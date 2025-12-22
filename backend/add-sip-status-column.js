/**
 * Database Migration: Add SIP Status Columns
 * 
 * Run this script once to add SIP status tracking columns to the extensions table.
 * Usage: node add-sip-status-column.js
 */

const db = require('./config/db');

async function migrate() {
    console.log('[Migration] Adding SIP status columns to extensions table...');

    try {
        // Check if column already exists
        const [columns] = await db.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'extensions' 
            AND COLUMN_NAME = 'sip_status'
        `);

        if (columns.length > 0) {
            console.log('[Migration] Column sip_status already exists. Skipping.');
            process.exit(0);
        }

        // Add sip_status column
        await db.query(`
            ALTER TABLE extensions 
            ADD COLUMN sip_status ENUM('Registered', 'Unregistered', 'Unknown') DEFAULT 'Unknown',
            ADD COLUMN sip_port_open TINYINT(1) DEFAULT NULL,
            ADD COLUMN sip_last_checked DATETIME DEFAULT NULL
        `);

        console.log('[Migration] Successfully added columns: sip_status, sip_port_open, sip_last_checked');
        console.log('[Migration] Complete!');
        process.exit(0);
    } catch (err) {
        console.error('[Migration] Error:', err.message);
        process.exit(1);
    }
}

migrate();
