import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import UserEditModal from '../shared/UserEditModal';
import { useToast } from '../../context/ToastContext';

const AdminPage = () => {
    const [activeTab, setActiveTab] = useState('users');
    const toast = useToast();

    // Users
    const [users, setUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [usersError, setUsersError] = useState('');

    // Modal / edit state
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);

    const switchTab = (tab) => {
        setActiveTab(tab);
    };

    const logActivity = async (action, details) => {
        try {
            await api.post('/activity', { action, details, user_name: 'Admin' });
        } catch (err) {
            console.error('Failed to log activity', err);
        }
    };

    const fetchUsers = async () => {
        setLoadingUsers(true);
        setUsersError('');
        try {
            const { data } = await api.get('/users');
            setUsers(data);
        } catch (err) {
            console.error('Failed to fetch users', err);
            setUsersError('Failed to fetch users. Is the backend running?');
        } finally {
            setLoadingUsers(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleModalClose = () => {
        setShowModal(false);
        setEditingUser(null);
    };

    const handleModalShow = (user = null) => {
        setEditingUser(user);
        setShowModal(true);
    };

    const handleFormSubmit = async (formData) => {
        try {
            if (editingUser) {
                await api.put(`/users/${editingUser.id}`, formData);
                await logActivity('Updated user', `Updated ${formData.name_surname}`);
                toast.success(`User "${formData.name_surname}" updated successfully!`);
            } else {
                await api.post('/users', formData);
                await logActivity('Added new user', `Added ${formData.name_surname} (${formData.extension_number})`);
                toast.success(`User "${formData.name_surname}" added successfully!`);
            }
            await fetchUsers();
            handleModalClose();
        } catch (err) {
            console.error('Failed to save user', err);
            toast.error(err.response?.data?.msg || 'Failed to save user.');
        }
    };

    const handleDelete = async (userId) => {
        const user = users.find(u => u.id === userId);
        if (!window.confirm(`Are you sure you want to delete "${user?.name_surname}"?`)) return;
        try {
            await api.delete(`/users/${userId}`);
            await logActivity('Deleted user', `Deleted ${user?.name_surname}`);
            toast.success(`User "${user?.name_surname}" deleted successfully!`);
            await fetchUsers();
        } catch (err) {
            console.error('Failed to delete user', err);
            toast.error('Failed to delete user.');
        }
    };

    // Derived lists
    const [allUsers, setAllUsers] = useState([]);
    const [statusFilter, setStatusFilter] = useState('all');
    const phones = users.map(u => ({ ip: u.ip_address, extension: u.extension_number, user: u.name_surname, status: u.status, model: u.phone_model, mac: u.mac_address }));
    const filteredPhones = statusFilter === 'all' ? phones : phones.filter(p => p.status === statusFilter);
    const [departments, setDepartments] = useState([]);
    const [stations, setStations] = useState([]);

    useEffect(() => {
        // keep derived lists in sync when users change
        setAllUsers(users);
        setDepartments(Array.from(new Set(users.map(u => u.department).filter(Boolean))).sort());
        setStations(Array.from(new Set(users.map(u => u.station).filter(Boolean))).sort());
    }, [users]);

    const addDepartment = (name) => {
        if (!name) return;
        setDepartments(prev => Array.from(new Set([name, ...prev])));
    };

    const removeDepartment = (name) => {
        setDepartments(prev => prev.filter(d => d !== name));
    };

    const addStation = (name) => {
        if (!name) return;
        setStations(prev => Array.from(new Set([name, ...prev])));
    };

    const removeStation = (name) => {
        setStations(prev => prev.filter(s => s !== name));
    };

    return (
        <div className="container">
            <div className="page-header">
                <h1>Admin Panel</h1>
                <p className="text-muted">Manage users, phones, departments, and stations</p>
            </div>

            <div className="tabs">
                <button className={`tab-link ${activeTab === 'users' ? 'active' : ''}`} onClick={() => switchTab('users')}>Users</button>
                <button className={`tab-link ${activeTab === 'phones' ? 'active' : ''}`} onClick={() => switchTab('phones')}>Phones</button>
            </div>

            <section id="usersTab" className={`tab-content ${activeTab === 'users' ? 'active' : ''}`}>
                <div className="card">
                    <div className="card-header">
                        <h2>VOIP Users</h2>
                        <button className="btn btn-cerulean" onClick={() => handleModalShow()}>Add User</button>
                    </div>

                    <div className="search-bar">
                        <input type="text" placeholder="Search users..." id="userSearchInput" onChange={(e) => {
                            const q = e.target.value.toLowerCase();
                            if (!q) return fetchUsers();
                            setUsers(prev => prev.filter(u => (
                                String(u.name_surname || '').toLowerCase().includes(q) ||
                                String(u.extension_number || '').toLowerCase().includes(q) ||
                                String(u.department || '').toLowerCase().includes(q)
                            )));
                        }} />
                    </div>

                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Designation</th>
                                    <th>Department</th>
                                    <th>Station</th>
                                    <th>Office</th>
                                    <th>Extension</th>
                                    <th>IP</th>
                                    <th>Model</th>
                                    <th>MAC</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loadingUsers ? (
                                    <tr>
                                        <td colSpan={10} className="text-center">
                                            <div className="spinner" />
                                        </td>
                                    </tr>
                                ) : usersError ? (
                                    <tr>
                                        <td colSpan={10} className="text-center text-danger">{usersError}</td>
                                    </tr>
                                ) : users.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} className="text-center">No users found</td>
                                    </tr>
                                ) : (
                                    users.map(u => (
                                        <tr key={u.id}>
                                            <td>{u.name_surname}</td>
                                            <td>{u.designation || ''}</td>
                                            <td>{u.department}</td>
                                            <td>{u.station || ''}</td>
                                            <td>{u.office_number}</td>
                                            <td>{u.extension_number}</td>
                                            <td>{u.ip_address}</td>
                                            <td>{u.phone_model || ''}</td>
                                            <td>{u.mac_address || ''}</td>
                                            <td>
                                                <button className="btn btn-cerulean btn-sm" onClick={() => handleModalShow(u)}>Edit</button>
                                                <button className="btn btn-red btn-sm" onClick={() => handleDelete(u.id)}>Delete</button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            <section id="phonesTab" className={`tab-content ${activeTab === 'phones' ? 'active' : ''}`}>
                <div className="card">
                    <div className="card-header">
                        <h2>IP Phones</h2>
                        <div className="flex gap-1 align-center">
                            <label htmlFor="statusFilter" style={{ marginRight: '8px', fontWeight: '600' }}>Filter:</label>
                            <select
                                id="statusFilter"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #e6eef8' }}
                            >
                                <option value="all">All Phones</option>
                                <option value="Online">Online Only</option>
                                <option value="Offline">Offline Only</option>
                            </select>
                        </div>
                    </div>
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>IP Address</th>
                                    <th>Extension</th>
                                    <th>Assigned User</th>
                                    <th>Model</th>
                                    <th>MAC</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredPhones.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center">No phones found</td>
                                    </tr>
                                ) : (
                                    filteredPhones.map((p, idx) => (
                                        <tr key={idx}>
                                            <td>{p.ip}</td>
                                            <td>{p.extension}</td>
                                            <td>{p.user}</td>
                                            <td>{p.model || ''}</td>
                                            <td>{p.mac || ''}</td>
                                            <td>
                                                <span className={`status-pill ${p.status === 'Online' ? 'status-online' : 'status-offline'}`}>
                                                    {p.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            <UserEditModal
                show={showModal}
                handleClose={handleModalClose}
                handleSubmit={handleFormSubmit}
                user={editingUser}
                departments={departments}
                stations={stations}
            />
        </div>
    );
};

export default AdminPage;
