import React, { useState, useEffect } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';

const UserEditModal = ({ show, handleClose, handleSubmit, user, departments = [], stations = [] }) => {
    const [formData, setFormData] = useState({
        name_surname: '',
        department: '',
        office_number: '',
        designation: '',
        station: '',
        extension_number: '',
        ip_address: '',
        mac_address: '',
        phone_model: '',
    });

    const [customDepartment, setCustomDepartment] = useState(false);
    const [customStation, setCustomStation] = useState(false);

    useEffect(() => {
        if (user) {
            setFormData({
                name_surname: user.name_surname || '',
                department: user.department || '',
                office_number: user.office_number || '',
                designation: user.designation || '',
                station: user.station || '',
                extension_number: user.extension_number || '',
                ip_address: user.ip_address || '',
                mac_address: user.mac_address || '',
                phone_model: user.phone_model || '',
            });
            // Check if department/station exists in the list, if not, enable custom input
            setCustomDepartment(user.department && !departments.includes(user.department));
            setCustomStation(user.station && !stations.includes(user.station));
        } else {
            // Reset form for adding new user
            setFormData({
                name_surname: '', department: '', office_number: '', designation: '', station: '',
                extension_number: '', ip_address: '', mac_address: '', phone_model: '',
            });
            setCustomDepartment(false);
            setCustomStation(false);
        }
    }, [user, show, departments, stations]);

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
                        <Form.Control type="text" name="extension_number" value={formData.extension_number} onChange={handleChange} required />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>IP Address</Form.Label>
                        <Form.Control type="text" name="ip_address" value={formData.ip_address} onChange={handleChange} required />
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
