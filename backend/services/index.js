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
async function checkExtensions() {
    try {
        const [exts] = await db.query('SELECT id, ip_address, extension_number FROM extensions');
        if (exts.length === 0) return;
        const yStatuses = await yeastar.getAllStatuses();
        for (const e of exts) {
            const pRes = await ping.promise.probe(e.ip_address, { timeout: 3 });
            let sipPortOpen = null, sipStatus = 'Unknown';
            if (pRes.alive) {
                sipPortOpen = await new Promise(r => {
                    const s = new net.Socket(); s.setTimeout(2000);
                    s.on('connect', () => { s.destroy(); r(true); }).on('timeout', () => { s.destroy(); r(false); }).on('error', () => { s.destroy(); r(false); }).connect(SIP_PORT, e.ip_address);
                });
                if (yStatuses.has(String(e.extension_number))) sipStatus = yStatuses.get(String(e.extension_number)).sipStatus;
                else sipStatus = sipPortOpen ? 'Registered' : 'Unregistered';
            }
            const now = new Date();
            await db.query('UPDATE extensions SET status = ?, last_seen = ?, sip_port_open = ?, sip_status = ?, sip_last_checked = ? WHERE id = ?',
                [pRes.alive ? 'Online' : 'Offline', pRes.alive ? now : null, sipPortOpen, sipStatus, now, e.id]);
            await db.query('INSERT INTO ping_logs (extension_id, ping_time, result) VALUES (?, ?, ?)', [e.id, now, pRes.alive ? 'Success' : 'Failed']);
        }
    } catch (err) { console.error('[Monitoring] Error:', err.message); }
}

// --- STARTUP ---
function startServices() {
    console.log('[Services] Starting background tasks...');
    runDirectoryCleanup().catch(e => console.error('Initial cleanup failed', e));
    checkExtensions();
    setInterval(checkExtensions, PING_INTERVAL);
    setInterval(runDirectoryCleanup, 12 * 60 * 60 * 1000);
}

module.exports = { startServices, runDirectoryCleanup };
