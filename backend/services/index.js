const db = require('../config/db');
const ping = require('ping');
const net = require('net');
const axios = require('axios');

// --- CONFIG ---
const PING_INTERVAL = parseInt(process.env.PING_INTERVAL_MS, 10) || 5000;
const SIP_PORT = parseInt(process.env.SIP_PORT, 10) || 5060;

// --- YEASTAR SERVICE ---
class YeastarService {
    constructor() {
        this.baseUrl = process.env.YEASTAR_API_URL || '';
        this.username = process.env.YEASTAR_API_USERNAME || 'api';
        this.password = process.env.YEASTAR_API_PASSWORD || '';
        this.token = null;
        this.tokenExpiry = null;
    }
    async authenticate() {
        if (!this.baseUrl) return false;
        if (this.token && this.tokenExpiry && Date.now() < this.tokenExpiry - 60000) return true;
        try {
            const res = await axios.post(`${this.baseUrl}/api/v2.0.0/login`, { username: this.username, password: this.password }, { timeout: 5000 });
            if (res.data?.token) {
                this.token = res.data.token;
                this.tokenExpiry = Date.now() + (30 * 60 * 1000);
                return true;
            }
            return false;
        } catch (err) { return false; }
    }
    async getAllStatuses() {
        if (!this.baseUrl || !(await this.authenticate())) return new Map();
        try {
            const res = await axios.get(`${this.baseUrl}/api/v2.0.0/extension/list`, { headers: { 'Authorization': `Bearer ${this.token}` }, params: { page_size: 500 }, timeout: 10000 });
            const map = new Map();
            if (res.data?.data) {
                for (const e of res.data.data) {
                    map.set(String(e.number), { sipStatus: (e.status || '').toLowerCase() === 'registered' ? 'Registered' : 'Unregistered' });
                }
            }
            return map;
        } catch (err) { return new Map(); }
    }
}
const yeastar = new YeastarService();

// --- CLEANUP SERVICE ---
async function runDirectoryCleanup() {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        await conn.query('UPDATE users SET name_surname = TRIM(name_surname)');
        const [dups] = await conn.query('SELECT name_surname, COUNT(*) as count FROM users GROUP BY name_surname HAVING count > 1');
        let removed = 0, merged = 0;
        for (const d of dups) {
            const [users] = await conn.query('SELECT id FROM users WHERE name_surname = ? ORDER BY id ASC', [d.name_surname]);
            const keepId = users[0].id;
            for (const u of users.slice(1)) {
                const [res] = await conn.query('UPDATE IGNORE extensions SET user_id = ? WHERE user_id = ?', [keepId, u.id]);
                if (res.affectedRows > 0) merged++;
                await conn.query('DELETE FROM users WHERE id = ?', [u.id]);
                removed++;
            }
        }
        await conn.commit();
        return { removedCount: removed, mergedExtensions: merged };
    } catch (err) { await conn.rollback(); throw err; } finally { conn.release(); }
}

// --- MONITORING SERVICE ---
let isChecking = false;

