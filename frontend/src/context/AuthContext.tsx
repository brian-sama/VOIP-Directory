import React, { createContext, useState, useContext, useEffect } from 'react';
import { socketService } from '../services/socketService';
import { apiService } from '../services/apiService';

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
        // Restore session from HTTP-only cookie via /auth/me
        apiService.getMe()
            .then(userData => {
                const normalized = normalizeUser(userData);
                setUser(normalized);
                socketService.connect(normalized.username, normalized.department, normalized.role);
            })
            .catch(() => {
                // Not authenticated — silently ignore
            })
            .finally(() => setIsLoading(false));
    }, []);

    const login = (userData: any) => {
        const normalizedUser = normalizeUser(userData);
        setUser(normalizedUser);
        // Cookie is set by the server; no client-side storage needed
        socketService.connect(normalizedUser.username, normalizedUser.department, normalizedUser.role);
    };

    const logout = async () => {
        try { await apiService.logout(); } catch {}
        setUser(null);
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
