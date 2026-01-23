// @ts-ignore
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
  List,
  AlertCircle,
  Building,
  User,
  Briefcase,
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
  CalendarDays,
  Wifi,
  RotateCcw,
  ServerCrash,
  AlertTriangle,
  ClipboardList
} from 'lucide-react';
import PocketBase from 'pocketbase';

// --- Configuration ---
const PB_URL = import.meta.env.VITE_PB_URL;

const CUSTOM_STATE_SORT_ORDER = [
  "Proposed",
  "Approved",
  "In-Progress",
  "Waiting for Quotations",
  "Quote Received",
  "Sent PAF to contractor",
  "Sent to Storeroom",
  "Paperwork submitted",
  "Waiting for Parts",
  "Waiting for Project Start",
  "Waiting for Invoice",
  "Complete",
  "Cancelled",
  "Deferred"
];

// --- Types ---

type ProjectState = 
  | 'Approved' 
  | 'Cancelled'
  | 'Complete'
  | 'Deferred' 
  | 'In-Progress'
  | 'Paperwork submitted'
  | 'Proposed' 
  | 'Quote Received'
  | 'Sent PAF to contractor'
  | 'Sent to Storeroom'
  | 'Waiting for Parts'
  | 'Waiting for Project Start'
  | 'Waiting for Quotations'
  | 'Waiting for Invoice';

type PriorityLevel = 'Low' | 'Medium' | 'High' | 'Critical';