async function checkExtensions() {
    if (isChecking) return;
    isChecking = true;

    const connection = await db.getConnection();
    try {
        const [exts] = await connection.query('SELECT id, ip_address, extension_number FROM extensions');
        if (exts.length === 0) return;

        // 1. Get Yeastar Statuses (Primary Source of Truth for SIP)
        const yStatuses = await yeastar.getAllStatuses();

        for (const e of exts) {
            const extNum = String(e.extension_number);
            let sipStatus = 'Unknown';
            let sipPortOpen = null;
            let isPingAlive = false;

            // 2. Check Ping (Secondary Source for Network Reachability)
            if (e.ip_address) {
                const pRes = await ping.promise.probe(e.ip_address, { timeout: 3 });
                isPingAlive = pRes.alive;
            }

            // 3. Determine SIP Status
            if (yStatuses.has(extNum)) {
                // Trust Yeastar if available
                sipStatus = yStatuses.get(extNum).sipStatus;
            } else if (isPingAlive) {
                // Fallback: If alive but not in Yeastar list (or Yeastar down), check port 5060
                sipPortOpen = await new Promise(r => {
                    const s = new net.Socket();
                    s.setTimeout(2000);
                    s.on('connect', () => { s.destroy(); r(true); })
                        .on('timeout', () => { s.destroy(); r(false); })
                        .on('error', () => { s.destroy(); r(false); })
                        .connect(SIP_PORT, e.ip_address);
                });
                sipStatus = sipPortOpen ? 'Registered' : 'Unregistered';
            } else {
                // If not in Yeastar and Ping failed, we can't determine much, assume Unregistered/Unknown
                sipStatus = 'Unregistered';
            }

            // 4. Determine Global Status (Online if Registered OR Pingable)
            // A device might block ping but be registered (Online)
            // A device might be pingable but not registered (Online but improperly configured?)
            const status = (sipStatus === 'Registered' || isPingAlive) ? 'Online' : 'Offline';

            const now = new Date();
            await connection.query(
                'UPDATE extensions SET status = ?, last_seen = ?, sip_port_open = ?, sip_status = ?, sip_last_checked = ? WHERE id = ?',
                [status, (status === 'Online' ? now : null), sipPortOpen, sipStatus, now, e.id]
            );

            await connection.query('INSERT IGNORE INTO ping_logs (extension_id, ping_time, result) VALUES (?, ?, ?)', [e.id, now, isPingAlive ? 'Success' : 'Failed']);
        }
    } catch (err) {
        console.error('[Monitoring] Error:', err.message);
    } finally {
        connection.release();
        isChecking = false;
    }
}

// --- LOG RETENTION ---
const PING_LOG_RETENTION_DAYS = parseInt(process.env.PING_LOG_RETENTION_DAYS, 10) || 30;
const ACTIVITY_LOG_RETENTION_DAYS = parseInt(process.env.ACTIVITY_LOG_RETENTION_DAYS, 10) || 90;

async function ensureIndexes() {
    try {
        await db.query(`
            ALTER TABLE ping_logs
            ADD INDEX IF NOT EXISTS idx_ping_logs_time (ping_time)
        `).catch(() => {}); // Silently skip if syntax unsupported (MySQL < 8.0.29)
        await db.query(`
            ALTER TABLE activity_logs
            ADD INDEX IF NOT EXISTS idx_activity_logs_created (created_at)
        `).catch(() => {});
        console.log('[Services] DB indexes verified.');
    } catch (err) {
        console.warn('[Services] Index check skipped:', err.message);
    }
}

async function purgeOldLogs() {
    try {
        // Delete in batches of 1000 to avoid long-held locks that conflict with the
        // monitoring service writing ping_logs every few seconds.
        let pingDeleted = 0;
        let pingRows;
        do {
            [pingRows] = await db.query(
                'DELETE FROM ping_logs WHERE ping_time < DATE_SUB(NOW(), INTERVAL ? DAY) LIMIT 1000',
                [PING_LOG_RETENTION_DAYS]
            );
            pingDeleted += pingRows.affectedRows;
        } while (pingRows.affectedRows === 1000);

        let activityDeleted = 0;
        let actRows;
        do {
            [actRows] = await db.query(
                'DELETE FROM activity_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY) LIMIT 1000',
                [ACTIVITY_LOG_RETENTION_DAYS]
            );
            activityDeleted += actRows.affectedRows;
        } while (actRows.affectedRows === 1000);

        if (pingDeleted + activityDeleted > 0)
            console.log(`[Retention] Purged ${pingDeleted} ping logs, ${activityDeleted} activity logs.`);
    } catch (err) {
        console.error('[Retention] Purge failed:', err.message);
    }
}

// --- STARTUP ---
function startServices() {
    console.log('[Services] Starting background tasks...');
    ensureIndexes();
    runDirectoryCleanup().catch(e => console.error('Initial cleanup failed', e));
    checkExtensions();
    setInterval(checkExtensions, PING_INTERVAL);
    setInterval(runDirectoryCleanup, 12 * 60 * 60 * 1000);
    // Run log retention daily at midnight-ish (24h interval after startup)
    setInterval(purgeOldLogs, 24 * 60 * 60 * 1000);
    purgeOldLogs(); // Run once at startup to clean up immediately if needed
}

module.exports = { startServices, runDirectoryCleanup };
