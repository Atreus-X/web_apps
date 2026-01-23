import React, { useState, useEffect } from 'react';
import PocketBase from 'pocketbase';
import {
  ClipboardList,
  Clock, // For login screen approval pending
  Loader2,
  LogOut,
  ServerCrash,
  AlertTriangle,
  Wifi,
  RotateCcw,
  FolderOpen, // For public files
  FileText, // For public files
  Cpu, // Icon for the portal itself (Microchip replacement)
  Lock, // For login screen
  KeyRound, // For reset password
  UserPlus, // For register screen
  User, // For user display
  Database, // For PocketBase app link
  Briefcase, // For Parts App
  Workflow, // For Projects App (DiagramProject replacement)a
  Copy, // For Work Orders App (Lucide equivalent of fa-copy)
  Clock as ClockIcon, // For Hours App (Lucide equivalent of fa-clock)
  FolderOpen as FolderOpenIcon, // For FileZilla (Lucide equivalent of fa-folder-open)
  Server, // For Webmin
} from 'lucide-react';

// --- Configuration ---
const PB_URL = (import.meta as any).env.VITE_PB_URL as string;

// --- Types ---
interface AppItem {
  name: string;
  url: string;
  icon: React.ComponentType<any>;
  color: string;
  desc: string;
}

interface FileItem {
  name: string;
  type: 'file' | 'directory';
}

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

// --- Main Portal Application Component ---
function PortalAppInner({ pb }: { pb: any }) {
  // --- Auth State (Copied from other apps) ---
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

  // --- Portal Specific State ---
  const [apps, setApps] = useState<AppItem[]>([]);
  const [publicFiles, setPublicFiles] = useState<FileItem[]>([]);
  const [isFetchingFiles, setIsFetchingFiles] = useState(false);
  const [fileFetchError, setFileFetchError] = useState<string | null>(null);

  // --- Hardcoded Applications (from original index.php) ---
  useEffect(() => {
    setApps([
      { name: 'Parts Inventory', url: '/public/parts/', icon: Briefcase, color: 'bg-emerald-500', desc: 'Parts Inventory Tracker' },    
      { name: 'Projects Manager', url: '/public/projects/', icon: Workflow, color: 'bg-sky-500', desc: 'Project Manager' },
      { name: 'Work Orders Tracker', url: '/public/work_orders/', icon: Copy, color: 'bg-sky-500', desc: 'Work Orders Tracker' },
      { name: 'BAS Hourly Logs', url: '/public/bas_hour_tracking.php', icon: ClockIcon, color: 'bg-indigo-500', desc: 'BAS Hourly logs' }
    ]);
  }, []);

  // --- Auth & Data Subscription (Copied from other apps) ---
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

  // Fetch public files when user logs in
  useEffect(() => {
    if (user && user.approved !== false) {
      fetchPublicFiles();
    } else {
      setPublicFiles([]); // Clear files if logged out
    }
  }, [user]);

  const fetchPublicFiles = async () => {
    setIsFetchingFiles(true);
    setFileFetchError(null);
    try {
      // This assumes you'll create a PHP endpoint at /api/files.php
      const response = await fetch('/api/files.php');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: FileItem[] = await response.json();
      setPublicFiles(data);
    } catch (error: any) {
      console.error("Failed to fetch public files:", error);
      setFileFetchError(error.message || "Could not load public files.");
    } finally {
      setIsFetchingFiles(false);
    }
  };

  // --- Auth Handlers (Copied from other apps) ---
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

  // --- Auth Screen (Copied from other apps) ---
  if (!user || user.approved === false) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center text-indigo-600"><Cpu className="w-12 h-12" /></div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Lab Portal Login</h2>
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
                    {authLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing In...</> : 'Sign In'}
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

  // --- Main App Content ---
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-10">
      <nav className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-slate-200 px-6 py-3 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white"><Cpu className="w-5 h-5" /></div>
          <h1 className="font-bold text-slate-800">Lab Portal</h1>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-blue-600">{currentUser}</p>
          <button
            onClick={handleLogout}
            className="text-xs text-slate-500 hover:text-red-500 hover:underline"
          >
            Logout
          </button>
        </div>
      </nav>

      <main className="container mx-auto px-6 py-10">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 font-mono">Pinned Applications</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-12">
          {apps.map((app) => (
            <a key={app.name} href={app.url} className="group bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-all">
              <div className={`${app.color} w-10 h-10 rounded-lg flex items-center justify-center text-white mb-3 group-hover:scale-110 transition-transform`}>
                <app.icon className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-800 text-sm">{app.name}</h3>
            </a>
          ))}
        </div>

        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 font-mono">Public Files</h2>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {isFetchingFiles ? (
            <div className="p-8 text-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" />
              Loading files...
            </div>
          ) : fileFetchError ? (
            <div className="p-8 text-center text-red-500">
              <AlertTriangle className="w-6 h-6 mx-auto mb-3" />
              Error loading files: {fileFetchError}
            </div>
          ) : (
            <table className="w-full text-left">
              <tbody className="divide-y divide-slate-100">
                {publicFiles.length === 0 ? (
                  <tr>
                    <td className="px-6 py-4 text-center text-slate-400 italic">No public files found.</td>
                  </tr>
                ) : (
                  publicFiles.map((item) => (
                    <tr key={item.name} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {item.type === 'directory' ? <FolderOpen className="w-5 h-5 text-amber-400" /> : <FileText className="w-5 h-5 text-slate-400" />}
                          <a href={`/public/${item.name}${item.type === 'directory' ? '/' : ''}`} className="text-slate-700 hover:text-blue-600 font-medium">
                            {item.name}{item.type === 'directory' ? '/' : ''}
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* Footer (SDK Loader) */}
      <footer className="fixed bottom-0 w-full bg-white border-t py-2 px-4 text-xs text-gray-500 flex justify-between z-10">
        <div>
          {publicFiles.length} Public Files
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

export default function App() {
  const [pb, setPb] = useState<any>(null);

  useEffect(() => {
    const pbInstance = new PocketBase(PB_URL);
    setPb(pbInstance);
  }, []);

  return (
    <ErrorBoundary>
      {pb ? <PortalAppInner pb={pb} /> : <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>}
    </ErrorBoundary>
  );
}
