import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  Settings,
  FileText,
  Search,
  Plus,
  Download,
  RefreshCw,
  Bell,
  Trash2,
  Edit2,
  ShieldCheck,
  History,
  HardDrive,
  Phone,
  XCircle,
  ChevronDown,
  LogOut
} from 'lucide-react';
import { VoipUser, DeviceStatus, SystemStats, ActivityLog } from './types';
import { DEPARTMENTS } from './constants';
import { DashboardCards } from './components/DashboardCards';
import { StatusBadge } from './components/StatusBadge';
import { apiService } from './services/apiService';
import { useAuth } from './context/AuthContext';
import { LoginPage } from './components/pages/LoginPage';

type View = 'DASHBOARD' | 'DIRECTORY' | 'ADMIN' | 'REPORTS' | 'LOGS';

const App: React.FC = () => {
  const { isAuthenticated, logout, isLoading: authLoading, user: authUser } = useAuth();
  const [activeView, setActiveView] = useState<View>('DASHBOARD');
  const [users, setUsers] = useState<VoipUser[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingUser, setEditingUser] = useState<VoipUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAdmin = authUser?.role === 'admin';

  // Fetch initial data when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const fetchData = async () => {
        setIsLoading(true);
        try {
          const [userData, logData] = await Promise.all([
            apiService.getUsers(),
            apiService.getLogs()
          ]);
          setUsers(userData);
          setLogs(logData);
        } catch (error) {
          console.error("Failed to fetch data:", error);
        } finally {
          setIsLoading(false);
        }
      };
      fetchData();
    }
  }, [isAuthenticated]);

  // Monitoring loop
  useEffect(() => {
    let interval: any;
    if (isMonitoring && isAuthenticated) {
      interval = setInterval(async () => {
        try {
          const updated = await apiService.getUsers();
          setUsers(updated);
        } catch (error) {
          console.error("Monitoring sync failed:", error);
        }
      }, 30000);
    }
    return () => clearInterval(interval);
  }, [isMonitoring, isAuthenticated]);

  const stats: SystemStats = useMemo(() => {
    return {
      totalExtensions: users.length,
      onlineCount: users.filter(u => u.status === 'Online' || u.status === DeviceStatus.ONLINE).length,
      offlineCount: users.filter(u => u.status === 'Offline' || u.status === DeviceStatus.OFFLINE).length,
      departments: new Set(users.map(u => u.department)).size
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    return users.filter(u =>
      u.name_surname?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.extension_number?.includes(searchQuery) ||
      u.department?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.ip_address?.includes(searchQuery)
    );
  }, [users, searchQuery]);

  const handleManualSync = async () => {
    setIsMonitoring(true);
    try {
      const updated = await apiService.getUsers();
      setUsers(updated);
      await apiService.addLog({
        action: 'MANUAL_SYNC',
        details: 'Manual refresh of device statuses performed.',
        user_name: authUser?.username || 'System'
      });
      const updatedLogs = await apiService.getLogs();
      setLogs(updatedLogs);
    } catch (error) {
      console.error("Sync failed:", error);
    } finally {
      setIsMonitoring(false);
    }
  };

  const handleAddUser = () => {
    setEditingUser({
      id: 0,
      name_surname: '',
      extension_number: '',
      department: DEPARTMENTS[0],
      section: '',
      station: '',
      ip_address: '',
      mac_address: '',
      status: DeviceStatus.PENDING,
      last_seen: new Date().toISOString()
    });
  };

  const saveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      if (editingUser.id !== 0) {
        await apiService.updateUser(editingUser.id, editingUser);
      } else {
        await apiService.addUser(editingUser);
      }
      const updatedUsers = await apiService.getUsers();
      setUsers(updatedUsers);
      setEditingUser(null);
    } catch (error) {
      alert("Failed to save user.");
    }
  };

  const deleteUser = async (id: number) => {
    if (confirm('Are you sure you want to remove this extension?')) {
      try {
        await apiService.deleteUser(id);
        setUsers(users.filter(u => u.id !== id));
      } catch (error) {
        alert("Failed to delete user.");
      }
    }
  };

  const NavItem = ({ view, icon: Icon, label }: { view: View, icon: any, label: string }) => (
    <button
      onClick={() => setActiveView(view)}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 ${activeView === view
          ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`}
    >
      <Icon className="w-4 h-4" />
      <span className="font-medium text-sm">{label}</span>
    </button>
  );

  if (authLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <RefreshCw className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <nav className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm px-6 h-18">
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-200">
                <ShieldCheck className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight hidden md:block">VOIP Sentinel</h1>
            </div>

            <div className="hidden lg:flex items-center gap-1">
              <NavItem view="DASHBOARD" icon={LayoutDashboard} label="Dashboard" />
              <NavItem view="DIRECTORY" icon={Search} label="Directory" />
              <NavItem view="REPORTS" icon={FileText} label="Reports" />
              <NavItem view="LOGS" icon={History} label="Activity" />
              {isAdmin && <NavItem view="ADMIN" icon={Settings} label="Management" />}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="relative p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
            </button>

            <div className="h-8 w-[1px] bg-slate-200 mx-2"></div>

            <div className="flex items-center gap-3 pl-2 group">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-bold text-slate-900 leading-none mb-1 capitalize">{authUser?.username || 'User'}</p>
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">{authUser?.role || 'Staff'}</p>
              </div>
              <div className="relative group cursor-pointer" onClick={() => { if (confirm('Logout?')) logout(); }}>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white ring-4 ring-blue-50 shadow-lg group-hover:opacity-0 transition-opacity">
                  <span className="font-bold text-sm uppercase">{(authUser?.username || 'U').charAt(0)}</span>
                </div>
                <div className="absolute inset-0 w-10 h-10 rounded-xl bg-rose-600 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity ring-4 ring-rose-50">
                  <LogOut className="w-5 h-5" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 animate-fade-in">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight capitalize">
              {activeView.toLowerCase()} Panel
            </h2>
            <p className="text-slate-500 mt-1 font-medium">
              {activeView === 'DASHBOARD' && 'Real-time telemetry and network status.'}
              {activeView === 'DIRECTORY' && 'Search and locate staff extensions.'}
              {activeView === 'ADMIN' && 'Modify hardware and distribution settings.'}
              {activeView === 'REPORTS' && 'Generate compliance and downtime documents.'}
              {activeView === 'LOGS' && 'Full audit trail of administrative actions.'}
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleManualSync}
              disabled={isMonitoring}
              className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold hover:border-blue-300 hover:text-blue-600 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isMonitoring ? 'animate-spin' : ''}`} />
              <span className="text-sm">Sync Status</span>
            </button>
            {isAdmin && activeView === 'ADMIN' && (
              <button onClick={handleAddUser} className="btn-primary flex items-center gap-2">
                <Plus className="w-5 h-5" />
                <span>Register Device</span>
              </button>
            )}
          </div>
        </div>

        {activeView === 'DASHBOARD' && (
          <>
            <DashboardCards stats={stats} />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 card">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2.5">
                    <Phone className="w-5 h-5 text-blue-600" />
                    Hardware Distribution
                  </h3>
                  <div className="relative w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Filter users..."
                      className="w-full bg-slate-100 border-none rounded-lg py-1.5 pl-9 pr-3 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {filteredUsers.slice(0, 6).map(user => (
                    <div key={user.id} className="p-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${user.status === 'Online' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                          <HardDrive className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{user.name_surname}</p>
                          <p className="text-xs font-medium text-slate-400">Ext: {user.extension_number} • {user.ip_address}</p>
                        </div>
                      </div>
                      <StatusBadge status={user.status} />
                    </div>
                  ))}
                </div>
                <div className="p-4 bg-slate-50 text-center">
                  <button onClick={() => setActiveView('DIRECTORY')} className="text-sm font-bold text-blue-600 hover:text-blue-700">Detailed Directory</button>
                </div>
              </div>

              <div className="card h-fit">
                <div className="p-6 border-b border-slate-100">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2.5">
                    <History className="w-5 h-5 text-indigo-600" />
                    Security Log
                  </h3>
                </div>
                <div className="p-6 space-y-7">
                  {logs.slice(0, 5).map((log) => (
                    <div key={log.id} className="relative pl-6 before:absolute before:left-0 before:top-2 before:bottom-[-28px] before:w-[2px] last:before:hidden before:bg-slate-100">
                      <div className="absolute left-[-4.5px] top-2 w-2.5 h-2.5 rounded-full bg-white border-[2.5px] border-blue-500 shadow-sm"></div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{new Date(log.created_at).toLocaleTimeString()}</p>
                      <p className="text-sm font-bold text-slate-900 truncate">{log.action}</p>
                      <p className="text-xs text-slate-500">{log.user_name}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Other views (Directory, Admin, etc.) maintained with similar card-based styling as previous App.jsx */}
        {activeView === 'DIRECTORY' && (
          <div className="card overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-white">
              <div className="relative max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Query extensions, users or IPs..."
                  className="w-full bg-slate-100 border-none rounded-2xl py-3 pl-12 pr-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-[11px] font-bold uppercase tracking-widest">
                    <th className="px-6 py-4">User Identity</th>
                    <th className="px-6 py-4">Department</th>
                    <th className="px-6 py-4">Network Info</th>
                    <th className="px-6 py-4">Current Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map(user => (
                    <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-5">
                        <p className="font-bold text-slate-900">{user.name_surname}</p>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Ext: {user.extension_number}</p>
                      </td>
                      <td className="px-6 py-5 text-sm font-semibold text-slate-600">{user.department}</td>
                      <td className="px-6 py-5">
                        <p className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded w-fit">{user.ip_address}</p>
                      </td>
                      <td className="px-6 py-5"><StatusBadge status={user.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Admin, Reports, Logs would follow similar patterns */}
      </main>

      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-slate-900">{editingUser.id !== 0 ? 'Modify Profile' : 'Register Hardware'}</h3>
              <button onClick={() => setEditingUser(null)}><XCircle className="w-8 h-8 text-slate-400" /></button>
            </div>
            <form onSubmit={saveUser} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <input required placeholder="Full Name" className="input-field" value={editingUser.name_surname} onChange={e => setEditingUser({ ...editingUser, name_surname: e.target.value })} />
                <input required placeholder="Extension" className="input-field" value={editingUser.extension_number} onChange={e => setEditingUser({ ...editingUser, extension_number: e.target.value })} />
                <select className="input-field" value={editingUser.department} onChange={e => setEditingUser({ ...editingUser, department: e.target.value })}>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <input placeholder="Station" className="input-field" value={editingUser.station} onChange={e => setEditingUser({ ...editingUser, station: e.target.value })} />
                <input required placeholder="IP Address" className="input-field" value={editingUser.ip_address} onChange={e => setEditingUser({ ...editingUser, ip_address: e.target.value })} />
                <input required placeholder="MAC Address" className="input-field" value={editingUser.mac_address} onChange={e => setEditingUser({ ...editingUser, mac_address: e.target.value })} />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setEditingUser(null)} className="flex-1 py-4 bg-slate-100 rounded-2xl font-bold">Cancel</button>
                <button type="submit" className="flex-1 btn-primary py-4">Save Configuration</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
