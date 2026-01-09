const db = require('../config/db');

/**
 * Automatically cleanup duplicate users and trim names
 */
async function runDirectoryCleanup() {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        console.log('[Cleanup Service] Starting directory cleanup...');

        // 1. Trim all name_surname values first to find hidden duplicates
        await connection.query('UPDATE users SET name_surname = TRIM(name_surname)');

        // 2. Find duplicates
        const [duplicates] = await connection.query(`
            SELECT name_surname, COUNT(*) as count 
            FROM users 
            GROUP BY name_surname 
            HAVING count > 1
        `);

        let removedCount = 0;
        let mergedExtensions = 0;

        for (const dup of duplicates) {
            const [users] = await connection.query(
                'SELECT id FROM users WHERE name_surname = ? ORDER BY id ASC',
                [dup.name_surname]
            );

            const keepId = users[0].id;
            const deleteIds = users.slice(1).map(u => u.id);

            for (const deleteId of deleteIds) {
                // Move extensions to keepId
                const [result] = await connection.query(
                    'UPDATE IGNORE extensions SET user_id = ? WHERE user_id = ?',
                    [keepId, deleteId]
                );

                if (result.affectedRows > 0) mergedExtensions++;

                // Delete any extensions that couldn't be moved (due to unique constraints if any)
                // Actually, extension_number is unique, so UPDATE IGNORE will skip if keepId already has that extension
                // But we should probably delete the orphaned extensions too? 

                await connection.query('DELETE FROM users WHERE id = ?', [deleteId]);
                removedCount++;
            }
        }

        await connection.commit();
        if (removedCount > 0) {
            console.log(`[Cleanup Service] Cleanup successful. Removed ${removedCount} duplicate users and merged ${mergedExtensions} extensions.`);
        } else {
            console.log('[Cleanup Service] No duplicates found.');
        }

        return { removedCount, mergedExtensions };
    } catch (err) {
        await connection.rollback();
        console.error('[Cleanup Service] Cleanup error:', err);
        throw err;
    } finally {
        connection.release();
    }
}

/**
 * Start periodic cleanup
 */
function startCleanupTask() {
    // Run once on startup
    runDirectoryCleanup().catch(err => console.error('Initial cleanup failed', err));

    // Then run every 12 hours
    setInterval(() => {
        runDirectoryCleanup().catch(err => console.error('Periodic cleanup failed', err));
    }, 12 * 60 * 60 * 1000);
}

module.exports = { runDirectoryCleanup, startCleanupTask };
