const express = require('express');
const router = express.Router();
const db = require('../config/db');
const PDFDocument = require('pdfkit');
const xlsx = require('xlsx');

// @route   GET api/reports/daily
// @desc    Generate a daily report of offline extensions
// @access  Private
router.get('/daily', async (req, res) => {
    const { format = 'json', date } = req.query;

    if (!date) {
        return res.status(400).json({ msg: 'Date parameter is required' });
    }

    try {
        // Get data for the specified day
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const [logs] = await db.query(
            `SELECT 
                e.extension_number,
                e.ip_address,
                u.name_surname,
                u.department,
                u.station,
                pl.ping_time,
                pl.result
            FROM ping_logs pl
            JOIN extensions e ON pl.extension_id = e.id
            JOIN users u ON e.user_id = u.id
            WHERE pl.ping_time >= ? AND pl.ping_time <= ? AND pl.result = 'Failed'
            ORDER BY pl.ping_time DESC`,
            [startOfDay, endOfDay]
        );

        if (format === 'pdf') {
            generatePDF(res, logs, `Daily Downtime Report - ${date}`, `daily_report_${date}.pdf`);
        } else if (format === 'excel') {
            generateExcel(res, logs, `daily_report_${date}.xlsx`);
        } else {
            res.json(logs);
        }

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET api/reports/range
// @desc    Generate a report for a date range
// @access  Private
router.get('/range', async (req, res) => {
    const { format = 'json', startDate, endDate } = req.query;

    if (!startDate || !endDate) {
        return res.status(400).json({ msg: 'Start date and end date are required' });
    }

    try {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);

        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        const [logs] = await db.query(
            `SELECT 
                e.extension_number,
                e.ip_address,
                u.name_surname,
                u.department,
                u.station,
                pl.ping_time,
                pl.result
            FROM ping_logs pl
            JOIN extensions e ON pl.extension_id = e.id
            JOIN users u ON e.user_id = u.id
            WHERE pl.ping_time >= ? AND pl.ping_time <= ? AND pl.result = 'Failed'
            ORDER BY pl.ping_time DESC`,
            [start, end]
        );

        if (format === 'pdf') {
            generatePDF(res, logs, `Downtime Report - ${startDate} to ${endDate}`, `report_${startDate}_to_${endDate}.pdf`);
        } else if (format === 'excel') {
            generateExcel(res, logs, `report_${startDate}_to_${endDate}.xlsx`);
        } else {
            res.json(logs);
        }

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Helper function to generate PDF
function generatePDF(res, logs, title, filename) {
    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    doc.pipe(res);

    // Add header
    doc.fontSize(20).text(title, { align: 'center' });
    doc.fontSize(10).text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
    doc.moveDown(2);

    // Table headers
    const tableTop = doc.y;
    const itemX = 50;
    const extensionX = 120;
    const userX = 220;
    const timeX = 400;

    doc.fontSize(10).text('Extension', itemX, tableTop, { bold: true, width: 70 });
    doc.text('User', userX, tableTop, { bold: true, width: 180 });
    doc.text('Time of Failure', timeX, tableTop, { bold: true, width: 150 });
    doc.y += 15;

    // Table rows
    logs.forEach(log => {
        doc.fontSize(9).text(log.extension_number, itemX, doc.y, { width: 70 });
        doc.text(`${log.name_surname} (${log.department || 'N/A'})`, userX, doc.y, { width: 180 });
        doc.text(new Date(log.ping_time).toLocaleString(), timeX, doc.y, { width: 150 });
        doc.y += 20;
    });

    doc.end();
}

// Helper function to generate Excel
function generateExcel(res, logs, filename) {
    const worksheetData = logs.map(log => ({
        'Extension': log.extension_number,
        'IP Address': log.ip_address,
        'User': log.name_surname,
        'Department': log.department || 'N/A',
        'Station': log.station || 'N/A',
        'Time of Failure': new Date(log.ping_time).toLocaleString(),
    }));

    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.json_to_sheet(worksheetData);
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Downtime');

    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(buffer);
}

module.exports = router;
