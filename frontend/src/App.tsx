import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  LayoutDashboard,
  Settings,
  FileText,
  Search,
  Plus,
  RefreshCw,
  Trash2,
  Edit2,
  History,
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
  ZapOff,
  Menu,
  X,
  Clock,
  Star,
  LayoutGrid,
  List,
  GitBranch,
  Radio,
  Printer,
} from 'lucide-react';
import { VoipUser, DeviceStatus, SystemStats, ActivityLog } from './types';
import { DEPARTMENTS } from './constants';
import { DashboardCards } from './components/DashboardCards';
import { StatusBadge } from './components/StatusBadge';
import { ConfirmModal } from './components/ConfirmModal';
import { apiService } from './services/apiService';
import { socketService } from './services/socketService';
import { useAuth } from './context/AuthContext';
import { useToast } from './context/ToastContext';
import { LoginPage } from './components/pages/LoginPage';
// @ts-ignore
import logo from './assets/logo.jpg';

type View = 'DASHBOARD' | 'DIRECTORY' | 'ADMIN' | 'REPORTS' | 'LOGS' | 'NOC' | 'LOGIN';
type ViewMode = 'table' | 'cards';
type SortKey = 'name_surname' | 'email' | 'extension_number' | 'old_extension_number' | 'ip_address' | 'department' | 'station' | 'status';

interface ConfirmState {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
}

