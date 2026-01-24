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
  AlertTriangle,
  KeyRound,
  Printer
} from 'lucide-react';
import PocketBase from 'pocketbase';

// --- Configuration ---
const PB_URL = import.meta.env.VITE_PB_URL;
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

interface BuildingInfo {
  id: string;
  bldg_name: string;
  bldg_cmu_abbr: string;
  bldg_max_abbr: string;
  bldg_zone?: string;
  bldg_zone_supervisor?: string;
  bldg_number?: string;
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

const CUSTOM_STATUS_SORT_ORDER = [
  "UNKNOWN", "APPROVED", "IN-PROGRESS", "WAIT-APPROVAL", "WAIT-ORDER-PARTS", 
  "WAIT-RECV-PARTS", "WAIT-RECV-QUOTE", "WAIT-PARTS-INSTALL", "WAIT-PROJ-START", 
  "WAIT-PROP-COND", "QUOTE-RECVD", "DEFERRED", "ON-GOING", "OTHER", 
  "NEEDS HOURS", "WINVOICE-C", "DONE", "COMPLETE"
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
  const s = (status || '').toUpperCase();
  let style = 'bg-slate-100 text-slate-600 border-slate-200';

  if (s === 'APPROVED') style = 'bg-teal-100 text-teal-700 border-teal-200';
  else if (s === 'CANCELLED') style = 'bg-red-100 text-red-700 border-red-200 line-through';
  else if (['COMPLETE', 'DONE'].includes(s)) style = 'bg-emerald-100 text-emerald-700 border-emerald-200';
  else if (s === 'DEFERRED') style = 'bg-zinc-100 text-zinc-600 border-zinc-200';
  else if (['IN-PROGRESS', 'ON-GOING'].includes(s)) style = 'bg-blue-100 text-blue-700 border-blue-200';
  else if (s === 'QUOTE-RECVD' || s === 'WAIT-RECV-QUOTE') style = 'bg-indigo-100 text-indigo-700 border-indigo-200';
  else if (s === 'WINVOICE-C') style = 'bg-pink-100 text-pink-700 border-pink-200';
  else if (s === 'NEEDS HOURS') style = 'bg-orange-100 text-orange-700 border-orange-200';
  else if (s === 'WAIT-APPROVAL') style = 'bg-purple-100 text-purple-700 border-purple-200';
  else if (['WAIT-ORDER-PARTS', 'WAIT-RECV-PARTS', 'WAIT-PARTS-INSTALL'].includes(s)) style = 'bg-amber-100 text-amber-700 border-amber-200';
  else if (s === 'WAIT-PROJ-START') style = 'bg-yellow-100 text-yellow-800 border-yellow-200';
  else if (s === 'WAIT-PROP-COND') style = 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200';

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

const ContactTooltip = ({ abbr, name, contacts, children }: { abbr: string, name: string, contacts: ContactInfo[], children?: React.ReactNode }) => {
  const contact = contacts.find(c => c.abbr === abbr) || contacts.find(c => c.name === name);
  const [isHovering, setIsHovering] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const handleMouseEnter = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setCoords({
      top: rect.top - 5,
      left: rect.left + rect.width / 2
    });
    setIsHovering(true);
  };

  return (
    <>
      <div 
        className="group relative flex flex-col cursor-help"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setIsHovering(false)}
      >
        {children ? children : (
          <>
            <span>{name}</span>
            {abbr && abbr !== name && <span className="text-[10px] text-slate-400">{abbr}</span>}
          </>
        )}
      </div>
      
      {isHovering && contact && createPortal(
        <div 
          className="fixed z-[9999] w-56 bg-slate-800 text-white text-xs p-3 rounded-lg shadow-xl pointer-events-none animate-in fade-in zoom-in-95 duration-200"
          style={{ top: coords.top, left: coords.left, transform: 'translate(-50%, -100%)' }}
        >
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
        </div>,
        document.body
      )}
    </>
  );
};

