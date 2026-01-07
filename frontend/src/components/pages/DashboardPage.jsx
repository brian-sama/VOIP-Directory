import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { useToast } from '../../context/ToastContext';
import Pagination from '../shared/Pagination';
import { useAuth } from '../../context/AuthContext';

// Utility function for relative time
const getRelativeTime = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
};

// Simple Pie Chart component using CSS conic-gradient
const PieChart = ({ online, offline }) => {
    const total = online + offline;
    const onlinePercent = total > 0 ? (online / total) * 100 : 0;
    const offlinePercent = total > 0 ? (offline / total) * 100 : 0;

    return (
        <div className="chart-container">
            <div
                className="pie-chart"
                style={{
                    background: total > 0
                        ? `conic-gradient(#38ef7d 0% ${onlinePercent}%, #f45c43 ${onlinePercent}% 100%)`
                        : '#e0e0e0'
                }}
            />
            <div className="chart-legend">
                <div className="legend-item">
                    <span className="legend-dot online"></span>
                    <span>Online: {online} ({onlinePercent.toFixed(1)}%)</span>
                </div>
                <div className="legend-item">
                    <span className="legend-dot offline"></span>
                    <span>Offline: {offline} ({offlinePercent.toFixed(1)}%)</span>
                </div>
            </div>
        </div>
    );
};

// Loading Skeleton component
const LoadingSkeleton = ({ rows = 5, cols = 11 }) => (
    <>
        {[...Array(rows)].map((_, i) => (
            <tr key={i}>
                <td colSpan={cols}>
                    <div className="skeleton-row">
                        {[...Array(cols)].map((_, j) => (
                            <div key={j} className="skeleton skeleton-cell"></div>
                        ))}
                    </div>
                </td>
            </tr>
        ))}
    </>
);

// Helper to get SIP status class
const getSipStatusClass = (sipStatus) => {
    switch (sipStatus) {
        case 'Registered': return 'sip-registered';
        case 'Unregistered': return 'sip-unregistered';
        default: return 'sip-unknown';
    }
};

