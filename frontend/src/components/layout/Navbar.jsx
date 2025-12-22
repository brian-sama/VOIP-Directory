import React from 'react';
import { Navbar, Nav, Container, Image } from 'react-bootstrap';
import { LinkContainer } from 'react-router-bootstrap';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import logo from '../../assets/images.jfif';

const AppNavbar = () => {
    const { isAuthenticated, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <Navbar variant="dark" expand="lg" collapseOnSelect className="navbar-dark">
            <Container>
                <LinkContainer to="/">
                    <Navbar.Brand>
                        <Image src={logo} alt="BCC Logo" style={{ height: '30px', marginRight: '10px' }} />
                        BCC VOIP Directory
                    </Navbar.Brand>
                </LinkContainer>
                <Navbar.Toggle aria-controls="basic-navbar-nav" />
                <Navbar.Collapse id="basic-navbar-nav">
                    <Nav className="ms-auto">
                        {isAuthenticated ? (
                            <>
                                <LinkContainer to="/">
                                    <Nav.Link>Dashboard</Nav.Link>
                                </LinkContainer>
                                <LinkContainer to="/reports">
                                    <Nav.Link>Reports</Nav.Link>
                                </LinkContainer>
                                <LinkContainer to="/admin">
                                    <Nav.Link>Admin</Nav.Link>
                                </LinkContainer>
                                <LinkContainer to="/settings">
                                    <Nav.Link>Settings</Nav.Link>
                                </LinkContainer>
                                <LinkContainer to="/activity">
                                    <Nav.Link>Activity</Nav.Link>
                                </LinkContainer>
                                <Nav.Link onClick={handleLogout}>Logout</Nav.Link>
                            </>
                        ) : (
                            <LinkContainer to="/login">
                                <Nav.Link>Login</Nav.Link>
                            </LinkContainer>
                        )}
                    </Nav>
                </Navbar.Collapse>
            </Container>
        </Navbar>
    );
};

export default AppNavbar;
