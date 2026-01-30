import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, 
  Plus, 
  Filter, 
  MoreHorizontal, 
  X, 
  ChevronDown, 
  ChevronUp,
  Folder,
  FileText,
  Image as ImageIcon,
  File,
  Download,
  Trash2,
  Clock,
  Star,
  HardDrive,
  Cloud,
  Loader2,
  LogOut,
  ChevronRight,
  ArrowUp,
  Grid,
  List as ListIcon,
  Eye,
  Info,
  Box as BoxIcon,
  Lock,
  Wifi,
  WifiOff,
  AlertTriangle,
  ServerCrash
} from 'lucide-react';

// --- Configuration ---
// In production, this would point to your PHP backend to exchange Auth Codes for Tokens
const BOX_API_BASE = 'https://api.box.com/2.0';
const UPLOAD_API_BASE = 'https://upload.box.com/api/2.0';

// --- Types ---
interface BoxEntry {
  type: 'file' | 'folder' | 'web_link';
  id: string;
  etag?: string;
  name: string;
  modified_at?: string;
  created_at?: string;
  size?: number;
  description?: string;
  parent?: { id: string; name: string };
  item_status?: string;
  extension?: string;
}

interface BoxCollection {
  total_count: number;
  entries: BoxEntry[];
  offset: number;
  limit: number;
}

interface UserProfile {
  name: string;
  login: string;
  avatar_url?: string;
}

// --- Helper Functions ---
const formatBytes = (bytes: number | undefined, decimals = 2) => {
  if (!bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const formatDate = (dateString: string | undefined) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString(undefined, { 
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
  });
};

const getFileIcon = (name: string, type: string) => {
  if (type === 'folder') return <Folder className="w-6 h-6 text-indigo-500 fill-indigo-100" />;
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf': return <FileText className="w-6 h-6 text-red-500" />;
    case 'png': 
    case 'jpg': 
    case 'jpeg': return <ImageIcon className="w-6 h-6 text-purple-500" />;
    case 'doc':
    case 'docx': return <FileText className="w-6 h-6 text-blue-500" />;
    case 'xls':
    case 'xlsx': return <FileText className="w-6 h-6 text-green-500" />;
    default: return <File className="w-6 h-6 text-slate-400" />;
  }
};

// --- Error Boundary ---
class ErrorBoundary extends React.Component<any, any> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-800 p-6">
        <ServerCrash className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Application Crashed</h1>
        <p className="text-slate-600 mb-6">Something went wrong while processing your request.</p>
        <button onClick={() => window.location.reload()} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Reload Application</button>
      </div>
    );
    return this.props.children;
  }
}