const DashboardPage = () => {
    const [extensions, setExtensions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [sipFilter, setSipFilter] = useState('all');
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const toast = useToast();
    const { user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (user && user.role !== 'admin') {
            navigate('/directory');
        }
    }, [user, navigate]);

    const fetchExtensions = useCallback(async () => {
        try {
            const { data } = await api.get('/users');
            setExtensions(data);
            setError('');
        } catch (err) {
            setError('Failed to fetch extensions. Is the backend running?');
            toast.error('Failed to fetch data from server');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchExtensions();
        const interval = setInterval(fetchExtensions, 5000);
        return () => clearInterval(interval);
    }, [fetchExtensions]);

    // Sorting logic
    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const getSortClass = (key) => {
        if (sortConfig.key !== key) return 'sortable';
        return `sortable ${sortConfig.direction}`;
    };

    // Filtered and sorted data
    const processedData = useMemo(() => {
        let data = [...extensions];

        // Search filter
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            data = data.filter(ext => (
                String(ext.ip_address || '').toLowerCase().includes(q) ||
                String(ext.name_surname || '').toLowerCase().includes(q) ||
                String(ext.extension_number || '').toLowerCase().includes(q) ||
                String(ext.department || '').toLowerCase().includes(q) ||
                String(ext.station || '').toLowerCase().includes(q) ||
                String(ext.section || '').toLowerCase().includes(q)
            ));
        }

        // Network status filter
        if (statusFilter !== 'all') {
            data = data.filter(ext => (ext.status || 'Offline') === statusFilter);
        }

        // SIP status filter
        if (sipFilter !== 'all') {
            data = data.filter(ext => (ext.sip_status || 'Unknown') === sipFilter);
        }

        // Sort
        if (sortConfig.key) {
            data.sort((a, b) => {
                const aVal = String(a[sortConfig.key] || '').toLowerCase();
                const bVal = String(b[sortConfig.key] || '').toLowerCase();
                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return data;
    }, [extensions, searchQuery, statusFilter, sipFilter, sortConfig]);

    // Stats
    const onlineCount = extensions.filter(ext => ext.status === 'Online').length;
    const offlineCount = extensions.length - onlineCount;
    const sipRegisteredCount = extensions.filter(ext => ext.sip_status === 'Registered').length;
    const sipUnregisteredCount = extensions.filter(ext => ext.sip_status === 'Unregistered').length;

    // Export to CSV (matching import template format)
    const exportToCSV = () => {
        // Headers match the import template exactly
        const headers = ['Name', 'Surname', 'Department', 'Section', 'Office Number', 'Designation', 'Station', 'Extension', 'IP Address', 'Model', 'Mac Address'];
        const rows = processedData.map(ext => {
            // Split name_surname into Name and Surname
            const fullName = ext.name_surname || '';
            const nameParts = fullName.trim().split(/\s+/);
            const firstName = nameParts[0] || '';
            const surname = nameParts.slice(1).join(' ') || '';
            
            return [
                firstName,
                surname,
                ext.department || '',
                ext.section || '',
                ext.office_number || '',
                ext.designation || '',
                ext.station || '',
                ext.extension_number || '',
                ext.ip_address || '',
                ext.phone_model || '',
                ext.mac_address || ''
            ];
        });

        const csvContent = [headers, ...rows]
            .map(row => row.map(cell => `"${cell}"`).join(','))
            .join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `voip_users_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);

        toast.success('CSV exported successfully!');
    };


    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(15);

    // Reset page on filter change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, statusFilter, sipFilter, sortConfig]);

    // Calculate pagination slice
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = processedData.slice(indexOfFirstItem, indexOfLastItem);

    return (
        <div className="container">
            <div className="page-header">
                <h1>Phone Dashboard</h1>
                <p className="text-muted">Real-time monitoring of all VOIP IP phones in the system</p>
            </div>

            {/* Filters and Actions */}
            <div className="search-bar flex gap-1 align-center">
                <input
                    type="text"
                    id="filterInput"
                    placeholder="Search by IP, user, extension, department, or station..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                <div className="flex gap-1 align-center">
                    <select
                        id="statusFilter"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #e6eef8' }}
                    >
                        <option value="all">Network: All ({extensions.length})</option>
                        <option value="Online">Online ({onlineCount})</option>
                        <option value="Offline">Offline ({offlineCount})</option>
                    </select>
                    <select
                        id="sipFilter"
                        value={sipFilter}
                        onChange={(e) => setSipFilter(e.target.value)}
                        style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #e6eef8' }}
                    >
                        <option value="all">SIP: All</option>
                        <option value="Registered">Registered ({sipRegisteredCount})</option>
                        <option value="Unregistered">Unregistered ({sipUnregisteredCount})</option>
                        <option value="Unknown">Unknown</option>
                    </select>
                    <button className="btn btn-export btn-sm" onClick={exportToCSV}>
                        Export CSV
                    </button>
                    <button className="btn btn-cerulean btn-sm" onClick={fetchExtensions}>
                        Refresh
                    </button>
                    <span className="status-badge status-online" id="connectionStatus">
                        <span className="status-dot"></span>
                        Live
                    </span>
                </div>
            </div>

            {/* Data Table */}
            <div className="card">
                <div className="card-header flex justify-between align-center">
                    <h2 className="card-title">Users & IP Phones</h2>
                    <span className="text-muted">{processedData.length} results</span>
                </div>

                <div className="table-container">
                    <table id="consolidatedTable">
                        <thead>
                            <tr>
                                <th className={getSortClass('status')} onClick={() => handleSort('status')}>Network</th>
                                <th className={getSortClass('sip_status')} onClick={() => handleSort('sip_status')}>SIP Status</th>
                                <th className={getSortClass('ip_address')} onClick={() => handleSort('ip_address')}>IP Address</th>
                                <th className={getSortClass('name_surname')} onClick={() => handleSort('name_surname')}>User Name</th>
                                <th className={getSortClass('extension_number')} onClick={() => handleSort('extension_number')}>Extension</th>
                                <th className={getSortClass('department')} onClick={() => handleSort('department')}>Department</th>
                                <th className={getSortClass('section')} onClick={() => handleSort('section')}>Section</th>
                                <th className={getSortClass('station')} onClick={() => handleSort('station')}>Station</th>
                                <th className={getSortClass('phone_model')} onClick={() => handleSort('phone_model')}>Model</th>
                                <th className={getSortClass('designation')} onClick={() => handleSort('designation')}>Designation</th>
                                <th className={getSortClass('office_number')} onClick={() => handleSort('office_number')}>Office #</th>
                                <th className={getSortClass('last_seen')} onClick={() => handleSort('last_seen')}>Last Seen</th>
                            </tr>
                        </thead>
                        <tbody id="consolidatedTableBody">
                            {loading ? (
                                <LoadingSkeleton rows={5} cols={11} />
                            ) : error ? (
                                <tr>
                                    <td colSpan={11} className="text-center text-danger">{error}</td>
                                </tr>
                            ) : processedData.length === 0 ? (
                                <tr>
                                    <td colSpan={11} className="text-center">No data available</td>
                                </tr>
                            ) : (
                                currentItems.map(ext => (
                                    <tr key={ext.id}>
                                        <td>
                                            <span className={`status-pill ${(ext.status === 'Online') ? 'status-online' : 'status-offline'}`}>
                                                {ext.status || 'Offline'}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`status-pill ${getSipStatusClass(ext.sip_status)}`}>
                                                {ext.sip_status || 'Unknown'}
                                            </span>
                                        </td>
                                        <td>{ext.ip_address}</td>
                                        <td>{ext.name_surname}</td>
                                        <td>{ext.extension_number}</td>
                                        <td>{ext.department}</td>
                                        <td>{ext.section || '-'}</td>
                                        <td>{ext.station}</td>
                                        <td>{ext.phone_model || ''}</td>
                                        <td>{ext.designation || ''}</td>
                                        <td>{ext.office_number}</td>
                                        <td title={ext.last_seen || ''}>{getRelativeTime(ext.last_seen)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                    <Pagination
                        itemsPerPage={itemsPerPage}
                        totalItems={processedData.length}
                        paginate={(num) => setCurrentPage(num)}
                        currentPage={currentPage}
                    />
                </div>
            </div>
        </div>
    );
};

export default DashboardPage;
