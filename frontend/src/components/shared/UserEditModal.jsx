import React, { useState, useEffect } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import api from '../../api/axios';

const UserEditModal = ({ show, handleClose, handleSubmit, user }) => {
    const [departments, setDepartments] = useState([]);
    const [sections, setSections] = useState([]);
    const [stations, setStations] = useState([]);
    const [formData, setFormData] = useState({
        name_surname: '',
        department: '',
        section: '',
        office_number: '',
        designation: '',
        station: '',
        extension_number: '',
        ip_address: '',
        mac_address: '',
        phone_model: '',
        role: 'user',
    });

    const [customDepartment, setCustomDepartment] = useState(false);
    const [customSection, setCustomSection] = useState(false);
    const [customStation, setCustomStation] = useState(false);

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const [dRes, sRes, stRes] = await Promise.all([
                    api.get('/metadata/departments'),
                    api.get('/metadata/sections'),
                    api.get('/metadata/stations')
                ]);
                setDepartments(dRes.data.map(d => d.name));
                setSections(sRes.data.map(s => s.name));
                setStations(stRes.data.map(st => st.name));
            } catch (err) {
                console.error('Failed to fetch categories', err);
            }
        };
        if (show) fetchCategories();
    }, [show]);

    useEffect(() => {
        if (user) {
            setFormData({
                name_surname: user.name_surname || '',
                department: user.department || '',
                section: user.section || '',
                office_number: user.office_number || '',
                designation: user.designation || '',
                station: user.station || '',
                extension_number: user.extension_number || '',
                ip_address: user.ip_address || '',
                mac_address: user.mac_address || '',
                phone_model: user.phone_model || '',
                role: user.role || 'user',
            });
            setCustomDepartment(user.department && !departments.includes(user.department));
            setCustomSection(user.section && !sections.includes(user.section));
            setCustomStation(user.station && !stations.includes(user.station));
        } else {
            setFormData({
                name_surname: '', department: '', section: '', office_number: '', designation: '', station: '',
                extension_number: '', ip_address: '', mac_address: '', phone_model: '', role: 'user',
            });
            setCustomDepartment(false);
            setCustomSection(false);
            setCustomStation(false);
        }
    }, [user, show, departments, sections]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleDepartmentChange = (e) => {
        const value = e.target.value;
        if (value === '__custom__') {
            setCustomDepartment(true);
            setFormData({ ...formData, department: '' });
        } else {
            setCustomDepartment(false);
            setFormData({ ...formData, department: value });
        }
    };

    const handleStationChange = (e) => {
        const value = e.target.value;
        if (value === '__custom__') {
            setCustomStation(true);
            setFormData({ ...formData, station: '' });
        } else {
            setCustomStation(false);
            setFormData({ ...formData, station: value });
        }
    };

    const onFormSubmit = (e) => {
        e.preventDefault();

        // IP Address Validation
        if (formData.ip_address) {
            const ipRegex = /^[0-9.]+$/;
            if (!ipRegex.test(formData.ip_address)) {
                alert('IP Address can only contain numbers and dots.');
                return;
            }
        }

        handleSubmit(formData);
    };

    return (
        <Modal show={show} onHide={handleClose}>
            <Modal.Header closeButton>
                <Modal.Title>{user ? 'Edit User' : 'Add New User'}</Modal.Title>
            </Modal.Header>
            <Form onSubmit={onFormSubmit}>
                <Modal.Body>
                    <Form.Group className="mb-3">
                        <Form.Label>Name & Surname</Form.Label>
                        <Form.Control type="text" name="name_surname" value={formData.name_surname} onChange={handleChange} required />
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>Role</Form.Label>
                        <Form.Select name="role" value={formData.role} onChange={handleChange}>
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                        </Form.Select>
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>Department</Form.Label>
                        {!customDepartment ? (
                            <Form.Select
                                name="department"
                                value={formData.department}
                                onChange={handleDepartmentChange}
                            >
                                <option value="">-- Select Department --</option>
                                {departments.map(d => (
                                    <option key={d} value={d}>{d}</option>
                                ))}
                                <option value="__custom__">Add New Department...</option>
                            </Form.Select>
                        ) : (
                            <div className="d-flex gap-2">
                                <Form.Control
                                    type="text"
                                    name="department"
                                    value={formData.department}
                                    onChange={handleChange}
                                    placeholder="Enter new department"
                                />
                                <Button variant="outline-secondary" size="sm" onClick={() => setCustomDepartment(false)}>
                                    Cancel
                                </Button>
                            </div>
                        )}
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>Section</Form.Label>
                        {!customSection ? (
                            <Form.Select
                                name="section"
                                value={formData.section}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === '__custom__') {
                                        setCustomSection(true);
                                        setFormData({ ...formData, section: '' });
                                    } else {
                                        setCustomSection(false);
                                        setFormData({ ...formData, section: val });
                                    }
                                }}
                            >
                                <option value="">-- Select Section --</option>
                                {sections.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                                <option value="__custom__">Add New Section...</option>
                            </Form.Select>
                        ) : (
                            <div className="d-flex gap-2">
                                <Form.Control
                                    type="text"
                                    name="section"
                                    value={formData.section}
                                    onChange={handleChange}
                                    placeholder="Enter new section"
                                />
                                <Button variant="outline-secondary" size="sm" onClick={() => setCustomSection(false)}>
                                    Cancel
                                </Button>
                            </div>
                        )}
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>Station</Form.Label>
                        {!customStation ? (
                            <Form.Select
                                name="station"
                                value={formData.station}
                                onChange={handleStationChange}
                            >
                                <option value="">-- Select Station --</option>
                                {stations.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                                <option value="__custom__">Add New Station...</option>
                            </Form.Select>
                        ) : (
                            <div className="d-flex gap-2">
                                <Form.Control
                                    type="text"
                                    name="station"
                                    value={formData.station}
                                    onChange={handleChange}
                                    placeholder="Enter new station"
                                />
                                <Button variant="outline-secondary" size="sm" onClick={() => setCustomStation(false)}>
                                    Cancel
                                </Button>
                            </div>
                        )}
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>Office Number</Form.Label>
                        <Form.Control type="text" name="office_number" value={formData.office_number} onChange={handleChange} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Designation</Form.Label>
                        <Form.Control type="text" name="designation" value={formData.designation} onChange={handleChange} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Extension Number</Form.Label>
                        <Form.Control type="text" name="extension_number" value={formData.extension_number} onChange={handleChange} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>IP Address</Form.Label>
                        <Form.Control
                            type="text"
                            name="ip_address"
                            value={formData.ip_address}
                            onChange={handleChange}
                            placeholder="e.g. 192.168.1.1"
                        />
                        <Form.Text className="text-muted">
                            Numbers and dots only.
                        </Form.Text>
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>MAC Address</Form.Label>
                        <Form.Control type="text" name="mac_address" value={formData.mac_address} onChange={handleChange} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Phone Model</Form.Label>
                        <Form.Control type="text" name="phone_model" value={formData.phone_model} onChange={handleChange} />
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleClose}>
                        Cancel
                    </Button>
                    <Button variant="primary" type="submit">
                        Save Changes
                    </Button>
                </Modal.Footer>
            </Form>
        </Modal>
    );
};

export default UserEditModal;
