import React, { useState } from 'react';
import { ShieldCheck, Lock, User, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiService } from '../../services/apiService';

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
                    <div className="inline-flex items-center justify-center bg-blue-600 p-4 rounded-3xl shadow-xl shadow-blue-200 mb-6">
                        <ShieldCheck className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">VOIP Sentinel</h1>
                    <p className="text-slate-500 mt-2 font-medium">Monitoring & Directory Gateway</p>
                </div>

                <div className="card p-8 md:p-10">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="bg-rose-50 border border-rose-100 text-rose-600 p-4 rounded-xl flex items-center gap-3 animate-in slide-in-from-top-2">
                                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                <p className="text-sm font-semibold">{error}</p>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Authentication Identity</label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    required
                                    type="text"
                                    placeholder="Name & Surname"
                                    className="input-field pl-12"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Extension Key</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    required
                                    type="password"
                                    placeholder="Extension Code"
                                    className="input-field pl-12"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full btn-primary py-4 flex items-center justify-center gap-2 text-lg"
                        >
                            {isLoading ? (
                                <RefreshCw className="w-5 h-5 animate-spin" />
                            ) : (
                                'Initialize Session'
                            )}
                        </button>
                    </form>

                    <div className="mt-8 text-center pt-8 border-t border-slate-100">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                            Secure hardware monitoring protocol v2.0
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
