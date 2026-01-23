import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Search, 
  Plus, 
  Filter, 
  MoreHorizontal, 
  X, 
  ChevronDown, 
  ChevronUp,
  Briefcase,
  AlertCircle,
  Building,
  User,
  Clock,
  LogOut,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Upload,
  Calendar,
  Loader2,
  CheckSquare,
  Square,
  Edit3,
  MessageSquare,
  FileText,
  MapPin,
  Phone,
  Info,
  RotateCcw,
  Wifi,
  ServerCrash,
  AlertTriangle
} from 'lucide-react';
// @ts-ignore
import PocketBase from 'https://unpkg.com/pocketbase@0.21.3/dist/pocketbase.es.mjs';

// --- Configuration ---
const PB_URL = 'https://wchrestay-ubuntu.lan.local.cmu.edu/pocketbase';
const COLLECTION_NAME = 'work_orders';

// --- Types & Interfaces ---

interface WorkOrder {
  id: string;
  wo_number: string;
  status: string;
  assignee: string;
  priority: string;
  date_reported: string;
  wo_type: string;
  description: string;
  bldg_abbr: string;
  bldg_name: string;
  contact_abbr: string;
  contact_name: string;
  comments: string;
  last_modified_by: string;
  updated?: string;
  created?: string;
  [key: string]: any; 
}

interface BulkUpdatePayload {
  status?: string;
  priority?: string;
  assignee?: string;
  bldg_abbr?: string;
  last_modified_by?: string;
}

interface ContactInfo {
  abbr: string;
  name: string;
  phone: string;
  zone: string;
  supervisor: string;
}

// --- Constants ---

const STATUS_OPTIONS = [
  "APPROVED",
  "CANCELLED",
  "COMPLETE",
  "DEFERRED",
  "DONE",
  "HIDE",
  "IN-PROGRESS",
  "NEEDS HOURS",
  "ON-GOING",
  "OTHER",
  "QUOTE-RECVD",
  "UNKNOWN",
  "WAIT-APPROVAL",
  "WAIT-ORDER-PARTS",
  "WAIT-PARTS-INSTALL",
  "WAIT-PROJ-START",
  "WAIT-PROP-COND",
  "WAIT-RECV-PARTS",
  "WAIT-RECV-QUOTE",
  "WINVOICE-C"
];

const WO_TYPE_OPTIONS = [
  "CM", "DS", "N/A", "PR", "PR (UE)", "SERV", "UP"
];

const WO_TYPE_DEFINITIONS: Record<string, string> = {
  "CM": "Corrective Maintenance",
  "DS": "Daily Service",
  "N/A": "Not Applicable",
  "PR": "Project",
  "PR (UE)": "Project (University Engineer)",
  "SERV": "Service",
  "UP": "Urgent Priority"
};

const PRIORITY_OPTIONS = ['Low', 'Medium', 'High', 'Critical'];

const CONTACT_DATA: ContactInfo[] = [
  { abbr: "BG2M", name: "Joe Smith", phone: "(412) 444-4444", zone: "West Zone", supervisor: "CERV" }
];

// --- Error Boundary ---
class ErrorBoundary extends React.Component<any, any> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center bg-red-50 text-red-900 min-h-screen flex flex-col items-center justify-center">
          <AlertTriangle className="w-12 h-12 mb-4 text-red-500" />
          <h1 className="text-xl font-bold mb-2">Something went wrong.</h1>
          <p className="mb-4">The application encountered an error while rendering.</p>
          <div className="flex gap-4">
            <button 
              onClick={() => {
                  localStorage.clear();
                  window.location.reload();
              }}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Reset App & Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- Utility Components ---

