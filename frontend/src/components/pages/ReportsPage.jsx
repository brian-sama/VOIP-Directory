import React, { useState } from 'react';
import axios from 'axios';

const ReportsPage = () => {
    const [loading, setLoading] = useState(null);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [dateRange, setDateRange] = useState({
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    });

    const downloadReport = async (format, reportType) => {
        setLoading(`${reportType}-${format}`);
        try {
            let url = '';
            let filename = '';

            if (reportType === 'daily') {
                url = `/api/reports/daily?date=${selectedDate}&format=${format}`;
                filename = format === 'pdf'
                    ? `daily_report_${selectedDate}.pdf`
                    : `daily_report_${selectedDate}.xlsx`;
            } else if (reportType === 'range') {
                url = `/api/reports/range?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}&format=${format}`;
                filename = format === 'pdf'
                    ? `report_${dateRange.startDate}_to_${dateRange.endDate}.pdf`
                    : `report_${dateRange.startDate}_to_${dateRange.endDate}.xlsx`;
            }

            const response = await axios.get(url, {
                responseType: 'blob',
            });

            const downloadUrl = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute('download', filename);

            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);

        } catch (error) {
            console.error(`Failed to download ${format} report`, error);
            alert(`Could not download the ${format} report. See console for details.`);
        } finally {
            setLoading(null);
        }
    };

    return (
        <div className="container">
            <div className="page-header">
                <h1>Download Reports</h1>
                <p className="text-muted">Generate and download downtime reports for offline extensions</p>
            </div>

            {/* Daily Report */}
            <div className="card" style={{ marginBottom: '24px' }}>
                <div className="card-header">
                    <h2>Daily Report</h2>
                </div>
                <div style={{ padding: '24px' }}>
                    <p className="text-muted">Generate a report for a specific day showing all offline extensions.</p>

                    <div style={{ marginBottom: '20px' }}>
                        <label htmlFor="dailyDate" style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                            Select Date:
                        </label>
                        <input
                            type="date"
                            id="dailyDate"
                            value={selectedDate}
                            max={new Date().toISOString().split('T')[0]}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            style={{
                                padding: '10px',
                                borderRadius: '6px',
                                border: '1px solid #E2E8F0',
                                fontSize: '0.875rem',
                                width: '100%',
                                maxWidth: '300px'
                            }}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <button
                            className="btn btn-danger"
                            onClick={() => downloadReport('pdf', 'daily')}
                            disabled={loading === 'daily-pdf'}
                        >
                            {loading === 'daily-pdf' ? (
                                <>
                                    <div className="spinner" style={{ width: '16px', height: '16px' }} />
                                    Downloading...
                                </>
                            ) : (
                                'Download PDF'
                            )}
                        </button>
                        <button
                            className="btn btn-success"
                            onClick={() => downloadReport('excel', 'daily')}
                            disabled={loading === 'daily-excel'}
                        >
                            {loading === 'daily-excel' ? (
                                <>
                                    <div className="spinner" style={{ width: '16px', height: '16px' }} />
                                    Downloading...
                                </>
                            ) : (
                                'Download Excel'
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Date Range Report */}
            <div className="card">
                <div className="card-header">
                    <h2>Date Range Report</h2>
                </div>
                <div style={{ padding: '24px' }}>
                    <p className="text-muted">Generate a report for a custom date range.</p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                        <div>
                            <label htmlFor="startDate" style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                                Start Date:
                            </label>
                            <input
                                type="date"
                                id="startDate"
                                value={dateRange.startDate}
                                max={dateRange.endDate}
                                onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                                style={{
                                    padding: '10px',
                                    borderRadius: '6px',
                                    border: '1px solid #E2E8F0',
                                    fontSize: '0.875rem',
                                    width: '100%'
                                }}
                            />
                        </div>
                        <div>
                            <label htmlFor="endDate" style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                                End Date:
                            </label>
                            <input
                                type="date"
                                id="endDate"
                                value={dateRange.endDate}
                                min={dateRange.startDate}
                                max={new Date().toISOString().split('T')[0]}
                                onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                                style={{
                                    padding: '10px',
                                    borderRadius: '6px',
                                    border: '1px solid #E2E8F0',
                                    fontSize: '0.875rem',
                                    width: '100%'
                                }}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <button
                            className="btn btn-danger"
                            onClick={() => downloadReport('pdf', 'range')}
                            disabled={loading === 'range-pdf'}
                        >
                            {loading === 'range-pdf' ? (
                                <>
                                    <div className="spinner" style={{ width: '16px', height: '16px' }} />
                                    Downloading...
                                </>
                            ) : (
                                'Download PDF'
                            )}
                        </button>
                        <button
                            className="btn btn-success"
                            onClick={() => downloadReport('excel', 'range')}
                            disabled={loading === 'range-excel'}
                        >
                            {loading === 'range-excel' ? (
                                <>
                                    <div className="spinner" style={{ width: '16px', height: '16px' }} />
                                    Downloading...
                                </>
                            ) : (
                                'Download Excel'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReportsPage;
