import axios from '../api/axios';
import { VoipUser, ActivityLog } from '../types';

export const apiService = {
    // User Management
    getUsers: async (params?: any) => {
        const response = await axios.get<VoipUser[]>('/users', { params });
        return response.data;
    },
    addUser: async (userData: any) => {
        const response = await axios.post('/users', userData);
        return response.data;
    },
    updateUser: async (id: number, userData: any) => {
        const response = await axios.put(`/users/${id}`, userData);
        return response.data;
    },
    deleteUser: async (id: number) => {
        const response = await axios.delete(`/users/${id}`);
        return response.data;
    },

    // Activity Logs
    getLogs: async () => {
        const response = await axios.get<ActivityLog[]>('/activity');
        return response.data;
    },
    addLog: async (logData: { action: string; details?: string; user_name?: string }) => {
        const response = await axios.post('/activity', logData);
        return response.data;
    },

    // Metadata
    getMetadata: async (type: 'departments' | 'sections' | 'stations') => {
        const response = await axios.get(`/metadata/${type}`);
        return response.data;
    },

    // Reports
    getDailyReport: async (date: string, format: 'json' | 'pdf' | 'excel' = 'json') => {
        const response = await axios.get('/reports/daily', {
            params: { date, format },
            responseType: format === 'json' ? 'json' : 'blob'
        });
        return response.data;
    },
    getRangeReport: async (startDate: string, endDate: string, format: 'json' | 'pdf' | 'excel' = 'json') => {
        const response = await axios.get('/reports/range', {
            params: { startDate, endDate, format },
            responseType: format === 'json' ? 'json' : 'blob'
        });
        return response.data;
    },

    // Auth
    login: async (credentials: any) => {
        const response = await axios.post('/auth/login', credentials);
        return response.data;
    }
};