const getAvatarColor = (name: string) => {
  const colors = [
    'bg-red-100 text-red-700 border-red-200',
    'bg-orange-100 text-orange-700 border-orange-200',
    'bg-amber-100 text-amber-700 border-amber-200',
    'bg-green-100 text-green-700 border-green-200',
    'bg-emerald-100 text-emerald-700 border-emerald-200',
    'bg-blue-100 text-blue-700 border-blue-200',
    'bg-indigo-100 text-indigo-700 border-indigo-200',
    'bg-purple-100 text-purple-700 border-purple-200',
  ];
  if (!name) return colors[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const StatusBadge = ({ status }: { status: string }) => {
  let style = 'bg-gray-100 text-gray-600 border-gray-200';
  
  const s = status.toUpperCase();
  if (['APPROVED', 'COMPLETE', 'DONE'].includes(s)) {
    style = 'bg-green-100 text-green-700 border-green-200';
  } else if (['CANCELLED'].includes(s)) {
    style = 'bg-red-100 text-red-700 border-red-200 line-through';
  } else if (['IN-PROGRESS', 'ON-GOING'].includes(s)) {
    style = 'bg-blue-100 text-blue-700 border-blue-200';
  } else if (['DEFERRED', 'HIDE', 'UNKNOWN', 'OTHER', 'N/A'].includes(s)) {
    style = 'bg-slate-100 text-slate-500 border-slate-200';
  } else if (s.startsWith('WAIT') || s === 'NEEDS HOURS' || s === 'QUOTE-RECVD' || s === 'WINVOICE-C') {
    style = 'bg-amber-100 text-amber-700 border-amber-200';
  }

  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${style} whitespace-nowrap`}>
      {status}
    </span>
  );
};

const PriorityBadge = ({ priority }: { priority: string }) => {
  const colors: Record<string, string> = {
    'Low': 'text-slate-500',
    'Medium': 'text-blue-600',
    'High': 'text-orange-600 font-bold',
    'Critical': 'text-red-600 font-extrabold',
  };
  return <span className={`text-xs flex items-center gap-1 ${colors[priority] || 'text-slate-500'}`}>
    {priority === 'Critical' && <AlertCircle className="w-3 h-3" />}
    {priority}
  </span>;
};

const ContactTooltip = ({ abbr, name }: { abbr: string, name: string }) => {
  const contact = CONTACT_DATA.find(c => c.abbr === abbr) || CONTACT_DATA.find(c => c.name === name);

  return (
    <div className="group relative flex flex-col cursor-help">
      <span>{name}</span>
      {abbr && abbr !== name && <span className="text-[10px] text-slate-400">{abbr}</span>}
      
      {contact && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-56 bg-slate-800 text-white text-xs p-3 rounded-lg shadow-xl z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-200">
          <div className="font-bold text-sm mb-1 text-indigo-300">{contact.name}</div>
          <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
            <span className="text-slate-400">Phone:</span>
            <span>{contact.phone}</span>
            <span className="text-slate-400">Zone:</span>
            <span>{contact.zone}</span>
            <span className="text-slate-400">Supervisor:</span>
            <span>{contact.supervisor}</span>
            <span className="text-slate-400">ID:</span>
            <span className="font-mono text-xs">{contact.abbr}</span>
          </div>
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
        </div>
      )}
    </div>
  );
};

const WOTypeTooltip = ({ type }: { type: string }) => {
  const definition = WO_TYPE_DEFINITIONS[type];

  if (!definition) {
      return <span className="text-slate-600 text-xs">{type || '-'}</span>;
  }

  return (
    <div className="group relative flex flex-col cursor-help items-start">
      <span className="text-slate-700 font-medium bg-slate-100 px-2 py-1 rounded inline-block text-xs border border-slate-200">{type}</span>
      
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 bg-slate-800 text-white text-xs p-2 rounded-lg shadow-xl z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-200 text-center">
        {definition}
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
      </div>
    </div>
  );
};

// --- Inner Application Component ---

function WorkOrderManagerInner({ pb }: { pb: any }) {
  // --- Auth State ---
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginModal, setShowLoginModal] = useState(true);
  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // --- App State ---
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<keyof WorkOrder>('date_reported');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showCompleted, setShowCompleted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Selection & Bulk Edit
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  
  // Modal State
  const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Data Subscription ---
  useEffect(() => {
    // Check initial auth state
    if (pb.authStore.isValid) {
      const model = pb.authStore.model;
      const displayName = model?.name || model?.email || model?.username || 'User';
      setCurrentUser(displayName);
      setShowLoginModal(false);
      loadData();
    } else {
      setCurrentUser(null);
      setShowLoginModal(true);
    }

    // Subscribe to auth changes
    const unsubscribe = pb.authStore.onChange((token: any, model: any) => {
        if (pb.authStore.isValid && model) {
            setCurrentUser(model.name || model.email);
        } else {
            setCurrentUser(null);
        }
    });

    return () => unsubscribe();
  }, [pb]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await pb.collection(COLLECTION_NAME).getFullList({ sort: '-created' });
      setWorkOrders(res as WorkOrder[]);
    } catch (err: any) {
      console.error("PB Load Error:", err);
      if (err.status === 401 || err.status === 403 || err.status === 0) {
        setShowLoginModal(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    setAuthError('');
    
    try {
      await pb.collection('users').authWithPassword(loginEmail, loginPassword);
      const model = pb.authStore.model;
      const displayName = model?.name || model?.email || model?.username || 'User';
      setCurrentUser(displayName);
      setShowLoginModal(false);
      loadData();
    } catch (err) {
      setAuthError('Invalid email or password.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = () => {
    pb.authStore.clear();
    localStorage.clear();
    window.location.reload();
  };

  // --- Stats Calculation ---
  const stats = useMemo(() => {
    const total = workOrders.length;
    let open = 0;
    let wait = 0;
    let complete = 0;

    workOrders.forEach(wo => {
        const s = wo.status.toUpperCase();
        if (['COMPLETE', 'DONE'].includes(s)) {
            complete++;
        } else if (s.startsWith('WAIT') || ['QUOTE-RECVD', 'WINVOICE-C'].includes(s)) {
            wait++;
        } else if (!['CANCELLED', 'HIDE', 'UNKNOWN'].includes(s)) {
            // Assuming everything else that isn't explicitly cancelled/hidden is "Open"
            open++;
        }
    });

    return { total, open, wait, complete };
  }, [workOrders]);

  // --- CSV Import ---
  const handleImportClick = () => fileInputRef.current?.click();

  const parseCSVLine = (text: string) => {
    const re_value = /(?!\s*$)\s*(?:'([^'\\]*(?:\\[\S\s][^'\\]*)*)'|"([^"\\]*(?:\\[\S\s][^"\\]*)*)"|([^,'"\s\\]*(?:\s+[^,'"\s\\]+)*))\s*(?:,|$)/g;
    const matches: string[] = [];
    let match;
    while ((match = re_value.exec(text)) !== null) {
      matches.push(match[1] || match[2] || match[3] || "");
    }
    return matches;
  };

  const formatDateForPB = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return date.toISOString();
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      const lines = text.split('\n');
      const startIndex = lines[0].toLowerCase().includes('wo') ? 1 : 0;
      
      pb.autoCancellation(false);
      
      setIsLoading(true);

      try {
        const promises = [];
        for (let i = startIndex; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          let cols = parseCSVLine(line);
          if (cols.length === 0) cols = line.split(',').map(c => c.trim());
          
          if (cols.length >= 1) {
             const newWO = {
               wo_number: cols[0] || 'Unknown',
               status: cols[1] || 'NEW', 
               assignee: cols[2] || '',
               priority: cols[3] || 'Medium',
               date_reported: formatDateForPB(cols[4]),
               wo_type: cols[5] || 'N/A',
               description: cols[6] || '',
               bldg_abbr: cols[7] || '',
               bldg_name: cols[8] || '',
               contact_abbr: cols[9] || '',
               contact_name: cols[10] || '',
               comments: cols[11] || '',
               last_modified_by: currentUser || 'Importer'
             };
             promises.push(pb.collection(COLLECTION_NAME).create(newWO));
          }
        }
        
        if (promises.length > 0) {
          await Promise.all(promises);
          await loadData();
          alert(`Successfully imported ${promises.length} work orders.`);
        }
      } catch (err: any) {
        console.error("Import failed:", err);
        const msg = err.data?.message || err.message || "Unknown error";
        alert(`Import failed.\n\nBackend Error: ${msg}`);
      } finally {
        setIsLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  // --- CRUD Operations ---

  const handleSave = async () => {
    if (!selectedWO) return;
    setIsSaving(true);

    try {
      const updatedWO = { ...selectedWO };
      updatedWO.last_modified_by = currentUser || 'Unknown';
      
      if (updatedWO.date_reported) {
         const d = new Date(updatedWO.date_reported);
         if (!isNaN(d.getTime())) updatedWO.date_reported = d.toISOString();
      }

      if (updatedWO.id === 'NEW') {
        const { id, updated, created, ...data } = updatedWO;
        await pb.collection(COLLECTION_NAME).create(data);
      } else {
        const { id, updated, created, ...data } = updatedWO;
        await pb.collection(COLLECTION_NAME).update(id, data);
      }

      await loadData();
      setShowModal(false);
    } catch (err: any) {
      console.error("Save failed:", err);
      const msg = err.data?.message || err.message || "Check console";
      alert(`Failed to save Work Order.\nError: ${msg}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedWO || selectedWO.id === 'NEW') return;
    if (!confirm('Are you sure you want to delete this Work Order? This cannot be undone.')) return;

    setIsSaving(true);
    try {
      await pb.collection(COLLECTION_NAME).delete(selectedWO.id);
      await loadData();
      setShowModal(false);
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Failed to delete. Check permissions.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateNew = () => {
    setSelectedWO({
      id: 'NEW',
      wo_number: `WO-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`,
      status: 'NEW',
      assignee: '',
      priority: 'Medium',
      date_reported: new Date().toISOString().split('T')[0],
      wo_type: 'N/A',
      description: '',
      bldg_abbr: '',
      bldg_name: '',
      contact_abbr: '',
      contact_name: '',
      comments: '',
      last_modified_by: currentUser || 'Unknown'
    });
    setIsEditing(true);
    setShowModal(true);
  };

  const openWO = (wo: WorkOrder) => {
    const formatted = { 
      ...wo, 
      date_reported: wo.date_reported ? wo.date_reported.split('T')[0] : ''
    };
    setSelectedWO(formatted);
    setIsEditing(false);
    setShowModal(true);
  };

  const handleBulkEdit = async (updates: BulkUpdatePayload) => {
    if (selectedIds.size === 0) return;
    setIsSaving(true);
    
    pb.autoCancellation(false);
    const finalUpdates = { ...updates, last_modified_by: currentUser || 'Bulk Edit' };

    try {
      const promises = Array.from(selectedIds).map(id => 
        pb.collection(COLLECTION_NAME).update(id, finalUpdates)
      );
      await Promise.all(promises);
      await loadData();
      setShowBulkModal(false);
      setSelectedIds(new Set());
    } catch (err) {
      console.error("Bulk update failed", err);
      alert("Some items failed to update.");
    } finally {
      setIsSaving(false);
    }
  };

  // --- Filtering & Sorting ---

  const filteredData = useMemo(() => {
    let data = [...workOrders];

    if (!showCompleted) {
      data = data.filter(p => !['COMPLETE', 'DONE', 'CANCELLED', 'HIDE'].includes(p.status.toUpperCase()));
    }

    if (search) {
      const lower = search.toLowerCase();
      data = data.filter(p => 
        (p.wo_number && p.wo_number.toLowerCase().includes(lower)) ||
        (p.description && p.description.toLowerCase().includes(lower)) ||
        (p.assignee && p.assignee.toLowerCase().includes(lower)) ||
        (p.bldg_name && p.bldg_name.toLowerCase().includes(lower)) ||
        (p.contact_name && p.contact_name.toLowerCase().includes(lower))
      );
    }

    data.sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return data;
  }, [workOrders, search, sortField, sortDir, showCompleted]);

  const handleSort = (field: keyof WorkOrder) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }: { field: keyof WorkOrder }) => {
    if (sortField !== field) return <div className="w-4 h-4" />;
    return sortDir === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />;
  };

  // --- Selection Logic ---
  const handleSelectAll = () => {
    if (selectedIds.size === filteredData.length && filteredData.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredData.map(p => p.id)));
    }
  };

  const handleSelectRow = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const newSelected = new Set(selectedIds);

    if (event.shiftKey && lastSelectedId) {
      const lastIndex = filteredData.findIndex(p => p.id === lastSelectedId);
      const currentIndex = filteredData.findIndex(p => p.id === id);

      if (lastIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastIndex, currentIndex);
        const end = Math.max(lastIndex, currentIndex);
        const range = filteredData.slice(start, end + 1);
        range.forEach(p => newSelected.add(p.id));
      }
    } else {
      if (newSelected.has(id)) {
        newSelected.delete(id);
        setLastSelectedId(id);
      } else {
        newSelected.add(id);
        setLastSelectedId(id);
      }
    }
    setSelectedIds(newSelected);
  };

  // --- Render ---

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-10">
      
      {/* Top Navigation Bar */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="w-full px-6 h-16 flex items-center justify-between gap-4">
          
          {/* Brand & Stats */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-sm">
                <Briefcase className="w-5 h-5" />
                </div>
                <div>
                <h1 className="font-bold text-lg leading-tight text-slate-800">Work Order Manager</h1>
                </div>
            </div>

            {/* Header Stats */}
            <div className="hidden lg:flex items-center gap-2 text-xs font-semibold">
                <div className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded border border-yellow-200" title="Active/Open WOs">
                    Open: {stats.open}
                </div>
                <div className="bg-lime-100 text-lime-800 px-2 py-1 rounded border border-lime-200" title="Waiting for Parts/Approval/Invoice">
                    Wait-Inv: {stats.wait}
                </div>
                <div className="bg-green-600 text-white px-2 py-1 rounded border border-green-700" title="Completed Jobs">
                    Complete: {stats.complete}
                </div>
                <div className="bg-emerald-800 text-white px-2 py-1 rounded border border-emerald-900" title="Total Records">
                    Total: {stats.total}
                </div>
            </div>
          </div>

          {/* Search & Actions */}
          <div className="flex items-center gap-4 flex-1 justify-end">
            {selectedIds.size > 0 ? (
              <div className="flex items-center gap-3 bg-indigo-50 px-4 py-2 rounded-lg border border-indigo-100 animate-in slide-in-from-top-2 fade-in">
                <span className="text-sm font-medium text-indigo-700">{selectedIds.size} Selected</span>
                <div className="h-4 w-px bg-indigo-200 mx-1" />
                <button 
                  onClick={() => setShowBulkModal(true)}
                  className="flex items-center gap-2 text-sm font-medium text-indigo-700 hover:text-indigo-900"
                >
                  <Edit3 className="w-4 h-4" />
                  Bulk Edit
                </button>
                <button 
                  onClick={() => setSelectedIds(new Set())}
                  className="ml-2 p-1 hover:bg-indigo-100 rounded text-indigo-400 hover:text-indigo-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="relative flex-1 max-w-xl group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                <input 
                  type="text" 
                  placeholder="Search WOs, assignees, buildings, contacts..." 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-100 border border-transparent rounded-lg text-sm focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-50 transition-all"
                />
              </div>
            )}
            
            <div className="h-8 w-px bg-slate-200 mx-1" />

            <button 
              onClick={() => setShowCompleted(!showCompleted)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                showCompleted 
                  ? 'bg-slate-100 text-slate-700 border-slate-300' 
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
              }`}
            >
              {showCompleted ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              <span className="hidden lg:inline">{showCompleted ? 'Hide Completed' : 'Show Completed'}</span>
            </button>

            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".csv"/>
            <button 
              onClick={handleImportClick}
              disabled={isLoading}
              className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800 px-3 py-2 rounded-lg text-sm font-medium transition-all shadow-sm disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              <span className="hidden lg:inline">Import</span>
            </button>

            <button 
              onClick={handleCreateNew}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>New</span>
            </button>
            
            <div className="h-8 w-px bg-slate-200 mx-1" />

            {/* User Profile */}
            {currentUser ? (
               <div className="flex items-center gap-3 pl-2">
                 <div className="text-right hidden md:block">
                   <div className="text-xs font-bold text-slate-700 max-w-[150px] truncate">{currentUser}</div>
                   <div className="text-[10px] text-slate-400 uppercase tracking-wider">Online</div>
                 </div>
                 <button 
                   onClick={handleLogout}
                   className="p-2 hover:bg-red-50 hover:text-red-500 rounded-lg text-slate-400 transition-colors"
                   title="Logout"
                 >
                   <LogOut className="w-5 h-5" />
                 </button>
               </div>
            ) : (
              <div className="text-xs text-slate-400 italic px-2">Not logged in</div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="w-full px-6 py-6">
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1300px]">
              <thead>
                <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
                  <th className="px-4 py-3 w-10">
                    <button onClick={handleSelectAll} className="flex items-center justify-center text-slate-400 hover:text-indigo-600">
                      {selectedIds.size > 0 && selectedIds.size === filteredData.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                    </button>
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('wo_number')}>
                    <div className="flex items-center gap-1">WO# <SortIcon field="wo_number" /></div>
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('status')}>
                    <div className="flex items-center gap-1">Status <SortIcon field="status" /></div>
                  </th>
                  <th className="px-4 py-3 w-64">Description</th>
                  <th className="px-4 py-3 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('priority')}>
                    <div className="flex items-center gap-1">Priority <SortIcon field="priority" /></div>
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('assignee')}>
                    <div className="flex items-center gap-1">Assignee <SortIcon field="assignee" /></div>
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('bldg_name')}>
                    <div className="flex items-center gap-1">Building <SortIcon field="bldg_name" /></div>
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('wo_type')}>
                    <div className="flex items-center gap-1">Type <SortIcon field="wo_type" /></div>
                  </th>
                   <th className="px-4 py-3 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('date_reported')}>
                    <div className="flex items-center gap-1">Reported <SortIcon field="date_reported" /></div>
                  </th>
                  <th className="px-4 py-3">Contact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading && workOrders.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Loading data...
                      </div>
                    </td>
                  </tr>
                ) : filteredData.map((wo) => {
                  // Determine background color based on status or selection
                  const isComplete = ['COMPLETE', 'DONE'].includes(wo.status?.toUpperCase());
                  let rowClass = 'cursor-pointer transition-colors group text-sm';
                  if (selectedIds.has(wo.id)) {
                      rowClass += ' bg-indigo-50 hover:bg-indigo-100';
                  } else if (isComplete) {
                      rowClass += ' bg-green-50 hover:bg-green-100';
                  } else {
                      rowClass += ' hover:bg-gray-50';
                  }

                  return (
                  <tr 
                    key={wo.id} 
                    onClick={() => openWO(wo)}
                    className={rowClass}
                  >
                    <td className="px-4 py-3" onClick={(e) => handleSelectRow(wo.id, e)}>
                      <button className={`flex items-center justify-center ${selectedIds.has(wo.id) ? 'text-indigo-600' : 'text-slate-300 hover:text-slate-500'}`}>
                        {selectedIds.has(wo.id) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800 font-mono">
                      {wo.wo_number}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={wo.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                       <div className="truncate max-w-[250px]" title={wo.description}>
                         {wo.description || <span className="text-slate-300 italic">No description</span>}
                       </div>
                    </td>
                    <td className="px-4 py-3">
                      <PriorityBadge priority={wo.priority} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div className="flex items-center gap-2">
                        {wo.assignee ? (
                          <>
                             <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${getAvatarColor(wo.assignee)}`}>
                               {wo.assignee.charAt(0)}
                             </div>
                             <span className="text-xs">{wo.assignee}</span>
                          </>
                        ) : (
                          <span className="text-slate-400 text-xs italic">Unassigned</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {wo.bldg_abbr ? (
                         <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-700 bg-slate-100 px-1.5 rounded text-xs">{wo.bldg_abbr}</span>
                            <span className="text-xs text-slate-500 truncate max-w-[100px]">{wo.bldg_name}</span>
                         </div>
                      ) : (
                         <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">
                      <WOTypeTooltip type={wo.wo_type} />
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">
                      {wo.date_reported ? new Date(wo.date_reported).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">
                       <ContactTooltip abbr={wo.contact_abbr} name={wo.contact_name} />
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
          
          {!isLoading && filteredData.length === 0 && (
            <div className="p-16 text-center text-slate-400">
              <Filter className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-lg font-medium text-slate-500">No work orders found</p>
              <p className="text-sm">Try adjusting your search or filters.</p>
            </div>
          )}
        </div>
      </div>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-8 animate-in fade-in zoom-in-95">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                <Lock className="w-8 h-8" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-center text-slate-800 mb-2">Login Required</h2>
            <p className="text-center text-slate-500 mb-6">Please sign in with your account to access the connected database.</p>
            
            {authError && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {authError}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input 
                  type="email" 
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <input 
                  type="password" 
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                />
              </div>
              <button 
                type="submit" 
                disabled={isAuthLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg transition-colors flex justify-center items-center gap-2"
              >
                {isAuthLoading ? 'Authenticating...' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Edit Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
              <h3 className="font-bold text-slate-800">Bulk Edit ({selectedIds.size} Items)</h3>
            </div>
            
            <div className="p-6 space-y-4">
              <BulkEditField label="Status" 
                onUpdate={(val: string) => handleBulkEdit({ status: val })} 
                options={STATUS_OPTIONS}
              />
              <BulkEditField label="Priority" 
                onUpdate={(val: string) => handleBulkEdit({ priority: val })} 
                options={PRIORITY_OPTIONS}
              />
              <BulkEditField label="Assignee" 
                onUpdate={(val: string) => handleBulkEdit({ assignee: val })} 
                isInput
              />
              <BulkEditField label="Building Abbr" 
                onUpdate={(val: string) => handleBulkEdit({ bldg_abbr: val })} 
                isInput
              />
            </div>

            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => setShowBulkModal(false)} className="text-slate-600 hover:text-slate-800 text-sm font-medium">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Detail / Edit Modal */}
      {showModal && selectedWO && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-start flex-shrink-0">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  {!isEditing && (
                     <span className="font-mono text-xs text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                       {selectedWO.wo_number}
                     </span>
                  )}
                  {isEditing ? (
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                      {selectedWO.id === 'NEW' ? 'NEW RECORD' : 'EDITING'}
                    </span>
                  ) : (
                    <StatusBadge status={selectedWO.status} />
                  )}
                  {!isEditing && selectedWO.updated && (
                    <div className="text-[10px] text-slate-400 flex items-center gap-1 ml-auto mr-4">
                      <Clock className="w-3 h-3" />
                      Updated {new Date(selectedWO.updated).toLocaleString()}
                    </div>
                  )}
                </div>
                {isEditing ? (
                  <input 
                    type="text" 
                    className="text-2xl font-bold text-slate-800 bg-transparent border-b border-slate-300 focus:border-indigo-500 outline-none w-full placeholder-slate-300"
                    value={selectedWO.wo_number}
                    placeholder="WO-202X-XXXX"
                    onChange={e => setSelectedWO({...selectedWO, wo_number: e.target.value})}
                  />
                ) : (
                  <h2 className="text-2xl font-bold text-slate-800">{selectedWO.wo_number}</h2>
                )}
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors ml-4"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-8 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                
                {/* --- Column 1: Core Info --- */}
                <div className="space-y-6">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">Core Details</h3>
                  
                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Status</label>
                    {isEditing ? (
                      <select 
                          className="w-full p-2 bg-white border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
                          value={selectedWO.status}
                          onChange={e => setSelectedWO({...selectedWO, status: e.target.value})}
                      >
                          {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                      </select>
                    ) : (
                      <StatusBadge status={selectedWO.status} />
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Priority</label>
                    {isEditing ? (
                      <select 
                        className="w-full p-2 bg-white border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
                        value={selectedWO.priority}
                        onChange={e => setSelectedWO({...selectedWO, priority: e.target.value})}
                      >
                        {PRIORITY_OPTIONS.map(p => <option key={p}>{p}</option>)}
                      </select>
                    ) : (
                      <PriorityBadge priority={selectedWO.priority} />
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Assignee</label>
                    {isEditing ? (
                       <input 
                         type="text" 
                         className="w-full p-2 bg-white border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
                         value={selectedWO.assignee}
                         onChange={e => setSelectedWO({...selectedWO, assignee: e.target.value})}
                         placeholder="Technician Name"
                       />
                    ) : (
                      <div className="flex items-center gap-2 text-slate-800">
                        <User className="w-4 h-4 text-slate-400" />
                        {selectedWO.assignee || 'Unassigned'}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Date Reported</label>
                    {isEditing ? (
                      <input 
                        type="date" 
                        className="w-full p-2 bg-white border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
                        value={selectedWO.date_reported}
                        onChange={e => setSelectedWO({...selectedWO, date_reported: e.target.value})}
                      />
                    ) : (
                      <div className="flex items-center gap-2 text-slate-800">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        {selectedWO.date_reported ? new Date(selectedWO.date_reported).toLocaleDateString() : '-'}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">WO Type</label>
                    {isEditing ? (
                       <select 
                        className="w-full p-2 bg-white border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
                        value={selectedWO.wo_type}
                        onChange={e => setSelectedWO({...selectedWO, wo_type: e.target.value})}
                      >
                        {WO_TYPE_OPTIONS.map(p => <option key={p}>{p}</option>)}
                      </select>
                    ) : (
                      <div className="text-slate-800 font-medium bg-slate-100 px-2 py-1 rounded inline-block">{selectedWO.wo_type || '-'}</div>
                    )}
                  </div>
                </div>

                {/* --- Column 2: Location & Contact --- */}
                <div className="space-y-6">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">Location & Contact</h3>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Building Name</label>
                    {isEditing ? (
                      <input 
                        type="text" 
                        className="w-full p-2 bg-white border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
                        value={selectedWO.bldg_name}
                        onChange={e => setSelectedWO({...selectedWO, bldg_name: e.target.value})}
                      />
                    ) : (
                      <div className="flex items-center gap-2 text-slate-800">
                        <Building className="w-4 h-4 text-slate-400" />
                        {selectedWO.bldg_name || '-'}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Building Abbr</label>
                    {isEditing ? (
                      <input 
                        type="text" 
                        className="w-full p-2 bg-white border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
                        value={selectedWO.bldg_abbr}
                        onChange={e => setSelectedWO({...selectedWO, bldg_abbr: e.target.value})}
                      />
                    ) : (
                      <div className="text-slate-800 font-mono text-sm bg-slate-100 px-2 py-1 inline-block rounded">{selectedWO.bldg_abbr || '-'}</div>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Contact Name</label>
                    {isEditing ? (
                      <input 
                        type="text" 
                        className="w-full p-2 bg-white border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
                        value={selectedWO.contact_name}
                        onChange={e => setSelectedWO({...selectedWO, contact_name: e.target.value})}
                      />
                    ) : (
                      <div className="flex items-center gap-2 text-slate-800">
                         <User className="w-4 h-4 text-slate-400" />
                         {selectedWO.contact_name || '-'}
                      </div>
                    )}
                  </div>

                   <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Contact Abbr</label>
                    {isEditing ? (
                      <input 
                        type="text" 
                        className="w-full p-2 bg-white border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
                        value={selectedWO.contact_abbr}
                        onChange={e => setSelectedWO({...selectedWO, contact_abbr: e.target.value})}
                      />
                    ) : (
                      <div className="text-slate-800 text-sm">{selectedWO.contact_abbr || '-'}</div>
                    )}
                  </div>
                </div>

                {/* --- Column 3: Description --- */}
                <div className="space-y-6">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">Description & Notes</h3>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Description</label>
                    {isEditing ? (
                      <textarea 
                        className="w-full text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none min-h-[120px]"
                        value={selectedWO.description}
                        onChange={e => setSelectedWO({...selectedWO, description: e.target.value})}
                      />
                    ) : (
                      <p className="text-slate-700 bg-slate-50 p-4 rounded-lg border border-slate-100 leading-relaxed text-sm">
                        {selectedWO.description || "No description provided."}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Comments</label>
                    {isEditing ? (
                      <textarea 
                        className="w-full text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none min-h-[80px]"
                        value={selectedWO.comments}
                        onChange={e => setSelectedWO({...selectedWO, comments: e.target.value})}
                        placeholder="Internal notes..."
                      />
                    ) : (
                      <div className="text-slate-700 bg-yellow-50/50 p-4 rounded-lg border border-yellow-100/50 leading-relaxed text-sm flex items-start gap-2">
                        <MessageSquare className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                        <p>{selectedWO.comments || "No comments."}</p>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-between items-center flex-shrink-0">
              {!isEditing ? (
                <button 
                  className="text-red-500 text-sm hover:underline"
                  onClick={handleDelete}
                >
                  Delete Record
                </button>
              ) : (
                 <div /> 
              )}
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-slate-600 font-medium hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 rounded-lg transition-all"
                >
                  {isEditing ? 'Cancel' : 'Close'}
                </button>
                <button 
                  onClick={() => {
                    if (isEditing) {
                      handleSave();
                    } else {
                      setIsEditing(true);
                    }
                  }}
                  disabled={isSaving}
                  className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 shadow-sm transition-colors flex items-center gap-2"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isEditing ? 'Save Changes' : 'Edit WO'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Stats Footer */}
      <footer className="fixed bottom-0 w-full bg-white border-t py-2 px-4 text-xs text-gray-500 flex justify-between z-10">
          <div>
              Total: {stats.total} | Visible: {filteredData.length}
              {workOrders.length > filteredData.length && <span className="ml-1 text-indigo-600">(Filters active)</span>}
          </div>
          <div className="flex items-center gap-2">
              <button 
                  onClick={() => { localStorage.clear(); window.location.reload(); }} 
                  className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                  title="Hard Reset App (Clear Session)"
              >
                  <RotateCcw className="w-3 h-3" />
              </button>
              <div className="group relative">
                  <Wifi className="w-4 h-4 text-green-500 cursor-help" />
                  <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block bg-gray-800 text-white text-xs p-2 rounded whitespace-nowrap">
                      Connected to {PB_URL}
                  </div>
              </div>
              {currentUser}
          </div>
      </footer>
    </div>
  );
}

// --- SDK Loader ---
function PocketBaseLoader() {
  const [pb, setPb] = useState<any>(null);
  const [healthStatus, setHealthStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [healthError, setHealthError] = useState('');

  useEffect(() => {
    // Since we import the class directly, we instantiate it
    try {
        const pbInstance = new PocketBase(PB_URL);
        setPb(pbInstance);
        
        // Health check
        pbInstance.health.check()
            .then(() => setHealthStatus('ok'))
            .catch((err: any) => {
                console.error("Health check failed:", err);
                setHealthStatus('error');
                setHealthError(err.message);
            });
    } catch (e: any) {
        console.error("Init Error", e);
        setHealthStatus('error');
        setHealthError(e.message);
    }
  }, []);

  if (healthStatus === 'error') {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-700 p-4 text-center">
            <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
                <div className="flex justify-center mb-4 text-red-500"><ServerCrash className="w-16 h-16" /></div>
                <h2 className="text-xl font-bold mb-2">Connection Failed</h2>
                <p className="mb-4 text-sm text-gray-600">
                    Unable to connect to the inventory server at <strong>{PB_URL}</strong>.
                </p>
                <div className="bg-red-50 p-3 rounded text-left text-xs text-red-800 mb-6 font-mono overflow-auto max-h-32">
                    Error: {healthError || "Network Error (Status 0)"}
                </div>
                <div className="text-left text-sm text-gray-600 space-y-2">
                    <p className="font-semibold">Troubleshooting:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Check if your device has internet access.</li>
                        <li><strong>Cloudflare Users:</strong> Ensure SSL/TLS mode is set to <strong>Full (Strict)</strong>.</li>
                        <li>Check if the PocketBase server is running.</li>
                    </ul>
                </div>
                <button 
                    onClick={() => window.location.reload()} 
                    className="mt-6 w-full py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
                >
                    Retry Connection
                </button>
            </div>
        </div>
      );
  }

  if (!pb || healthStatus === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
        <p>Connecting to Database...</p>
      </div>
    );
  }

  return <WorkOrderManagerInner pb={pb} />;
}

export default function WorkOrderApp() {
  return (
    <ErrorBoundary>
      <PocketBaseLoader />
    </ErrorBoundary>
  );
}

// Subcomponent for Bulk Edit Fields
const BulkEditField = ({ label, onUpdate, options, isInput, type = "text" }: { 
  label: string; 
  onUpdate: (val: string) => void; 
  options?: string[]; 
  isInput?: boolean; 
  type?: string 
}) => {
  const [enabled, setEnabled] = useState(false);
  const [val, setVal] = useState('');

  const handleApply = () => {
    if (enabled && val) {
      if (confirm(`Are you sure you want to update ${label} for all selected items?`)) {
        onUpdate(val);
        setEnabled(false);
      }
    }
  };

  return (
    <div className="flex items-center gap-3">
      <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="w-4 h-4" />
      <div className="flex-1">
        <label className={`text-sm font-medium block mb-1 ${enabled ? 'text-slate-700' : 'text-slate-400'}`}>{label}</label>
        {isInput ? (
          <input 
            type={type}
            disabled={!enabled}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            className="w-full p-2 border rounded-md disabled:bg-slate-100 disabled:text-slate-400 text-sm"
          />
        ) : (
          <select 
            disabled={!enabled}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            className="w-full p-2 border rounded-md disabled:bg-slate-100 disabled:text-slate-400 text-sm"
          >
            <option value="">Select...</option>
            {options?.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        )}
      </div>
      <button 
        disabled={!enabled}
        onClick={handleApply}
        className="mt-6 px-3 py-2 bg-indigo-600 text-white rounded text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Apply
      </button>
    </div>
  );
};