import React, { useState, useEffect } from 'react';
import api from '../../api/axios';

const SettingsPage = () => {
    const [users, setUsers] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [stations, setStations] = useState([]);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const { data } = await api.get('/users');
            setUsers(data);
            // Extract unique departments and stations
            setDepartments(Array.from(new Set(data.map(u => u.department).filter(Boolean))).sort());
            setStations(Array.from(new Set(data.map(u => u.station).filter(Boolean))).sort());
        } catch (err) {
            console.error('Failed to fetch users', err);
        }
    };

    const addDepartment = (name) => {
        if (!name) return;
        setDepartments(prev => Array.from(new Set([name, ...prev])).sort());
    };

    const removeDepartment = (name) => {
        if (window.confirm(`Remove department "${name}"? This won't delete users, but they'll need to be reassigned.`)) {
            setDepartments(prev => prev.filter(d => d !== name));
        }
    };

    const addStation = (name) => {
        if (!name) return;
        setStations(prev => Array.from(new Set([name, ...prev])).sort());
    };

    const removeStation = (name) => {
        if (window.confirm(`Remove station "${name}"? This won't delete users, but they'll need to be reassigned.`)) {
            setStations(prev => prev.filter(s => s !== name));
        }
    };

    return (
        <div className="container">
            <div className="page-header">
                <h1>Settings</h1>
                <p className="text-muted">Manage departments and stations</p>
            </div>

            <div className="grid-2">
                {/* Departments Section */}
                <div className="card">
                    <div className="card-header">
                        <h2>Departments</h2>
                    </div>
                    <div style={{ padding: '16px' }}>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const name = e.target.departmentName.value.trim();
                            addDepartment(name);
                            e.target.departmentName.value = '';
                        }}>
                            <div className="form-group">
                                <label htmlFor="departmentName" className="form-label">
                                    Add New Department
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g., Finance, IT, HR"
                                    id="departmentName"
                                    name="departmentName"
                                    required
                                    style={{ width: '100%' }}
                                />
                            </div>
                            <button type="submit" className="btn btn-cerulean">
                                Add Department
                            </button>
                        </form>

                        <div style={{ marginTop: '24px' }}>
                            <h3 style={{ fontSize: '1rem', marginBottom: '12px', color: 'var(--muted)' }}>
                                Current Departments ({departments.length})
                            </h3>
                            {departments.length === 0 ? (
                                <div className="text-muted" style={{ padding: '20px', textAlign: 'center', background: '#f9fafb', borderRadius: '8px' }}>
                                    No departments yet. Add one above.
                                </div>
                            ) : (
                                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                    {departments.map(d => (
                                        <li key={d} style={{
                                            padding: '12px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            borderBottom: '1px solid #f0f2f7'
                                        }}>
                                            <span style={{ fontWeight: '500' }}>{d}</span>
                                            <button
                                                className="btn btn-outline btn-sm"
                                                onClick={() => removeDepartment(d)}
                                            >
                                                Remove
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>

                {/* Stations Section */}
                <div className="card">
                    <div className="card-header">
                        <h2>Stations</h2>
                    </div>
                    <div style={{ padding: '16px' }}>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const name = e.target.stationName.value.trim();
                            addStation(name);
                            e.target.stationName.value = '';
                        }}>
                            <div className="form-group">
                                <label htmlFor="stationName" className="form-label">
                                    Add New Station
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g., Main Office, Branch A"
                                    id="stationName"
                                    name="stationName"
                                    required
                                    style={{ width: '100%' }}
                                />
                            </div>
                            <button type="submit" className="btn btn-cerulean">
                                Add Station
                            </button>
                        </form>

                        <div style={{ marginTop: '24px' }}>
                            <h3 style={{ fontSize: '1rem', marginBottom: '12px', color: 'var(--muted)' }}>
                                Current Stations ({stations.length})
                            </h3>
                            {stations.length === 0 ? (
                                <div className="text-muted" style={{ padding: '20px', textAlign: 'center', background: '#f9fafb', borderRadius: '8px' }}>
                                    No stations yet. Add one above.
                                </div>
                            ) : (
                                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                    {stations.map(s => (
                                        <li key={s} style={{
                                            padding: '12px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            borderBottom: '1px solid #f0f2f7'
                                        }}>
                                            <span style={{ fontWeight: '500' }}>{s}</span>
                                            <button
                                                className="btn btn-outline btn-sm"
                                                onClick={() => removeStation(s)}
                                            >
                                                Remove
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="card" style={{ marginTop: '24px' }}>
                <div className="card-header">
                    <h2>Information</h2>
                </div>
                <div style={{ padding: '16px' }}>
                    <p className="text-muted" style={{ margin: 0 }}>
                        <strong>Note:</strong> Departments and stations are automatically extracted from your user data.
                        Adding new ones here will make them available in the user creation/edit forms.
                        Removing them won't delete users, but you may need to reassign affected users to new departments or stations.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;
