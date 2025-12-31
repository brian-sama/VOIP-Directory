import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';

const SettingsPage = () => {
    const { user } = useAuth();
    const [departments, setDepartments] = useState([]);
    const [sections, setSections] = useState([]);
    const [stations, setStations] = useState([]);
    const toast = useToast();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [dRes, sRes, uRes, stRes] = await Promise.all([
                api.get('/departments'),
                api.get('/sections'),
                api.get('/users'),
                api.get('/stations')
            ]);
            setDepartments(dRes.data);
            setSections(sRes.data);
            setStations(stRes.data);
        } catch (err) {
            console.error('Failed to fetch settings data', err);
            toast.error('Failed to load settings');
        }
    };

    const addDepartment = async (name) => {
        try {
            await api.post('/departments', { name });
            toast.success(`Department "${name}" added`);
            fetchData();
        } catch (err) {
            toast.error('Failed to add department');
        }
    };

    const removeDepartment = async (id, name) => {
        if (window.confirm(`Remove department "${name}"? This won't delete users.`)) {
            try {
                await api.delete(`/departments/${id}`);
                toast.success('Department removed');
                fetchData();
            } catch (err) {
                toast.error('Failed to remove department');
            }
        }
    };

    const addSection = async (name) => {
        try {
            await api.post('/sections', { name });
            toast.success(`Section "${name}" added`);
            fetchData();
        } catch (err) {
            toast.error('Failed to add section');
        }
    };

    const removeSection = async (id, name) => {
        if (window.confirm(`Remove section "${name}"? This won't delete users.`)) {
            try {
                await api.delete(`/sections/${id}`);
                toast.success('Section removed');
                fetchData();
            } catch (err) {
                toast.error('Failed to remove section');
            }
        }
    };

    const addStation = async (name) => {
        try {
            await api.post('/stations', { name });
            toast.success(`Station "${name}" added`);
            fetchData();
        } catch (err) {
            toast.error('Failed to add station');
        }
    };

    const removeStation = async (id, name) => {
        if (window.confirm(`Remove station "${name}"? This won't delete users.`)) {
            try {
                await api.delete(`/stations/${id}`);
                toast.success('Station removed');
                fetchData();
            } catch (err) {
                toast.error('Failed to remove station');
            }
        }
    };

    return (
        <div className="container">
            <div className="page-header">
                <h1>Settings</h1>
                <p className="text-muted">Manage system departments and sections</p>
            </div>

            {user?.role === 'admin' ? (
                <div className="grid-3">
                    {/* Departments */}
                    <div className="card">
                        <div className="card-header">
                            <h2>Departments</h2>
                        </div>
                        <div style={{ padding: '16px' }}>
                            <form onSubmit={(e) => {
                                e.preventDefault();
                                const name = e.target.deptName.value.trim();
                                if (name) {
                                    addDepartment(name);
                                    e.target.deptName.value = '';
                                }
                            }}>
                                <div className="form-group">
                                    <label className="form-label">New Department</label>
                                    <input type="text" name="deptName" className="form-control" placeholder="e.g., HR, Finance" required />
                                </div>
                                <button type="submit" className="btn btn-cerulean mt-2">Add</button>
                            </form>
                            <div className="mt-4">
                                <h3 className="h6 text-muted">Current Departments</h3>
                                <ul className="list-group">
                                    {departments.map(d => (
                                        <li key={d.id} className="list-group-item d-flex justify-between align-center">
                                            <span>{d.name}</span>
                                            <button className="btn btn-outline btn-sm" onClick={() => removeDepartment(d.id, d.name)}>Remove</button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Sections */}
                    <div className="card">
                        <div className="card-header">
                            <h2>Sections</h2>
                        </div>
                        <div style={{ padding: '16px' }}>
                            <form onSubmit={(e) => {
                                e.preventDefault();
                                const name = e.target.secName.value.trim();
                                if (name) {
                                    addSection(name);
                                    e.target.secName.value = '';
                                }
                            }}>
                                <div className="form-group">
                                    <label className="form-label">New Section</label>
                                    <input type="text" name="secName" className="form-control" placeholder="e.g., IT Support" required />
                                </div>
                                <button type="submit" className="btn btn-cerulean mt-2">Add</button>
                            </form>
                            <div className="mt-4">
                                <h3 className="h6 text-muted">Current Sections</h3>
                                <ul className="list-group">
                                    {sections.map(s => (
                                        <li key={s.id} className="list-group-item d-flex justify-between align-center">
                                            <span>{s.name}</span>
                                            <button className="btn btn-outline btn-sm" onClick={() => removeSection(s.id, s.name)}>Remove</button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Stations */}
                    <div className="card">
                        <div className="card-header">
                            <h2>Stations</h2>
                        </div>
                        <div style={{ padding: '16px' }}>
                            <form onSubmit={(e) => {
                                e.preventDefault();
                                const name = e.target.stName.value.trim();
                                if (name) {
                                    addStation(name);
                                    e.target.stName.value = '';
                                }
                            }}>
                                <div className="form-group">
                                    <label className="form-label">New Station</label>
                                    <input type="text" name="stName" className="form-control" placeholder="e.g., Station A" required />
                                </div>
                                <button type="submit" className="btn btn-cerulean mt-2">Add</button>
                            </form>
                            <div className="mt-4">
                                <h3 className="h6 text-muted">Current Stations</h3>
                                <ul className="list-group">
                                    {stations.map(s => (
                                        <li key={s.id} className="list-group-item d-flex justify-between align-center">
                                            <span>{s.name}</span>
                                            <button className="btn btn-outline btn-sm" onClick={() => removeStation(s.id, s.name)}>Remove</button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="card">
                    <div className="card-header">
                        <h2>My Profile Settings</h2>
                    </div>
                    <div style={{ padding: '20px' }}>
                        <p><strong>Name:</strong> {user?.user?.username || user?.username}</p>
                        <p><strong>Department:</strong> {user?.user?.department || 'N/A'}</p>
                        <p><strong>Section:</strong> {user?.user?.section || 'N/A'}</p>
                        <p><strong>Role:</strong> {user?.role}</p>
                        <hr />
                        <p className="text-muted">You have limited access to system settings. Please contact an administrator for changes to departments or stations.</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SettingsPage;
