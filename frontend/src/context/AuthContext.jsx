import React, { createContext, useState, useContext } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null); // Could be an object with user details, or just a token

    const login = (userData) => {
        // In a real app, you might store the token in localStorage
        // localStorage.setItem('token', userData.token);
        setUser(userData);
    };

    const logout = () => {
        // localStorage.removeItem('token');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ isAuthenticated: !!user, user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    return useContext(AuthContext);
};
