import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { Table, Form, InputGroup, Container, Row, Col, Badge } from 'react-bootstrap';

import Pagination from '../shared/Pagination';

const DirectoryPage = () => {
    const [users, setUsers] = useState([]);
    const [filters, setFilters] = useState({
        department: '',
        user: '',
        extension: ''
    });

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(15);

    useEffect(() => {
        fetchUsers();
    }, [filters]);

    // Reset pagination when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [filters]);

    const fetchUsers = async () => {
        try {
            const params = new URLSearchParams(filters).toString();
            const response = await api.get(`/users?${params}`);
            setUsers(response.data);
        } catch (error) {
            console.error('Error fetching directory:', error);
        }
    };

    const handleFilterChange = (e) => {
        setFilters({
            ...filters,
            [e.target.name]: e.target.value
        });
    };

    // Get current users
    const indexOfLastUser = currentPage * itemsPerPage;
    const indexOfFirstUser = indexOfLastUser - itemsPerPage;
    const currentUsers = users.slice(indexOfFirstUser, indexOfLastUser);

    const paginate = (pageNumber) => setCurrentPage(pageNumber);

    return (
        <Container fluid className="mt-4">
            <h2 className="mb-4">Internal Directory ({users.length})</h2>

            <Row className="mb-4">
                <Col md={3}>
                    <Form.Control
                        type="text"
                        placeholder="Filter by Department"
                        name="department"
                        value={filters.department}
                        onChange={handleFilterChange}
                    />
                </Col>
                <Col md={3}>
                    <Form.Control
                        type="text"
                        placeholder="Search Name"
                        name="user"
                        value={filters.user}
                        onChange={handleFilterChange}
                    />
                </Col>
                <Col md={3}>
                    <Form.Control
                        type="text"
                        placeholder="Search Extension"
                        name="extension"
                        value={filters.extension}
                        onChange={handleFilterChange}
                    />
                </Col>
            </Row>

            <div className="table-responsive">
                <Table striped bordered hover>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Department</th>
                            <th>Section</th>
                            <th>Designation</th>
                            <th>Extension</th>
                            <th>Office</th>
                        </tr>
                    </thead>
                    <tbody>
                        {currentUsers.map((user) => (
                            <tr key={user.id}>
                                <td>{user.name_surname}</td>
                                <td>{user.department}</td>
                                <td>{user.section || '-'}</td>
                                <td>{user.designation}</td>
                                <td>
                                    <Badge bg="info" className="fs-6">{user.extension_number}</Badge>
                                </td>
                                <td>{user.office_number}</td>
                            </tr>
                        ))}
                        {users.length === 0 && (
                            <tr>
                                <td colSpan="7" className="text-center">No results found</td>
                            </tr>
                        )}
                    </tbody>
                </Table>

                <Pagination
                    itemsPerPage={itemsPerPage}
                    totalItems={users.length}
                    paginate={paginate}
                    currentPage={currentPage}
                />
            </div>
        </Container>
    );
};

export default DirectoryPage;