const WOTypeTooltip = ({ type }: { type: string }) => {
  const definition = WO_TYPE_DEFINITIONS[type];
  const [isHovering, setIsHovering] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  if (!definition) {
      return <span className="text-slate-600 text-xs">{type || '-'}</span>;
  }

  const handleMouseEnter = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setCoords({
      top: rect.top - 5,
      left: rect.left + rect.width / 2
    });
    setIsHovering(true);
  };

  return (
    <>
      <div className="cursor-help inline-block" onMouseEnter={handleMouseEnter} onMouseLeave={() => setIsHovering(false)}>
        <span className="text-slate-700 font-medium bg-slate-100 px-2 py-1 rounded inline-block text-xs border border-slate-200">{type}</span>
      </div>
      
      {isHovering && createPortal(
        <div 
          className="fixed z-[9999] w-48 bg-slate-800 text-white text-xs p-2 rounded-lg shadow-xl pointer-events-none animate-in fade-in zoom-in-95 duration-200 text-center"
          style={{ top: coords.top, left: coords.left, transform: 'translate(-50%, -100%)' }}
        >
          {definition}
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
        </div>,
        document.body
      )}
    </>
  );
};

const BuildingTooltip = ({ abbr, name, buildings }: { abbr: string, name: string, buildings: BuildingInfo[] }) => {
  const building = buildings.find(b => 
    (b.bldg_cmu_abbr === abbr) || 
    (b.bldg_max_abbr === abbr) || 
    (b.bldg_name === name)
  );
  
  const [isHovering, setIsHovering] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const handleMouseEnter = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setCoords({
      top: rect.top - 5,
      left: rect.left + rect.width / 2
    });
    setIsHovering(true);
  };

  const display = abbr || name || '-';

  return (
    <>
      <div 
        className="cursor-help inline-block" 
        onMouseEnter={handleMouseEnter} 
        onMouseLeave={() => setIsHovering(false)}
      >
        <span className="font-bold text-slate-700 bg-slate-100 px-1.5 rounded text-xs">{display}</span>
      </div>
      
      {isHovering && building && createPortal(
        <div 
          className="fixed z-[9999] w-64 bg-slate-800 text-white text-xs p-3 rounded-lg shadow-xl pointer-events-none animate-in fade-in zoom-in-95 duration-200"
          style={{ top: coords.top, left: coords.left, transform: 'translate(-50%, -100%)' }}
        >
          <div className="font-bold text-sm mb-1 text-indigo-300">{building.bldg_name}</div>
          <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
            <span className="text-slate-400">CMU Abbr:</span><span className="font-mono">{building.bldg_cmu_abbr || '-'}</span>
            <span className="text-slate-400">Maximo Abbr:</span><span className="font-mono">{building.bldg_max_abbr || '-'}</span>
            {building.bldg_number && <><span className="text-slate-400">Number:</span><span>{building.bldg_number}</span></>}
            {building.bldg_zone && <><span className="text-slate-400">Zone:</span><span>{building.bldg_zone}</span></>}
            {building.bldg_zone_supervisor && <><span className="text-slate-400">Supervisor:</span><span>{building.bldg_zone_supervisor}</span></>}
          </div>
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
        </div>,
        document.body
      )}
    </>
  );
};

// --- Inner Application Component ---

