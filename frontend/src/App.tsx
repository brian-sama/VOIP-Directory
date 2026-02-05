import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  History,
  HardDrive,
  Phone,
  XCircle,
  LogOut,
  Upload,
  FileSpreadsheet,
  Layers,
  Wand2,
  ChevronRight,
  Monitor,
  ArrowUpDown,
  ChevronLeft,
  Activity,
  Zap,
  ZapOff
} from 'lucide-react';
import { VoipUser, DeviceStatus, SystemStats, ActivityLog } from './types';
import { DEPARTMENTS } from './constants';
import { DashboardCards } from './components/DashboardCards';
import { StatusBadge } from './components/StatusBadge';
import { apiService } from './services/apiService';
import { socketService } from './services/socketService';
import { useAuth } from './context/AuthContext';
import { useToast } from './context/ToastContext';
import { LoginPage } from './components/pages/LoginPage';
import logo from './assets/logo.jpg';

type View = 'DASHBOARD' | 'DIRECTORY' | 'ADMIN' | 'REPORTS' | 'LOGS';
type SortKey = 'name_surname' | 'extension_number' | 'ip_address' | 'department' | 'status';

const App: React.FC = () => {
  const { isAuthenticated, logout, isLoading: authLoading, user: authUser } = useAuth();
  const { success, error: toastError } = useToast();
  const [activeView, setActiveView] = useState<View>('DIRECTORY');
  const [users, setUsers] = useState<any[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [liveMode, setLiveMode] = useState(() => localStorage.getItem('bcc_live_mode') !== 'false');

  useEffect(() => {
    localStorage.setItem('bcc_live_mode', liveMode.toString());
  }, [liveMode]);
  const [searchQuery, setSearchQuery] = useState('');
  const [adminSearchQuery, setAdminSearchQuery] = useState('');
  const [editingUser, setEditingUser] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pagination & Filtering
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;
  const [filterDept, setFilterDept] = useState('ALL');
  const [filterSection, setFilterSection] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Sorting
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'name_surname', direction: 'asc' });

  // Metadata
  const [depts, setDepts] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [newMeta, setNewMeta] = useState('');

  const isAdmin = authUser?.role === 'admin';

  // Socket.io listeners for real-time updates
  useEffect(() => {
    if (!isAuthenticated) return;

    // Listen for extension status updates
    const handleStatusUpdate = (extension: any) => {
      setUsers(prev => prev.map(u => u.id === extension.user_id ? { ...u, ...extension } : u));
    };

    // Listen for new user added
    const handleUserAdded = (user: any) => {
      setUsers(prev => [...prev, user]);
      success('New user added');
    };

    // Listen for user deleted
    const handleUserDeleted = ({ id }: { id: number }) => {
      setUsers(prev => prev.filter(u => u.id !== id));
    };

    // Listen for bulk updates
    const handleBulkUpdate = (type: string, data: any) => {
      if (type === 'import') {
        fetchData(); // Refresh all data on bulk import
      }
    };

    socketService.on('extension:statusUpdate', handleStatusUpdate);
    socketService.on('user:added', handleUserAdded);
    socketService.on('user:deleted', handleUserDeleted);
    socketService.on('bulk:import', handleBulkUpdate);

    return () => {
      socketService.off('extension:statusUpdate', handleStatusUpdate);
      socketService.off('user:added', handleUserAdded);
      socketService.off('user:deleted', handleUserDeleted);
      socketService.off('bulk:import', handleBulkUpdate);
    };
  }, [isAuthenticated]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [userData, logData] = await Promise.all([
        apiService.getUsers(),
        isAdmin ? apiService.getLogs() : Promise.resolve([])
      ]);
      setUsers(userData);
      setLogs(logData);

      if (isAdmin) {
        const [d, st, sec] = await Promise.all([
          apiService.getMetadata('departments'),
          apiService.getMetadata('stations'),
          apiService.getMetadata('sections')
        ]);
        setDepts(d);
        setStations(st);
        setSections(sec);
      }
    } catch (e) {
      toastError("Synchronous load failed.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
      if (!isAdmin) setActiveView('DIRECTORY');
    } else {
      // Clear search queries when user logs out to isolate search state
      setSearchQuery('');
      setAdminSearchQuery('');
    }
  }, [isAuthenticated, isAdmin]);

  // Clear search queries when user changes to prevent search persistence across accounts
  useEffect(() => {
    setSearchQuery('');
    setAdminSearchQuery('');
  }, [authUser?.username]);

  const stats: SystemStats = useMemo(() => {
    return {
      totalExtensions: users.length,
      onlineCount: users.filter(u => u.status === 'Online' || u.status === 'Registered').length,
      offlineCount: users.filter(u => u.status === 'Offline' || u.status === 'Unregistered').length,
      departments: new Set(users.map(u => u.department)).size
    };
  }, [users]);

  const handleSort = (key: SortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const processedUsers = useMemo(() => {
    let result = [...users];

    // Search
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter((u: any) =>
        u.name_surname?.toLowerCase().includes(lowerQuery) ||
        u.extension_number?.includes(searchQuery) ||
        u.ip_address?.includes(searchQuery) ||
        u.department?.toLowerCase().includes(lowerQuery) ||
        u.section?.toLowerCase().includes(lowerQuery) ||
        u.station?.toLowerCase().includes(lowerQuery) ||
        u.mac_address?.toLowerCase().includes(lowerQuery) ||
        u.phone_model?.toLowerCase().includes(lowerQuery) ||
        u.office_number?.toLowerCase().includes(lowerQuery)
      );
    }

    // Dropdown Filters
    if (filterDept !== 'ALL') result = result.filter((u: any) => u.department === filterDept);
    if (filterSection !== 'ALL') result = result.filter((u: any) => u.section === filterSection);

    // Status Filter
    if (filterStatus !== 'ALL') {
      if (filterStatus === 'ONLINE') {
        result = result.filter((u: any) => u.status === 'Online' || u.status === 'Registered');
      } else if (filterStatus === 'OFFLINE') {
        result = result.filter((u: any) => u.status === 'Offline' || u.status === 'Unregistered');
      }
    }

    // Sort
    result.sort((a, b) => {
      const valA = a[sortConfig.key]?.toString().toLowerCase() || '';
      const valB = b[sortConfig.key]?.toString().toLowerCase() || '';
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [users, searchQuery, filterDept, filterSection, sortConfig]);

  const toEmpty = (val: any) => (val === null || val === undefined) ? '' : val;
  const ensureNoNulls = (user: any) => {
    if (!user) return null;
    return {
      ...user,
      name_surname: toEmpty(user.name_surname),
      extension_number: toEmpty(user.extension_number),
      ip_address: toEmpty(user.ip_address),
      department: toEmpty(user.department),
      section: toEmpty(user.section),
      station: toEmpty(user.station),
      phone_model: toEmpty(user.phone_model),
      mac_address: toEmpty(user.mac_address),
      office_number: toEmpty(user.office_number),
      designation: toEmpty(user.designation),
      role: user.role || 'user'
    };
  };

  const processedAdminUsers = useMemo(() => {
    let result = [...users];
    if (adminSearchQuery) {
      result = result.filter((u: any) =>
        u.name_surname?.toLowerCase().includes(adminSearchQuery.toLowerCase()) ||
        u.extension_number?.includes(adminSearchQuery) ||
        u.ip_address?.includes(adminSearchQuery)
      );
    }
    return result;
  }, [users, adminSearchQuery]);

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Permanently purge ${selectedIds.length} units from registry?`)) return;

    setIsLoading(true);
    try {
      await apiService.bulkDeleteUsers(selectedIds);
      success(`${selectedIds.length} units purged.`);
      setSelectedIds([]);
      fetchData();
    } catch (e: any) {
      toastError(e.response?.data?.msg || "Bulk purge failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      // Select ALL users across all pages
      const allIds = processedAdminUsers.map(u => u.id);
      setSelectedIds(allIds);
    } else {
      // Deselect all
      setSelectedIds([]);
    }
  };

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return processedUsers.slice(start, start + itemsPerPage);
  }, [processedUsers, currentPage]);

  const totalPages = Math.ceil(processedUsers.length / itemsPerPage);

  const handleManualSync = async () => {
    setIsMonitoring(true);
    try {
      const updated = await apiService.getUsers();
      setUsers(updated);
      success("Network state synchronized.");
    } catch (e) { toastError("Sync failed."); }
    finally { setIsMonitoring(false); }
  };

  const handleMetaAdd = async (type: string) => {
    if (!newMeta) return;
    try {
      await apiService.addMetadata(type, newMeta);
      success(`${type} entity injected.`);
      setNewMeta('');
      fetchData();
    } catch (e) { toastError("Metadata injection failed."); }
  };

  const handleMetaDel = async (type: string, id: number) => {
    if (!confirm(`Purge this ${type} entity?`)) return;
    try {
      await apiService.deleteMetadata(type, id);
      success("Entity purged.");
      fetchData();
    } catch (e) { toastError("Purge protocol failed."); }
  };

  const handleExportCSV = () => {
    const headers = ['name_surname', 'extension_number', 'ip_address', 'department', 'section', 'station', 'mac_address', 'phone_model', 'designation', 'office_number'];
    const csvRows = [headers.join(',')];

    users.forEach((u: any) => {
      const row = headers.map(h => `"${(u[h] || '').toString().replace(/"/g, '""')}"`);
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BCC_VOIP_Directory_Export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    success("Directory exported to CSV.");
  };

  const saveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser.id !== 0) {
        await apiService.updateUser(editingUser.id, editingUser);
        success("Profile metadata committed.");
      } else {
        await apiService.addUser(editingUser);
        success("Hardware registered.");
      }
      fetchData();
      setEditingUser(null);
    } catch (e: any) {
      const msg = e.response?.data?.msg || "Configuration commit failed.";
      toastError(msg);
    }
  };

  // UI Components
  const NavItem = ({ view, icon: Icon, label }: { view: View, icon: any, label: string }) => (
    <button onClick={() => { setActiveView(view); setCurrentPage(1); }} className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${activeView === view ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-500 hover:bg-slate-100'}`}>
      <Icon className="w-4 h-4" />
      <span className="font-bold text-sm tracking-tight">{label}</span>
    </button>
  );

  const TableHeader = ({ k, label }: { k: SortKey, label: string }) => (
    <th className="px-6 py-4 cursor-pointer hover:text-blue-600 transition-colors" onClick={() => handleSort(k)}>
      <div className="flex items-center gap-2">
        {label}
        <ArrowUpDown className={`w-3 h-3 ${sortConfig.key === k ? 'text-blue-600' : 'text-slate-300'}`} />
      </div>
    </th>
  );

  if (authLoading) return <div className="min-h-screen bg-white flex items-center justify-center"><RefreshCw className="w-12 h-12 text-blue-600 animate-spin" /></div>;
  if (!isAuthenticated) return <LoginPage />;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <nav className="sticky top-0 z-40 bg-white border-b border-slate-200 px-6 h-20">
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="BCC" className="w-10 h-10 object-contain" />
            <h1 className="text-xl font-black text-slate-900 tracking-tight hidden lg:block">BCC VOIP Directory</h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-1">
              {isAdmin && <NavItem view="DASHBOARD" icon={LayoutDashboard} label="Overview" />}
              <NavItem view="DIRECTORY" icon={Search} label="Directory" />
              {isAdmin && (
                <>
                  <NavItem view="REPORTS" icon={FileText} label="Reports" />
                  <NavItem view="LOGS" icon={History} label="Activity" />
                  <NavItem view="ADMIN" icon={Settings} label="Management" />
                </>
              )}
            </div>

            <div className="h-8 w-[1px] bg-slate-200 mx-2"></div>

            <div className="flex items-center gap-3 group">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-black text-slate-900 leading-none">{authUser?.username}</p>
                <p className="text-[10px] font-black text-slate-400 mt-1 uppercase">{authUser?.role}</p>
              </div>
              <button onClick={() => { if (confirm('Exit Session?')) logout(); }} title="Logout" aria-label="Logout" className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center hover:bg-rose-600 transition-all shadow-lg hover:shadow-rose-100">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6 md:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">{activeView === 'DIRECTORY' ? 'Directory' : activeView === 'DASHBOARD' ? 'Overview' : activeView === 'ADMIN' ? 'Management' : activeView === 'REPORTS' ? 'Reports' : 'Activity Logs'}</h2>
            {isAdmin && (
              <div className="flex items-center gap-4 mt-2">
                <button onClick={() => setLiveMode(!liveMode)} title="Toggle Live Monitoring" className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${liveMode ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-50' : 'bg-slate-100 text-slate-500'}`}>
                  {liveMode ? <Zap className="w-3 h-3 animate-pulse" /> : <ZapOff className="w-3 h-3" />}
                  {liveMode ? 'Live Updates: ON' : 'Live Updates: OFF'}
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button onClick={handleManualSync} disabled={isMonitoring} className="h-12 px-6 bg-white border-2 border-slate-100 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-600 hover:border-blue-300 hover:text-blue-600 transition-all flex items-center gap-2 shadow-sm">
              <RefreshCw className={`w-4 h-4 ${isMonitoring ? 'animate-spin' : ''}`} /> Sync
            </button>
            {isAdmin && activeView === 'ADMIN' && (
              <div className="flex gap-2">
                {selectedIds.length > 0 && (
                  <button onClick={handleBulkDelete} className="h-12 px-6 bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-rose-700 shadow-xl shadow-rose-100 flex items-center gap-2 transition-all animate-fade-in">
                    <Trash2 className="w-4 h-4" /> Delete ({selectedIds.length})
                  </button>
                )}
                <button onClick={() => fileInputRef.current?.click()} className="h-12 px-6 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 shadow-xl shadow-emerald-100 flex items-center gap-2 transition-all">
                  <Upload className="w-4 h-4" /> Import CSV
                </button>
                <button onClick={handleExportCSV} className="h-12 px-6 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-100 flex items-center gap-2 transition-all">
                  <FileSpreadsheet className="w-4 h-4" /> Export CSV
                </button>
                <button onClick={() => setEditingUser({ id: 0, name_surname: '', extension_number: '', department: (depts[0]?.name || 'IT'), section: '', station: '', ip_address: '', mac_address: '', phone_model: '', designation: '', office_number: '', role: 'user' })} className="h-12 px-6 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-100 flex items-center gap-2 transition-all">
                  <Plus className="w-4 h-4" /> New Hardware
                </button>
              </div>
            )}
          </div>
        </div>

        {activeView === 'DIRECTORY' && (
          <div className="card shadow-2xl shadow-slate-200/50 animate-fade-in border-none">
            <div className="p-8 border-b border-slate-100 flex flex-col xl:flex-row gap-6">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input type="text" placeholder="Search Master Directory..." className="w-full h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl pl-14 pr-6 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-100 transition-all" value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }} />
              </div>
              <div className="flex gap-4 flex-wrap">
                <select title="Filter by Department" className="h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 text-xs font-black uppercase outline-none focus:ring-4 focus:ring-blue-100" value={filterDept} onChange={e => { setFilterDept(e.target.value); setCurrentPage(1); }}>
                  <option value="ALL">All Departments</option>
                  {depts.map((d: any) => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
                <select title="Filter by Section" className="h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 text-xs font-black uppercase outline-none focus:ring-4 focus:ring-blue-100" value={filterSection} onChange={e => { setFilterSection(e.target.value); setCurrentPage(1); }}>
                  <option value="ALL">All Sections</option>
                  {sections.map((s: any) => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
                <select title="Filter by Status" className="h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 text-xs font-black uppercase outline-none focus:ring-4 focus:ring-blue-100" value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }}>
                  <option value="ALL">All Statuses</option>
                  <option value="ONLINE">Online / Registered</option>
                  <option value="OFFLINE">Offline / Unregistered</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto min-h-[600px]">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">
                  <tr>
                    <TableHeader k="name_surname" label="User Identity" />
                    <th className="px-6 py-4">Designation</th>
                    <TableHeader k="department" label="Department" />
                    <th className="px-6 py-4">Office Number</th>
                    <TableHeader k="extension_number" label="Extension" />
                    {isAdmin && <TableHeader k="ip_address" label="IP Interface" />}
                    {isAdmin && <th className="px-6 py-4">Status</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {paginatedUsers.map((u: any) => (
                    <tr key={u.id} className="hover:bg-blue-50/20 transition-all">
                      <td className="px-6 py-6 font-black text-slate-900 group">{u.name_surname}</td>
                      <td className="px-6 py-6 text-xs font-bold text-slate-600 italic">{u.designation || 'N/A'}</td>
                      <td className="px-6 py-6 text-xs font-black text-slate-500 uppercase">{u.department}</td>
                      <td className="px-6 py-6 text-xs font-bold text-slate-600">{u.office_number || 'N/A'}</td>
                      <td className="px-6 py-6"><span className="bg-blue-600 text-white px-4 py-2 rounded-xl font-black text-sm font-mono shadow-md shadow-blue-100">{u.extension_number}</span></td>
                      {isAdmin && <td className="px-6 py-6 font-bold font-mono text-xs text-slate-400">{u.ip_address}</td>}
                      {isAdmin && (
                        <td className="px-6 py-6">
                          <div className="flex items-center gap-3">
                            <StatusBadge status={u.status} />
                            <span className={`text-[10px] font-black uppercase tracking-tighter ${u.sip_status === 'Registered' ? 'text-emerald-500' : 'text-rose-400'}`}>{u.sip_status || 'Unregistered'}</span>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Page {currentPage} of {totalPages || 1} • {processedUsers.length} Units Found</p>
              <div className="flex gap-2">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} title="Previous Page" className="h-10 w-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-all disabled:opacity-30" disabled={currentPage === 1}><ChevronLeft className="w-4 h-4" /></button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .map((p, i, arr) => (
                    <React.Fragment key={p}>
                      {i > 0 && arr[i - 1] !== p - 1 && <span className="px-2 text-slate-300">...</span>}
                      <button onClick={() => setCurrentPage(p)} className={`h-10 w-10 rounded-xl font-black text-xs transition-all ${currentPage === p ? 'bg-blue-600 text-white shadow-xl shadow-blue-300 ring-4 ring-blue-100' : 'bg-white border border-slate-200 hover:bg-slate-50 text-slate-600'}`}>{p}</button>
                    </React.Fragment>
                  ))
                }
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} title="Next Page" className="h-10 w-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-all disabled:opacity-30" disabled={currentPage === totalPages}><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        )}

        {activeView === 'DASHBOARD' && isAdmin && (
          <div className="space-y-10 animate-fade-in">
            <DashboardCards stats={stats} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="card p-8 bg-slate-900 border-none text-white overflow-hidden relative">
                <div className="absolute top-0 right-0 p-8 opacity-10"><Monitor className="w-32 h-32" /></div>
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-blue-400 mb-8">Live Device Status</h3>
                <div className="space-y-6">
                  {users.slice(0, 5).map((u: any) => (
                    <div key={u.id} className="flex items-center justify-between group">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-white/5 ${u.status === 'Online' ? 'text-emerald-400' : 'text-rose-400'}`}><Activity className="w-5 h-5" /></div>
                        <div>
                          <p className="font-black text-sm group-hover:text-blue-400 transition-colors uppercase">{u.name_surname}</p>
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">{u.extension_number} • {u.ip_address}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-[10px] font-black uppercase ${u.sip_status === 'Registered' ? 'text-emerald-500' : 'text-rose-500'}`}>{u.sip_status || 'Unregistered'}</p>
                        <p className="text-[8px] font-bold text-slate-600 uppercase mt-0.5">SIP PORT: {u.sip_port_open ? 'OPEN' : 'CLOSED'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card p-8 bg-white shadow-2xl shadow-indigo-100 border-none">
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-indigo-600 mb-8">Recent Activity</h3>
                <div className="space-y-8">
                  {logs.slice(0, 5).map(l => (
                    <div key={l.id} className="flex gap-4 group">
                      <div className="text-[10px] font-black text-slate-300 w-16 pt-1 whitespace-nowrap">{new Date(l.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      <div>
                        <p className="text-xs font-black text-slate-900 group-hover:text-indigo-600 transition-colors uppercase italic">{l.action}</p>
                        <p className="text-[11px] font-bold text-slate-400 mt-0.5">{l.user_name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeView === 'ADMIN' && isAdmin && (
          <div className="space-y-12 animate-fade-in pb-10">
            <div className="card shadow-xl shadow-slate-200/40 border-none">
              <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6 bg-slate-50/30">
                <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">Managed Devices</h3>
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="text" placeholder="Search Managed Units..." className="w-full h-12 bg-white border border-slate-200 rounded-xl pl-12 pr-6 text-xs font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all" value={adminSearchQuery} onChange={e => { setAdminSearchQuery(e.target.value); setCurrentPage(1); }} />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                    <tr>
                      <th className="px-8 py-5 w-10">
                        <div className="flex flex-col items-center gap-1">
                          <input
                            type="checkbox"
                            title="Select All Users"
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            checked={selectedIds.length === processedAdminUsers.length && processedAdminUsers.length > 0}
                            onChange={e => toggleSelectAll(e.target.checked)}
                          />
                          {processedAdminUsers.length > 0 && (
                            <span className="text-[8px] text-slate-400 whitespace-nowrap">{selectedIds.length}/{processedAdminUsers.length}</span>
                          )}
                        </div>
                      </th>
                      <th className="px-8 py-5">Entity</th>
                      <th className="px-8 py-5">Extension</th>
                      <th className="px-8 py-5">IP Lease</th>
                      <th className="px-8 py-5">Hardware Profile</th>
                      <th className="px-8 py-5 text-right">Operations</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {processedAdminUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((u: any) => (
                      <tr key={u.id} className={`hover:bg-slate-50 transition-all ${selectedIds.includes(u.id) ? 'bg-blue-50/30' : ''}`}>
                        <td className="px-8 py-6">
                          <input
                            type="checkbox"
                            title="Select Unit"
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            checked={selectedIds.includes(u.id)}
                            onChange={() => setSelectedIds(prev => prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id])}
                          />
                        </td>
                        <td className="px-8 py-6">
                          <p className="font-black text-slate-900 uppercase">{u.name_surname}</p>
                          <p className="text-[10px] font-black text-slate-400">{u.department}</p>
                        </td>
                        <td className="px-8 py-6 font-black text-blue-600">{u.extension_number}</td>
                        <td className="px-8 py-6 font-black font-mono text-xs text-slate-400">{u.ip_address}</td>
                        <td className="px-8 py-6">
                          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{u.mac_address}</p>
                          <p className="text-[9px] font-bold text-slate-300 italic">{u.phone_model || 'Standard Device'}</p>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <div className="inline-flex gap-2">
                            <button onClick={() => setEditingUser(ensureNoNulls(u))} title="Edit Configuration" className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={async () => { if (confirm('Permanently purge this unit from registry?')) { await apiService.deleteUser(u.id); fetchData(); } }} title="Purge Unit" className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center hover:bg-rose-600 hover:text-white transition-all"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Registry Page {currentPage} of {Math.ceil(processedAdminUsers.length / itemsPerPage) || 1}</p>
                <div className="flex gap-2">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} title="Previous Page" className="h-10 w-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-all disabled:opacity-30" disabled={currentPage === 1}><ChevronLeft className="w-4 h-4" /></button>
                  {Array.from({ length: Math.ceil(processedAdminUsers.length / itemsPerPage) }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === Math.ceil(processedAdminUsers.length / itemsPerPage) || Math.abs(p - currentPage) <= 1)
                    .map((p, i, arr) => (
                      <React.Fragment key={p}>
                        {i > 0 && arr[i - 1] !== p - 1 && <span className="px-2 text-slate-300">...</span>}
                        <button key={p} onClick={() => setCurrentPage(p)} className={`h-10 w-10 rounded-xl font-black text-xs transition-all ${currentPage === p ? 'bg-blue-600 text-white shadow-xl shadow-blue-300 ring-4 ring-blue-50' : 'bg-white border border-slate-200 hover:bg-slate-50 text-slate-600'}`}>{p}</button>
                      </React.Fragment>
                    ))
                  }
                  <button onClick={() => setCurrentPage(p => Math.min(Math.ceil(processedAdminUsers.length / itemsPerPage), p + 1))} title="Next Page" className="h-10 w-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-all disabled:opacity-30" disabled={currentPage === Math.ceil(processedAdminUsers.length / itemsPerPage)}><ChevronRight className="w-4 h-4" /></button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <h3 className="font-black text-slate-900 uppercase tracking-[0.2em] text-xs px-2">Organization Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {['departments', 'sections', 'stations'].map(type => (
                    <div key={type} className="card p-6 shadow-lg shadow-slate-200/30">
                      <h4 className="font-black text-slate-900 uppercase tracking-widest text-[10px] mb-4 flex items-center justify-between">
                        {type} <Layers className="w-4 h-4 text-blue-600" />
                      </h4>
                      <div className="flex gap-2 mb-4">
                        <input
                          type="text"
                          title={`Add new ${type}`}
                          placeholder={`Add ${type.slice(0, -1)}...`}
                          className="flex-1 h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-100"
                          onKeyPress={(e) => { if (e.key === 'Enter') handleMetaAdd(type); }}
                          onChange={(e) => setNewMeta(e.target.value)}
                          value={newMeta}
                        />
                        <button onClick={() => handleMetaAdd(type)} title="Add Item" className="h-10 w-10 bg-slate-900 text-white rounded-xl flex items-center justify-center hover:bg-blue-600 transition-all"><Plus className="w-4 h-4" /></button>
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                        {(type === 'departments' ? depts : type === 'sections' ? sections : stations).map((m: any) => (
                          <div key={m.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl group/item">
                            <span className="text-[10px] font-black text-slate-600 uppercase truncate">{m.name}</span>
                            <button onClick={() => handleMetaDel(type, m.id)} title="Delete Item" className="text-slate-300 hover:text-rose-600 transition-colors opacity-0 group-hover/item:opacity-100"><XCircle className="w-3.5 h-3.5" /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card p-8 bg-blue-600 border-none text-white h-fit shadow-2xl shadow-blue-200">
                <h3 className="font-black uppercase tracking-[0.2em] text-xs mb-6">Data Management</h3>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept=".csv"
                  title="Bulk Import CSV"
                  aria-label="Bulk Import CSV"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      try {
                        setIsLoading(true);
                        await apiService.importUsers(file);
                        success("Bulk data imported successfully.");
                        fetchData();
                      } catch (err) { toastError("Bulk import failed."); }
                      finally { setIsLoading(false); }
                    }
                  }} />
                <div className="space-y-4">
                  <button onClick={() => fileInputRef.current?.click()} className="w-full h-14 bg-white text-blue-600 rounded-2xl flex items-center justify-between px-6 transition-all font-black text-xs uppercase tracking-widest shadow-lg">
                    Bulk Import CSV <Upload className="w-4 h-4" />
                  </button>
                  <button onClick={handleExportCSV} className="w-full h-14 bg-white/10 hover:bg-white/20 rounded-2xl flex items-center justify-between px-6 transition-all font-black text-xs uppercase tracking-widest border border-white/20">
                    Bulk Export CSV <FileSpreadsheet className="w-4 h-4" />
                  </button>
                  <button onClick={async () => { if (confirm('Run Cleanup?')) { await apiService.runCleanup(); success('Cleanup complete'); fetchData(); } }} className="w-full h-14 bg-white/10 hover:bg-white/20 rounded-2xl flex items-center justify-between px-6 transition-all font-black text-xs uppercase tracking-widest border border-white/20">
                    System Cleanup <Wand2 className="w-4 h-4" />
                  </button>
                  <div className="p-4 bg-black/10 rounded-2xl mt-8">
                    <p className="text-[9px] font-black uppercase text-blue-100 tracking-widest mb-1 opacity-60">Status</p>
                    <p className="text-xs font-black italic tracking-tighter">System Active</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeView === 'LOGS' && isAdmin && (
          <div className="card shadow-2xl shadow-slate-200/50 animate-fade-in border-none">
            <div className="p-8 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h3 className="font-black text-slate-900 uppercase tracking-[0.3em] text-xs">System Audit Logs</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-900 text-white sticky top-0 z-10">
                  <tr className="text-[10px] font-black uppercase tracking-[0.3em]">
                    <th className="px-10 py-6">Timestamp</th>
                    <th className="px-10 py-6 text-center">Protocol</th>
                    <th className="px-10 py-6">Operator</th>
                    <th className="px-10 py-6">Diagnostic Payload</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-all">
                      <td className="px-10 py-8 text-[11px] font-black text-slate-400 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-10 py-8 text-center">
                        <span className="bg-slate-100 text-slate-900 px-4 py-2 rounded-full text-[9px] font-black tracking-widest uppercase border border-slate-200">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-10 py-8 font-black text-slate-900 uppercase text-xs">{log.user_name}</td>
                      <td className="px-10 py-8 text-xs text-slate-500 italic font-black leading-relaxed">{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeView === 'REPORTS' && isAdmin && (
          <div className="max-w-5xl mx-auto py-10 animate-fade-in space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl shadow-slate-200/50 group border border-slate-50 transition-all hover:-translate-y-2">
                <div className="w-20 h-20 bg-blue-600 text-white rounded-3xl flex items-center justify-center mb-10 shadow-xl shadow-blue-200 group-hover:rotate-6 transition-transform">
                  <FileText className="w-10 h-10" />
                </div>
                <h3 className="text-3xl font-black text-slate-900 mb-4 uppercase tracking-tighter">Daily Offline Report</h3>
                <p className="text-slate-500 font-bold mb-10 leading-relaxed text-sm">Critical audit of hardware failure clusters within the latest 24-hour network cycle.</p>
                <div className="flex gap-4">
                  <button onClick={() => success('Report Generation Queued')} className="flex-1 h-16 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-800 transition-all">Generate PDF</button>
                  <button className="px-8 h-16 bg-slate-100 text-slate-900 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-200 transition-all">Excel</button>
                </div>
              </div>

              <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl shadow-slate-200/50 group border border-slate-50 transition-all hover:-translate-y-2">
                <div className="w-20 h-20 bg-indigo-600 text-white rounded-3xl flex items-center justify-center mb-10 shadow-xl shadow-indigo-200 group-hover:-rotate-6 transition-transform">
                  <History className="w-10 h-10" />
                </div>
                <h3 className="text-3xl font-black text-slate-900 mb-4 uppercase tracking-tighter">Custom Range Report</h3>
                <p className="text-slate-500 font-bold mb-10 leading-relaxed text-sm">Cross-sectional analysis of handset performance across a custom-defined date manifest.</p>
                <div className="flex gap-4">
                  <button className="flex-1 h-16 bg-slate-100 text-slate-900 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-200 transition-all">Select Date Manifest</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl z-[200] flex items-center justify-center p-6 bg-glow-blue animate-fade-in">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl overflow-hidden animate-zoom-in border border-slate-100">
            <div className="p-10 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">{editingUser.id !== 0 ? 'Edit User' : 'Register User'}</h3>
                <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mt-1">User Database</p>
              </div>
              <button onClick={() => setEditingUser(null)} title="Close" aria-label="Close" className="h-12 w-12 flex items-center justify-center bg-white rounded-2xl border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"><XCircle className="w-8 h-8" /></button>
            </div>
            <form onSubmit={saveUser} className="p-10 space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Staff Member</label>
                  <input required placeholder="Identity Name" className="input-field" value={editingUser.name_surname || ''} onChange={e => setEditingUser({ ...editingUser, name_surname: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Extension Code</label>
                  <input placeholder="8000" className="input-field font-black text-blue-600" value={editingUser.extension_number || ''} onChange={e => setEditingUser({ ...editingUser, extension_number: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">IP Lease ID</label>
                  <input placeholder="192.168.x.x" className="input-field font-mono" value={editingUser.ip_address || ''} onChange={e => setEditingUser({ ...editingUser, ip_address: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Structural Unit</label>
                  <select title="Select Department" className="input-field" value={editingUser.department || ''} onChange={e => setEditingUser({ ...editingUser, department: e.target.value })}>
                    <option value="">None</option>
                    {depts.map((d: any) => <option key={d.id} value={d.name}>{d.name}</option>)}
                    {depts.length === 0 && DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Physical Station</label>
                  <input placeholder="Location" className="input-field" value={editingUser.station || ''} onChange={e => setEditingUser({ ...editingUser, station: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Device Model</label>
                  <input placeholder="Hardware Blueprint" className="input-field" value={editingUser.phone_model || ''} onChange={e => setEditingUser({ ...editingUser, phone_model: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">MAC Signature</label>
                  <input placeholder="00:...:00" className="input-field font-mono text-xs uppercase" value={editingUser.mac_address || ''} onChange={e => setEditingUser({ ...editingUser, mac_address: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Office Code</label>
                  <input placeholder="B22" className="input-field" value={editingUser.office_number || ''} onChange={e => setEditingUser({ ...editingUser, office_number: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Official Role</label>
                  <select title="Select Role" className="input-field h-14" value={editingUser.role || 'user'} onChange={e => setEditingUser({ ...editingUser, role: e.target.value })}>
                    <option value="user">Staff Member</option>
                    <option value="admin">System Admin</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-4 pt-6 border-t border-slate-100">
                <button type="button" onClick={() => setEditingUser(null)} className="flex-1 py-5 bg-slate-50 text-slate-500 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-100 transition-all">Abort</button>
                <button type="submit" className="flex-[2] py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] hover:bg-blue-600 shadow-2xl shadow-blue-200 transition-all">Execute Registration</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="fixed inset-0 bg-white/60 backdrop-blur-md z-[300] flex items-center justify-center">
          <div className="flex flex-col items-center gap-6 p-12 bg-white rounded-[3rem] shadow-2xl border border-slate-50 scale-up">
            <RefreshCw className="w-16 h-16 text-blue-600 animate-spin" />
            <div className="text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-1">Loading Data</p>
              <p className="text-xs font-black text-slate-900 uppercase italic">Please Wait...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