interface Project {
  id: string;
  name: string;           
  building: string[];     
  priority: PriorityLevel;
  vendor: string;         
  responsibility: string; 
  state: ProjectState;    
  description: string;
  comments: string; 
  fiscal_year: string; 
  work_orders: string[];
  contractors: string[];
  target_start_date: string;
  completion_date: string;
  last_modified_by: string;
  last_modified_at: string;
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

// --- Components ---

const getAvatarColor = (name: string) => {
  const colors = [
    'bg-red-100 text-red-700 border-red-200',
    'bg-orange-100 text-orange-700 border-orange-200',
    'bg-amber-100 text-amber-700 border-amber-200',
    'bg-green-100 text-green-700 border-green-200',
    'bg-emerald-100 text-emerald-700 border-emerald-200',
    'bg-teal-100 text-teal-700 border-teal-200',
    'bg-cyan-100 text-cyan-700 border-cyan-200',
    'bg-sky-100 text-sky-700 border-sky-200',
    'bg-blue-100 text-blue-700 border-blue-200',
    'bg-indigo-100 text-indigo-700 border-indigo-200',
    'bg-violet-100 text-violet-700 border-violet-200',
    'bg-purple-100 text-purple-700 border-purple-200',
    'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200',
    'bg-pink-100 text-pink-700 border-pink-200',
    'bg-rose-100 text-rose-700 border-rose-200',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const StateBadge = ({ state }: { state: ProjectState }) => {
  const styles: Record<ProjectState, string> = {
    'Approved': 'bg-teal-100 text-teal-700 border-teal-200',
    'Cancelled': 'bg-red-100 text-red-700 border-red-200 line-through',
    'Complete': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'Deferred': 'bg-zinc-100 text-zinc-600 border-zinc-200',
    'In-Progress': 'bg-blue-100 text-blue-700 border-blue-200',
    'Paperwork submitted': 'bg-sky-100 text-sky-700 border-sky-200',
    'Proposed': 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200',
    'Quote Received': 'bg-indigo-100 text-indigo-700 border-indigo-200',
    'Sent PAF to contractor': 'bg-cyan-100 text-cyan-700 border-cyan-200',
    'Sent to Storeroom': 'bg-orange-100 text-orange-700 border-orange-200',
    'Waiting for Parts': 'bg-amber-100 text-amber-700 border-amber-200',
    'Waiting for Project Start': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'Waiting for Quotations': 'bg-purple-100 text-purple-700 border-purple-200',
    'Waiting for Invoice': 'bg-pink-100 text-pink-700 border-pink-200',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap ${styles[state] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
      {state}
    </span>
  );
};

const PriorityBadge = ({ priority }: { priority: PriorityLevel }) => {
  const colors: Record<PriorityLevel, string> = {
    'Low': 'text-slate-500',
    'Medium': 'text-blue-600',
    'High': 'text-orange-600 font-bold',
    'Critical': 'text-red-600 font-extrabold',
  };
  return <span className={`text-xs ${colors[priority]}`}>{priority}</span>;
};

const BuildingTooltip = ({ name, buildings }: { name: string, buildings: BuildingInfo[] }) => {
  const building = buildings.find(b => b.bldg_name === name);
  const abbr = building ? (building.bldg_max_abbr || building.bldg_cmu_abbr) : null;
  const display = abbr || name;

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
        className="cursor-help inline-flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setIsHovering(false)}
      >
        <Building className="w-3 h-3 text-slate-400" />
        <span className="text-slate-800 text-sm">{display}</span>
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

// Error Boundary Component
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
          <button 
             onClick={() => { localStorage.clear(); window.location.reload(); }}
             className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
           >
             Reset App
           </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const MultiInput = ({ values, onChange, placeholder, list }: { values: string[], onChange: (v: string[]) => void, placeholder: string, list?: string[] }) => {
  const [input, setInput] = useState('');
  const listId = useMemo(() => `list-${Math.random().toString(36).substr(2, 9)}`, []);
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault();
      if (!values.includes(input.trim())) {
        onChange([...values, input.trim()]);
      }
      setInput('');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);
    if (list && list.includes(val)) {
      if (!values.includes(val)) {
        onChange([...values, val]);
      }
      setInput('');
    }
  };

  const removeValue = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  return (
    <div className="w-full">
      <div className="flex flex-wrap gap-2 mb-2">
        {values.map((v, i) => (
          <span key={i} className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs flex items-center gap-1 border border-slate-200">
            {v}
            <button onClick={() => removeValue(i)} className="hover:text-red-500"><X className="w-3 h-3" /></button>
          </span>
        ))}
      </div>
      <input 
        type="text" 
        value={input}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        list={list ? listId : undefined}
        className="w-full p-2 bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
        placeholder={`${placeholder} (Press Enter to add)`}
      />
      {list && (
        <datalist id={listId}>
          {list.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
      )}
    </div>
  );
};

// Main Inner Component
function ProjectsManagerInner({ pb }: { pb: any }) {
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [buildings, setBuildings] = useState<BuildingInfo[]>([]); 
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<keyof Project>('state');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showCompleted, setShowCompleted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Selection & Bulk Edit
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null); // New State for Shift Click
  const [showBulkModal, setShowBulkModal] = useState(false);
  
  // Modal State
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derived state for dropdowns (Responsibility)
  const uniqueResponsibilities = useMemo(() => {
    const items = new Set(projects.map(p => p.responsibility).filter(Boolean));
    return Array.from(items).sort();
  }, [projects]);

  // Derived state for Header Summary
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    projects.forEach(p => {
      // If hiding completed, skip complete/cancelled for counts unless explicitly shown
      if (!showCompleted && (p.state === 'Complete' || p.state === 'Cancelled')) return;
      counts[p.state] = (counts[p.state] || 0) + 1;
    });
    return counts;
  }, [projects, showCompleted]);

  const STATUS_OPTIONS: ProjectState[] = [
    'Proposed', 
    'Approved',
    'Waiting for Project Start',
    'In-Progress',
    'Waiting for Parts',
    'Waiting for Quotations',
    'Quote Received',
    'Paperwork submitted',
    'Sent PAF to contractor',
    'Sent to Storeroom',
    'Waiting for Invoice',
    'Deferred',
    'Complete',
    'Cancelled'
  ];

  // --- PB Integration ---
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
    if (user && user.approved !== false && pb) { // Ensure pb is initialized
        loadData();
    }
  }, [user, pb]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [projectsRes, buildingsRes] = await Promise.all([
        pb.collection('projects').getFullList({ sort: '-created' }),
        pb.collection('buildings').getFullList({ sort: 'bldg_name' }).catch((e: any) => { console.warn("Buildings load failed", e); return []; })
      ]);

