import React from 'react';
import { Navbar, Nav, Container, Image } from 'react-bootstrap';
import { LinkContainer } from 'react-router-bootstrap';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import logo from '../../assets/images.jfif';

const AppNavbar = () => {
    const { isAuthenticated, user, logout } = useAuth();
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
                                {user?.role === 'admin' ? (
                                    <LinkContainer to="/">
                                        <Nav.Link>Dashboard</Nav.Link>
                                    </LinkContainer>
                                ) : (
                                    <LinkContainer to="/directory">
                                        <Nav.Link>Directory</Nav.Link>
                                    </LinkContainer>
                                )}

                                {user?.role === 'admin' && (
                                    <>
                                        <LinkContainer to="/logs">
                                            <Nav.Link>Logs & Reports</Nav.Link>
                                        </LinkContainer>
                                        <LinkContainer to="/admin">
                                            <Nav.Link>Admin</Nav.Link>
                                        </LinkContainer>
                                    </>
                                )}

                                <LinkContainer to="/settings">
                                    <Nav.Link>Settings</Nav.Link>
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
        </Navbar >
    );
};

export default AppNavbar;
