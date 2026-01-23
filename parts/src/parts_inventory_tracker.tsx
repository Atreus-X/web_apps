import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle,
  Clock, 
  Plus, 
  Trash2, 
  ArrowRight, 
  Box, 
  ClipboardList,
  LogOut,
  AlertTriangle,
  Upload,
  FileText,
  MapPin,
  Tag,
  Hash,
  Edit,
  Package,
  Truck,
  Archive,
  Eye,
  EyeOff,
  Filter,
  Search,
  ArrowUpDown,
  Calendar,
  CheckSquare,
  Square,
  Layers,
  MinusCircle,
  History,
  X,
  Save,
  UserPlus,
  KeyRound,
  ArrowLeft,
  ShieldAlert,
  User,
  ShieldCheck,
  RefreshCw,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  ChevronsDown,
  ChevronsRight,
  WifiOff,
  Wifi,
  RotateCcw,
  Image as ImageIcon,
  ExternalLink,
  Sparkles,
  Loader2
} from 'lucide-react';
import PocketBase from 'pocketbase';

// --- Configuration ---
const PB_URL = (import.meta as any).env.VITE_PB_URL;

// --- Constants ---
const STATUS_OPTIONS = [
  "In-Progress",
  "At Storeroom",
  "Ordered",
  "Received",
  "In-Stock (In Office)",
  "In-Stock (At Storeroom)",
  "In-Stock (Storage Closet)",
  "Complete",
  "Sent to Storeroom",
  "Waiting on PO"
];

// --- Error Boundary Component ---
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
          <pre className="text-xs bg-white p-4 rounded border border-red-200 mb-4 max-w-lg overflow-auto text-left">
            {this.state.error?.toString()}
          </pre>
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

// --- Utility Functions ---

const normalizeHeader = (h: string) => {
  if (!h) return '';
  return h.replace(/["']/g, '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
};

const parseCSV = (text: string) => {
  const cleanText = text.replace(/^\uFEFF/, '');
  const arr: string[][] = []; 
  let quote = false;
  let col = "";
  let row: string[] = [];
  
  for (let c = 0; c < cleanText.length; c++) {
    let cc = cleanText[c];
    
    if (cc === '"') {
      if (quote && cleanText[c+1] === '"') { col += '"'; c++; }
      else { quote = !quote; }
    } else if (cc === ',' && !quote) {
      row.push(col); 
      col = "";
    } else if ((cc === '\r' || cc === '\n') && !quote) {
      if (cc === '\r' && cleanText[c+1] === '\n') c++;
      row.push(col);
      if(row.some(c => c.trim())) arr.push(row);
      row = [];
      col = "";
    } else {
      col += cc;
    }
  }
  if (row.length > 0 && row.some(c => c.trim())) {
    row.push(col);
    arr.push(row);
  }
  
  if (arr.length < 2) return { headers: [], data: [] };

  const headers = arr[0].map(normalizeHeader);
  const data = arr.slice(1).map(row => {
    return row.map(cell => {
       let val = cell ? cell.trim() : '';
       if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
       return val.replace(/""/g, '"');
    });
  });

  return { headers, data };
};

const formatDateForPB = (dateStr: string | null | undefined) => {
  if (!dateStr || dateStr === 'N/A' || typeof dateStr !== 'string') return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return ''; 
    return d.toISOString();
  } catch { return ''; }
};

const formatDateForInput = (dateStr: string | null | undefined) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  } catch { return ''; }
}

const formatDateForDisplay = (dateStr: string | null | undefined) => {
  if (!dateStr) return null;
  if (typeof dateStr === 'object') return 'Invalid Date';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr); 
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return String(dateStr); }
};

const formatHistoryTime = (isoString: string | null | undefined) => {
  try {
    return new Date(isoString).toLocaleString(undefined, { 
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' 
    });
  } catch { return isoString; }
};

// --- Render Helpers ---
const getStatusBadge = (status?: string | null) => {
  const s = String(status || 'Ordered').trim();
  const sLower = s.toLowerCase();
  
  if (sLower === 'in-stock (in office)') return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200 whitespace-nowrap"><Package className="w-3 h-3 mr-1"/> {s}</span>;
  if (sLower === 'in-stock (at storeroom)') return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-cyan-100 text-cyan-800 border border-cyan-200 whitespace-nowrap"><Package className="w-3 h-3 mr-1"/> {s}</span>;
  if (sLower === 'in-stock (storage closet)') return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-pink-100 text-pink-800 border border-pink-200 whitespace-nowrap"><Package className="w-3 h-3 mr-1"/> {s}</span>;
  
  if (sLower.includes('in-stock') || sLower === 'received') return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200 whitespace-nowrap"><Package className="w-3 h-3 mr-1"/> {s}</span>;
  if (sLower.includes('storeroom') && !sLower.includes('in-stock')) return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200 whitespace-nowrap"><Archive className="w-3 h-3 mr-1"/> {s}</span>;
  if (sLower === 'complete') return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200 whitespace-nowrap"><CheckCircle className="w-3 h-3 mr-1"/> {s}</span>;
  if (sLower === 'ordered' || sLower.includes('waiting') || sLower.includes('progress')) return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200 whitespace-nowrap"><Truck className="w-3 h-3 mr-1"/> {s}</span>;
  
  return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200 whitespace-nowrap">{s}</span>;
};

// --- Hover Image Component (Using Portal) ---
const ImageHoverPreview = ({ src, alt, children }: { src?: string, alt: string, children: React.ReactNode }) => {
  const [isHovering, setIsHovering] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, placement: 'top' });

  // Don't show anything if no valid image URL
  if (!src) return <>{children}</>;

  const handleMouseEnter = (e: React.MouseEvent) => {
      const rect = e.currentTarget.getBoundingClientRect();
      // If element is too close to top of viewport (< 250px), show below
      const showBelow = rect.top < 250; 
      
      setCoords({
          top: showBelow ? rect.bottom + 10 : rect.top - 10,
          left: rect.left, 
          placement: showBelow ? 'bottom' : 'top'
      });
      setIsHovering(true);
  };

  return (
    <>
      <div 
        className="relative flex items-center"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setIsHovering(false)}
      >
        {children}
        <ImageIcon className="w-3 h-3 text-indigo-400 ml-1.5 opacity-75" />
      </div>
      
      {isHovering && !imgError && createPortal(
        <div 
           className="fixed z-[9999] p-1 bg-white rounded-lg shadow-xl border border-gray-200 w-48 h-auto pointer-events-none animate-in fade-in duration-200"
           style={{ 
               top: coords.top, 
               left: coords.left,
               transform: coords.placement === 'top' ? 'translateY(-100%)' : 'translateY(0)'
           }}
        >
           <img 
             src={src} 
             alt={alt} 
             className="w-full h-auto rounded bg-gray-50 object-contain max-h-48" 
             onError={() => setImgError(true)}
           />
           <div className="text-[10px] text-center text-gray-500 mt-1 truncate px-1">Source: Google Search</div>
        </div>,
        document.body
      )}
    </>
  );
};

interface TableHeaderProps {
  label: string;
  sortKey?: string;
  sortConfig?: { key: string; direction: 'asc' | 'desc' };
  onSort?: (key: string) => void;
  width?: number;
  onResizeStart?: (e: React.MouseEvent, colKey: string) => void;
  className?: string;
  stickyLeft?: boolean;
  leftOffset?: number;
}