function WorkOrderManagerInner({ pb }: { pb: any }) {
  // --- Auth State ---
  const [user, setUser] = useState(() => {
      if (pb.authStore.isValid && pb.authStore.model) {
          if (!pb.authStore.model.email) return null;
          return pb.authStore.model;
      }
      return null;
  });
  const [loginEmail, setLoginEmail] = useState(''); 
  const [registerEmail, setRegisterEmail] = useState(''); 
  const [registerName, setRegisterName] = useState(''); 
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [authMode, setAuthMode] = useState('login'); 
  const [authMessage, setAuthMessage] = useState<{ type: 'error' | 'success' | '', text: string }>({ type: '', text: '' });
  const [authLoading, setAuthLoading] = useState(false);

  const currentUser = user?.name || user?.email;

  // --- App State ---
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [contacts, setContacts] = useState<ContactInfo[]>([]);
  const [buildings, setBuildings] = useState<BuildingInfo[]>([]);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<keyof WorkOrder>('status');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
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

  // --- Auth & Data Subscription ---
  useEffect(() => {
      const unsubscribe = pb.authStore.onChange((token: any, model: any) => { 
          if (!pb.authStore.isValid || !model || !model.email) {
              setUser(null);
          } else {
              setUser(model); 
          }
      }); 
      return () => unsubscribe(); 
  }, [pb]);

  // Sanity Check
  useEffect(() => {
      if (user && (!user.id || !user.email)) {
          console.warn("Detected corrupt or invalid session. Forcing logout.");
          pb.authStore.clear();
          setUser(null);
      }
  }, [user, pb]);

  useEffect(() => {
    if (user && user.approved !== false) {
        loadData();
    }
  }, [user]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [woRes, contactsRes, buildingsRes] = await Promise.all([
        pb.collection(COLLECTION_NAME).getFullList({ sort: '-created' }),
        pb.collection('contacts').getFullList().catch((e: any) => { console.warn("Contacts load failed", e); return []; }),
        pb.collection('buildings').getFullList().catch((e: any) => { console.warn("Buildings load failed", e); return []; })
      ]);
      
      setWorkOrders(woRes as WorkOrder[]);
      setContacts(contactsRes as ContactInfo[]);
      setBuildings(buildingsRes as BuildingInfo[]);
    } catch (err: any) {
      console.error("PB Load Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); 
    setAuthMessage({ type: '', text: '' });
    setAuthLoading(true); 
    
    await new Promise(resolve => setTimeout(resolve, 1500));

    try { 
      await pb.collection('users').authWithPassword(loginEmail, password); 
    } catch (err: any) { 
      console.error("Login failed", err);
      const msg = err.message || 'Invalid login credentials.';
      setAuthMessage({ type: 'error', text: msg }); 
    } finally {
        setAuthLoading(false); 
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault(); setAuthMessage({ type: '', text: '' });
    if (password !== passwordConfirm) { setAuthMessage({ type: 'error', text: 'Passwords do not match' }); return; }
    try {
        await pb.collection('users').create({ email: registerEmail, name: registerName, password, passwordConfirm, emailVisibility: true, role: 'user', approved: false });
        setAuthMessage({ type: 'success', text: 'Account created! Pending admin approval.' });
        setTimeout(() => setAuthMode('login'), 2000);
    } catch (err: any) { setAuthMessage({ type: 'error', text: err.message || 'Failed.' }); }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault(); setAuthMessage({ type: '', text: '' });
    try { await pb.collection('users').requestPasswordReset(loginEmail); setAuthMessage({ type: 'success', text: 'Reset email sent (if account exists).' }); } 
    catch (err: any) { setAuthMessage({ type: 'error', text: err.message || 'Failed.' }); }
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
        } else if (s === 'WINVOICE-C') {
            wait++;          
        } else if (s === 'HIDE') {
// Do nothing               
          } else {
            open++;
        }
    });

    return { total, open, wait, complete };
  }, [workOrders]);

  // --- Print Report ---
  const handlePrintReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const getStatusStyle = (status: string) => {
      const s = (status || '').toUpperCase();
      if (s === 'APPROVED') return 'background-color: #ccfbf1; color: #0f766e; border-color: #99f6e4;';
      if (s === 'CANCELLED') return 'background-color: #fee2e2; color: #b91c1c; border-color: #fecaca; text-decoration: line-through;';
      if (['COMPLETE', 'DONE'].includes(s)) return 'background-color: #d1fae5; color: #047857; border-color: #a7f3d0;';
      if (s === 'DEFERRED') return 'background-color: #f4f4f5; color: #52525b; border-color: #e4e4e7;';
      if (['IN-PROGRESS', 'ON-GOING'].includes(s)) return 'background-color: #dbeafe; color: #1d4ed8; border-color: #bfdbfe;';
      if (s === 'QUOTE-RECVD' || s === 'WAIT-RECV-QUOTE') return 'background-color: #e0e7ff; color: #4338ca; border-color: #c7d2fe;';
      if (s === 'WINVOICE-C') return 'background-color: #fce7f3; color: #be185d; border-color: #fbcfe8;';
      if (s === 'NEEDS HOURS') return 'background-color: #ffedd5; color: #c2410c; border-color: #fed7aa;';
      if (s === 'WAIT-APPROVAL') return 'background-color: #f3e8ff; color: #7e22ce; border-color: #e9d5ff;';
      if (['WAIT-ORDER-PARTS', 'WAIT-RECV-PARTS', 'WAIT-PARTS-INSTALL'].includes(s)) return 'background-color: #fef3c7; color: #b45309; border-color: #fde68a;';
      if (s === 'WAIT-PROJ-START') return 'background-color: #fef9c3; color: #854d0e; border-color: #fde047;';
      if (s === 'WAIT-PROP-COND') return 'background-color: #fae8ff; color: #a21caf; border-color: #f5d0fe;';
      return 'background-color: #f1f5f9; color: #475569; border-color: #e2e8f0;';
    };

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Work Orders Report</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 20px; color: #1f2937; font-size: 10px; }
            h1 { text-align: center; margin-bottom: 20px; font-size: 20px; font-weight: 800; color: #111827; }
            .header-info { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 10px; color: #6b7280; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; }
            table { width: auto; border-collapse: collapse; }
            th { background-color: #f3f4f6; color: #374151; font-weight: 700; text-transform: uppercase; padding: 6px 8px; text-align: left; border: 1px solid #e5e7eb; white-space: nowrap; font-size: 9px; }
            td { padding: 6px 8px; border: 1px solid #e5e7eb; vertical-align: top; }
            tr:nth-child(even) { background-color: #f9fafb; }
            .status-badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 9px; text-transform: uppercase; border: 1px solid; }
            .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
            .nowrap { white-space: nowrap; }
            @media print {
              .no-print { display: none; }
              body { padding: 0; }
              @page { size: landscape; margin: 1cm; }
            }
          </style>
        </head>
        <body>
          <div class="no-print" style="margin-bottom: 20px; text-align: right;">
            <button onclick="window.print()" style="padding: 8px 16px; background: #4f46e5; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Print Report</button>
          </div>
          
          <h1>Work Orders Report</h1>
          <div class="header-info">
            <span>Generated: ${new Date().toLocaleString()}</span>
            <span>Total Records: ${filteredData.length}</span>
          </div>

          <table>
            <thead>
              <tr>
                <th>WO #</th>
                <th>Status</th>
                <th>Description</th>
                <th>Priority</th>
                <th>Assignee</th>
                <th>Building</th>
                <th>Type</th>
                <th>Reported</th>
                <th>Contact</th>
              </tr>
            </thead>
            <tbody>
              ${filteredData.map(wo => `
                <tr>
                  <td class="mono nowrap" style="font-weight: 600;">${wo.wo_number}</td>
                  <td class="nowrap"><span class="status-badge" style="${getStatusStyle(wo.status)}">${wo.status}</span></td>
                  <td>${wo.description || ''}</td>
                  <td class="nowrap">${wo.priority}</td>
                  <td class="nowrap">${wo.assignee || '-'}</td>
                  <td class="nowrap">${wo.bldg_abbr || wo.bldg_name || '-'}</td>
                  <td class="nowrap">${wo.wo_type || '-'}</td>
                  <td class="nowrap">${wo.date_reported ? new Date(wo.date_reported).toLocaleDateString() : '-'}</td>
                  <td class="nowrap">${wo.contact_name || wo.contact_abbr || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

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
      wo_number: '',
      status: 'APPROVED',
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
    let dateVal = '';
    if (wo.date_reported) {
        const d = new Date(wo.date_reported);
        if (!isNaN(d.getTime())) {
            dateVal = d.toISOString().split('T')[0];
        }
    }
    const formatted = { 
      ...wo, 
      date_reported: dateVal
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
        (p.id && p.id.toLowerCase().includes(lower)) ||
        (p.wo_number && p.wo_number.toLowerCase().includes(lower)) ||
        (p.status && p.status.toLowerCase().includes(lower)) ||
        (p.assignee && p.assignee.toLowerCase().includes(lower)) ||
        (p.priority && p.priority.toLowerCase().includes(lower)) ||
        (p.date_reported && p.date_reported.toLowerCase().includes(lower)) ||
        (p.wo_type && p.wo_type.toLowerCase().includes(lower)) ||
        (p.description && p.description.toLowerCase().includes(lower)) ||
        (p.bldg_abbr && p.bldg_abbr.toLowerCase().includes(lower)) ||
        (p.bldg_name && p.bldg_name.toLowerCase().includes(lower)) ||
        (p.contact_abbr && p.contact_abbr.toLowerCase().includes(lower)) ||
        (p.contact_name && p.contact_name.toLowerCase().includes(lower)) ||
        (p.comments && p.comments.toLowerCase().includes(lower)) ||
        (p.last_modified_by && p.last_modified_by.toLowerCase().includes(lower))
      );
    }

    data.sort((a, b) => {
      if (sortField === 'status') {
        const getRank = (s: string) => {
            const idx = CUSTOM_STATUS_SORT_ORDER.indexOf(s?.toUpperCase());
            return idx === -1 ? 999 : idx;
        };
        const rankA = getRank(a.status);
        const rankB = getRank(b.status);
        
        if (rankA < rankB) return sortDir === 'asc' ? -1 : 1;
        if (rankA > rankB) return sortDir === 'asc' ? 1 : -1;
        
        // Secondary sort: date_reported descending
        const dateA = a.date_reported || '';
        const dateB = b.date_reported || '';
        if (dateA < dateB) return 1;
        if (dateA > dateB) return -1;
        return 0;
      }

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

  // --- Auth Screen ---
  if (!user || user.approved === false) {
     return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center text-indigo-600"><Briefcase className="w-12 h-12" /></div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Work Orders Login</h2>
        </div>
        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            {user && user.approved === false ? (
               <div className="text-center">
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 mb-4"><Clock className="h-6 w-6 text-yellow-600" /></div>
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Approval Pending</h3>
                  <button onClick={handleLogout} className="mt-6 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700">Sign Out</button>
               </div>
            ) : (
                authMode === 'login' ? (
                <form className="space-y-6" onSubmit={handleLogin}>
                    <div><label className="block text-sm font-medium text-gray-700">Email Address</label><input type="email" required value={loginEmail} onChange={e => setLoginEmail(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md p-2" placeholder="user@example.com" /></div>
                    <div><label className="block text-sm font-medium text-gray-700">Password</label><input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md p-2" /></div>
                    {authMessage.text && <div className="text-red-600 text-sm">{authMessage.text}</div>}
                    <button type="submit" disabled={authLoading} className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md flex items-center justify-center gap-2 disabled:opacity-70">
                        {authLoading ? <><Loader2 className="w-4 h-4 animate-spin"/> Signing In...</> : 'Sign In'}
                    </button>
                    <div className="flex justify-between text-sm mt-4">
                        <button type="button" onClick={() => setAuthMode('register')} className="text-indigo-600">Create Account</button>
                        <button type="button" onClick={() => setAuthMode('reset')} className="text-gray-500 flex items-center gap-1"><KeyRound className="w-4 h-4" /> Forgot Password?</button>
                    </div>
                </form>
                ) : authMode === 'register' ? (
                <form className="space-y-6" onSubmit={handleRegister}>
                    <div><label className="block text-sm font-medium text-gray-700">Full Name</label><input type="text" required value={registerName} onChange={e => setRegisterName(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md p-2" placeholder="John Doe" /></div>
                    <div><label className="block text-sm font-medium text-gray-700">Email Address</label><input type="email" required value={registerEmail} onChange={e => setRegisterEmail(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md p-2" /></div>
                    <div><label className="block text-sm font-medium text-gray-700">Password</label><input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md p-2" /></div>
                    <div><label className="block text-sm font-medium text-gray-700">Confirm Password</label><input type="password" required value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md p-2" /></div>
                    {authMessage.text && <div className="text-red-600 text-sm">{authMessage.text}</div>}
                    <button type="submit" className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md">Register</button>
                    <button type="button" onClick={() => setAuthMode('login')} className="w-full text-center text-sm text-gray-600 mt-2">Back</button>
                </form>
                ) : (
                <form className="space-y-6" onSubmit={handleResetPassword}>
                    <div><label className="block text-sm font-medium text-gray-700">Email Address</label><input type="email" required value={loginEmail} onChange={e => setLoginEmail(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md p-2" /></div>
                    {authMessage.text && <div className="text-green-600 text-sm">{authMessage.text}</div>}
                    <button type="submit" className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md">Reset</button>
                    <button type="button" onClick={() => setAuthMode('login')} className="w-full text-center text-sm text-gray-600 mt-2">Back</button>
                </form>
                )
            )}
          </div>
        </div>
      </div>
    );
  }

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
              onClick={handlePrintReport}
              className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800 px-3 py-2 rounded-lg text-sm font-medium transition-all shadow-sm"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden lg:inline">Print Report</span>
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
                  <th className="px-4 py-3 whitespace-nowrap w-32 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('wo_number')}>
                    <div className="flex items-center gap-1">WO# <SortIcon field="wo_number" /></div>
                  </th>
                  <th className="px-4 py-3 whitespace-nowrap w-32 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('status')}>
                    <div className="flex items-center gap-1">Status <SortIcon field="status" /></div>
                  </th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3 whitespace-nowrap w-24 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('priority')}>
                    <div className="flex items-center gap-1">Priority <SortIcon field="priority" /></div>
                  </th>
                  <th className="px-4 py-3 whitespace-nowrap w-32 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('assignee')}>
                    <div className="flex items-center gap-1">Assignee <SortIcon field="assignee" /></div>
                  </th>
                  <th className="px-4 py-3 whitespace-nowrap w-40 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('bldg_name')}>
                    <div className="flex items-center gap-1">Building <SortIcon field="bldg_name" /></div>
                  </th>
                  <th className="px-4 py-3 whitespace-nowrap w-24 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('wo_type')}>
                    <div className="flex items-center gap-1">Type <SortIcon field="wo_type" /></div>
                  </th>
                   <th className="px-4 py-3 whitespace-nowrap w-28 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('date_reported')}>
                    <div className="flex items-center gap-1">Reported <SortIcon field="date_reported" /></div>
                  </th>
                  <th className="px-4 py-3 whitespace-nowrap w-32">Contact</th>
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
                       <div className="whitespace-normal break-words min-w-[300px]" title={wo.description}>
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
                      <BuildingTooltip abbr={wo.bldg_abbr} name={wo.bldg_name} buildings={buildings} />
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">
                      <WOTypeTooltip type={wo.wo_type} />
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">
                      {wo.date_reported ? new Date(wo.date_reported).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">
                       <ContactTooltip abbr={wo.contact_abbr} name={wo.contact_name} contacts={contacts} />
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
                      <>
                        <input 
                          type="text" 
                          list="bldg-names-list"
                          className="w-full p-2 bg-white border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
                          value={selectedWO.bldg_name}
                          onChange={e => {
                              const val = e.target.value;
                              const match = buildings.find(b => b.bldg_name === val);
                              setSelectedWO(prev => ({...prev!, bldg_name: val, bldg_abbr: match ? (match.bldg_max_abbr || match.bldg_cmu_abbr) : prev!.bldg_abbr}));
                          }}
                          placeholder="Select or type building..."
                        />
                        <datalist id="bldg-names-list">
                            {buildings.map(b => <option key={b.id} value={b.bldg_name} />)}
                        </datalist>
                      </>
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
                      <>
                        <input 
                          type="text" 
                          list="bldg-abbrs-list"
                          className="w-full p-2 bg-white border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
                          value={selectedWO.bldg_abbr}
                          onChange={e => {
                              const val = e.target.value;
                              const match = buildings.find(b => (b.bldg_max_abbr === val || b.bldg_cmu_abbr === val));
                              setSelectedWO(prev => ({...prev!, bldg_abbr: val, bldg_name: match ? match.bldg_name : prev!.bldg_name}));
                          }}
                          placeholder="Abbreviation..."
                        />
                        <datalist id="bldg-abbrs-list">
                            {buildings.map(b => <option key={b.id} value={b.bldg_max_abbr || b.bldg_cmu_abbr} />)}
                        </datalist>
                      </>
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
                      <ContactTooltip abbr={selectedWO.contact_abbr} name={selectedWO.contact_name} contacts={contacts}>
                        <div className="flex items-center gap-2 text-slate-800">
                           <User className="w-4 h-4 text-slate-400" />
                           {selectedWO.contact_name || '-'}
                        </div>
                      </ContactTooltip>
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