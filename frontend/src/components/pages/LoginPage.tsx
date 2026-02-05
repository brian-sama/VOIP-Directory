import React, { useState } from 'react';
import { ShieldCheck, Lock, User, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiService } from '../../services/apiService';
import logo from '../../assets/logo.jpg';

export const LoginPage: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const userData = await apiService.login({ username, password });
            login(userData);
        } catch (err: any) {
            setError(err.response?.data?.msg || 'Authentication failed. Please check your credentials.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
            <div className="max-w-md w-full animate-fade-in">
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center mb-6">
                        <img src={logo} alt="BCC Logo" className="w-24 h-24 object-contain" />
                    </div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">BCC VOIP Directory</h1>
                    <p className="text-slate-500 mt-2 font-medium">Monitoring & Communications Hub</p>
                </div>

                <div className="card p-10 border-none shadow-2xl shadow-slate-200/60 rounded-[2.5rem] bg-white">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="bg-rose-50 border border-rose-100 text-rose-600 p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                <p className="text-sm font-semibold">{error}</p>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">Identity Profile</label>
                            <div className="relative">
                                <User className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    required
                                    type="text"
                                    placeholder="Name & Surname"
                                    className="input-field pl-14 h-14 bg-slate-50/50 border-slate-100 hover:border-blue-200 transition-all focus:bg-white"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">Extension Code</label>
                            <div className="relative">
                                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    required
                                    type="password"
                                    placeholder="••••••"
                                    className="input-field pl-14 h-14 bg-slate-50/50 border-slate-100 hover:border-blue-200 transition-all focus:bg-white"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full h-14 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-200 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                            {isLoading ? (
                                <RefreshCw className="w-5 h-5 animate-spin" />
                            ) : (
                                'Login'
                            )}
                        </button>
                    </form>

                    <div className="mt-10 text-center">
                        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.3em]">
                            Authenticated Management System v3.0
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