const TableHeader = ({ label, sortKey, sortConfig, onSort, width, onResizeStart, className, stickyLeft, leftOffset }: TableHeaderProps) => (
  <th 
    className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 group relative 
      ${sortKey ? 'cursor-pointer hover:bg-gray-100 hover:text-gray-700' : ''} 
      ${className} 
      ${stickyLeft ? 'sticky left-0 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]' : 'z-10'}
    `} 
    style={{ 
        width: width ? `${width}px` : 'auto',
        left: stickyLeft ? leftOffset || 0 : 'auto'
    }}
    onClick={() => sortKey && onSort && onSort(sortKey)}
  >
    <div className="flex items-center gap-1 w-full overflow-hidden">
      <span className="truncate">{label}</span>
      {sortKey && sortConfig && sortConfig.key === sortKey && (
        <ArrowUpDown className={`w-3 h-3 flex-shrink-0 ${sortConfig.direction === 'asc' ? 'text-indigo-500' : 'text-indigo-300'}`} />
      )}
    </div>
    {onResizeStart && (
      <div 
        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-indigo-300 group-hover:bg-gray-300 transition-colors z-30" 
        onClick={(e) => e.stopPropagation()} 
        onMouseDown={onResizeStart}
      />
    )}
  </th>
);

// --- Main Inner Component ---
function PartsInventoryTrackerInner({ pb }: { pb: any }) {
  // STRICT INITIALIZATION
  const [user, setUser] = useState(() => {
      if (pb.authStore.isValid && pb.authStore.model) {
          if (!pb.authStore.model.email) return null;
          return pb.authStore.model;
      }
      return null;
  });

  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false); 
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Persistent State
  const [hideComplete, setHideComplete] = useState(() => {
    try { const saved = localStorage.getItem('inventory_hide_completed'); return saved !== null ? JSON.parse(saved) : true; } catch { return true; }
  });

  const [colWidths, setColWidths] = useState(() => {
    try { // Use try-catch for localStorage access
      const saved = localStorage.getItem('inventory_col_widths');
      return saved ? JSON.parse(saved) : { part: 220, details: 280, location: 200, dates: 140, qty: 100, status: 160, actions: 160 };
    } catch { return { part: 220, details: 280, location: 200, dates: 140, qty: 100, status: 160, actions: 160 }; }
  });

  // Group By State
  const [groupBy, setGroupBy] = useState<string>('none');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Track the last clicked ID for range selection
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  // Reset collapsed groups when grouping criteria changes
  useEffect(() => {
      setCollapsedGroups(new Set());
  }, [groupBy]);

  useEffect(() => { try { localStorage.setItem('inventory_hide_completed', JSON.stringify(hideComplete)); } catch (e) { console.error("Error saving hideComplete to localStorage", e); } }, [hideComplete]);
  useEffect(() => { try { localStorage.setItem('inventory_col_widths', JSON.stringify(colWidths)); } catch (e) { console.error("Error saving colWidths to localStorage", e); } }, [colWidths]);
  
  // Filtering & Sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'updated', direction: 'desc' });
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [bulkModalOpen, setBulkModalOpen] = useState(false);

  // Column Resizing
  const [resizingCol, setResizingCol] = useState<string | null>(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);

  // Derived Data for Autocomplete
  const uniquePartNames = useMemo(() => {
      const names = parts.map((p: any) => p.name).filter(Boolean);
      return [...new Set(names)].sort();
  }, [parts]);

  const uniqueManufacturers = useMemo(() => {
      const mfrs = parts.map((p: any) => p.manufacturer).filter(Boolean);
      return [...new Set(mfrs)].sort();
  }, [parts]);

  useEffect(() => {
    if (resizingCol) {
      const onMove = (e: MouseEvent) => {
        const diff = e.clientX - resizeStartX;
        setColWidths((prev: any) => ({ ...prev, [resizingCol]: Math.max(50, resizeStartWidth + diff) }));
      };
      const onUp = () => setResizingCol(null);
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    }
  }, [resizingCol, resizeStartX, resizeStartWidth]);

  const startResize = (e: React.MouseEvent, colKey: string) => {
    e.preventDefault(); e.stopPropagation();
    setResizingCol(colKey); setResizeStartX(e.clientX); setResizeStartWidth(colWidths[colKey]);
  };

  // Auth State
  const [loginEmail, setLoginEmail] = useState('');
  const [registerEmail, setRegisterEmail] = useState(''); 
  const [registerName, setRegisterName] = useState(''); 
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [authMode, setAuthMode] = useState('login'); 
  const [authMessage, setAuthMessage] = useState<{ type: 'error' | 'success' | '', text: string }>({ type: '', text: '' });

  // Import State
  const [showImport, setShowImport] = useState(false);
  const [csvData, setCsvData] = useState<string[][]>([]); 
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);   
  const [isImporting, setIsImporting] = useState(false);

  // Field Mapping
  const [importMapping, setImportMapping] = useState<any>({ 
    manufacturer: '', part: '', description: '', quantity: '', quantity_ordered: '',  
    area: '', status: '', vendor: '', work_order: '', date_ordered: '', date_sent: '', image_url: ''
  });

  // Action Modals
  const [editModal, setEditModal] = useState<{ isOpen: boolean; partId: string | null; original: any; edited: any; }>({ isOpen: false, partId: null, original: null, edited: null });
  const [quantityModal, setQuantityModal] = useState<{ isOpen: boolean; partId: string | null; partName: string; currentQty: number; }>({ isOpen: false, partId: null, partName: '', currentQty: 0 }); // Use number for currentQty
  const [historyModal, setHistoryModal] = useState<{ isOpen: boolean; partId: string | null; partName: string; history: { action: string; at: string; by: string; from?: string; to?: string; }[]; }>({ isOpen: false, partId: null, partName: '', history: [] }); // More specific history type
  const [statusModal, setStatusModal] = useState<{ isOpen: boolean; partId: string | null; partName: string; currentStatus: string; }>({ isOpen: false, partId: null, partName: '', currentStatus: '' }); // Use string for currentStatus
  
  const [modalNewStatus, setModalNewStatus] = useState('');
  const [modalTakeAmount, setModalTakeAmount] = useState<number>(1); // Explicitly number

  // New Part Form
  const [newPart, setNewPart] = useState({ manufacturer: '', name: '', sku: '', description: '', quantity: '1', quantity_ordered: '1', area: '', vendor: '', work_order: '', status: 'Ordered', date_ordered: '', date_sent: '', image_url: '' });

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
    // If no user, skip fetching
    if (!user || user.approved === false) { setParts([]); return; }
    
    let isMounted = true;
    let unsubFunc: any = null;

    const fetchData = async () => {
      setLoading(true);
      setFetchError(null);
      try {
        const records = await pb.collection('parts').getFullList();
        if (isMounted) { 
            setParts(records); 
            setLoading(false);
            console.log(`[DEBUG] Fetched ${records.length} records from PocketBase`); 
        }
      } catch (err: any) { 
          console.error("Fetch Error:", err); 
          if (isMounted) {
              setLoading(false);
              
              if (err.status === 401) {
                  console.warn("Token expired or invalid (401). Logging out.");
                  setAuthMessage({ type: 'error', text: "Your session has expired. Please sign in again." });
                  pb.authStore.clear();
                  setUser(null);
                  return;
              }

              if (err.response && typeof err.response === 'string' && err.response.trim().startsWith('<')) {
                  setFetchError("Connection Blocked: Received HTML instead of JSON. Check Cloudflare WAF settings.");
              } else if (err.status === 403) {
                  setFetchError("Permission Denied: Update API Rules in PocketBase Admin.");
              } else if (err.status === 0) {
                  setFetchError("Network Error: Unable to connect. Check SSL/TLS settings.");
              } else {
                  setFetchError(err.message || "Failed to load data");
              }
          }
      }
    };

    fetchData();

    pb.collection('parts').subscribe('*', function (e: any) {
        if (isImporting) return;
        if (e.action === 'create') setParts((prev: any) => [e.record, ...prev]);
        if (e.action === 'update') setParts((prev: any) => prev.map((item: any) => (item.id === e.record.id ? e.record : item)));
        if (e.action === 'delete') setParts((prev: any) => prev.filter((item: any) => item.id !== e.record.id));
    }).then((unsub: any) => { unsubFunc = unsub; }).catch((err: any) => { console.error("Realtime subscription failed:", err); });

    return () => { 
        isMounted = false; 
        if (unsubFunc) { unsubFunc(); }
    };
  }, [user, isImporting, pb]);

  // --- Handlers ---
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
  
  // Safe Logout: Clears store AND reloads page to flush memory
  const handleLogout = () => { 
      pb.authStore.clear(); 
      localStorage.clear(); 
      window.location.reload();
  };

  // --- Import Logic ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const { headers, data } = parseCSV(text);
      if (headers.length > 0) {
        setCsvHeaders(headers);
        setCsvData(data);
        const findCol = (terms: string[]) => headers.find(h => terms.some(t => h.toLowerCase().includes(t.toLowerCase()))) || '';
        setImportMapping({
          manufacturer: findCol(['manufacturer']),
          part: headers.find(h => ['part', 'part number', 'sku'].includes(h.toLowerCase())) || '',
          description: findCol(['desc']),
          quantity: headers.find(h => h.toLowerCase().includes('quantity') && h.toLowerCase().includes('remain')) || findCol(['qty']),
          quantity_ordered: headers.find(h => h.toLowerCase().includes('quantity') && h.toLowerCase().includes('ord')) || '',
          area: findCol(['area', 'project', 'loc']),
          status: findCol(['status']),
          vendor: findCol(['vendor']),
          work_order: findCol(['work', 'wo']),
          date_ordered: headers.find(h => h.toLowerCase().includes('order') && h.toLowerCase().includes('date')) || '',
          date_sent: headers.find(h => h.toLowerCase().includes('sent') && h.toLowerCase().includes('date')) || '',
          image_url: findCol(['image', 'img', 'url'])
        });
      }
    };
    reader.readAsText(file);
  };

  const executeImport = async () => {
    if (!importMapping.part && !importMapping.name) {
       if (!importMapping.part) { alert("Please map the 'Part' field."); return; }
    }
    setIsImporting(true);
    let successCount = 0;
    let lastError = "";

    const headerIndices: Record<string, number> = {};
    csvHeaders.forEach((h, i) => { headerIndices[h] = i; });

    const getVal = (row: string[], fieldKey: string) => {
        const mappedHeaderName = importMapping[fieldKey];
        if (!mappedHeaderName) return '';
        const idx = headerIndices[mappedHeaderName];
        if (idx === undefined) return '';
        return row[idx] || '';
    };
    
    const sanitize = (val: string) => val ? String(val).replace(/[\uFEFF\u00A0\u200B]/g, ' ').trim() : '';

    for (const row of csvData) {
        if (row.length === 0 || row.every(c => !c.trim())) continue;

        const partVal = sanitize(getVal(row, 'part') || getVal(row, 'name')); 
        if (!partVal) continue; 

        const qtyNum = parseInt(sanitize(getVal(row, 'quantity'))) || 0;
        const qtyOrdNum = parseInt(sanitize(getVal(row, 'quantity_ordered'))) || 0;
        const rawStatus = sanitize(getVal(row, 'status')) || 'Ordered';

        const payload = {
          manufacturer: sanitize(getVal(row, 'manufacturer')),
          name: partVal,
          sku: partVal,
          description: sanitize(getVal(row, 'description')),
          quantity: qtyNum,
          quantity_ordered: qtyOrdNum,
          area: sanitize(getVal(row, 'area')),
          vendor: sanitize(getVal(row, 'vendor')),
          work_order: sanitize(getVal(row, 'work_order')),
          status: rawStatus,
          date_ordered: formatDateForPB(sanitize(getVal(row, 'date_ordered'))),
          date_sent: formatDateForPB(sanitize(getVal(row, 'date_sent'))),
          image_url: sanitize(getVal(row, 'image_url')),
          lastActionBy: user?.name || user?.email || 'Import',
          lastActionAt: new Date().toISOString()
        };

        try {
            await pb.collection('parts').create(payload);
            successCount++;
        } catch (err: any) {
            console.error("Import Error Row:", row, err);
            lastError = err.message;
        }
    }
    
    try { const records = await pb.collection('parts').getFullList({ sort: '-created' }); setParts(records); } catch(e) {}
    setIsImporting(false);
    setShowImport(false);
    
    if (successCount === 0 && lastError) alert(`Import Failed.\nError: ${lastError}`);
    else alert(`Imported ${successCount} parts.`);
  };

  const handleDelete = async (id: string) => {
    if(!confirm("Delete this part record?")) return;
    try {
      await pb.collection('parts').delete(id);
      setSelectedItems(prev => { const next = new Set(prev); next.delete(id); return next; });
    } catch (error) { console.error("Error deleting", error); }
  };

  const handleSort = (key: string) => {
    setSortConfig(current => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }));
  };

  const handleEditChange = (field: string, value: any) => {
    setEditModal(prev => ({ ...prev, edited: { ...prev.edited, [field]: value } }));
  };

  const filteredAndSortedParts = useMemo(() => {
    let result = [...parts];
    if (hideComplete) result = result.filter((p: any) => String(p.status || '').toLowerCase() !== 'complete');
    if (searchTerm.trim()) {
      const lowerTerm = searchTerm.toLowerCase();
      result = result.filter((p: any) => 
        (p.name && p.name.toLowerCase().includes(lowerTerm)) ||
        (p.manufacturer && p.manufacturer.toLowerCase().includes(lowerTerm)) ||
        (p.sku && p.sku.toLowerCase().includes(lowerTerm)) ||
        (p.description && p.description.toLowerCase().includes(lowerTerm)) ||
        (p.area && p.area.toLowerCase().includes(lowerTerm)) ||
        (p.work_order && p.work_order.toLowerCase().includes(lowerTerm)) ||
        (p.vendor && p.vendor.toLowerCase().includes(lowerTerm)) ||
        (p.status && p.status.toLowerCase().includes(lowerTerm)) ||
        (p.lastActionBy && p.lastActionBy.toLowerCase().includes(lowerTerm)) ||
        (p.date_ordered && p.date_ordered.toLowerCase().includes(lowerTerm)) ||
        (p.date_sent && p.date_sent.toLowerCase().includes(lowerTerm))
      );
    }
    if (sortConfig.key) {
      result.sort((a: any, b: any) => {
        const aVal = String(a[sortConfig.key] || '').toLowerCase();
        const bVal = String(b[sortConfig.key] || '').toLowerCase();
        return (aVal < bVal ? -1 : 1) * (sortConfig.direction === 'asc' ? 1 : -1);
      });
    }
    return result;
  }, [parts, hideComplete, searchTerm, sortConfig]);

  // Grouping Logic
  const groupedData = useMemo(() => {
    if (groupBy === 'none') return null;
    
    const groups: Record<string, any> = {};
    
    filteredAndSortedParts.forEach((part: any) => {
        let key = part[groupBy] || 'Unassigned';
        key = String(key).trim();
        if (!key) key = 'Unassigned';
        
        if (!groups[key]) {
            groups[key] = {
                id: `group-${key}`, 
                title: key,
                items: [],
                totalQty: 0,
                totalOrd: 0
            };
        }
        groups[key].items.push(part);
        groups[key].totalQty += (parseInt(part.quantity) || 0);
        groups[key].totalOrd += (parseInt(part.quantity_ordered) || 0);
    });

    // Sort groups alphanumerically
    return Object.values(groups).sort((a: any, b: any) => a.title.localeCompare(b.title));
  }, [filteredAndSortedParts, groupBy]);

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => {
        const next = new Set(prev);
        if (next.has(groupId)) next.delete(groupId);
        else next.add(groupId);
        return next;
    });
  };

  const expandAll = () => {
    setCollapsedGroups(new Set());
  };

  const collapseAll = () => {
    if (groupedData) {
      const allIds = groupedData.map((g: any) => g.id);
      setCollapsedGroups(new Set(allIds));
    }
  };

  // Determine the visual list for range selection
  const visibleParts = useMemo(() => {
    if (groupBy === 'none') return filteredAndSortedParts;
    // Flatten grouped data, keeping only groups that match the sort order. 
    // Technically collapsed groups should be skippable, but for simplicity of index math we include them or flatmap them.
    if (!groupedData) return [];
    return groupedData.flatMap((g: any) => g.items);
  }, [groupBy, filteredAndSortedParts, groupedData]);

  const handleSelectRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    let newSelected = new Set(selectedItems);
    
    // Shift + Click Range Selection
    if (e.shiftKey && lastSelectedId) {
        const indexA = visibleParts.findIndex((p: any) => p.id === lastSelectedId);
        const indexB = visibleParts.findIndex((p: any) => p.id === id);
        
        if (indexA !== -1 && indexB !== -1) {
            const start = Math.min(indexA, indexB);
            const end = Math.max(indexA, indexB);
            const rangeIds = visibleParts.slice(start, end + 1).map((p: any) => p.id);
            
            // Add all in range
            rangeIds.forEach((pid: string) => newSelected.add(pid));
        }
    } else {
        // Normal Click / Toggle
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setLastSelectedId(id);
    }
    
    setSelectedItems(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === filteredAndSortedParts.length && filteredAndSortedParts.length > 0) setSelectedItems(new Set());
    else setSelectedItems(new Set(filteredAndSortedParts.map((p: any) => p.id)));
  };

  // Action Executors
  const executeBulkDelete = async () => {
     if (!confirm(`Delete ${selectedItems.size} items?`)) return;
     setLoading(true);
     await Promise.all(Array.from(selectedItems).map(id => pb.collection('parts').delete(id)));
     setLoading(false); setSelectedItems(new Set());
  };

  const handleAddPart = async (e: React.FormEvent) => {
    e.preventDefault(); if (!user || !newPart.name) return;
    try {
        await pb.collection('parts').create({ 
            ...newPart, 
            quantity: parseInt(newPart.quantity)||0, 
            quantity_ordered: parseInt(newPart.quantity_ordered)||0, 
            lastActionBy: user?.name || user?.email || 'User', 
            lastActionAt: new Date().toISOString() 
        });
        setShowAddForm(false);
    } catch (e) { alert("Failed to add"); }
  };

  const openGoogleSearch = (manufacturer: string, part: string) => {
     const query = encodeURIComponent(`${manufacturer} ${part}`);
     window.open(`https://www.google.com/search?tbm=isch&q=${query}`, '_blank');
  };

  // Helper to find existing image for suggestion
  const getSuggestedImage = (targetName: string, currentImage: string) => {
      if (!targetName || !parts.length) return null;
      const lowerName = targetName.toLowerCase().trim();
      
      const match = parts.find((p: any) => 
          p.name?.toLowerCase().trim() === lowerName && 
          p.image_url && 
          p.image_url.trim() !== '' &&
          p.image_url !== currentImage
      );
      
      return match?.image_url;
  };

  // Helper to find existing description for suggestion
  const getSuggestedDescription = (targetName: string, currentDesc: string) => {
      if (!targetName || !parts.length) return null;
      const lowerName = targetName.toLowerCase().trim();

      const match = parts.find((p: any) =>
          p.name?.toLowerCase().trim() === lowerName &&
          p.description &&
          p.description.trim() !== '' &&
          p.description !== currentDesc
      );

      return match?.description;
  };
  
  // Helper to find existing manufacturer for suggestion
  const getSuggestedManufacturer = (targetName: string, currentManuf: string) => {
      if (!targetName || !parts.length) return null;
      const lowerName = targetName.toLowerCase().trim();

      const match = parts.find((p: any) =>
          p.name?.toLowerCase().trim() === lowerName &&
          p.manufacturer &&
          p.manufacturer.trim() !== '' &&
          p.manufacturer !== currentManuf
      );

      return match?.manufacturer;
  };

  // Modal Openers
  const openEditModal = (part: any) => setEditModal({ isOpen: true, partId: part.id, original: { ...part }, edited: { ...part } });
  const openQuantityModal = (partId: string, partName: string, currentQty: number) => { setQuantityModal({ isOpen: true, partId, partName, currentQty }); setModalTakeAmount(1); };
  const openHistoryModal = (partId: string, partName: string, history: any[]) => setHistoryModal({ isOpen: true, partId, partName, history: history || [] });
  const openStatusModal = (partId: string, partName: string, currentStatus: string) => { setStatusModal({ isOpen: true, partId, partName, currentStatus: currentStatus || 'Ordered' }); setModalNewStatus(currentStatus || 'Ordered'); };

  const openBulkModal = () => {
      setBulkModalOpen(true);
  };

  // Modal Confirmations
  const confirmEditUpdate = async () => {
      const { partId, edited } = editModal;
      try {
          await pb.collection('parts').update(partId!, { 
              ...edited, 
              lastActionBy: user?.name || user?.email || 'User', 
              lastActionAt: new Date().toISOString() 
          });
          setEditModal({ isOpen: false, partId: null, original: null, edited: null });
      } catch (e) { alert("Failed"); }
  };
  const confirmQuantityUpdate = async () => {
      const { partId, currentQty } = quantityModal;
      const newQty = Math.max(0, currentQty - modalTakeAmount);
      await pb.collection('parts').update(partId!, { 
          quantity: newQty, 
          lastActionBy: user?.name || user?.email || 'User', 
          lastActionAt: new Date().toISOString() 
      });
      setQuantityModal({ isOpen: false, partId: null, partName: '', currentQty: 0 });
  };
  const confirmStatusUpdate = async () => {
      const { partId } = statusModal;
      await pb.collection('parts').update(partId!, { 
          status: modalNewStatus, 
          lastActionBy: user?.name || user?.email || 'User', 
          lastActionAt: new Date().toISOString() 
      });
      setStatusModal({ isOpen: false, partId: null, partName: '', currentStatus: '' });
  };

  const handleBulkUpdate = async (updates: any) => {
      if (selectedItems.size === 0) return;
      
      const finalUpdates = { ...updates };
      // Handle number conversions
      if (finalUpdates.quantity) finalUpdates.quantity = parseInt(finalUpdates.quantity);
      if (finalUpdates.quantity_ordered) finalUpdates.quantity_ordered = parseInt(finalUpdates.quantity_ordered);

      setLoading(true);
      pb.autoCancellation(false);

      try {
        await Promise.all(Array.from(selectedItems).map(id => pb.collection('parts').update(id, { 
            ...finalUpdates, 
            lastActionBy: user?.name || user?.email || 'User', 
            lastActionAt: new Date().toISOString() 
        })));
        setBulkModalOpen(false); 
        setSelectedItems(new Set());
      } catch (err: any) {
          alert("Bulk Update Failed: " + err.message);
      } finally {
          setLoading(false);
      }
  };

  // --- Auth Screen ---
  if (!user || user.approved === false) {
     return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center text-indigo-600"><ClipboardList className="w-12 h-12" /></div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Inventory Login</h2>
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

  // --- Main App ---
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans pb-10">
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-20">
        <div className="w-full px-4 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2"><ClipboardList className="w-6 h-6 text-indigo-600" /><h1 className="text-xl font-bold text-gray-900">Inventory</h1></div>
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
               <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" /><input type="text" placeholder="Search..." className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm w-full md:w-64 focus:ring-2 focus:ring-indigo-500 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
               
               {/* Group By Controls */}
               <div className="flex items-center gap-1">
                   <div className="relative">
                       <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><FolderOpen className="w-4 h-4" /></div>
                       <select 
                          value={groupBy} 
                          onChange={(e) => setGroupBy(e.target.value)} 
                          className="pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer hover:bg-gray-50"
                       >
                          <option value="none">No Grouping</option>
                          <option value="name">Group by Part Name</option>
                          <option value="manufacturer">Group by Manufacturer</option>
                          <option value="area">Group by Location</option>
                          <option value="vendor">Group by Vendor</option>
                       </select>
                       <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                          <ChevronDown className="w-3 h-3" />
                       </div>
                   </div>
                   
                   {groupBy !== 'none' && (
                       <div className="flex bg-white border border-gray-300 rounded-lg overflow-hidden shrink-0">
                           <button onClick={expandAll} className="p-2 hover:bg-gray-100 border-r border-gray-200 text-gray-600" title="Expand All"><ChevronsDown className="w-4 h-4" /></button>
                           <button onClick={collapseAll} className="p-2 hover:bg-gray-100 text-gray-600" title="Collapse All"><ChevronsRight className="w-4 h-4" /></button>
                       </div>
                   )}
               </div>

               {selectedItems.size > 0 && (<div className="flex gap-2"><button onClick={openBulkModal} className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm transition-colors"><Layers className="w-4 h-4 mr-2" /> Bulk Edit ({selectedItems.size})</button><button onClick={executeBulkDelete} className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 shadow-sm transition-colors"><Trash2 className="w-4 h-4 mr-2" /> Delete ({selectedItems.size})</button></div>)}
               <button onClick={() => setHideComplete(!hideComplete)} className={`flex items-center justify-center px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${hideComplete ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`} title={hideComplete ? "Show Completed Items" : "Hide Completed Items"}>{hideComplete ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />} <span className="hidden md:inline">{hideComplete ? 'Show Completed' : 'Hide Completed'}</span></button>
              <div className="flex gap-2 border-l pl-2 ml-1">
                <button onClick={() => setShowImport(true)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg" title="Import CSV"><Upload className="w-5 h-5" /></button>
                <button onClick={() => setShowAddForm(!showAddForm)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg" title="Add Item"><Plus className="w-5 h-5" /></button>
                
                {/* User Menu */}
                <div className="flex items-center gap-2 px-2 border-l ml-1">
                    <div className="text-right hidden md:block">
                        <div className="text-xs font-bold text-gray-700">{user?.name || user?.email || 'User'}</div>
                        <div className="text-[10px] text-gray-500 uppercase">{user?.role || 'user'}</div>
                    </div>
                    <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Logout"><LogOut className="w-5 h-5" /></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Datalists for Autocomplete */}
      <datalist id="part-names-list">
          {uniquePartNames.map((name: string) => <option key={name} value={name} />)}
      </datalist>
      <datalist id="manufacturers-list">
          {uniqueManufacturers.map((m: string) => <option key={m} value={m} />)}
      </datalist>

      <main className="w-full px-4 py-8">
        {/* Fetch Error Banner */}
        {fetchError && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 flex items-center justify-between">
                <div className="flex items-start">
                    <div className="mr-2 mt-0.5"><WifiOff className="w-5 h-5 text-red-600" /></div>
                    <div className="text-sm text-red-700">{fetchError}</div>
                    {/* ADD LOGOUT BUTTON HERE FOR SAFETY */}
                    {user && (
                        <button 
                            onClick={handleLogout} 
                            className="ml-3 text-xs bg-red-100 text-red-800 px-2 py-1 rounded hover:bg-red-200 font-bold"
                        >
                            Log Out
                        </button>
                    )}
                </div>
                <button onClick={() => window.location.reload()} className="text-xs bg-white border border-red-200 text-red-700 px-3 py-1 rounded hover:bg-red-50">Retry</button>
            </div>
        )}

        {/* Loading Spinner */}
        {loading && (
            <div className="flex justify-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        )}

        {/* Empty State */}
        {!loading && parts.length === 0 && !fetchError && (
             <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 text-center text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                 <div className="bg-gray-100 p-6 rounded-full mb-4"><Box className="w-12 h-12 text-gray-400" /></div>
                 <h3 className="text-lg font-medium text-gray-900">No parts found</h3>
                 <p className="mb-6 max-w-sm">It looks like your inventory is empty, or you might be experiencing a session issue.</p>
                 <button 
                    onClick={handleLogout} 
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm"
                 >
                     Not seeing your data? Sign In Again
                 </button>
             </div>
        )}

        {/* IMPORT MODAL */}
        {showImport && (
           <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
             <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 overflow-y-auto max-h-[90vh]">
              <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-medium text-gray-900">Import CSV</h3><button onClick={() => {setShowImport(false); setCsvData([]);}} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button></div>
              {!csvData.length ? (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-10 text-center relative"><Upload className="mx-auto h-12 w-12 text-gray-400" /><p className="mt-2 text-sm text-gray-600">Select CSV File</p><input type="file" accept=".csv" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" /></div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-blue-50 p-3 rounded text-sm text-blue-700">Map your CSV columns to the Database fields below:</div>
                  <div className="grid grid-cols-2 gap-4">
                    {Object.keys(importMapping).map((key) => (
                      <div key={key}>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">{key.replace(/_/g, ' ')} {key === 'part' && <span className="text-red-500">*</span>}</label>
                        <select value={(importMapping as any)[key]} onChange={(e) => setImportMapping({...importMapping, [key]: e.target.value})} className="block w-full border border-gray-300 rounded p-1 text-sm bg-white">
                            <option value="">(Skip)</option>
                            {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 flex justify-end gap-3"><button onClick={() => {setCsvData([]); setCsvHeaders([]);}} className="px-4 py-2 border rounded text-gray-700">Reset</button><button onClick={executeImport} disabled={isImporting} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50">{isImporting ? 'Importing...' : 'Start Import'}</button></div>
                </div>
              )}
             </div>
           </div>
        )}

        {/* Add Part Form */}
        {showAddForm && (
            <div className="bg-indigo-50 border-b border-indigo-100 p-4 animate-fadeIn mb-6 rounded-lg">
            <form onSubmit={handleAddPart} className="max-w-7xl mx-auto">
                <h3 className="text-sm font-bold text-indigo-900 uppercase mb-3 flex items-center gap-2"><Plus className="w-4 h-4"/> New Item</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-3">
                <div className="flex flex-col gap-1">
                    <input type="text" list="manufacturers-list" placeholder="Manufacturer" className="border p-2 rounded text-sm" value={newPart.manufacturer} onChange={e => setNewPart({...newPart, manufacturer: e.target.value})} />
                    {(() => {
                            const suggested = getSuggestedManufacturer(newPart.name, newPart.manufacturer);
                            if (suggested) return (
                                <div className="flex items-center gap-2 text-xs bg-indigo-50 p-2 rounded border border-indigo-100 animate-in fade-in mt-1">
                                    <Sparkles className="w-3 h-3 text-indigo-500 shrink-0" />
                                    <span className="text-indigo-700 font-medium whitespace-nowrap">Found existing manufacturer:</span>
                                    <span className="truncate text-gray-600 italic max-w-[200px]" title={suggested}>{suggested}</span>
                                    <button 
                                        type="button" 
                                        onClick={() => setNewPart({...newPart, manufacturer: suggested})}
                                        className="text-indigo-600 underline hover:text-indigo-800 ml-auto whitespace-nowrap"
                                    >
                                        Use this
                                    </button>
                                </div>
                            );
                        })()}
                </div>
                <input type="text" list="part-names-list" placeholder="Part Name / SKU *" required className="border p-2 rounded text-sm font-semibold" value={newPart.name} onChange={e => setNewPart({...newPart, name: e.target.value, sku: e.target.value})} />
                
                <div className="flex flex-col gap-1">
                    <input type="text" placeholder="Description" className="border p-2 rounded text-sm" value={newPart.description} onChange={e => setNewPart({...newPart, description: e.target.value})} />
                    {(() => {
                        const suggested = getSuggestedDescription(newPart.name, newPart.description);
                        if (suggested) return (
                            <div className="flex items-center gap-2 text-xs bg-indigo-50 p-2 rounded border border-indigo-100 animate-in fade-in mt-1">
                                <Sparkles className="w-3 h-3 text-indigo-500 shrink-0" />
                                <span className="text-indigo-700 font-medium whitespace-nowrap">Found existing desc:</span>
                                <span className="truncate text-gray-600 italic max-w-[200px]" title={suggested}>{suggested}</span>
                                <button 
                                    type="button" 
                                    onClick={() => setNewPart({...newPart, description: suggested})}
                                    className="text-indigo-600 underline hover:text-indigo-800 ml-auto whitespace-nowrap"
                                >
                                    Use this
                                </button>
                            </div>
                        );
                    })()}
                </div>

                <input type="text" placeholder="Vendor" className="border p-2 rounded text-sm" value={newPart.vendor} onChange={e => setNewPart({...newPart, vendor: e.target.value})} />
                <input type="text" placeholder="Area / Loc" className="border p-2 rounded text-sm" value={newPart.area} onChange={e => setNewPart({...newPart, area: e.target.value})} />
                <input type="text" placeholder="Work Order" className="border p-2 rounded text-sm" value={newPart.work_order} onChange={e => setNewPart({...newPart, work_order: e.target.value})} />
                <div className="flex items-center gap-2 bg-white rounded border px-2">
                    <span className="text-xs text-gray-500">Qty:</span>
                    <input type="number" placeholder="1" className="w-full p-2 text-sm outline-none" value={newPart.quantity} onChange={e => setNewPart({...newPart, quantity: e.target.value})} />
                </div>
                <div className="flex items-center gap-2 bg-white rounded border px-2">
                    <span className="text-xs text-gray-500">Ord:</span>
                    <input type="number" placeholder="1" className="w-full p-2 text-sm outline-none" value={newPart.quantity_ordered} onChange={e => setNewPart({...newPart, quantity_ordered: e.target.value})} />
                </div>
                <select className="border p-2 rounded text-sm bg-white" value={newPart.status} onChange={e => setNewPart({...newPart, status: e.target.value})}>{STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select>
                
                {/* IMAGE URL ADD INPUT */}
                <div className="col-span-2 md:col-span-3 flex flex-col gap-1">
                    <div className="flex gap-2">
                        <input type="text" placeholder="Image URL (http://...)" className="flex-1 border p-2 rounded text-sm" value={newPart.image_url} onChange={e => setNewPart({...newPart, image_url: e.target.value})} />
                        <button type="button" onClick={() => openGoogleSearch(newPart.manufacturer, newPart.name)} className="bg-gray-100 text-gray-600 px-3 py-2 rounded border hover:bg-gray-200" title="Find Image on Google"><Search className="w-4 h-4" /></button>
                    </div>
                    {/* Smart Suggestion */}
                    {(() => {
                        const suggested = getSuggestedImage(newPart.name, newPart.image_url);
                        if (suggested) return (
                            <div className="flex items-center gap-2 text-xs bg-indigo-50 p-2 rounded border border-indigo-100 animate-in fade-in">
                                <Sparkles className="w-3 h-3 text-indigo-500" />
                                <span className="text-indigo-700 font-medium">Found existing image:</span>
                                <img src={suggested} className="w-6 h-6 object-contain border bg-white rounded" alt="Suggestion" />
                                <button 
                                    type="button" 
                                    onClick={() => setNewPart({...newPart, image_url: suggested})}
                                    className="text-indigo-600 underline hover:text-indigo-800 ml-auto"
                                >
                                    Use this
                                </button>
                            </div>
                        );
                    })()}
                </div>

                <div className="flex items-center gap-2 col-span-2 md:col-span-3">
                    <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-indigo-700 flex-1">Add Part</button>
                    <button type="button" onClick={() => setShowAddForm(false)} className="bg-white border text-gray-600 px-4 py-2 rounded text-sm hover:bg-gray-50">Cancel</button>
                </div>
                </div>
            </form>
            </div>
        )}

        {/* Table */}
        {!loading && parts.length > 0 && (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg border border-gray-200">
          <div className="overflow-auto max-h-[75vh] relative">
            <table className="min-w-full divide-y divide-gray-200 table-fixed min-w-[1000px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 w-10 sticky top-0 left-0 z-20 bg-gray-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"><button onClick={toggleSelectAll} className="text-gray-400 hover:text-indigo-600">{selectedItems.size > 0 && selectedItems.size === filteredAndSortedParts.length ? (<CheckSquare className="w-5 h-5 text-indigo-600" />) : (<Square className="w-5 h-5" />)}</button></th>
                  <TableHeader label="Part / Manufacturer" sortKey="name" sortConfig={sortConfig} onSort={handleSort} width={colWidths.part} onResizeStart={(e:any) => startResize(e, 'part')} stickyLeft={true} leftOffset={40} />
                  <TableHeader label="Details" sortKey="description" sortConfig={sortConfig} onSort={handleSort} width={colWidths.details} onResizeStart={(e:any) => startResize(e, 'details')} />
                  <TableHeader label="Location / WO" sortKey="area" sortConfig={sortConfig} onSort={handleSort} width={colWidths.location} onResizeStart={(e:any) => startResize(e, 'location')} />
                  <TableHeader label="Dates" width={colWidths.dates} onResizeStart={(e:any) => startResize(e, 'dates')} />
                  <TableHeader label="Qty" sortKey="quantity" sortConfig={sortConfig} onSort={handleSort} width={colWidths.qty} onResizeStart={(e:any) => startResize(e, 'qty')} />
                  <TableHeader label="Status" sortKey="status" sortConfig={sortConfig} onSort={handleSort} width={colWidths.status} onResizeStart={(e:any) => startResize(e, 'status')} />
                  <TableHeader label="Actions" className="text-right" width={colWidths.actions} />
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {groupedData ? (
                    // GROUPED RENDER
                    groupedData.map((group: any) => (
                        <React.Fragment key={group.id}>
                            <tr 
                                className="bg-indigo-50 border-b border-indigo-100 cursor-pointer hover:bg-indigo-100 transition-colors sticky left-0 z-10"
                                onClick={() => toggleGroup(group.id)}
                            >
                                <td colSpan={5} className="px-6 py-2 text-sm font-bold text-indigo-900 sticky left-0 z-10 bg-indigo-50">
                                    <div className="flex items-center">
                                        {collapsedGroups.has(group.id) ? <ChevronRight className="w-4 h-4 mr-2" /> : <ChevronDown className="w-4 h-4 mr-2" />}
                                        {groupBy === 'name' && <span className="text-xs font-normal text-indigo-500 mr-2 uppercase">Part Name:</span>}
                                        {groupBy === 'manufacturer' && <span className="text-xs font-normal text-indigo-500 mr-2 uppercase">Manufacturer:</span>}
                                        {groupBy === 'area' && <span className="text-xs font-normal text-indigo-500 mr-2 uppercase">Location:</span>}
                                        {group.title} <span className="text-xs font-normal text-gray-500 ml-2">({group.items.length} records)</span>
                                    </div>
                                </td>
                                <td className="px-6 py-2 text-sm font-mono font-bold text-indigo-900 border-l border-indigo-100">
                                    <div className="flex flex-col">
                                        <span>Total: {group.totalQty}</span>
                                        <span className="text-xs text-indigo-400 font-normal">Ord: {group.totalOrd}</span>
                                    </div>
                                </td>
                                <td colSpan={2}></td>
                            </tr>
                            {!collapsedGroups.has(group.id) && group.items.map((part: any) => (
                                <tr key={part.id} className={`${selectedItems.has(part.id) ? 'bg-yellow-50' : 'hover:bg-gray-50'}`}>
                                    <td className="px-3 py-4 pl-8 sticky left-0 z-10 bg-inherit shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]"><button onClick={(e) => handleSelectRow(part.id, e)} className="text-gray-400 hover:text-indigo-600">{selectedItems.has(part.id) ? <CheckSquare className="w-5 h-5 text-indigo-600" /> : <Square className="w-5 h-5" />}</button></td>
                                    
                                    {/* PART NAME COLUMN WITH HOVER PREVIEW */}
                                    <td className="px-6 py-4 truncate sticky left-10 z-10 bg-inherit shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                        <ImageHoverPreview src={part.image_url} alt={part.name}>
                                            <div className="text-sm font-bold text-gray-900 truncate cursor-help decoration-dotted underline-offset-2 hover:underline" title={part.name}>{part.name}</div>
                                        </ImageHoverPreview>
                                        <div className="text-xs text-gray-500 uppercase tracking-wide truncate" title={part.manufacturer}>{part.manufacturer || '-'}</div>
                                    </td>

                                    <td className="px-6 py-4 truncate"><div className="text-sm text-gray-900 truncate" title={part.description}>{part.description || '-'}</div><div className="text-xs text-gray-500 truncate" title={part.vendor}>{part.vendor}</div></td>
                                    <td className="px-6 py-4 truncate"><div className="flex items-center text-xs text-gray-700 gap-1 truncate" title={part.area}><MapPin className="w-3 h-3 flex-shrink-0"/> {part.area}</div><div className="flex items-center text-xs text-gray-500 gap-1 mt-1 truncate" title={part.work_order}><Hash className="w-3 h-3 flex-shrink-0"/> {part.work_order}</div></td>
                                    <td className="px-6 py-4 text-xs text-gray-500 truncate">{part.date_ordered && <div className="flex items-center gap-1 mb-1 text-amber-700" title="Ordered"><Calendar className="w-3 h-3 flex-shrink-0" /> {formatDateForDisplay(part.date_ordered)}</div>}{part.date_sent && <div className="flex items-center gap-1 text-purple-700" title="Sent to Storeroom"><Archive className="w-3 h-3 flex-shrink-0" /> {formatDateForDisplay(part.date_sent)}</div>}</td>
                                    <td className="px-6 py-4 text-sm font-mono truncate"><div className="font-bold text-gray-900">Rem: {part.quantity}</div><div className="text-xs text-gray-500">Ord: {part.quantity_ordered}</div></td>
                                    <td className="px-6 py-4" onDoubleClick={() => openStatusModal(part.id, part.name, part.status)} title="Double click to change status">
                                    <div className="cursor-pointer">{getStatusBadge(part.status)}</div>
                                    <div className="text-xs text-gray-400 mt-1 truncate">{part.lastActionBy && `By: ${part.lastActionBy}`}</div>
                                    </td>
                                    <td className="px-6 py-4 text-right text-sm font-medium"><div className="flex justify-end gap-1"><button onClick={() => openEditModal(part)} className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 p-1.5 rounded" title="Edit"><Edit className="w-4 h-4" /></button><button onClick={() => openQuantityModal(part.id, part.name, part.quantity)} className="text-amber-600 hover:text-amber-900 bg-amber-50 p-1.5 rounded" title="Take"><MinusCircle className="w-4 h-4" /></button><button onClick={() => openHistoryModal(part.id, part.name, part.history)} className="text-slate-600 hover:text-slate-900 bg-slate-100 p-1.5 rounded" title="History"><History className="w-4 h-4" /></button><button onClick={() => handleDelete(part.id)} className="text-gray-400 hover:text-red-600 p-1.5" title="Delete"><Trash2 className="w-4 h-4" /></button></div></td>
                                </tr>
                            ))}
                        </React.Fragment>
                    ))
                ) : (
                    // STANDARD RENDER (No Grouping)
                    filteredAndSortedParts.map((part: any) => (
                    <tr key={part.id} className={`${selectedItems.has(part.id) ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}>
                        <td className="px-3 py-4 sticky left-0 z-10 bg-inherit shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]"><button onClick={(e) => handleSelectRow(part.id, e)} className="text-gray-400 hover:text-indigo-600">{selectedItems.has(part.id) ? <CheckSquare className="w-5 h-5 text-indigo-600" /> : <Square className="w-5 h-5" />}</button></td>
                        
                        {/* PART NAME COLUMN WITH HOVER PREVIEW */}
                        <td className="px-6 py-4 truncate sticky left-10 z-10 bg-inherit shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                            <ImageHoverPreview src={part.image_url} alt={part.name}>
                                <div className="text-sm font-bold text-gray-900 truncate cursor-help decoration-dotted underline-offset-2 hover:underline" title={part.name}>{part.name}</div>
                            </ImageHoverPreview>
                            <div className="text-xs text-gray-500 uppercase tracking-wide truncate" title={part.manufacturer}>{part.manufacturer || '-'}</div>
                        </td>

                        <td className="px-6 py-4 truncate"><div className="text-sm text-gray-900 truncate" title={part.description}>{part.description || '-'}</div><div className="text-xs text-gray-500 truncate" title={part.vendor}>{part.vendor}</div></td>
                        <td className="px-6 py-4 truncate"><div className="flex items-center text-xs text-gray-700 gap-1 truncate" title={part.area}><MapPin className="w-3 h-3 flex-shrink-0"/> {part.area}</div><div className="flex items-center text-xs text-gray-500 gap-1 mt-1 truncate" title={part.work_order}><Hash className="w-3 h-3 flex-shrink-0"/> {part.work_order}</div></td>
                        <td className="px-6 py-4 text-xs text-gray-500 truncate">{part.date_ordered && <div className="flex items-center gap-1 mb-1 text-amber-700" title="Ordered"><Calendar className="w-3 h-3 flex-shrink-0" /> {formatDateForDisplay(part.date_ordered)}</div>}{part.date_sent && <div className="flex items-center gap-1 text-purple-700" title="Sent to Storeroom"><Archive className="w-3 h-3 flex-shrink-0" /> {formatDateForDisplay(part.date_sent)}</div>}</td>
                        <td className="px-6 py-4 text-sm font-mono truncate"><div className="font-bold text-gray-900">Rem: {part.quantity}</div><div className="text-xs text-gray-500">Ord: {part.quantity_ordered}</div></td>
                        <td className="px-6 py-4" onDoubleClick={() => openStatusModal(part.id, part.name, part.status)} title="Double click to change status">
                        <div className="cursor-pointer">{getStatusBadge(part.status)}</div>
                        <div className="text-xs text-gray-400 mt-1 truncate">{part.lastActionBy && `By: ${part.lastActionBy}`}</div>
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-medium"><div className="flex justify-end gap-1"><button onClick={() => openEditModal(part)} className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 p-1.5 rounded" title="Edit"><Edit className="w-4 h-4" /></button><button onClick={() => openQuantityModal(part.id, part.name, part.quantity)} className="text-amber-600 hover:text-amber-900 bg-amber-50 p-1.5 rounded" title="Take"><MinusCircle className="w-4 h-4" /></button><button onClick={() => openHistoryModal(part.id, part.name, part.history)} className="text-slate-600 hover:text-slate-900 bg-slate-100 p-1.5 rounded" title="History"><History className="w-4 h-4" /></button><button onClick={() => handleDelete(part.id)} className="text-gray-400 hover:text-red-600 p-1.5" title="Delete"><Trash2 className="w-4 h-4" /></button></div></td>
                    </tr>
                    ))
                )}

              </tbody>
            </table>
          </div>
        </div>
      )}
        {/* Bulk Edit Modal */}
        {bulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
              <h3 className="font-bold text-slate-800">Bulk Edit ({selectedItems.size} Items)</h3>
            </div>
            
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <BulkEditField label="Manufacturer" onUpdate={(v: string) => handleBulkUpdate({ manufacturer: v })} isInput list={uniqueManufacturers} />
              <BulkEditField label="Part Name" onUpdate={(v: string) => handleBulkUpdate({ name: v })} isInput list={uniquePartNames} />
              <BulkEditField label="Description" onUpdate={(v: string) => handleBulkUpdate({ description: v })} isInput />
              <BulkEditField label="Status" onUpdate={(v: string) => handleBulkUpdate({ status: v })} options={STATUS_OPTIONS} />
              <BulkEditField label="Vendor" onUpdate={(v: string) => handleBulkUpdate({ vendor: v })} isInput />
              <BulkEditField label="Area / Loc" onUpdate={(v: string) => handleBulkUpdate({ area: v })} isInput />
              <BulkEditField label="Work Order" onUpdate={(v: string) => handleBulkUpdate({ work_order: v })} isInput />
              <BulkEditField label="Qty Remaining" onUpdate={(v: string) => handleBulkUpdate({ quantity: v })} isInput type="number" />
              <BulkEditField label="Qty Ordered" onUpdate={(v: string) => handleBulkUpdate({ quantity_ordered: v })} isInput type="number" />
              <BulkEditField label="Date Ordered" onUpdate={(v: string) => handleBulkUpdate({ date_ordered: v })} isInput type="date" />
              <BulkEditField label="Date Sent" onUpdate={(v: string) => handleBulkUpdate({ date_sent: v })} isInput type="date" />
            </div>

            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => setBulkModalOpen(false)} className="text-slate-600 hover:text-slate-800 text-sm font-medium">Cancel</button>
            </div>
          </div>
        </div>
        )}

        {editModal.isOpen && editModal.edited && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">Edit Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">Manufacturer</label>
                    <input className="w-full border p-2 rounded" list="manufacturers-list" value={editModal.edited.manufacturer} onChange={e => handleEditChange('manufacturer', e.target.value)} />
                    {(() => {
                        const suggested = getSuggestedManufacturer(editModal.edited.name, editModal.edited.manufacturer);
                        if (suggested) return (
                            <div className="flex items-center gap-2 text-xs bg-indigo-50 p-2 rounded border border-indigo-100 animate-in fade-in mt-1">
                                <Sparkles className="w-3 h-3 text-indigo-500 shrink-0" />
                                <span className="text-indigo-700 font-medium whitespace-nowrap">Found existing manufacturer:</span>
                                <span className="truncate text-gray-600 italic max-w-[200px]" title={suggested}>{suggested}</span>
                                <button 
                                    type="button" 
                                    onClick={() => handleEditChange('manufacturer', suggested)}
                                    className="text-indigo-600 underline hover:text-indigo-800 ml-auto whitespace-nowrap"
                                >
                                    Use this
                                </button>
                            </div>
                        );
                    })()}
                </div>
                <div><label className="text-xs font-bold text-gray-500 uppercase">Part Name/SKU</label><input className="w-full border p-2 rounded" list="part-names-list" value={editModal.edited.name} onChange={e => handleEditChange('name', e.target.value)} /></div>
                <div className="md:col-span-2">
                    <label className="text-xs font-bold text-gray-500 uppercase">Description</label>
                    <input className="w-full border p-2 rounded" value={editModal.edited.description} onChange={e => handleEditChange('description', e.target.value)} />
                    {(() => {
                        const suggested = getSuggestedDescription(editModal.edited.name, editModal.edited.description);
                        if (suggested) return (
                            <div className="flex items-center gap-2 text-xs bg-indigo-50 p-2 rounded border border-indigo-100 animate-in fade-in mt-1">
                                <Sparkles className="w-3 h-3 text-indigo-500 shrink-0" />
                                <span className="text-indigo-700 font-medium whitespace-nowrap">Found existing desc:</span>
                                <span className="truncate text-gray-600 italic max-w-[200px]" title={suggested}>{suggested}</span>
                                <button 
                                    type="button" 
                                    onClick={() => handleEditChange('description', suggested)}
                                    className="text-indigo-600 underline hover:text-indigo-800 ml-auto whitespace-nowrap"
                                >
                                    Use this
                                </button>
                            </div>
                        );
                    })()}
                </div>
                <div><label className="text-xs font-bold text-gray-500 uppercase">Vendor</label><input className="w-full border p-2 rounded" value={editModal.edited.vendor} onChange={e => handleEditChange('vendor', e.target.value)} /></div>
                <div><label className="text-xs font-bold text-gray-500 uppercase">Status</label><select className="w-full border p-2 rounded bg-white" value={editModal.edited.status} onChange={e => handleEditChange('status', e.target.value)}>{STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select></div>
                <div><label className="text-xs font-bold text-gray-500 uppercase">Area / Project</label><input className="w-full border p-2 rounded" value={editModal.edited.area} onChange={e => handleEditChange('area', e.target.value)} /></div>
                <div><label className="text-xs font-bold text-gray-500 uppercase">Work Order</label><input className="w-full border p-2 rounded" value={editModal.edited.work_order} onChange={e => handleEditChange('work_order', e.target.value)} /></div>
                <div><label className="text-xs font-bold text-gray-500 uppercase">Quantity Remaining</label><input type="number" className="w-full border p-2 rounded" value={editModal.edited.quantity} onChange={e => handleEditChange('quantity', parseInt(e.target.value) || 0)} /></div>
                <div><label className="text-xs font-bold text-gray-500 uppercase">Quantity Ordered</label><input type="number" className="w-full border p-2 rounded" value={editModal.edited.quantity_ordered} onChange={e => handleEditChange('quantity_ordered', parseInt(e.target.value) || 0)} /></div>
                <div><label className="text-xs font-bold text-gray-500 uppercase">Date Ordered</label><input type="date" className="w-full border p-2 rounded" value={formatDateForInput(editModal.edited.date_ordered)} onChange={e => handleEditChange('date_ordered', e.target.value)} /></div>
                <div><label className="text-xs font-bold text-gray-500 uppercase">Date Sent</label><input type="date" className="w-full border p-2 rounded" value={formatDateForInput(editModal.edited.date_sent)} onChange={e => handleEditChange('date_sent', e.target.value)} /></div>
                
                {/* IMAGE URL EDIT INPUT */}
                <div className="col-span-2 flex flex-col gap-1">
                    <div className="flex gap-2 items-end">
                        <div className="flex-1">
                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Image URL</label>
                            <input className="w-full border p-2 rounded" placeholder="http://..." value={editModal.edited.image_url || ''} onChange={e => handleEditChange('image_url', e.target.value)} />
                        </div>
                        <button type="button" onClick={() => openGoogleSearch(editModal.edited.manufacturer, editModal.edited.name)} className="bg-gray-100 text-gray-600 px-3 py-2 rounded border hover:bg-gray-200 h-[42px]" title="Find Image on Google"><Search className="w-4 h-4" /></button>
                    </div>
                     {/* Smart Suggestion */}
                    {(() => {
                        const suggested = getSuggestedImage(editModal.edited.name, editModal.edited.image_url);
                        if (suggested) return (
                            <div className="flex items-center gap-2 text-xs bg-indigo-50 p-2 rounded border border-indigo-100 animate-in fade-in">
                                <Sparkles className="w-3 h-3 text-indigo-500" />
                                <span className="text-indigo-700 font-medium">Found existing image:</span>
                                <img src={suggested} className="w-6 h-6 object-contain border bg-white rounded" alt="Suggestion" />
                                <button 
                                    type="button" 
                                    onClick={() => handleEditChange('image_url', suggested)}
                                    className="text-indigo-600 underline hover:text-indigo-800 ml-auto"
                                >
                                    Use this
                                </button>
                            </div>
                        );
                    })()}
                </div>
            </div>
            <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end gap-3">
                <button onClick={() => setEditModal({ isOpen: false, partId: null, original: null, edited: null })} className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={confirmEditUpdate} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 flex items-center gap-2"><Save className="w-4 h-4" /> Save Changes</button>
            </div>
          </div>
        </div>
        )}

        {quantityModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
          <div className="bg-white rounded p-6 shadow-xl max-w-sm w-full">
            <h3 className="text-lg font-bold mb-1">Take Items</h3>
            <p className="text-sm text-gray-500 mb-4 truncate">{quantityModal.partName}</p>
            <div className="bg-gray-50 p-3 rounded mb-4 text-sm text-center">Current Remaining: <span className="font-bold">{quantityModal.currentQty}</span></div>
            <div className="space-y-4"><div><label className="block text-xs font-medium text-gray-700 uppercase mb-1">How many are you taking?</label><input type="number" min="1" className="w-full border p-2 rounded bg-white text-sm text-center font-bold" value={modalTakeAmount} onChange={(e) => setModalTakeAmount(parseInt(e.target.value) || 0)} /></div></div>
            <div className="mt-6 flex justify-end gap-2"><button onClick={() => setQuantityModal({ isOpen: false, partId: null, partName: '', currentQty: 0 })} className="px-3 py-2 border rounded text-sm hover:bg-gray-50">Cancel</button><button onClick={confirmQuantityUpdate} className="px-4 py-2 bg-amber-600 text-white rounded text-sm hover:bg-amber-700 font-medium">Confirm</button></div>
          </div>
        </div>
        )}

        {statusModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
          <div className="bg-white rounded p-6 shadow-xl max-w-sm w-full">
            <h3 className="text-lg font-bold mb-1">Update Status</h3>
            <p className="text-sm text-gray-500 mb-4 truncate">{statusModal.partName}</p>
            <div className="space-y-4"><div><label className="block text-xs font-medium text-gray-700 uppercase mb-1">New Status</label><select value={modalNewStatus} onChange={(e) => setModalNewStatus(e.target.value)} className="w-full border p-2 rounded bg-white text-sm">{STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select></div></div>
            <div className="mt-6 flex justify-end gap-2"><button onClick={() => setStatusModal({ isOpen: false, partId: null, partName: '', currentStatus: '' })} className="px-3 py-2 border rounded text-sm hover:bg-gray-50">Cancel</button><button onClick={confirmStatusUpdate} className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 font-medium">Update Status</button></div>
          </div>
        </div>
        )}

        {historyModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4"><div><h3 className="text-lg font-bold">Activity Log</h3><p className="text-sm text-gray-500 truncate max-w-xs">{historyModal.partName}</p></div><button onClick={() => setHistoryModal({ isOpen: false, partId: null, partName: '', history: [] })} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button></div>
            <div className="flex-1 overflow-y-auto border-t border-gray-200 pt-4 space-y-4">
              {historyModal.history && historyModal.history.length > 0 ? (
                [...historyModal.history].reverse().map((entry, idx) => (
                  <div key={idx} className="flex gap-3 text-sm">
                    <div className="mt-1"><div className="w-2 h-2 rounded-full bg-indigo-400"></div></div>
                    <div>
                      <div className="font-medium text-gray-900">{entry.action}</div>
                      <div className="text-gray-500 text-xs flex gap-2"><span>{formatHistoryTime(entry.at)}</span><span>•</span><span className="font-semibold bg-gray-100 px-1 rounded text-gray-600">{entry.by || 'SYSTEM'}</span></div>
                      {entry.from && entry.to && (<div className="text-xs text-gray-400 mt-0.5">Changed from "{entry.from}" to "{entry.to}"</div>)}
                    </div>
                  </div>
                ))
              ) : ( <div className="text-center text-gray-500 py-8">No history recorded yet.</div> )}
            </div>
          </div>
        </div>
        )}
      </main>
      
      {/* Stats Footer */}
      <footer className="fixed bottom-0 w-full bg-white border-t py-2 px-4 text-xs text-gray-500 flex justify-between z-10">
          <div>
              Total: {parts.length} | Visible: {filteredAndSortedParts.length}
              {parts.length > filteredAndSortedParts.length && <span className="ml-1 text-indigo-600">(Filters active)</span>}
          </div>
          <div className="flex items-center gap-2">
              <button 
                  onClick={() => { localStorage.clear(); window.location.reload(); }} 
                  className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                  title="Hard Reset App (Clear Session)"
              >

type BulkEditFieldProps = {
  label: string;
  onUpdate: (val: string) => void;
  options?: string[];
  isInput?: boolean;
  type?: string;
  list?: string[];
  onSelectFromList?: (val: string) => void;
};

const BulkEditField = ({
  label,
  onUpdate,
  options,
  isInput,
  type = "text",
  list,
  onSelectFromList,
}: BulkEditFieldProps) => {


  const [enabled, setEnabled] = useState(false);
  const [val, setVal] = useState('');

  const handleApply = () => {
    if (enabled && val) {
      if (confirm(`Are you sure you want to update "${label}" to "${val}" for all selected items?`)) {
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
              onBlur={(e) => { // Auto-fill logic for inputs with datalist
                if (list && onSelectFromList) {
                  const selectedValue = onSelectFromList(e.target.value);
                  if (selectedValue) setVal(selectedValue);
                }
              }}
              list={list ? `bulk-list-${label.replace(/\s+/g, '-')}` : undefined}
              className="w-full p-2 border rounded-md disabled:bg-slate-100 disabled:text-slate-400 text-sm"
            />
            {list && (
              <datalist id={`bulk-list-${label.replace(/\s+/g, '-')}`}>
                {list.map((o) => <option key={o} value={o} />)}
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
};                 <RotateCcw className="w-3 h-3" />
              </button>
              <div className="group relative">
                  <Wifi className="w-4 h-4 text-green-500 cursor-help" />
                  <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block bg-gray-800 text-white text-xs p-2 rounded whitespace-nowrap">
                      Connected to {PB_URL}
                  </div>
              </div>
              {user?.email}
          </div>
      </footer>
    </div>
  );
}

// --- Main App Component ---
export default function PartsInventoryTracker() {
  const [pb, setPb] = useState<any>(null);

  useEffect(() => {
    const pbInstance = new PocketBase(PB_URL);
    setPb(pbInstance);
  }, []);

  return (
    <ErrorBoundary>
      {pb ? <PartsInventoryTrackerInner pb={pb} /> : <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>}
    </ErrorBoundary>
  );
}

// Subcomponent for Bulk Edit Fields
const BulkEditField = ({ label, onUpdate, options, isInput, type = "text", list, onSelectFromList }: {
  label: string; 
  onUpdate: (val: string) => void; 
  options?: string[]; 
  list?: string[];
  isInput?: boolean; 
  type?: string;
  onSelectFromList?: (val: string) => string | undefined;
}) => {
  const [enabled, setEnabled] = useState(false);
  const [val, setVal] = useState('');

  const handleApply = () => {
    if (enabled && val) {
      if (confirm(`Are you sure you want to update "${label}" to "${val}" for all selected items?`)) {
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
              onBlur={(e) => { // Auto-fill logic for inputs with datalist
                if (list && onSelectFromList) {
                  const selectedValue = onSelectFromList(e.target.value);
                  if (selectedValue) setVal(selectedValue);
                }
              }}
              list={list ? `bulk-list-${label.replace(/\s+/g, '-')}` : undefined}
              className="w-full p-2 border rounded-md disabled:bg-slate-100 disabled:text-slate-400 text-sm"
            />
            {list && (
              <datalist id={`bulk-list-${label.replace(/\s+/g, '-')}`}>
                {list.map((o) => <option key={o} value={o} />)}
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