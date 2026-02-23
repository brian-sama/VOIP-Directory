import React, { createContext, useState, useContext, useEffect } from 'react';
import { socketService } from '../services/socketService';

interface AuthContextType {
    isAuthenticated: boolean;
    user: any;
    login: (userData: any) => void;
    logout: () => void;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    const normalizeUser = (payload: any) => {
        if (!payload) return null;
        const base = payload.user || payload;
        return {
            ...base,
            role: payload.role || base.role || 'user'
        };
    };

    useEffect(() => {
        // Check for persisted session in sessionStorage (expires when tab/browser closes)
        const savedUser = sessionStorage.getItem('sentinel_user');
        if (savedUser) {
            try {
                const userData = normalizeUser(JSON.parse(savedUser));
                setUser(userData);
                // Connect Socket.io on page load if user is authenticated
                socketService.connect(userData.username, userData.department, userData.role);
            } catch (e) {
                sessionStorage.removeItem('sentinel_user');
            }
        }
        setIsLoading(false);
    }, []);

    const login = (userData: any) => {
        const normalizedUser = normalizeUser(userData);
        setUser(normalizedUser);
        sessionStorage.setItem('sentinel_user', JSON.stringify(normalizedUser));
        // Connect Socket.io on login
        socketService.connect(normalizedUser.username, normalizedUser.department, normalizedUser.role);
    };

    const logout = () => {
        setUser(null);
        sessionStorage.removeItem('sentinel_user');
        // Disconnect Socket.io on logout
        socketService.disconnect();
    };

    return (
        <AuthContext.Provider value={{ isAuthenticated: !!user, user, login, logout, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