const App: React.FC = () => {
  const { isAuthenticated, logout, isLoading: authLoading, user: authUser } = useAuth();
  const { success, error: toastError } = useToast();
  const [activeView, setActiveView] = useState<View>('DIRECTORY');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  const stripPunctuation = (str: string) => str.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const ALL_DEPARTMENTS = 'ALL';
  const NO_DEPARTMENT = '__NO_DEPARTMENT__';
  const normalizeDepartment = (value: any) => (value ?? '').toString().trim();

  const [users, setUsers] = useState<any[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [liveMode, setLiveMode] = useState(() => localStorage.getItem('bcc_live_mode') !== 'false');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    localStorage.setItem('bcc_live_mode', liveMode.toString());
  }, [liveMode]);

  const [searchQuery, setSearchQuery] = useState('');
  const [adminSearchQuery, setAdminSearchQuery] = useState('');
  const [adminFilterDept, setAdminFilterDept] = useState(ALL_DEPARTMENTS);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Separate pagination state per view
  const [currentPage, setCurrentPage] = useState(1);
  const [adminCurrentPage, setAdminCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Directory filters
  const [filterDept, setFilterDept] = useState('ALL');
  const [filterSection, setFilterSection] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'name_surname', direction: 'asc' });

  // Separate state per metadata type (previously all shared one variable — bug)
  const [depts, setDepts] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [newDept, setNewDept] = useState('');
  const [newSection, setNewSection] = useState('');
  const [newStation, setNewStation] = useState('');

  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    (localStorage.getItem('bcc_view_mode') as ViewMode) || 'table'
  );
  const [showTree, setShowTree] = useState(() =>
    localStorage.getItem('bcc_show_tree') === 'true'
  );
  const [favouriteIds, setFavouriteIds] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem('bcc_favourites') || '[]'); }
    catch { return []; }
  });
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());

  useEffect(() => { localStorage.setItem('bcc_view_mode', viewMode); }, [viewMode]);
  useEffect(() => { localStorage.setItem('bcc_show_tree', showTree.toString()); }, [showTree]);

  const getAvatarColor = (dept?: string): string => {
    const palette = ['bg-blue-600', 'bg-indigo-600', 'bg-violet-600', 'bg-purple-600', 'bg-rose-600', 'bg-amber-600', 'bg-teal-600', 'bg-cyan-600', 'bg-emerald-600', 'bg-orange-600'];
    if (!dept) return 'bg-slate-500';
    let h = 0;
    for (let i = 0; i < dept.length; i++) h = dept.charCodeAt(i) + ((h << 5) - h);
    return palette[Math.abs(h) % palette.length];
  };

  const toggleFavourite = (id: number) => {
    setFavouriteIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      localStorage.setItem('bcc_favourites', JSON.stringify(next));
      return next;
    });
  };

  const isAdmin = authUser?.role === 'admin';

  // Escape closes any open overlay
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (confirmState) { setConfirmState(null); return; }
      if (editingUser) { setEditingUser(null); return; }
      if (mobileMenuOpen) { setMobileMenuOpen(false); return; }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [confirmState, editingUser, mobileMenuOpen]);

  const openConfirm = (state: ConfirmState) => setConfirmState(state);

  useEffect(() => {
    if (!isAuthenticated) return;

    const handleStatusUpdate = (extension: any) => {
      setUsers(prev => prev.map(u => u.id === extension.user_id ? { ...u, ...extension } : u));
    };
    const handleUserAdded = (user: any) => {
      setUsers(prev => [...prev, user]);
      success('New user added');
    };
    const handleUserDeleted = ({ id }: { id: number }) => {
      setUsers(prev => prev.filter(u => u.id !== id));
    };
    const handleBulkUpdate = (type: string) => {
      if (type === 'import') fetchData(true);
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

  // silent=true skips the full-screen overlay (used after mutations)
  const fetchData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const [userData, logData] = await Promise.all([
        apiService.getUsers(),
        isAdmin ? apiService.getLogs() : Promise.resolve([])
      ]);
      setUsers(userData);
      setLogs(logData);

      // Always fetch metadata so non-admin users can use dept/section filters
      const [d, st, sec] = await Promise.all([
        apiService.getMetadata('departments'),
        isAdmin ? apiService.getMetadata('stations') : Promise.resolve([]),
        apiService.getMetadata('sections')
      ]);
      setDepts(d);
      setStations(st);
      setSections(sec);
    } catch (e) {
      toastError('Failed to load data.');
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    // Wait for auth check to finish before fetching — avoids a double fetch
    // when the session resolves and isAdmin flips from false → true.
    if (authLoading) return;
    fetchData();
    if (isAuthenticated) {
      if (!isAdmin && activeView === 'LOGIN') setActiveView('DIRECTORY');
      else if (isAdmin && activeView === 'LOGIN') setActiveView('DASHBOARD');
    } else {
      setSearchQuery('');
      setAdminSearchQuery('');
      setAdminFilterDept(ALL_DEPARTMENTS);
      setActiveView('DIRECTORY');
    }
  }, [isAuthenticated, isAdmin, authLoading]);

  useEffect(() => {
    setSearchQuery('');
    setAdminSearchQuery('');
    setAdminFilterDept(ALL_DEPARTMENTS);
  }, [authUser?.username]);

  const stats: SystemStats = useMemo(() => ({
    totalExtensions: users.length,
    onlineCount: users.filter(u => u.status === 'Online' || u.status === 'Registered').length,
    offlineCount: users.filter(u => u.status === 'Offline' || u.status === 'Unregistered').length,
    departments: new Set(users.map(u => u.department)).size
  }), [users]);

  const handleSort = (key: SortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const processedUsers = useMemo(() => {
    let result = [...users];

    if (searchQuery) {
      const q = stripPunctuation(searchQuery);
      result = result.filter((u: any) =>
        stripPunctuation(u.name_surname || '').includes(q) ||
        stripPunctuation(u.email || '').includes(q) ||
        stripPunctuation(u.extension_number || '').includes(q) ||
        stripPunctuation(u.old_extension_number || '').includes(q) ||
        stripPunctuation(u.ip_address || '').includes(q) ||
        stripPunctuation(u.department || '').includes(q) ||
        stripPunctuation(u.section || '').includes(q) ||
        stripPunctuation(u.station || '').includes(q) ||
        stripPunctuation(u.mac_address || '').includes(q) ||
        stripPunctuation(u.phone_model || '').includes(q) ||
        stripPunctuation(u.office_number || '').includes(q)
      );
    }

    if (filterDept !== 'ALL') result = result.filter((u: any) => u.department === filterDept);
    if (filterSection !== 'ALL') result = result.filter((u: any) => u.section === filterSection);

    if (filterStatus !== 'ALL') {
      if (filterStatus === 'ONLINE') result = result.filter((u: any) => u.status === 'Online' || u.status === 'Registered');
      else if (filterStatus === 'OFFLINE') result = result.filter((u: any) => u.status === 'Offline' || u.status === 'Unregistered');
    }

    result.sort((a, b) => {
      const valA = a[sortConfig.key]?.toString().toLowerCase() || '';
      const valB = b[sortConfig.key]?.toString().toLowerCase() || '';
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [users, searchQuery, filterDept, filterSection, filterStatus, sortConfig]);

  const deptTree = useMemo(() => {
    const tree = new Map<string, Set<string>>();
    users.forEach(u => {
      if (!u.department) return;
      if (!tree.has(u.department)) tree.set(u.department, new Set());
      if (u.section) tree.get(u.department)!.add(u.section);
    });
    return tree;
  }, [users]);

  const processedUsersWithFaves = useMemo(() => {
    const favs = processedUsers.filter(u => favouriteIds.includes(u.id));
    const rest = processedUsers.filter(u => !favouriteIds.includes(u.id));
    return [...favs, ...rest];
  }, [processedUsers, favouriteIds]);

  const toEmpty = (val: any) => (val === null || val === undefined) ? '' : val;
  const ensureNoNulls = (user: any) => {
    if (!user) return null;
    return {
      ...user,
      name_surname: toEmpty(user.name_surname),
      email: toEmpty(user.email),
      extension_number: toEmpty(user.extension_number),
      old_extension_number: toEmpty(user.old_extension_number),
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

  const managementDeptOptions = useMemo(() => {
    const deduped = new Map<string, string>();
    const addOption = (value: any) => {
      const normalized = normalizeDepartment(value);
      if (!normalized) return;
      const key = normalized.toLowerCase();
      if (!deduped.has(key)) deduped.set(key, normalized);
    };
    depts.forEach((d: any) => addOption(d?.name));
    users.forEach((u: any) => addOption(u?.department));
    return Array.from(deduped.values()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [depts, users]);

  const processedAdminUsers = useMemo(() => {
    let result = [...users];
    if (adminSearchQuery) {
      const q = stripPunctuation(adminSearchQuery);
      result = result.filter((u: any) =>
        stripPunctuation(u.name_surname || '').includes(q) ||
        stripPunctuation(u.email || '').includes(q) ||
        stripPunctuation(u.extension_number || '').includes(q) ||
        stripPunctuation(u.old_extension_number || '').includes(q) ||
        stripPunctuation(u.ip_address || '').includes(q) ||
        stripPunctuation(u.department || '').includes(q) ||
        stripPunctuation(u.section || '').includes(q) ||
        stripPunctuation(u.station || '').includes(q) ||
        stripPunctuation(u.office_number || '').includes(q) ||
        stripPunctuation(u.designation || '').includes(q) ||
        stripPunctuation(u.mac_address || '').includes(q) ||
        stripPunctuation(u.phone_model || '').includes(q)
      );
    }
    if (adminFilterDept === NO_DEPARTMENT) {
      result = result.filter((u: any) => !normalizeDepartment(u.department));
    } else if (adminFilterDept !== ALL_DEPARTMENTS) {
      result = result.filter((u: any) => normalizeDepartment(u.department) === adminFilterDept);
    }
    return result;
  }, [users, adminSearchQuery, adminFilterDept]);

  useEffect(() => {
    const visibleIds = new Set(processedAdminUsers.map((u: any) => u.id));
    setSelectedIds(prev => {
      const next = prev.filter(id => visibleIds.has(id));
      if (next.length === prev.length && next.every((id, i) => id === prev[i])) return prev;
      return next;
    });
  }, [processedAdminUsers]);

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    openConfirm({
      title: `Delete ${selectedIds.length} user${selectedIds.length > 1 ? 's' : ''}?`,
      message: `This permanently removes ${selectedIds.length} user${selectedIds.length > 1 ? 's' : ''} and all associated data. This cannot be undone.`,
      confirmLabel: `Delete ${selectedIds.length} Users`,
      danger: true,
      onConfirm: async () => {
        setConfirmState(null);
        setIsLoading(true);
        try {
          await apiService.bulkDeleteUsers(selectedIds, authUser?.username);
          success(`${selectedIds.length} users deleted.`);
          setSelectedIds([]);
          fetchData();
        } catch (e: any) {
          toastError(e.response?.data?.msg || 'Delete failed.');
        } finally {
          setIsLoading(false);
        }
      }
    });
  };

  const handleDeleteUser = (u: any) => {
    openConfirm({
      title: 'Delete user?',
      message: `Permanently delete ${u.name_surname}? This cannot be undone.`,
      confirmLabel: 'Delete User',
      danger: true,
      onConfirm: async () => {
        setConfirmState(null);
        try {
          await apiService.deleteUser(u.id, authUser?.username);
          fetchData(true);
        } catch (e) {
          toastError('Delete failed.');
        }
      }
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? processedAdminUsers.map(u => u.id) : []);
  };

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return processedUsersWithFaves.slice(start, start + itemsPerPage);
  }, [processedUsersWithFaves, currentPage]);

  const totalPages = Math.ceil(processedUsersWithFaves.length / itemsPerPage);
  const adminTotalPages = Math.ceil(processedAdminUsers.length / itemsPerPage);

  const handleManualSync = async () => {
    setIsMonitoring(true);
    try {
      const updated = await apiService.getUsers();
      setUsers(updated);
      success('Directory synced.');
    } catch (e) {
      toastError('Sync failed.');
    } finally {
      setIsMonitoring(false);
    }
  };

  const getNewMetaValue = (type: string) =>
    type === 'departments' ? newDept : type === 'sections' ? newSection : newStation;

  const setNewMetaValue = (type: string, value: string) => {
    if (type === 'departments') setNewDept(value);
    else if (type === 'sections') setNewSection(value);
    else setNewStation(value);
  };

  const handleMetaAdd = async (type: string) => {
    const val = getNewMetaValue(type);
    if (!val.trim()) return;
    try {
      await apiService.addMetadata(type, val.trim(), authUser?.username);
      success(`Added to ${type}.`);
      setNewMetaValue(type, '');
      fetchData(true);
    } catch (e) {
      toastError('Could not add item.');
    }
  };

  const handleMetaDel = (type: string, id: number, name: string) => {
    openConfirm({
      title: `Remove "${name}"?`,
      message: `This removes the ${type.slice(0, -1)} from the system.`,
      confirmLabel: 'Remove',
      danger: true,
      onConfirm: async () => {
        setConfirmState(null);
        try {
          await apiService.deleteMetadata(type, id, authUser?.username);
          success('Removed.');
          fetchData(true);
        } catch (e) {
          toastError('Delete failed.');
        }
      }
    });
  };

  const handleExportCSV = () => {
    const headers = ['name_surname', 'email', 'extension_number', 'old_extension_number', 'ip_address', 'department', 'section', 'station', 'mac_address', 'phone_model', 'designation', 'office_number'];
    const csvRows = [headers.join(',')];
    users.forEach((u: any) => {
      const row = headers.map(h => `"${(u[h] || '').toString().replace(/"/g, '""')}"`);
      csvRows.push(row.join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CoB_INTERNAL_DIRECTORY_Export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    success('Directory exported to CSV.');
  };

  const printDepartmentPDF = () => {
    const deptLabel = filterDept !== 'ALL' ? filterDept : 'All Departments';
    const targets = [...processedUsers].sort((a, b) => a.name_surname.localeCompare(b.name_surname));

    const printWin = window.open('', '_blank');
    if (!printWin) { toastError('Popup blocked — allow popups and try again.'); return; }

    const rows = targets.map(u => `
      <tr>
        <td>${u.name_surname || ''}</td>
        <td>${u.extension_number || '—'}</td>
        <td>${u.designation || '—'}</td>
        <td>${u.department || '—'}</td>
        <td>${u.section || '—'}</td>
        <td>${u.station || '—'}</td>
        <td>${u.office_number || '—'}</td>
        <td>${u.email || '—'}</td>
      </tr>`).join('');

    printWin.document.write(`<!DOCTYPE html><html lang="en"><head>
      <meta charset="UTF-8">
      <title>CoB Directory — ${deptLabel}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Arial,sans-serif;font-size:10px;padding:16px;color:#0f172a}
        h1{font-size:15px;font-weight:900;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px}
        .meta{font-size:8px;color:#64748b;margin-bottom:12px}
        table{width:100%;border-collapse:collapse}
        th{background:#2563eb;color:#fff;padding:6px 8px;text-align:left;font-size:8px;text-transform:uppercase;letter-spacing:.08em}
        td{padding:5px 8px;border-bottom:1px solid #e2e8f0;vertical-align:top}
        tr:nth-child(even) td{background:#f8fafc}
        @media print{body{padding:0}@page{margin:12mm;size:A4 landscape}}
      </style>
    </head><body>
      <h1>CoB Internal Directory — ${deptLabel}</h1>
      <p class="meta">Generated: ${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} &nbsp;|&nbsp; Total: ${targets.length}</p>
      <table>
        <thead><tr>
          <th>Name</th><th>Extension</th><th>Designation</th><th>Department</th>
          <th>Section</th><th>Station</th><th>Office</th><th>Email</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </body></html>`);

    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); printWin.close(); }, 400);
    success('Print dialog opened.');
  };

  const saveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const userPayload = { ...editingUser, audit_user: authUser?.username };
      if (editingUser.id !== 0) {
        await apiService.updateUser(editingUser.id, userPayload);
        success('User updated successfully.');
      } else {
        await apiService.addUser(userPayload);
        success('User added successfully.');
      }
      fetchData(true);
      setEditingUser(null);
    } catch (e: any) {
      toastError(e.response?.data?.msg || 'Save failed.');
    } finally {
      setIsSaving(false);
    }
  };

  const navigate = (view: View) => {
    setActiveView(view);
    setCurrentPage(1);
    setMobileMenuOpen(false);
  };

  // Dashboard: show offline devices first so issues are immediately visible
  const dashboardDevices = useMemo(() => {
    return [...users].sort((a, b) => {
      const aOnline = a.status === 'Online' || a.status === 'Registered' ? 1 : 0;
      const bOnline = b.status === 'Online' || b.status === 'Registered' ? 1 : 0;
      return aOnline - bOnline;
    }).slice(0, 6);
  }, [users]);

  // Reusable pagination component
  const Pagination = ({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) => (
    <div className="flex gap-2">
      <button type="button" onClick={() => onChange(Math.max(1, page - 1))} aria-label="Previous page" disabled={page === 1} className="h-10 w-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-all disabled:opacity-30">
        <ChevronLeft className="w-4 h-4" />
      </button>
      {Array.from({ length: total }, (_, i) => i + 1)
        .filter(p => p === 1 || p === total || Math.abs(p - page) <= 1)
        .map((p, i, arr) => (
          <React.Fragment key={p}>
            {i > 0 && arr[i - 1] !== p - 1 && <span className="px-1 text-slate-300 self-center">…</span>}
            <button
              type="button"
              onClick={() => onChange(p)}
              aria-label={`Page ${p}`}
              aria-current={page === p ? 'page' : undefined}
              className={`h-10 w-10 rounded-xl font-black text-xs transition-all ${page === p ? 'bg-blue-600 text-white shadow-xl shadow-blue-300 ring-4 ring-blue-100' : 'bg-white border border-slate-200 hover:bg-slate-50 text-slate-600'}`}
            >
              {p}
            </button>
          </React.Fragment>
        ))}
      <button type="button" onClick={() => onChange(Math.min(total, page + 1))} aria-label="Next page" disabled={page === total} className="h-10 w-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-all disabled:opacity-30">
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );

  const NavItem = ({ view, icon: Icon, label }: { view: View; icon: any; label: string }) => (
    <button
      type="button"
      onClick={() => navigate(view)}
      aria-current={activeView === view ? 'page' : undefined}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${activeView === view ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-500 hover:bg-slate-100'}`}
    >
      <Icon className="w-4 h-4" />
      <span className="font-bold text-sm tracking-tight">{label}</span>
    </button>
  );

  const TableHeader = ({ k, label }: { k: SortKey; label: string }) => (
    <th className="px-6 py-4 cursor-pointer hover:text-blue-600 transition-colors" onClick={() => handleSort(k)}>
      <div className="flex items-center gap-2">
        {label}
        <ArrowUpDown className={`w-3 h-3 ${sortConfig.key === k ? 'text-blue-600' : 'text-slate-300'}`} />
      </div>
    </th>
  );

  if (authLoading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <RefreshCw className="w-12 h-12 text-blue-600 animate-spin" />
    </div>
  );
  if (activeView === 'LOGIN') return <LoginPage onBack={() => setActiveView('DIRECTORY')} />;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">

      {/* ── NAV ── */}
      <nav className="sticky top-0 z-40 bg-white border-b border-slate-200 px-6 h-20">
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="CoB logo" className="w-10 h-10 object-contain" />
            <h1 className="text-xl font-black text-slate-900 tracking-tight hidden lg:block">CoB INTERNAL DIRECTORY</h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Desktop navigation */}
            <div className="hidden md:flex items-center gap-1">
              {isAdmin && <NavItem view="DASHBOARD" icon={LayoutDashboard} label="Overview" />}
              <NavItem view="DIRECTORY" icon={Search} label="Directory" />
              {isAdmin && (
                <>
                  <NavItem view="NOC" icon={Radio} label="NOC" />
                  <NavItem view="REPORTS" icon={FileText} label="Reports" />
                  <NavItem view="LOGS" icon={History} label="Activity" />
                  <NavItem view="ADMIN" icon={Settings} label="Management" />
                </>
              )}
            </div>

            <div className="h-8 w-px bg-slate-200 mx-2 hidden md:block" />

            <div className="flex items-center gap-3">
              {isAuthenticated ? (
                <>
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-bold text-slate-900 leading-none capitalize">{authUser?.username?.toLowerCase().replace(/_/g, ' ')}</p>
                    <p className="text-xs font-black text-slate-400 mt-1 uppercase">{authUser?.role}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openConfirm({
                      title: 'Sign out?',
                      message: 'You will be returned to the public directory.',
                      confirmLabel: 'Sign Out',
                      onConfirm: () => { setConfirmState(null); logout(); }
                    })}
                    aria-label="Sign out"
                    className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center hover:bg-rose-600 transition-all shadow-lg"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => setActiveView('LOGIN')} className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-blue-600 transition-all shadow-lg">
                  Admin Login
                </button>
              )}

              {/* Mobile hamburger */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(o => !o)}
                aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                className="md:hidden w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200 transition-all"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute left-0 right-0 top-20 bg-white border-b border-slate-200 shadow-lg z-50 px-6 py-4 flex flex-col gap-2">
            {isAdmin && (
              <button type="button" onClick={() => navigate('DASHBOARD')} className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeView === 'DASHBOARD' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                <LayoutDashboard className="w-4 h-4" /> Overview
              </button>
            )}
            <button type="button" onClick={() => navigate('DIRECTORY')} className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeView === 'DIRECTORY' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
              <Search className="w-4 h-4" /> Directory
            </button>
            {isAdmin && (
              <>
                <button type="button" onClick={() => navigate('NOC')} className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeView === 'NOC' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                  <Radio className="w-4 h-4" /> NOC Board
                </button>
                <button type="button" onClick={() => navigate('REPORTS')} className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeView === 'REPORTS' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                  <FileText className="w-4 h-4" /> Reports
                </button>
                <button type="button" onClick={() => navigate('LOGS')} className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeView === 'LOGS' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                  <History className="w-4 h-4" /> Activity
                </button>
                <button type="button" onClick={() => navigate('ADMIN')} className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeView === 'ADMIN' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                  <Settings className="w-4 h-4" /> Management
                </button>
              </>
            )}
          </div>
        )}
      </nav>

      {/* ── MAIN ── */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-6 md:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">
              {activeView === 'DIRECTORY' ? 'CoB Internal Directory'
                : activeView === 'DASHBOARD' ? 'Overview'
                : activeView === 'ADMIN' ? 'Management'
                : activeView === 'REPORTS' ? 'Reports'
                : activeView === 'NOC' ? 'NOC Status Board'
                : 'Activity Logs'}
            </h2>
            {isAdmin && (
              <div className="flex items-center gap-4 mt-2">
                <button
                  onClick={() => setLiveMode(m => !m)}
                  type="button"
                  aria-label={liveMode ? 'Disable live updates' : 'Enable live updates'}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-widest transition-all ${liveMode ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-50' : 'bg-slate-100 text-slate-500'}`}
                >
                  {liveMode ? <Zap className="w-3 h-3 animate-pulse" /> : <ZapOff className="w-3 h-3" />}
                  {liveMode ? 'Live: ON' : 'Live: OFF'}
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={handleManualSync} disabled={isMonitoring} className="h-12 px-6 bg-white border-2 border-slate-100 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-600 hover:border-blue-300 hover:text-blue-600 transition-all flex items-center gap-2 shadow-sm">
              <RefreshCw className={`w-4 h-4 ${isMonitoring ? 'animate-spin' : ''}`} /> Sync
            </button>
            {isAdmin && activeView === 'ADMIN' && (
              <div className="flex gap-2 flex-wrap">
                {selectedIds.length > 0 && (
                  <button type="button" onClick={handleBulkDelete} className="h-12 px-6 bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-rose-700 shadow-xl shadow-rose-100 flex items-center gap-2 transition-all">
                    <Trash2 className="w-4 h-4" /> Delete ({selectedIds.length})
                  </button>
                )}
                <button type="button" onClick={() => fileInputRef.current?.click()} className="h-12 px-6 bg-white border-2 border-slate-200 text-slate-700 rounded-2xl font-black text-xs uppercase tracking-widest hover:border-blue-300 hover:text-blue-600 flex items-center gap-2 transition-all">
                  <Upload className="w-4 h-4" /> Import
                </button>
                <button type="button" onClick={handleExportCSV} className="h-12 px-6 bg-white border-2 border-slate-200 text-slate-700 rounded-2xl font-black text-xs uppercase tracking-widest hover:border-blue-300 hover:text-blue-600 flex items-center gap-2 transition-all">
                  <FileSpreadsheet className="w-4 h-4" /> Export
                </button>
                <button
                  type="button"
                  onClick={() => setEditingUser({ id: 0, name_surname: '', email: '', extension_number: '', old_extension_number: '', department: depts[0]?.name || '', section: '', station: '', ip_address: '', mac_address: '', phone_model: '', designation: '', office_number: '', role: 'user' })}
                  className="h-12 px-6 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-100 flex items-center gap-2 transition-all"
                >
                  <Plus className="w-4 h-4" /> Add User
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── DIRECTORY ── */}
        {activeView === 'DIRECTORY' && (
          <div className="animate-fade-in flex gap-8 items-start">
            {/* Department Tree Sidebar */}
            {showTree && (
              <div className="w-60 shrink-0 bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sticky top-28 max-h-[calc(100vh-9rem)] overflow-y-auto">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Browse</h4>
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => { setFilterDept('ALL'); setFilterSection('ALL'); setCurrentPage(1); }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all ${filterDept === 'ALL' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    All Departments
                  </button>
                  {Array.from(deptTree.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([dept, sects]) => (
                    <div key={dept}>
                      <button
                        type="button"
                        onClick={() => {
                          setFilterDept(dept); setFilterSection('ALL'); setCurrentPage(1);
                          setExpandedDepts(prev => { const n = new Set(prev); n.has(dept) ? n.delete(dept) : n.add(dept); return n; });
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${filterDept === dept ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        <span className="truncate">{dept}</span>
                        {sects.size > 0 && <ChevronRight className={`w-3 h-3 shrink-0 transition-transform ${expandedDepts.has(dept) ? 'rotate-90' : ''}`} />}
                      </button>
                      {expandedDepts.has(dept) && sects.size > 0 && (
                        <div className="ml-3 mt-1 space-y-0.5">
                          {Array.from(sects).sort().map(sect => (
                            <button
                              key={sect}
                              type="button"
                              onClick={() => { setFilterDept(dept); setFilterSection(sect); setCurrentPage(1); }}
                              className={`w-full text-left px-3 py-1.5 rounded-xl text-xs transition-all ${filterSection === sect && filterDept === dept ? 'bg-blue-100 text-blue-700 font-black' : 'text-slate-500 hover:bg-slate-50 font-medium'}`}
                            >
                              {sect}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Main content card */}
            <div className="card shadow-2xl shadow-slate-200/50 border-none flex-1 min-w-0">
              <div className="p-8 border-b border-slate-100 flex flex-col xl:flex-row gap-6">
                <div className="relative flex-1 max-w-2xl">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by name, extension, department…"
                    className="w-full h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl pl-14 pr-6 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  />
                </div>
                <div className="flex gap-3 flex-wrap items-center">
                  <select
                    aria-label="Filter by department"
                    className="h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 text-xs font-black uppercase outline-none focus:ring-4 focus:ring-blue-100"
                    value={filterDept}
                    onChange={e => { setFilterDept(e.target.value); setCurrentPage(1); }}
                  >
                    <option value="ALL">All Departments</option>
                    {depts.map((d: any) => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </select>
                  <select
                    aria-label="Filter by section"
                    className="h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 text-xs font-black uppercase outline-none focus:ring-4 focus:ring-blue-100"
                    value={filterSection}
                    onChange={e => { setFilterSection(e.target.value); setCurrentPage(1); }}
                  >
                    <option value="ALL">All Sections</option>
                    {sections.map((s: any) => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                  {isAdmin && (
                    <select
                      aria-label="Filter by status"
                      className="h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 text-xs font-black uppercase outline-none focus:ring-4 focus:ring-blue-100"
                      value={filterStatus}
                      onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }}
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="ONLINE">Online</option>
                      <option value="OFFLINE">Offline</option>
                    </select>
                  )}
                  {/* View controls */}
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setShowTree(t => !t)} aria-label="Toggle department tree" title="Browse by department" className={`h-14 w-14 rounded-2xl border-2 flex items-center justify-center transition-all ${showTree ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-blue-300 hover:text-blue-600'}`}>
                      <GitBranch className="w-5 h-5" />
                    </button>
                    <button type="button" onClick={() => setViewMode('table')} aria-label="Table view" title="Table view" className={`h-14 w-14 rounded-2xl border-2 flex items-center justify-center transition-all ${viewMode === 'table' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-blue-300 hover:text-blue-600'}`}>
                      <List className="w-5 h-5" />
                    </button>
                    <button type="button" onClick={() => setViewMode('cards')} aria-label="Card view" title="Card view" className={`h-14 w-14 rounded-2xl border-2 flex items-center justify-center transition-all ${viewMode === 'cards' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-blue-300 hover:text-blue-600'}`}>
                      <LayoutGrid className="w-5 h-5" />
                    </button>
                    <button type="button" onClick={printDepartmentPDF} aria-label="Print directory PDF" title="Print as PDF" className="h-14 px-4 rounded-2xl border-2 border-slate-100 bg-slate-50 text-slate-400 hover:border-blue-300 hover:text-blue-600 flex items-center gap-2 text-xs font-black uppercase tracking-widest transition-all">
                      <Printer className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {viewMode === 'table' ? (
                <div className="overflow-x-auto min-h-[600px]">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-xs font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">
                      <tr>
                        <th className="px-4 py-4 w-10"><span className="sr-only">Favourite</span></th>
                        <TableHeader k="name_surname" label="Name" />
                        <TableHeader k="email" label="Email" />
                        <th className="px-6 py-4">Designation</th>
                        <TableHeader k="department" label="Department" />
                        <TableHeader k="station" label="Station" />
                        <th className="px-6 py-4">Office</th>
                        <TableHeader k="extension_number" label="Extension" />
                        <TableHeader k="old_extension_number" label="Old Ext." />
                        {isAdmin && <TableHeader k="ip_address" label="IP Address" />}
                        {isAdmin && <th className="px-6 py-4">Status</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {paginatedUsers.length === 0 ? (
                        <tr>
                          <td colSpan={isAdmin ? 11 : 9} className="px-6 py-20 text-center">
                            <Search className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                            <p className="font-bold text-slate-400 text-sm">No users found</p>
                            <p className="text-xs text-slate-300 mt-1">Try adjusting your search or filters</p>
                          </td>
                        </tr>
                      ) : paginatedUsers.map((u: any) => (
                        <tr key={u.id} className={`hover:bg-blue-50/20 transition-all ${favouriteIds.includes(u.id) ? 'bg-amber-50/30' : ''}`}>
                          <td className="px-4 py-6">
                            <button type="button" onClick={() => toggleFavourite(u.id)} aria-label={favouriteIds.includes(u.id) ? `Remove ${u.name_surname} from favourites` : `Add ${u.name_surname} to favourites`}>
                              <Star className={`w-4 h-4 transition-colors ${favouriteIds.includes(u.id) ? 'fill-amber-400 text-amber-400' : 'text-slate-200 hover:text-amber-400'}`} />
                            </button>
                          </td>
                          <td className="px-6 py-6 font-black text-slate-900">{u.name_surname}</td>
                          <td className="px-6 py-6 font-bold text-slate-500 text-sm">{u.email || '—'}</td>
                          <td className="px-6 py-6 text-xs font-bold text-slate-600 italic">{u.designation || '—'}</td>
                          <td className="px-6 py-6 text-xs font-black text-slate-500 uppercase">{u.department}</td>
                          <td className="px-6 py-6 text-xs font-black text-slate-500 uppercase">{u.station || '—'}</td>
                          <td className="px-6 py-6 text-xs font-bold text-slate-600">{u.office_number || '—'}</td>
                          <td className="px-6 py-6"><span className="bg-blue-600 text-white px-4 py-2 rounded-xl font-black text-sm font-mono shadow-md shadow-blue-100">{u.extension_number || '—'}</span></td>
                          <td className="px-6 py-6 text-xs font-black font-mono text-slate-400">{u.old_extension_number || '—'}</td>
                          {isAdmin && <td className="px-6 py-6 font-bold font-mono text-xs text-slate-400">{u.ip_address}</td>}
                          {isAdmin && (
                            <td className="px-6 py-6">
                              <div className="flex items-center gap-3">
                                <StatusBadge status={u.status} />
                                <span className={`text-xs font-black uppercase ${u.sip_status === 'Registered' ? 'text-emerald-500' : 'text-rose-400'}`}>{u.sip_status || 'Unregistered'}</span>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className={`grid grid-cols-1 sm:grid-cols-2 ${showTree ? 'lg:grid-cols-2 xl:grid-cols-3' : 'lg:grid-cols-3 xl:grid-cols-4'} gap-5 p-8 min-h-[600px] content-start`}>
                  {paginatedUsers.length === 0 ? (
                    <div className="col-span-full flex flex-col items-center justify-center py-20">
                      <Search className="w-10 h-10 text-slate-200 mb-3" />
                      <p className="font-bold text-slate-400 text-sm">No users found</p>
                      <p className="text-xs text-slate-300 mt-1">Try adjusting your search or filters</p>
                    </div>
                  ) : paginatedUsers.map((u: any) => {
                    const initials = u.name_surname.split(' ').filter(Boolean).map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
                    const isOnline = u.status === 'Online' || u.sip_status === 'Registered';
                    const isFav = favouriteIds.includes(u.id);
                    return (
                      <div key={u.id} className={`bg-white rounded-2xl p-5 border shadow-sm hover:shadow-md transition-all relative ${isFav ? 'border-amber-200 bg-amber-50/20' : 'border-slate-100'}`}>
                        <button
                          type="button"
                          onClick={() => toggleFavourite(u.id)}
                          aria-label={isFav ? `Remove ${u.name_surname} from favourites` : `Add ${u.name_surname} to favourites`}
                          className="absolute top-4 right-4"
                        >
                          <Star className={`w-4 h-4 transition-colors ${isFav ? 'fill-amber-400 text-amber-400' : 'text-slate-200 hover:text-amber-400'}`} />
                        </button>
                        <div className="flex items-center gap-4 mb-4">
                          <div className="relative shrink-0">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-white text-sm ${getAvatarColor(u.department)}`}>
                              {initials}
                            </div>
                            {isAdmin && (
                              <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-black text-slate-900 text-sm truncate pr-6">{u.name_surname}</p>
                            <p className="text-xs text-slate-400 font-bold truncate">{u.designation || u.department || '—'}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="bg-blue-600 text-white px-3 py-1.5 rounded-lg font-black text-sm font-mono shadow-sm shadow-blue-100">
                            {u.extension_number || '—'}
                          </span>
                          <div className="text-right">
                            <p className="text-xs font-black text-slate-400 uppercase">{u.station || '—'}</p>
                            {u.department && <p className="text-xs font-bold text-slate-300 uppercase truncate max-w-[100px]">{u.department}</p>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <p className="text-xs font-bold text-slate-400">
                  {processedUsers.length === users.length
                    ? `${users.length} users`
                    : `${processedUsers.length} of ${users.length} users`}
                  {favouriteIds.filter(id => processedUsers.some((u: any) => u.id === id)).length > 0 && (
                    <span className="ml-1 text-amber-500">• {favouriteIds.filter(id => processedUsers.some((u: any) => u.id === id)).length} starred</span>
                  )}
                  {` • Page ${currentPage} of ${totalPages || 1}`}
                </p>
                {totalPages > 1 && <Pagination page={currentPage} total={totalPages} onChange={setCurrentPage} />}
              </div>
            </div>
          </div>
        )}

        {/* ── DASHBOARD ── */}
        {activeView === 'DASHBOARD' && isAdmin && (
          <div className="space-y-10 animate-fade-in">
            <DashboardCards stats={stats} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="card p-8 bg-slate-900 border-none text-white overflow-hidden relative">
                <div className="absolute top-0 right-0 p-8 opacity-10"><Monitor className="w-32 h-32" /></div>
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-blue-400 mb-1">Live Device Status</h3>
                <p className="text-xs text-slate-500 font-bold mb-8 uppercase tracking-widest">Offline devices shown first</p>
                <div className="space-y-6">
                  {dashboardDevices.map((u: any) => (
                    <div key={u.id} className="flex items-center justify-between group">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-white/5 ${u.status === 'Online' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          <Activity className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-black text-sm group-hover:text-blue-400 transition-colors uppercase">{u.name_surname}</p>
                          <p className="text-xs font-black text-slate-500 uppercase tracking-tighter">{u.extension_number} • {u.ip_address}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-xs font-black uppercase ${u.sip_status === 'Registered' ? 'text-emerald-500' : 'text-rose-500'}`}>{u.sip_status || 'Unregistered'}</p>
                        <p className="text-xs font-bold text-slate-600 uppercase mt-0.5">SIP: {u.sip_port_open ? 'Open' : 'Closed'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card p-8 bg-white shadow-2xl shadow-indigo-100 border-none">
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-indigo-600 mb-8">Recent Activity</h3>
                <div className="space-y-8">
                  {logs.length === 0 ? (
                    <div className="text-center py-8">
                      <Clock className="w-8 h-8 text-slate-200 mx-auto mb-3" />
                      <p className="text-sm font-bold text-slate-300">No activity yet</p>
                    </div>
                  ) : logs.slice(0, 5).map(l => (
                    <div key={l.id} className="flex gap-4 group">
                      <div className="text-xs font-black text-slate-300 w-16 pt-1 whitespace-nowrap">{new Date(l.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      <div>
                        <p className="text-xs font-black text-slate-900 group-hover:text-indigo-600 transition-colors uppercase italic">{l.action}</p>
                        <p className="text-xs font-bold text-slate-400 mt-0.5">{l.user_name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── NOC STATUS BOARD ── */}
        {activeView === 'NOC' && isAdmin && (
          <div className="animate-fade-in space-y-8">
            <div className="grid grid-cols-3 gap-6">
              <div className="bg-emerald-50 rounded-3xl p-8 text-center border border-emerald-100">
                <p className="text-5xl font-black text-emerald-600 mb-1">{stats.onlineCount}</p>
                <p className="text-xs font-black uppercase text-emerald-500 tracking-widest">Online</p>
              </div>
              <div className="bg-rose-50 rounded-3xl p-8 text-center border border-rose-100">
                <p className="text-5xl font-black text-rose-600 mb-1">{stats.offlineCount}</p>
                <p className="text-xs font-black uppercase text-rose-500 tracking-widest">Offline</p>
              </div>
              <div className="bg-slate-100 rounded-3xl p-8 text-center">
                <p className="text-5xl font-black text-slate-600 mb-1">{stats.totalExtensions}</p>
                <p className="text-xs font-black uppercase text-slate-500 tracking-widest">Total</p>
              </div>
            </div>

            <div className="bg-slate-900 rounded-3xl p-8">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-6">
                Extension Status Grid — hover for details
              </p>
              <div className="flex flex-wrap gap-2">
                {[...users]
                  .filter(u => u.extension_number)
                  .sort((a, b) => (a.extension_number || '').localeCompare(b.extension_number || '', undefined, { numeric: true }))
                  .map(u => {
                    const isOnline = u.status === 'Online' || u.sip_status === 'Registered';
                    return (
                      <div
                        key={u.id}
                        title={`${u.name_surname}\nExt: ${u.extension_number}\nIP: ${u.ip_address || '—'}\nSIP: ${u.sip_status || u.status}`}
                        className={`w-16 h-16 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-110 hover:z-10 ${
                          isOnline
                            ? 'bg-emerald-500 shadow-lg shadow-emerald-900/30'
                            : 'bg-rose-600 shadow-lg shadow-rose-900/30'
                        }`}
                      >
                        <span className="text-white font-black text-xs leading-none">{u.extension_number}</span>
                        <span className="text-white/60 font-bold text-[9px] leading-none mt-1 truncate w-[56px] px-1 text-center">
                          {u.name_surname.split(' ')[0]}
                        </span>
                      </div>
                    );
                  })}
              </div>
              {users.filter(u => u.extension_number).length === 0 && (
                <p className="text-slate-600 font-bold text-sm text-center py-12">No extensions configured yet.</p>
              )}
            </div>
          </div>
        )}

        {/* ── MANAGEMENT ── */}
        {activeView === 'ADMIN' && isAdmin && (
          <div className="space-y-12 animate-fade-in pb-10">
            <div className="card shadow-xl shadow-slate-200/40 border-none">
              <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6 bg-slate-50/30">
                <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">Users</h3>
                <div className="w-full md:w-auto md:flex-1 md:max-w-2xl flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search users…"
                      className="w-full h-12 bg-white border border-slate-200 rounded-xl pl-12 pr-6 text-xs font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all"
                      value={adminSearchQuery}
                      onChange={e => { setAdminSearchQuery(e.target.value); setAdminCurrentPage(1); }}
                    />
                  </div>
                  <select
                    aria-label="Filter by department"
                    className="h-12 bg-white border border-slate-200 rounded-xl px-4 text-xs font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all min-w-[220px]"
                    value={adminFilterDept}
                    onChange={e => { setAdminFilterDept(e.target.value); setAdminCurrentPage(1); }}
                  >
                    <option value={ALL_DEPARTMENTS}>All Departments</option>
                    {managementDeptOptions.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                    <option value={NO_DEPARTMENT}>No Department</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                    <tr>
                      <th className="px-8 py-5 w-10">
                        <div className="flex flex-col items-center gap-1">
                          <input
                            type="checkbox"
                            aria-label="Select all users"
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            checked={selectedIds.length === processedAdminUsers.length && processedAdminUsers.length > 0}
                            onChange={e => toggleSelectAll(e.target.checked)}
                          />
                          {processedAdminUsers.length > 0 && (
                            <span className="text-xs text-slate-400 whitespace-nowrap">{selectedIds.length}/{processedAdminUsers.length}</span>
                          )}
                        </div>
                      </th>
                      <th className="px-8 py-5">Name</th>
                      <th className="px-8 py-5">Extension</th>
                      <th className="px-8 py-5">Old Ext.</th>
                      <th className="px-8 py-5">Station</th>
                      <th className="px-8 py-5">IP Address</th>
                      <th className="px-8 py-5">Device</th>
                      <th className="px-8 py-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {processedAdminUsers.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-8 py-20 text-center">
                          <Search className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                          <p className="font-bold text-slate-400 text-sm">No users found</p>
                          <p className="text-xs text-slate-300 mt-1">Try adjusting your search or filter</p>
                        </td>
                      </tr>
                    ) : processedAdminUsers.slice((adminCurrentPage - 1) * itemsPerPage, adminCurrentPage * itemsPerPage).map((u: any) => (
                      <tr key={u.id} className={`hover:bg-slate-50 transition-all ${selectedIds.includes(u.id) ? 'bg-blue-50/30' : ''}`}>
                        <td className="px-8 py-6">
                          <input
                            type="checkbox"
                            aria-label={`Select ${u.name_surname}`}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            checked={selectedIds.includes(u.id)}
                            onChange={() => setSelectedIds(prev => prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id])}
                          />
                        </td>
                        <td className="px-8 py-6">
                          <p className="font-black text-slate-900 uppercase">{u.name_surname}</p>
                          <p className="text-xs font-bold text-slate-400">{u.email}</p>
                          <p className="text-xs font-bold text-slate-400 mt-1">{u.department}</p>
                        </td>
                        <td className="px-8 py-6 font-black text-blue-600">{u.extension_number}</td>
                        <td className="px-8 py-6 font-black font-mono text-xs text-slate-400">{u.old_extension_number || '—'}</td>
                        <td className="px-8 py-6">
                          <p className="text-xs font-black text-slate-600 uppercase">{u.station || '—'}</p>
                          <p className="text-xs font-bold text-slate-300 italic">{u.office_number || ''}</p>
                        </td>
                        <td className="px-8 py-6 font-black font-mono text-xs text-slate-400">{u.ip_address}</td>
                        <td className="px-8 py-6">
                          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{u.mac_address}</p>
                          <p className="text-xs font-bold text-slate-300 italic">{u.phone_model || '—'}</p>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <div className="inline-flex gap-2">
                            <button type="button" onClick={() => setEditingUser(ensureNoNulls(u))} aria-label={`Edit ${u.name_surname}`} className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button type="button" onClick={() => handleDeleteUser(u)} aria-label={`Delete ${u.name_surname}`} className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center hover:bg-rose-600 hover:text-white transition-all">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <p className="text-xs font-bold text-slate-400">
                  {processedAdminUsers.length === users.length
                    ? `${users.length} users`
                    : `${processedAdminUsers.length} of ${users.length} users`} • Page {adminCurrentPage} of {adminTotalPages || 1}
                </p>
                {adminTotalPages > 1 && <Pagination page={adminCurrentPage} total={adminTotalPages} onChange={setAdminCurrentPage} />}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <h3 className="font-black text-slate-900 uppercase tracking-[0.2em] text-xs px-2">Organisation Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {(['departments', 'sections', 'stations'] as const).map(type => {
                    const metaValue = type === 'departments' ? newDept : type === 'sections' ? newSection : newStation;
                    const metaItems = type === 'departments' ? depts : type === 'sections' ? sections : stations;
                    return (
                      <div key={type} className="card p-6 shadow-lg shadow-slate-200/30">
                        <h4 className="font-black text-slate-900 uppercase tracking-widest text-xs mb-4 flex items-center justify-between">
                          {type} <Layers className="w-4 h-4 text-blue-600" />
                        </h4>
                        <div className="flex gap-2 mb-4">
                          <input
                            type="text"
                            aria-label={`New ${type.slice(0, -1)} name`}
                            placeholder={`Add ${type.slice(0, -1)}…`}
                            className="flex-1 h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100"
                            value={metaValue}
                            onChange={e => setNewMetaValue(type, e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleMetaAdd(type); }}
                          />
                          <button type="button" onClick={() => handleMetaAdd(type)} aria-label={`Add ${type.slice(0, -1)}`} className="h-10 w-10 bg-slate-900 text-white rounded-xl flex items-center justify-center hover:bg-blue-600 transition-all">
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                          {metaItems.length === 0 ? (
                            <p className="text-xs text-slate-300 text-center py-4 font-bold">No {type} yet</p>
                          ) : metaItems.map((m: any) => (
                            <div key={m.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl group/item">
                              <span className="text-xs font-black text-slate-600 uppercase truncate">{m.name}</span>
                              <button type="button" onClick={() => handleMetaDel(type, m.id, m.name)} aria-label={`Remove ${m.name}`} className="text-slate-300 hover:text-rose-600 transition-colors opacity-0 group-hover/item:opacity-100">
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="card p-8 bg-blue-600 border-none text-white h-fit shadow-2xl shadow-blue-200">
                <h3 className="font-black uppercase tracking-[0.2em] text-xs mb-6">Data Management</h3>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept=".csv"
                  aria-label="Import CSV file"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      setIsLoading(true);
                      await apiService.importUsers(file);
                      success('Import complete.');
                      fetchData();
                    } catch (err) {
                      toastError('Import failed.');
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                />
                <div className="space-y-4">
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full h-14 bg-white text-blue-600 rounded-2xl flex items-center justify-between px-6 transition-all font-black text-xs uppercase tracking-widest shadow-lg hover:bg-blue-50">
                    Import CSV <Upload className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={handleExportCSV} className="w-full h-14 bg-white/10 hover:bg-white/20 rounded-2xl flex items-center justify-between px-6 transition-all font-black text-xs uppercase tracking-widest border border-white/20">
                    Export CSV <FileSpreadsheet className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openConfirm({
                      title: 'Run system cleanup?',
                      message: 'This merges duplicate records and trims usernames. It may take a moment.',
                      confirmLabel: 'Run Cleanup',
                      onConfirm: async () => {
                        setConfirmState(null);
                        await apiService.runCleanup();
                        success('Cleanup complete.');
                        fetchData(true);
                      }
                    })}
                    type="button"
                    className="w-full h-14 bg-white/10 hover:bg-white/20 rounded-2xl flex items-center justify-between px-6 transition-all font-black text-xs uppercase tracking-widest border border-white/20"
                  >
                    System Cleanup <Wand2 className="w-4 h-4" />
                  </button>
                  <div className="p-4 bg-black/10 rounded-2xl mt-8">
                    <p className="text-xs font-black uppercase text-blue-100 tracking-widest mb-1 opacity-60">Status</p>
                    <p className="text-xs font-black italic tracking-tighter">System Active</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── ACTIVITY LOGS ── */}
        {activeView === 'LOGS' && isAdmin && (
          <div className="card shadow-2xl shadow-slate-200/50 animate-fade-in border-none">
            <div className="p-8 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h3 className="font-black text-slate-900 uppercase tracking-[0.3em] text-xs">System Audit Logs</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-900 text-white sticky top-0 z-10">
                  <tr className="text-xs font-black uppercase tracking-[0.3em]">
                    <th className="px-10 py-6">Timestamp</th>
                    <th className="px-10 py-6 text-center">Action</th>
                    <th className="px-10 py-6">Admin</th>
                    <th className="px-10 py-6">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-10 py-20 text-center">
                        <History className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                        <p className="font-bold text-slate-400 text-sm">No activity logged yet</p>
                      </td>
                    </tr>
                  ) : logs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-all">
                      <td className="px-10 py-8 text-xs font-bold text-slate-400 whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                      <td className="px-10 py-8 text-center">
                        <span className="bg-slate-100 text-slate-900 px-4 py-2 rounded-full text-xs font-black tracking-widest uppercase border border-slate-200">{log.action}</span>
                      </td>
                      <td className="px-10 py-8 font-black text-slate-900 uppercase text-xs">{log.user_name}</td>
                      <td className="px-10 py-8 text-xs text-slate-500 italic font-bold leading-relaxed">{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── REPORTS ── */}
        {activeView === 'REPORTS' && isAdmin && (
          <div className="max-w-5xl mx-auto py-10 animate-fade-in space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl shadow-slate-200/50 group border border-slate-50 transition-all hover:-translate-y-2">
                <div className="w-20 h-20 bg-blue-600 text-white rounded-3xl flex items-center justify-center mb-10 shadow-xl shadow-blue-200 group-hover:rotate-6 transition-transform">
                  <FileText className="w-10 h-10" />
                </div>
                <div className="flex items-start gap-3 mb-4">
                  <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Daily Offline Report</h3>
                  <span className="shrink-0 mt-1 text-xs font-black bg-amber-100 text-amber-700 px-3 py-1 rounded-full uppercase tracking-widest">Coming Soon</span>
                </div>
                <p className="text-slate-500 font-bold mb-10 leading-relaxed text-sm">Hardware failure audit for the latest 24-hour network cycle.</p>
                <div className="flex gap-4">
                  <button type="button" disabled className="flex-1 h-16 bg-slate-100 text-slate-400 rounded-2xl font-black uppercase tracking-widest text-xs cursor-not-allowed">Generate PDF</button>
                  <button type="button" disabled className="px-8 h-16 bg-slate-100 text-slate-400 rounded-2xl font-black uppercase tracking-widest text-xs cursor-not-allowed">Excel</button>
                </div>
              </div>

              <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl shadow-slate-200/50 group border border-slate-50 transition-all hover:-translate-y-2">
                <div className="w-20 h-20 bg-indigo-600 text-white rounded-3xl flex items-center justify-center mb-10 shadow-xl shadow-indigo-200 group-hover:-rotate-6 transition-transform">
                  <History className="w-10 h-10" />
                </div>
                <div className="flex items-start gap-3 mb-4">
                  <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Custom Range Report</h3>
                  <span className="shrink-0 mt-1 text-xs font-black bg-amber-100 text-amber-700 px-3 py-1 rounded-full uppercase tracking-widest">Coming Soon</span>
                </div>
                <p className="text-slate-500 font-bold mb-10 leading-relaxed text-sm">Performance analysis across a custom date range.</p>
                <div className="flex gap-4">
                  <button type="button" disabled className="flex-1 h-16 bg-slate-100 text-slate-400 rounded-2xl font-black uppercase tracking-widest text-xs cursor-not-allowed">Select Date Range</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── EDIT / ADD USER MODAL ── */}
      {editingUser && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl z-[200] flex items-center justify-center p-6 animate-fade-in"
          onClick={e => { if (e.target === e.currentTarget) setEditingUser(null); }}
        >
          <div
            className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl overflow-hidden animate-zoom-in border border-slate-100"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-10 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">{editingUser.id !== 0 ? 'Edit User' : 'Add New User'}</h3>
                <p className="text-xs font-black text-blue-500 uppercase tracking-widest mt-1">User Database</p>
              </div>
              <button type="button" onClick={() => setEditingUser(null)} aria-label="Close form" className="h-12 w-12 flex items-center justify-center bg-white rounded-2xl border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all">
                <XCircle className="w-8 h-8" />
              </button>
            </div>

            <form onSubmit={saveUser} className="p-10 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Name &amp; Surname</label>
                  <input required placeholder="Full name" className="input-field" value={editingUser.name_surname || ''} onChange={e => setEditingUser({ ...editingUser, name_surname: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                  <input type="email" placeholder="user@bcc.co.zw" className="input-field" value={editingUser.email || ''} onChange={e => setEditingUser({ ...editingUser, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Extension</label>
                  <input placeholder="8000" className="input-field font-black text-blue-600" value={editingUser.extension_number || ''} onChange={e => setEditingUser({ ...editingUser, extension_number: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Old Extension</label>
                  <input placeholder="Previous extension" className="input-field font-mono" value={editingUser.old_extension_number || ''} onChange={e => setEditingUser({ ...editingUser, old_extension_number: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">IP Address</label>
                  <input placeholder="192.168.x.x" className="input-field font-mono" value={editingUser.ip_address || ''} onChange={e => setEditingUser({ ...editingUser, ip_address: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Department</label>
                  <select title="Select department" className="input-field" value={editingUser.department || ''} onChange={e => setEditingUser({ ...editingUser, department: e.target.value })}>
                    <option value="">None</option>
                    {depts.map((d: any) => <option key={d.id} value={d.name}>{d.name}</option>)}
                    {depts.length === 0 && DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Section</label>
                  <select title="Select section" className="input-field" value={editingUser.section || ''} onChange={e => setEditingUser({ ...editingUser, section: e.target.value })}>
                    <option value="">None</option>
                    {sections.map((s: any) => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Station</label>
                  <input placeholder="Location" className="input-field" value={editingUser.station || ''} onChange={e => setEditingUser({ ...editingUser, station: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Phone Model</label>
                  <input placeholder="e.g. Yealink T46S" className="input-field" value={editingUser.phone_model || ''} onChange={e => setEditingUser({ ...editingUser, phone_model: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">MAC Address</label>
                  <input placeholder="00:00:00:00:00:00" className="input-field font-mono text-xs uppercase" value={editingUser.mac_address || ''} onChange={e => setEditingUser({ ...editingUser, mac_address: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Office Number</label>
                  <input placeholder="B22" className="input-field" value={editingUser.office_number || ''} onChange={e => setEditingUser({ ...editingUser, office_number: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Designation</label>
                  <input placeholder="Job title" className="input-field" value={editingUser.designation || ''} onChange={e => setEditingUser({ ...editingUser, designation: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Role</label>
                  <select title="Select role" className="input-field h-14" value={editingUser.role || 'user'} onChange={e => setEditingUser({ ...editingUser, role: e.target.value })}>
                    <option value="user">Staff Member</option>
                    <option value="admin">System Admin</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-4 pt-8 mt-8 border-t border-slate-100">
                <button type="button" onClick={() => setEditingUser(null)} className="flex-1 py-5 bg-slate-50 text-slate-500 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-100 transition-all" aria-label="Cancel and close form">
                  Cancel
                </button>
                <button type="submit" disabled={isSaving} className="flex-[2] py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] hover:bg-blue-600 shadow-2xl shadow-blue-200 transition-all flex items-center justify-center gap-3 disabled:opacity-60">
                  {isSaving && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {isSaving ? 'Saving…' : 'Save User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CONFIRM DIALOG ── */}
      {confirmState && (
        <ConfirmModal
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          danger={confirmState.danger}
          onConfirm={confirmState.onConfirm}
          onCancel={() => setConfirmState(null)}
        />
      )}

      {/* ── FULL-SCREEN LOADER (initial load and bulk operations only) ── */}
      {isLoading && (
        <div className="fixed inset-0 bg-white/60 backdrop-blur-md z-[300] flex items-center justify-center">
          <div className="flex flex-col items-center gap-6 p-12 bg-white rounded-[3rem] shadow-2xl border border-slate-50">
            <RefreshCw className="w-16 h-16 text-blue-600 animate-spin" />
            <div className="text-center">
              <p className="text-xs font-black text-slate-400 uppercase tracking-[0.4em] mb-1">Loading</p>
              <p className="text-xs font-black text-slate-900 uppercase italic">Please Wait…</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