      const mapped: Project[] = projectsRes.map((r: any) => ({
        id: r.id,
        name: r.name, 
        building: Array.isArray(r.building) ? r.building : (r.building ? [r.building] : []),
        priority: r.priority,
        vendor: r.vendor,
        responsibility: r.responsibility,
        state: r.state,
        description: r.description,
        comments: r.comments || '',
        fiscal_year: r.fiscal_year || '',
        work_orders: r.work_orders || [],
        contractors: r.contractors || [],
        target_start_date: r.target_start_date ? r.target_start_date.split(/[T ]/)[0] : '', 
        completion_date: r.completion_date ? r.completion_date.split(/[T ]/)[0] : '',
        last_modified_by: r.last_modified_by || 'System',
        last_modified_at: r.updated || ''
      }));
      setProjects(mapped);

      setBuildings(buildingsRes as BuildingInfo[]);
    } catch (err) {
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

  const formatDateForPB = (dateStr: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return date.toISOString();
  };

  // --- CSV Parser ---
  const parseCSVLine = (text: string) => {
    const re_value = /(?!\s*$)\s*(?:'([^'\\]*(?:\\[\S\s][^'\\]*)*)'|"([^"\\]*(?:\\[\S\s][^"\\]*)*)"|([^,'"\s\\]*(?:\s+[^,'"\s\\]+)*))\s*(?:,|$)/g;
    const matches = [];
    let match;
    while ((match = re_value.exec(text)) !== null) {
      matches.push(match[1] || match[2] || match[3] || "");
    }
    return matches;
  };

  // --- Filter & Sort ---
  const filteredData = useMemo(() => {
    let data = [...projects];

    if (!showCompleted) {
      data = data.filter(p => p.state !== 'Complete' && p.state !== 'Cancelled');
    }

    if (search) {
      const lower = search.toLowerCase();
      data = data.filter(p => 
        p.id.toLowerCase().includes(lower) ||
        p.name.toLowerCase().includes(lower) ||
        p.building.some(b => b.toLowerCase().includes(lower)) ||
        p.priority.toLowerCase().includes(lower) ||
        p.vendor.toLowerCase().includes(lower) ||
        p.responsibility.toLowerCase().includes(lower) ||
        p.state.toLowerCase().includes(lower) ||
        p.description.toLowerCase().includes(lower) ||
        p.fiscal_year.toLowerCase().includes(lower) ||
        p.work_orders.some(wo => wo.toLowerCase().includes(lower)) ||
        p.contractors.some(c => c.toLowerCase().includes(lower)) ||
        p.comments.toLowerCase().includes(lower) ||
        p.target_start_date.toLowerCase().includes(lower) ||
        p.completion_date.toLowerCase().includes(lower) ||
        p.last_modified_by.toLowerCase().includes(lower)
      );
    }

    data.sort((a, b) => {
      if (sortField === 'state') {
        const getRank = (s: string) => {
            const idx = CUSTOM_STATE_SORT_ORDER.indexOf(s);
            return idx === -1 ? 999 : idx;
        };
        const rankA = getRank(a.state);
        const rankB = getRank(b.state);
        
        if (rankA < rankB) return sortDir === 'asc' ? -1 : 1;
        if (rankA > rankB) return sortDir === 'asc' ? 1 : -1;
        
        // Secondary sort: name ascending
        if (a.name.toLowerCase() < b.name.toLowerCase()) return -1;
        if (a.name.toLowerCase() > b.name.toLowerCase()) return 1;
        return 0;
      }

      const valA = a[sortField];
      const valB = b[sortField];
      if (Array.isArray(valA)) return 0; 
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return data;
  }, [projects, search, sortField, sortDir, showCompleted]);

  const handleSort = (field: keyof Project) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }: { field: keyof Project }) => {
    if (sortField !== field) return <div className="w-4 h-4" />;
    return sortDir === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />;
  };

  // --- Import Logic ---
  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      const lines = text.split('\n');
      const startIndex = lines[0].toLowerCase().includes('name') ? 1 : 0;
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
             let csvState = cols[5] as ProjectState;
             if (!STATUS_OPTIONS.includes(csvState)) {
                csvState = 'In-Progress'; 
             }

             const newProject = {
               name: cols[0] || 'Untitled',
               building: cols[1] ? cols[1].split(';').map(b => b.trim()).filter(Boolean) : [],
               priority: (['Low', 'Medium', 'High', 'Critical'].includes(cols[2]) ? cols[2] : 'Medium'),
               vendor: cols[3] || '',
               responsibility: cols[4] || '',
               state: csvState,
               description: cols[6] || '',
               work_orders: cols[7] ? cols[7].split(';').map(s => s.trim()).filter(Boolean) : [],
               contractors: cols[8] ? cols[8].split(';').map(s => s.trim()).filter(Boolean) : [],
               target_start_date: formatDateForPB(cols[9]),
               completion_date: formatDateForPB(cols[10]),
               comments: cols[11] || '',
               fiscal_year: cols[12] || '', 
               last_modified_by: currentUser || 'Importer',
             };
             promises.push(pb.collection('projects').create(newProject));
          }
        }
        
        if (promises.length > 0) {
          await Promise.all(promises);
          await loadData(); 
          alert(`Successfully imported ${promises.length} records.`);
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

  const handleSave = async () => {
    if (!selectedProject) return;
    setIsSaving(true);

    try {
      const updatedProject = { ...selectedProject };
      
      updatedProject.last_modified_by = currentUser || 'Unknown';
      
      if (updatedProject.state === 'Complete' && !updatedProject.completion_date) {
        updatedProject.completion_date = new Date().toISOString();
      } 

      if (updatedProject.target_start_date) {
         const d = new Date(updatedProject.target_start_date);
         if (!isNaN(d.getTime())) updatedProject.target_start_date = d.toISOString();
         else updatedProject.target_start_date = '';
      }
      
      if (updatedProject.completion_date) {
         const d = new Date(updatedProject.completion_date);
         if (!isNaN(d.getTime())) updatedProject.completion_date = d.toISOString();
         else updatedProject.completion_date = '';
      }

      if (updatedProject.id === 'NEW') {
        const { id, last_modified_at, ...data } = updatedProject;
        await pb.collection('projects').create(data);
      } else {
        const { id, last_modified_at, ...data } = updatedProject;
        await pb.collection('projects').update(id, data);
      }

      await loadData();
      setShowModal(false);
    } catch (err: any) {
      console.error("Save failed:", err);
      const msg = err.data?.message || err.message || "Check console";
      alert(`Failed to save project.\nError: ${msg}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedProject || selectedProject.id === 'NEW') return;
    if (!confirm('Are you sure you want to delete this project? This cannot be undone.')) return;

    setIsSaving(true);
    try {
      await pb.collection('projects').delete(selectedProject.id);
      await loadData();
      setShowModal(false);
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Failed to delete project. Check permissions.");
    } finally {
      setIsSaving(false);
    }
  };

  const openProject = (p: Project) => {
    setSelectedProject(p);
    setIsEditing(false);
    setShowModal(true);
  };

  const handleCreateNew = () => {
    setSelectedProject({
      id: 'NEW',
      name: '',
      building: [],
      priority: 'Medium',
      vendor: '',
      responsibility: '',
      state: 'Proposed', 
      description: '',
      comments: '',
      fiscal_year: 'FY25', // Default
      work_orders: [],
      contractors: [],
      target_start_date: new Date().toISOString().split('T')[0],
      completion_date: '',
      last_modified_by: currentUser || 'Unknown',
      last_modified_at: new Date().toISOString()
    });
    setIsEditing(true);
    setShowModal(true);
  };

  // --- Auth Screen ---
  if (!user || user.approved === false) {
     return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center text-indigo-600"><ClipboardList className="w-12 h-12" /></div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Projects Login</h2>
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
                        <button type="button" onClick={() => setAuthMode('reset')} className="text-gray-500">Forgot Password?</button>
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

    // Range Select (Shift+Click)
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
      // Standard Toggle
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

  const handleBulkEdit = async (updates: Partial<Project>) => {
    if (selectedIds.size === 0) return;
    setIsSaving(true);
    
    pb.autoCancellation(false); // Disable auto-cancellation for bulk operations
    const now = new Date().toISOString();
    const finalUpdates = { ...updates, last_modified_by: currentUser || 'Bulk Edit' };

    if (finalUpdates.state === 'Complete') {
      (finalUpdates as any).completion_date = now;
    }

    try {
      const promises = Array.from(selectedIds).map(id => 
        pb.collection('projects').update(id, finalUpdates)
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-10">
      
      {/* Top Navigation Bar */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="w-full px-6 h-16 flex items-center justify-between">
          
          {/* Brand & Summary */}
          <div className="flex items-center gap-6 overflow-hidden">
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-sm">
                <List className="w-5 h-5" />
              </div>
              <h1 className="font-bold text-lg leading-tight text-slate-800 whitespace-nowrap">UE Projects</h1>
            </div>

            {/* Status Summary (New) */}
            <div className="hidden lg:flex items-center gap-2 overflow-x-auto no-scrollbar mask-linear-fade">
              {Object.entries(statusCounts).map(([status, count]) => (
                <div key={status} className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-200 rounded-md whitespace-nowrap">
                   <StateBadge state={status as ProjectState} />
                   <span className="text-xs font-bold text-slate-600">{count}</span>
                </div>
              ))}
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
                  placeholder="Search projects, buildings, WOs..." 
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
              <span className="hidden xl:inline">{showCompleted ? 'Hide Completed' : 'Show Completed'}</span>
            </button>

            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".csv"/>
            <button 
              onClick={handleImportClick}
              disabled={isLoading}
              className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800 px-3 py-2 rounded-lg text-sm font-medium transition-all shadow-sm disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              <span className="hidden xl:inline">Import</span>
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
            <table className="w-full text-left border-collapse min-w-[1400px]">
              <thead>
                <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
                  <th className="px-4 py-3 w-10">
                    <button onClick={handleSelectAll} className="flex items-center justify-center text-slate-400 hover:text-indigo-600">
                      {selectedIds.size > 0 && selectedIds.size === filteredData.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                    </button>
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('name')}>
                    <div className="flex items-center gap-1">Project <SortIcon field="name" /></div>
                  </th>
                  <th className="px-4 py-3 text-center" onClick={() => handleSort('state')}>
                    Status
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('building')}>
                    <div className="flex items-center gap-1">Building <SortIcon field="building" /></div>
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:text-indigo-600 w-24" onClick={() => handleSort('priority')}>
                    <div className="flex items-center gap-1">Priority <SortIcon field="priority" /></div>
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('vendor')}>
                    <div className="flex items-center gap-1">Vendor <SortIcon field="vendor" /></div>
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('contractors')}>
                     Contractors
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('responsibility')}>
                    <div className="flex items-center gap-1">Lead <SortIcon field="responsibility" /></div>
                  </th>
                  <th className="px-4 py-3" >Work Orders</th>
                  <th className="px-4 py-3 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('comments')}>
                    <div className="flex items-center gap-1">Comments <SortIcon field="comments" /></div>
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('target_start_date')}>
                    Start Date
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('fiscal_year')}>
                    <div className="flex items-center gap-1">FY <SortIcon field="fiscal_year" /></div>
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('completion_date')}>
                    Completion
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading && projects.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-12 text-center text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Loading data...
                      </div>
                    </td>
                  </tr>
                ) : filteredData.map((project) => (
                  <tr 
                    key={project.id} 
                    onClick={() => openProject(project)}
                    className={`cursor-pointer transition-colors group text-sm ${selectedIds.has(project.id) ? 'bg-indigo-50 hover:bg-indigo-100' : 'hover:bg-indigo-50/30'}`}
                  >
                    <td className="px-4 py-3" onClick={(e) => handleSelectRow(project.id, e)}>
                      <button className={`flex items-center justify-center ${selectedIds.has(project.id) ? 'text-indigo-600' : 'text-slate-300 hover:text-slate-500'}`}>
                        {selectedIds.has(project.id) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {project.name}
                      {project.description && (
                        <div className="text-[10px] text-slate-400 truncate max-w-[200px]">{project.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StateBadge state={project.state} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div className="flex flex-wrap gap-1">
                        {project.building.map((b, i) => (
                          <BuildingTooltip key={i} name={b} buildings={buildings} />
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <PriorityBadge priority={project.priority} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {project.vendor}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                       <div className="flex flex-wrap gap-1">
                         {project.contractors.length > 0 ? (
                           project.contractors.map((c, i) => (
                             <span key={i} className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 whitespace-nowrap">{c}</span>
                           ))
                         ) : <span className="text-slate-300">-</span>}
                       </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div className="flex items-center justify-center">
                        <div 
                          title={project.responsibility} 
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border ${getAvatarColor(project.responsibility)}`}
                        >
                          {project.responsibility ? project.responsibility.charAt(0).toUpperCase() : '?'}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-mono text-xs whitespace-nowrap">
                       <div className="flex flex-wrap gap-1">
                         {project.work_orders.length > 0 ? (
                           project.work_orders.map((wo, i) => (
                             <span key={i} className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-slate-500 whitespace-nowrap">{wo}</span>
                           ))
                         ) : <span className="text-slate-300">-</span>}
                       </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">
                      <div className="truncate max-w-[200px]" title={project.comments}>
                        {project.comments || <span className="text-slate-300">-</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">
                      {project.target_start_date || <span className="text-slate-300">-</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs font-mono">
                      {project.fiscal_year || <span className="text-slate-300">-</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">
                      {project.completion_date || <span className="text-slate-300">-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {!isLoading && filteredData.length === 0 && (
            <div className="p-16 text-center text-slate-400">
              <Filter className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-lg font-medium text-slate-500">No projects found</p>
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
                onUpdate={(val: any) => handleBulkEdit({ state: val })} 
                options={STATUS_OPTIONS}
              />
              <BulkEditField label="Priority" 
                onUpdate={(val: any) => handleBulkEdit({ priority: val })} 
                options={['Low', 'Medium', 'High', 'Critical']}
              />
              <BulkEditField label="Fiscal Year" 
                onUpdate={(val: any) => handleBulkEdit({ fiscal_year: val })} 
                isInput
              />
              <BulkEditField label="Responsibility" 
                onUpdate={(val: any) => handleBulkEdit({ responsibility: val })} 
                isInput
                list={uniqueResponsibilities} 
              />
              <BulkEditField label="Vendor" 
                onUpdate={(val: any) => handleBulkEdit({ vendor: val })} 
                isInput
              />
              <BulkEditField label="Building" 
                onUpdate={(val: any) => handleBulkEdit({ building: [val] })} 
                isInput list={buildings.map(b => b.bldg_name)}
              />
              <BulkEditField label="Target Start Date" 
                onUpdate={(val: any) => handleBulkEdit({ target_start_date: val })} 
                isInput type="date"
              />
              <BulkEditField label="Completion Date" 
                onUpdate={(val: any) => handleBulkEdit({ completion_date: val })} 
                isInput type="date"
              />
              <BulkEditField label="Comments" 
                onUpdate={(val: any) => handleBulkEdit({ comments: val })} 
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
      {showModal && selectedProject && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-start flex-shrink-0">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  {!isEditing && (
                     <span className="font-mono text-xs text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                       ID: {selectedProject.id}
                     </span>
                  )}
                  {isEditing ? (
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                      {selectedProject.id === 'NEW' ? 'CREATING NEW PROJECT' : 'EDITING MODE'}
                    </span>
                  ) : (
                    <StateBadge state={selectedProject.state} />
                  )}
                  {!isEditing && (
                    <div className="text-[10px] text-slate-400 flex items-center gap-1 ml-auto mr-4">
                      <Clock className="w-3 h-3" />
                      Updated by {selectedProject.last_modified_by} on {new Date(selectedProject.last_modified_at).toLocaleString()}
                    </div>
                  )}
                </div>
                {isEditing ? (
                  <input 
                    type="text" 
                    className="text-2xl font-bold text-slate-800 bg-transparent border-b border-slate-300 focus:border-indigo-500 outline-none w-full placeholder-slate-300"
                    value={selectedProject.name}
                    placeholder="Project Name"
                    onChange={e => setSelectedProject({...selectedProject, name: e.target.value})}
                  />
                ) : (
                  <h2 className="text-2xl font-bold text-slate-800">{selectedProject.name}</h2>
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
                         value={selectedProject.state}
                         onChange={e => setSelectedProject({...selectedProject, state: e.target.value as ProjectState})}
                      >
                         {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                      </select>
                    ) : (
                      <StateBadge state={selectedProject.state} />
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Fiscal Year</label>
                    {isEditing ? (
                      <input 
                        type="text" 
                        className="w-full p-2 bg-white border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
                        value={selectedProject.fiscal_year}
                        onChange={e => setSelectedProject({...selectedProject, fiscal_year: e.target.value})}
                        placeholder="e.g. FY25"
                      />
                    ) : (
                      <div className="flex items-center gap-2 text-slate-800">
                        <CalendarDays className="w-4 h-4 text-slate-400" />
                        {selectedProject.fiscal_year || <span className="text-slate-300">-</span>}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Priority</label>
                    {isEditing ? (
                      <select 
                        className="w-full p-2 bg-white border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
                        value={selectedProject.priority}
                        onChange={e => setSelectedProject({...selectedProject, priority: e.target.value as PriorityLevel})}
                      >
                        <option>Low</option>
                        <option>Medium</option>
                        <option>High</option>
                        <option>Critical</option>
                      </select>
                    ) : (
                      <PriorityBadge priority={selectedProject.priority} />
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Building</label>
                    {isEditing ? (
                      <MultiInput 
                        values={selectedProject.building} 
                        onChange={v => setSelectedProject({...selectedProject, building: v})} 
                        placeholder="Add Building"
                        list={buildings.map(b => b.bldg_name)}
                      />
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {selectedProject.building.map((b, i) => (
                          <BuildingTooltip key={i} name={b} buildings={buildings} />
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Lead Responsibility</label>
                    {isEditing ? (
                      <>
                        <input 
                          type="text" 
                          list="responsibility-options"
                          className="w-full p-2 bg-white border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
                          value={selectedProject.responsibility}
                          onChange={e => setSelectedProject({...selectedProject, responsibility: e.target.value})}
                          placeholder="Select or type name..."
                        />
                        <datalist id="responsibility-options">
                           {uniqueResponsibilities.map(r => <option key={r} value={r} />)}
                        </datalist>
                      </>
                    ) : (
                      <div className="flex items-center gap-2 text-slate-800">
                        <User className="w-4 h-4 text-slate-400" />
                        {selectedProject.responsibility}
                      </div>
                    )}
                  </div>
                </div>

                {/* --- Column 2: Execution --- */}
                <div className="space-y-6">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">Execution</h3>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Vendor</label>
                    {isEditing ? (
                      <input 
                        type="text" 
                        className="w-full p-2 bg-white border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
                        value={selectedProject.vendor}
                        onChange={e => setSelectedProject({...selectedProject, vendor: e.target.value})}
                      />
                    ) : (
                      <div className="flex items-center gap-2 text-slate-800">
                        <Briefcase className="w-4 h-4 text-slate-400" />
                        {selectedProject.vendor}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Contractors</label>
                    {isEditing ? (
                      <MultiInput 
                        values={selectedProject.contractors} 
                        onChange={v => setSelectedProject({...selectedProject, contractors: v})} 
                        placeholder="Add Contractor"
                      />
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {selectedProject.contractors.map((c, i) => (
                           <span key={i} className="bg-slate-100 px-2 py-1 rounded text-sm text-slate-700">{c}</span>
                        ))}
                        {selectedProject.contractors.length === 0 && <span className="text-slate-400 text-sm italic">None listed</span>}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Work Orders</label>
                    {isEditing ? (
                      <MultiInput 
                        values={selectedProject.work_orders} 
                        onChange={v => setSelectedProject({...selectedProject, work_orders: v})} 
                        placeholder="Add WO#"
                      />
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {selectedProject.work_orders.map((wo, i) => (
                           <span key={i} className="bg-blue-50 text-blue-700 border border-blue-100 px-2 py-1 rounded text-sm font-mono">{wo}</span>
                        ))}
                        {selectedProject.work_orders.length === 0 && <span className="text-slate-400 text-sm italic">None</span>}
                      </div>
                    )}
                  </div>
                </div>

                {/* --- Column 3: Dates & Description --- */}
                <div className="space-y-6">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">Timeline & Notes</h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 block mb-1">Target Start</label>
                      {isEditing ? (
                        <input 
                          type="date" 
                          className="w-full p-2 bg-white border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
                          value={selectedProject.target_start_date}
                          onChange={e => setSelectedProject({...selectedProject, target_start_date: e.target.value})}
                        />
                      ) : (
                        <div className="text-sm text-slate-800">{selectedProject.target_start_date || '-'}</div>
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 block mb-1">Completion</label>
                      {isEditing ? (
                        <input 
                          type="date" 
                          className="w-full p-2 bg-white border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
                          value={selectedProject.completion_date}
                          onChange={e => setSelectedProject({...selectedProject, completion_date: e.target.value})}
                        />
                      ) : (
                        <div className="text-sm text-slate-800 flex items-center gap-2 h-9">
                          {selectedProject.completion_date || <span className="text-slate-400 italic">Pending</span>}
                          {selectedProject.completion_date && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Description</label>
                    {isEditing ? (
                      <textarea 
                        className="w-full text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none min-h-[120px]"
                        value={selectedProject.description}
                        onChange={e => setSelectedProject({...selectedProject, description: e.target.value})}
                      />
                    ) : (
                      <p className="text-slate-700 bg-slate-50 p-4 rounded-lg border border-slate-100 leading-relaxed text-sm">
                        {selectedProject.description || "No description provided."}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Comments</label>
                    {isEditing ? (
                      <textarea 
                        className="w-full text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none min-h-[80px]"
                        value={selectedProject.comments}
                        onChange={e => setSelectedProject({...selectedProject, comments: e.target.value})}
                        placeholder="Internal notes..."
                      />
                    ) : (
                      <div className="text-slate-700 bg-yellow-50/50 p-4 rounded-lg border border-yellow-100/50 leading-relaxed text-sm flex items-start gap-2">
                        <MessageSquare className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                        <p>{selectedProject.comments || "No comments."}</p>
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
                  {isEditing ? 'Save Changes' : 'Edit Project'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Footer (SDK Loader) */}
      <footer className="fixed bottom-0 w-full bg-white border-t py-2 px-4 text-xs text-gray-500 flex justify-between z-10">
        <div>
          Total: {projects.length} | Visible: {filteredData.length}
          {projects.length > filteredData.length && <span className="ml-1 text-indigo-600">(Filters active)</span>}
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


// Subcomponent for Bulk Edit Fields
const BulkEditField = ({ label, onUpdate, options, isInput, list, type = "text" }: any) => {
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
          <React.Fragment>
            <input 
              type={type}
              disabled={!enabled}
              value={val}
              onChange={(e) => setVal(e.target.value)}
              list={list ? "bulk-list-" + label : undefined}
              className="w-full p-2 border rounded-md disabled:bg-slate-100 disabled:text-slate-400 text-sm"
            />
            {list && (
              <datalist id={"bulk-list-" + label}>
                {list.map((l: string) => <option key={l} value={l} />)}
              </datalist>
            )}
          </React.Fragment>
        ) : (
          <select 
            disabled={!enabled}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            className="w-full p-2 border rounded-md disabled:bg-slate-100 disabled:text-slate-400 text-sm"
          >
            <option value="">Select...</option>
            {options.map((o: string) => <option key={o} value={o}>{o}</option>)}
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

// --- Main App Component ---
export default function App() {
  const [pb, setPb] = useState<any>(null);

  useEffect(() => {
    const pbInstance = new PocketBase(PB_URL);
    setPb(pbInstance);
  }, []);

  return (
    <ErrorBoundary>
      {pb ? <ProjectsManagerInner pb={pb} /> : <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>}
    </ErrorBoundary>
  );
}