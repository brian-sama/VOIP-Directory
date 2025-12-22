const db = require('../config/db');
const ping = require('ping');
const net = require('net');
const yeastarService = require('./yeastarService');

// Configuration via environment variables
const PING_INTERVAL_MS = parseInt(process.env.PING_INTERVAL_MS, 10) || 5000; // default 5 seconds
const PING_TIMEOUT_SEC = parseInt(process.env.PING_TIMEOUT_SEC, 10) || 3; // default 3 seconds
const SIP_PORT = parseInt(process.env.SIP_PORT, 10) || 5060;
const SIP_TIMEOUT_MS = parseInt(process.env.SIP_TIMEOUT_MS, 10) || 2000;

// Guard to avoid overlapping runs
let isRunning = false;

/**
 * Check if a TCP port is open on the given IP address
 * Used to verify SIP port (5060) availability
 */
async function checkSipPort(ip, port = SIP_PORT, timeout = SIP_TIMEOUT_MS) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(timeout);

        socket.on('connect', () => {
            socket.destroy();
            resolve(true);
        });

        socket.on('timeout', () => {
            socket.destroy();
            resolve(false);
        });

        socket.on('error', () => {
            socket.destroy();
            resolve(false);
        });

        socket.connect(port, ip);
    });
}

/**
 * Update extension status in database including SIP status
 */
async function updateExtensionStatus(extensionId, status, logResult, sipPortOpen, sipStatus) {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const now = new Date();
        const lastSeen = status === 'Online' ? now : null;

        // Update main status and SIP status
        await connection.query(
            `UPDATE extensions SET 
                status = ?, 
                last_seen = ?,
                sip_port_open = ?,
                sip_status = ?,
                sip_last_checked = ?
            WHERE id = ?`,
            [status, lastSeen, sipPortOpen, sipStatus, now, extensionId]
        );

        // Log the ping result
        await connection.query(
            'INSERT INTO ping_logs (extension_id, ping_time, result) VALUES (?, ?, ?)',
            [extensionId, now, logResult]
        );

        await connection.commit();
    } catch (err) {
        await connection.rollback();
        console.error(`[Monitoring Service] Error updating extension ${extensionId}:`, err);
    } finally {
        connection.release();
    }
}

/**
 * Main monitoring cycle - checks all extensions
 */
async function checkExtensions() {
    if (isRunning) {
        console.log('[Monitoring Service] Previous check still running; skipping this cycle.');
        return;
    }

    isRunning = true;
    try {
        const [extensions] = await db.query('SELECT id, ip_address, extension_number FROM extensions');

        if (extensions.length === 0) {
            console.log('[Monitoring Service] No extensions to monitor.');
            return;
        }

        console.log(`[Monitoring Service] Checking ${extensions.length} extensions...`);

        // Fetch Yeastar registration status (if configured)
        const yeastarStatuses = await yeastarService.getAllExtensionStatuses();
        const hasYeastar = yeastarStatuses.size > 0;

        for (const ext of extensions) {
            // 1. ICMP Ping check (network reachability)
            const pingResult = await ping.promise.probe(ext.ip_address, {
                timeout: PING_TIMEOUT_SEC,
            });
            const isOnline = pingResult.alive;

            // 2. SIP Port check (port 5060 open)
            let sipPortOpen = null;
            if (isOnline) {
                sipPortOpen = await checkSipPort(ext.ip_address);
            }

            // 3. Determine SIP registration status
            let sipStatus = 'Unknown';

            if (hasYeastar && ext.extension_number) {
                // Use Yeastar API data if available
                const yeastarData = yeastarStatuses.get(String(ext.extension_number));
                if (yeastarData) {
                    sipStatus = yeastarData.sipStatus;
                }
            } else if (sipPortOpen !== null) {
                // Infer from SIP port check
                if (sipPortOpen) {
                    sipStatus = 'Registered'; // Port open suggests SIP is responding
                } else if (isOnline) {
                    sipStatus = 'Unregistered'; // Online but SIP port closed
                }
            }

            // 4. Update database
            const status = isOnline ? 'Online' : 'Offline';
            const logResult = isOnline ? 'Success' : 'Failed';

            await updateExtensionStatus(ext.id, status, logResult, sipPortOpen, sipStatus);
        }

        console.log(`[Monitoring Service] Check complete. Yeastar: ${hasYeastar ? 'Connected' : 'Not configured'}`);
    } catch (err) {
        console.error('[Monitoring Service] Error during check cycle:', err);
    } finally {
        isRunning = false;
    }
}

/**
 * Start the monitoring service
 */
function startMonitoring() {
    console.log('[Monitoring Service] Starting continuous monitoring...');
    console.log(`[Monitoring Service] Ping interval: ${PING_INTERVAL_MS}ms, SIP port: ${SIP_PORT}`);

    // Run immediately on start
    checkExtensions();

    // Then run on interval
    const intervalId = setInterval(checkExtensions, PING_INTERVAL_MS);

    // Graceful shutdown
    const shutdown = () => {
        console.log('[Monitoring Service] Shutting down...');
        clearInterval(intervalId);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

module.exports = { startMonitoring };
