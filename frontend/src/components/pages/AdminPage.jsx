import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import UserEditModal from '../shared/UserEditModal';
import Pagination from '../shared/Pagination';
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

    // Derived lists and filtering
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');


    // Pagination state
    const [currentUserPage, setCurrentUserPage] = useState(1);
    const [usersPerPage] = useState(10);

    // Pagination for Phones
    const [currentPhonePage, setCurrentPhonePage] = useState(1);
    const [phonesPerPage] = useState(10);

    const filteredUsers = searchQuery
        ? users.filter(u => (
            String(u.name_surname || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            String(u.extension_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            String(u.department || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            String(u.section || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            String(u.designation || '').toLowerCase().includes(searchQuery.toLowerCase())
        ))
        : users;

    // Calculate current users slice
    const indexOfLastUser = currentUserPage * usersPerPage;
    const indexOfFirstUser = indexOfLastUser - usersPerPage;
    const currentUsers = filteredUsers.slice(indexOfFirstUser, indexOfLastUser);

    // Reset page when search changes
    useEffect(() => {
        setCurrentUserPage(1);
    }, [searchQuery]);

    const phones = users.map(u => ({ ip: u.ip_address, extension: u.extension_number, user: u.name_surname, status: u.status || 'Offline', model: u.phone_model, mac: u.mac_address }));
    const filteredPhones = statusFilter === 'all' ? phones : phones.filter(p => (p.status || 'Offline') === statusFilter);

    // Calculate current phones slice
    const indexOfLastPhone = currentPhonePage * phonesPerPage;
    const indexOfFirstPhone = indexOfLastPhone - phonesPerPage;
    const currentPhones = filteredPhones.slice(indexOfFirstPhone, indexOfLastPhone);

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
                        <h2>VOIP Users ({users.length})</h2>
                        <div className="flex gap-2">
                            <input
                                type="file"
                                id="importFile"
                                accept=".csv, .xlsx, .xls"
                                style={{ display: 'none' }}
                                onChange={async (e) => {
                                    if (e.target.files && e.target.files[0]) {
                                        const file = e.target.files[0];
                                        const formData = new FormData();
                                        formData.append('file', file);

                                        try {
                                            toast.info('Uploading and importing...');
                                            const res = await api.post('/import/users', formData, {
                                                headers: { 'Content-Type': 'multipart/form-data' }
                                            });
                                            if (res.data.errors && res.data.errors.length > 0) {
                                                console.warn('Import errors:', res.data.errors);
                                                // Alert the user about errors
                                                alert(`Import completed with ${res.data.errors.length} errors/warnings:\n\n${res.data.errors.join('\n')}`);
                                                toast.warning(`Imported with ${res.data.errors.length} errors. Check alert.`);
                                            } else {
                                                toast.success(res.data.msg || 'Import successful!');
                                            }
                                            fetchUsers();
                                        } catch (err) {
                                            console.error(err);
                                            // Alert failure
                                            alert(`Import Failed: ${err.response?.data?.msg || err.message}`);
                                            toast.error('Import failed.');
                                        }
                                        e.target.value = null; // Reset input
                                    }
                                }}
                            />
                            <button className="btn btn-outline-secondary btn-sm" onClick={() => {
                                const headers = ['Name', 'Surname', 'Department', 'Section', 'Office Number', 'Designation', 'Station', 'Extension', 'IP Address', 'Model', 'Mac Address'];
                                const csvContent = [headers].map(e => e.join(',')).join('\n');
                                const blob = new Blob([csvContent], { type: 'text/csv' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = 'user_import_template.csv';
                                a.click();
                                URL.revokeObjectURL(url);
                            }}>Download Template</button>
                            <button className="btn btn-secondary btn-sm" onClick={() => document.getElementById('importFile').click()}>Import Users</button>
                            <button className="btn btn-cerulean" onClick={() => handleModalShow()}>Add User</button>
                        </div>
                    </div>

                    <div className="search-bar">
                        <input type="text" placeholder="Search users..." id="userSearchInput" onChange={(e) => {
                            setSearchQuery(e.target.value);
                        }} />
                    </div>

                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Role</th>
                                    <th>Designation</th>
                                    <th>Department</th>
                                    <th>Section</th>
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
                                        <td colSpan={12} className="text-center">
                                            <div className="spinner" />
                                        </td>
                                    </tr>
                                ) : usersError ? (
                                    <tr>
                                        <td colSpan={12} className="text-center text-danger">{usersError}</td>
                                    </tr>
                                ) : filteredUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan={12} className="text-center">No users found</td>
                                    </tr>
                                ) : (
                                    currentUsers.map(u => (
                                        <tr key={u.id}>
                                            <td>{u.name_surname}</td>
                                            <td>
                                                <span className={`badge ${u.role === 'admin' ? 'bg-danger' : 'bg-secondary'}`}>
                                                    {u.role || 'user'}
                                                </span>
                                            </td>
                                            <td>{u.designation || ''}</td>
                                            <td>{u.department}</td>
                                            <td>{u.section || '-'}</td>
                                            <td>{u.station || ''}</td>
                                            <td>{u.office_number}</td>
                                            <td>{u.extension_number || '-'}</td>
                                            <td>{u.ip_address || '-'}</td>
                                            <td>{u.phone_model || ''}</td>
                                            <td>{u.mac_address || ''}</td>
                                            <td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                                                        <button
                                                            type="button"
                                                            className={`btn btn-sm ${u.role === 'admin' ? 'btn-red' : 'btn-complete'}`}
                                                            style={{ padding: '4px 8px', fontSize: '0.8rem', minWidth: '32px' }}
                                                            onClick={() => handleRoleChange(u)}
                                                            title={u.role === 'admin' ? "Revoke Admin" : "Make Admin"}
                                                        >
                                                            {u.role === 'admin' ? '👑' : '👤'}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn btn-cerulean btn-sm"
                                                            style={{ padding: '4px 8px' }}
                                                            onClick={() => handleModalShow(u)}
                                                            title="Edit User"
                                                        >
                                                            ✏️
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn btn-red btn-sm"
                                                            style={{ padding: '4px 8px' }}
                                                            onClick={() => handleDelete(u.id)}
                                                            title="Delete User"
                                                        >
                                                            🗑️
                                                        </button>
                                                    </div>
                                                </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                        <Pagination
                            itemsPerPage={usersPerPage}
                            totalItems={filteredUsers.length}
                            paginate={(num) => setCurrentUserPage(num)}
                            currentPage={currentUserPage}
                        />
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
                                {currentPhones.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center">No phones found</td>
                                    </tr>
                                ) : (
                                    currentPhones.map((p, idx) => (
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
                        <Pagination
                            itemsPerPage={phonesPerPage}
                            totalItems={filteredPhones.length}
                            paginate={(num) => setCurrentPhonePage(num)}
                            currentPage={currentPhonePage}
                        />
                    </div>
                </div>
            </section>

            <UserEditModal
                show={showModal}
                handleClose={handleModalClose}
                handleSubmit={handleFormSubmit}
                user={editingUser}
            />
        </div>
    );
};

export default AdminPage;