// --- Main Component ---
function BoxManager() {
  // Auth State
  const [token, setToken] = useState<string>(() => localStorage.getItem('box_dev_token') || '');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // App State
  const [currentFolderId, setCurrentFolderId] = useState<string>('0'); // '0' is Root
  const [folderStack, setFolderStack] = useState<{id: string, name: string}[]>([{id: '0', name: 'All Files'}]);
  const [items, setItems] = useState<BoxEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [selectedItem, setSelectedItem] = useState<BoxEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- API Utilities ---
  const boxFetch = async (endpoint: string, options: RequestInit = {}) => {
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };
    
    // Handle File Upload content type exception
    if (options.body instanceof FormData) {
        delete (headers as any)['Content-Type'];
    }

    const res = await fetch(`${endpoint.startsWith('https') ? endpoint : BOX_API_BASE + endpoint}`, {
      ...options,
      headers
    });

    if (res.status === 401) {
      setAuthError("Session expired. Please update your token.");
      setUser(null);
      throw new Error("Unauthorized");
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Box API Error: ${res.statusText}`);
    }

    return res.json();
  };

  // --- Actions ---
  const verifyToken = async (inputToken: string) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await fetch(`${BOX_API_BASE}/users/me`, {
        headers: { 'Authorization': `Bearer ${inputToken}` }
      });
      if (!res.ok) throw new Error("Invalid Token");
      const userData = await res.json();
      setUser(userData);
      setToken(inputToken);
      localStorage.setItem('box_dev_token', inputToken);
    } catch (err: any) {
      setAuthError(err.message || "Failed to authenticate");
    } finally {
      setAuthLoading(false);
    }
  };

  const loadFolder = async (folderId: string) => {
    setLoading(true);
    try {
      // Fetch Folder Items
      const data: BoxCollection = await boxFetch(`/folders/${folderId}/items?fields=id,type,name,size,modified_at,created_at,extension,description&limit=100&sort=name&direction=ASC`);
      setItems(data.entries);
      
      // Fetch Folder Details (for Breadcrumbs/Name) if not root
      if (folderId !== '0') {
          const folderInfo = await boxFetch(`/folders/${folderId}`);
          // Simple breadcrumb rebuild logic could go here, for now we manage stack manually on click
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    if (!query) {
      loadFolder(currentFolderId);
      return;
    }
    setLoading(true);
    try {
      const data: BoxCollection = await boxFetch(`/search?query=${encodeURIComponent(query)}&limit=20&type=file,folder`);
      setItems(data.entries);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setUploading(true);
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('attributes', JSON.stringify({
        name: file.name,
        parent: { id: currentFolderId }
    }));
    formData.append('file', file);

    try {
        await boxFetch(`${UPLOAD_API_BASE}/files/content`, {
            method: 'POST',
            body: formData
        });
        loadFolder(currentFolderId);
    } catch (err: any) {
        alert("Upload failed: " + err.message);
    } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleNavigate = (entry: BoxEntry) => {
    if (entry.type === 'folder') {
      setFolderStack(prev => [...prev, { id: entry.id, name: entry.name }]);
      setCurrentFolderId(entry.id);
      setSelectedItem(null);
    } else {
      setSelectedItem(entry);
    }
  };

  const navigateUp = (index: number) => {
    const newStack = folderStack.slice(0, index + 1);
    setFolderStack(newStack);
    setCurrentFolderId(newStack[newStack.length - 1].id);
  };

  const handleLogout = () => {
      setToken('');
      setUser(null);
      localStorage.removeItem('box_dev_token');
  };

  // --- Effects ---
  useEffect(() => {
    if (token) verifyToken(token);
  }, []);

  useEffect(() => {
    if (user) loadFolder(currentFolderId);
  }, [user, currentFolderId]);


  // --- Render: Login Portal ---
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center text-indigo-600">
             <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-lg">
                <BoxIcon className="w-7 h-7" />
             </div>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900">Box DMS Login</h2>
          <p className="mt-2 text-center text-sm text-slate-600">
            Secure Document Management System
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow-xl shadow-slate-200 border border-slate-100 sm:rounded-lg sm:px-10">
            <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); verifyToken(token); }}>
              <div>
                <label htmlFor="token" className="block text-sm font-medium text-slate-700">Box Developer Token</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                   <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-slate-400" />
                   </div>
                   <input
                    id="token"
                    name="token"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-slate-300 rounded-md p-2 border"
                    placeholder="Enter your Dev Token"
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  <span className="font-semibold">Note:</span> Use a Developer Token from the Box Console for this demo environment.
                </p>
              </div>

              {authError && (
                <div className="rounded-md bg-red-50 p-4">
                  <div className="flex">
                    <div className="flex-shrink-0"><AlertTriangle className="h-5 w-5 text-red-400" /></div>
                    <div className="ml-3"><h3 className="text-sm font-medium text-red-800">{authError}</h3></div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {authLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Connect to Box'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // --- Render: Main App ---
  return (
    <div className="h-screen bg-slate-50 flex flex-col font-sans overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 h-16 flex-shrink-0 flex items-center px-4 justify-between z-10 shadow-sm">
        <div className="flex items-center gap-4 w-1/3">
           <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-sm">
              <BoxIcon className="w-5 h-5" />
           </div>
           <span className="font-bold text-lg text-slate-800 hidden md:block">Box DMS</span>
        </div>

        <div className="flex-1 max-w-xl px-4">
           <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              <input 
                type="text" 
                className="w-full bg-slate-100 border-none rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all" 
                placeholder="Search files and folders..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
              />
           </div>
        </div>

        <div className="flex items-center gap-3 w-1/3 justify-end">
          <div className="hidden md:flex flex-col items-end mr-2">
             <span className="text-xs font-bold text-slate-700">{user.name}</span>
             <span className="text-[10px] text-slate-400">{user.login}</span>
          </div>
          {user.avatar_url ? (
             <img src={user.avatar_url} alt="Profile" className="w-8 h-8 rounded-full border border-slate-200" />
          ) : (
             <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold border border-indigo-200">
               {user.name.charAt(0)}
             </div>
          )}
          <button onClick={handleLogout} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <nav className="w-64 bg-slate-50 border-r border-slate-200 flex-shrink-0 hidden md:flex flex-col">
           <div className="p-4">
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-lg shadow-sm flex items-center justify-center gap-2 font-medium transition-colors"
              >
                 {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadIcon />} 
                 <span>Upload File</span>
              </button>
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleUpload} />
           </div>

           <div className="flex-1 overflow-y-auto py-2">
              <div className="px-4 mb-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Locations</div>
              <NavItem icon={<HardDrive className="w-4 h-4" />} label="All Files" active={true} onClick={() => { setFolderStack([{id: '0', name: 'All Files'}]); setCurrentFolderId('0'); }} />
              <NavItem icon={<Star className="w-4 h-4" />} label="Favorites" />
              <NavItem icon={<Clock className="w-4 h-4" />} label="Recent" />
              
              <div className="mt-6 px-4 mb-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Storage</div>
              <div className="px-4 py-2">
                 <div className="w-full bg-slate-200 rounded-full h-1.5 mb-2">
                    <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: '45%' }}></div>
                 </div>
                 <div className="flex justify-between text-xs text-slate-500">
                    <span>45 GB used</span>
                    <span>100 GB total</span>
                 </div>
              </div>
           </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 flex flex-col bg-white overflow-hidden relative">
           {/* Toolbar / Breadcrumbs */}
           <div className="h-12 border-b border-slate-100 flex items-center px-4 justify-between bg-white z-10">
              <div className="flex items-center gap-1 text-sm text-slate-600 overflow-x-auto no-scrollbar">
                 {folderStack.map((folder, idx) => (
                    <React.Fragment key={folder.id}>
                       <button 
                         onClick={() => navigateUp(idx)}
                         className={`hover:text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded transition-colors whitespace-nowrap ${idx === folderStack.length -1 ? 'font-bold text-slate-900' : ''}`}
                       >
                         {folder.name}
                       </button>
                       {idx < folderStack.length - 1 && <ChevronRight className="w-4 h-4 text-slate-300" />}
                    </React.Fragment>
                 ))}
              </div>
              
              <div className="flex items-center gap-1 border-l pl-2 ml-2">
                 <button onClick={() => setViewMode('list')} className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-slate-100 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
                    <ListIcon className="w-4 h-4" />
                 </button>
                 <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-slate-100 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
                    <Grid className="w-4 h-4" />
                 </button>
              </div>
           </div>

           {/* File View */}
           <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                 <div className="h-full flex flex-col items-center justify-center text-slate-400">
                    <Loader2 className="w-8 h-8 animate-spin mb-2" />
                    <p className="text-sm">Loading contents...</p>
                 </div>
              ) : items.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                    <Folder className="w-12 h-12 mb-2 text-slate-200" />
                    <p className="text-sm font-medium">This folder is empty</p>
                    <p className="text-xs">Upload a file to get started</p>
                 </div>
              ) : viewMode === 'list' ? (
                <table className="w-full text-left border-collapse">
                   <thead>
                      <tr className="text-xs text-slate-400 border-b border-slate-100">
                         <th className="font-medium py-2 pl-2">Name</th>
                         <th className="font-medium py-2 hidden sm:table-cell">Date Modified</th>
                         <th className="font-medium py-2 hidden md:table-cell">Size</th>
                         <th className="font-medium py-2 w-10"></th>
                      </tr>
                   </thead>
                   <tbody>
                      {items.map(item => (
                         <tr 
                           key={item.id} 
                           onClick={() => handleNavigate(item)}
                           className={`group border-b border-slate-50 hover:bg-indigo-50/50 cursor-pointer transition-colors ${selectedItem?.id === item.id ? 'bg-indigo-50' : ''}`}
                         >
                            <td className="py-2.5 pl-2 flex items-center gap-3">
                               {getFileIcon(item.name, item.type)}
                               <span className="text-sm font-medium text-slate-700 group-hover:text-indigo-700 truncate max-w-[200px] sm:max-w-xs">
                                 {item.name}
                               </span>
                            </td>
                            <td className="py-2 text-xs text-slate-500 hidden sm:table-cell">{formatDate(item.modified_at)}</td>
                            <td className="py-2 text-xs text-slate-500 hidden md:table-cell">{formatBytes(item.size)}</td>
                            <td className="py-2 text-right pr-2">
                               <button className="text-slate-300 hover:text-slate-600 p-1"><MoreHorizontal className="w-4 h-4" /></button>
                            </td>
                         </tr>
                      ))}
                   </tbody>
                </table>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                   {items.map(item => (
                      <div 
                        key={item.id} 
                        onClick={() => handleNavigate(item)}
                        className={`p-4 rounded-xl border ${selectedItem?.id === item.id ? 'border-indigo-400 bg-indigo-50 shadow-sm' : 'border-slate-200 bg-white hover:border-indigo-200 hover:shadow-sm'} cursor-pointer transition-all flex flex-col items-center text-center gap-3`}
                      >
                         <div className="w-12 h-12 flex items-center justify-center bg-slate-50 rounded-lg">
                           {getFileIcon(item.name, item.type)}
                         </div>
                         <div className="w-full">
                            <div className="text-sm font-medium text-slate-700 truncate w-full">{item.name}</div>
                            <div className="text-xs text-slate-400 mt-1">{item.type === 'folder' ? 'Folder' : formatBytes(item.size)}</div>
                         </div>
                      </div>
                   ))}
                </div>
              )}
           </div>
        </main>

        {/* Right Sidebar (Details) */}
        {selectedItem && (
          <aside className="w-72 bg-white border-l border-slate-200 hidden lg:flex flex-col shadow-xl z-20">
             <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <span className="font-bold text-slate-700 text-sm">Details</span>
                <button onClick={() => setSelectedItem(null)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
             </div>
             <div className="p-6 flex flex-col items-center border-b border-slate-100 bg-slate-50">
                <div className="w-20 h-20 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center justify-center mb-4">
                   {getFileIcon(selectedItem.name, selectedItem.type)}
                </div>
                <h3 className="text-center font-bold text-slate-800 break-words w-full">{selectedItem.name}</h3>
                <span className="text-xs text-slate-500 uppercase mt-1">{selectedItem.extension || 'Folder'}</span>
             </div>
             
             <div className="flex-1 overflow-y-auto p-4 space-y-6">
                <div>
                   <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Information</h4>
                   <div className="space-y-3">
                      <DetailRow label="Type" value={selectedItem.type} />
                      <DetailRow label="Size" value={formatBytes(selectedItem.size)} />
                      <DetailRow label="Created" value={formatDate(selectedItem.created_at)} />
                      <DetailRow label="Modified" value={formatDate(selectedItem.modified_at)} />
                   </div>
                </div>
                
                {selectedItem.description && (
                   <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Description</h4>
                      <p className="text-sm text-slate-600 leading-relaxed">{selectedItem.description}</p>
                   </div>
                )}
             </div>

             <div className="p-4 border-t border-slate-100 bg-slate-50">
                <button 
                  onClick={() => alert("Preview feature requires Box UI Elements library integration.")}
                  className="w-full flex items-center justify-center gap-2 bg-white border border-slate-300 text-slate-700 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm"
                >
                   <Eye className="w-4 h-4" /> Preview File
                </button>
             </div>
          </aside>
        )}
      </div>
    </div>
  );
}

const NavItem = ({ icon, label, active, onClick }: any) => (
   <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-2 text-sm font-medium transition-colors border-l-4 ${active ? 'bg-indigo-50 text-indigo-700 border-indigo-600' : 'text-slate-600 border-transparent hover:bg-slate-100'}`}>
      {icon}
      <span>{label}</span>
   </button>
);

const DetailRow = ({ label, value }: any) => (
   <div className="flex justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800">{value || '-'}</span>
   </div>
);

const UploadIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

export default function App() {
  return (
    <ErrorBoundary>
      <BoxManager />
    </ErrorBoundary>
  );
}