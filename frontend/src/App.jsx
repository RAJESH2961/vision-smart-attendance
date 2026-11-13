import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';
import {
  Loader2, LayoutDashboard, Users, Fingerprint, Video,
  History, BarChart3, Sun, Moon, LogOut, ScanFace, ShieldCheck, GraduationCap,
  BookOpen,
} from 'lucide-react';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import StudentProfile from './pages/StudentProfile';
import StudentHome from './pages/StudentHome';
import UsersPage from './pages/Users';
import Subjects from './pages/Subjects';
import FaceRegistration from './pages/FaceRegistration';
import AttendanceLive from './pages/AttendanceLive';
import AttendanceHistory from './pages/AttendanceHistory';
import Reports from './pages/Reports';
import { Breadcrumbs } from './components/ui';

const ProtectedRoute = ({ children, roles }) => {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user?.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true, roles: ['admin', 'faculty'] },
  { to: '/', icon: GraduationCap, label: 'My Attendance', exact: true, roles: ['student'] },
  { to: '/students', icon: Users, label: 'Students', roles: ['admin', 'faculty'] },
  { to: '/face-registration', icon: Fingerprint, label: 'Face Registration', roles: ['admin', 'faculty'] },
  { to: '/attendance/live', icon: Video, label: 'Live Attendance', roles: ['admin', 'faculty'] },
  { to: '/attendance/history', icon: History, label: 'History', roles: ['admin', 'faculty'] },
  { to: '/reports', icon: BarChart3, label: 'Reports', roles: ['admin', 'faculty'] },
  { to: '/subjects', icon: BookOpen, label: 'Subjects', roles: ['admin', 'faculty'] },
  { to: '/users', icon: ShieldCheck, label: 'Staff Accounts', roles: ['admin'] },
];

const SideLink = ({ to, icon: Icon, label, exact }) => {
  const location = useLocation();
  const isActive = exact
    ? location.pathname === to
    : location.pathname === to || location.pathname.startsWith(to + '/');
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        isActive
          ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
          : 'text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent'
      }`}
    >
      <Icon size={18} />
      <span className="hidden lg:inline">{label}</span>
    </Link>
  );
};

const ROLE_BADGE = {
  admin: 'badge-info',
  faculty: 'badge-success',
  student: 'badge-warning',
};

// Sidebar layout for protected routes
const AppLayout = ({ children }) => {
  const { logout, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const role = user?.role || 'faculty';
  const navItems = NAV_ITEMS.filter(item => item.roles.includes(role));

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 flex">
      {/* Sidebar */}
      <aside className="w-16 lg:w-60 shrink-0 border-r border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 h-screen flex flex-col">
        <div className="h-16 flex items-center gap-2 px-4 border-b border-slate-800">
          <div className="w-8 h-8 rounded bg-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
            <ScanFace size={18} />
          </div>
          <span className="text-lg font-bold text-white hidden lg:block">VisionAttend</span>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(item => <SideLink key={item.label} {...item} />)}
        </nav>

        <div className="p-3 border-t border-slate-800 space-y-1">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/60 w-full transition-colors"
            title="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            <span className="hidden lg:inline">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-rose-400 hover:bg-rose-500/10 w-full transition-colors"
          >
            <LogOut size={18} />
            <span className="hidden lg:inline">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <header className="h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-40 flex items-center justify-between px-4 md:px-8">
          <Breadcrumbs />
          <div className="flex items-center gap-3">
            <span className={`badge ${ROLE_BADGE[role]} capitalize hidden sm:inline-flex`}>{role}</span>
            <span className="text-sm text-slate-400 hidden sm:block">{user?.name}</span>
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-sm font-bold">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
          </div>
        </header>
        <main className="pb-12">
          {children}
        </main>
      </div>
    </div>
  );
};

// Home route renders different pages by role
const HomeRoute = () => {
  const { user } = useAuth();
  return user?.role === 'student' ? <StudentHome /> : <Dashboard />;
};

function App() {
  const staff = ['admin', 'faculty'];
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/" element={<ProtectedRoute><AppLayout><HomeRoute /></AppLayout></ProtectedRoute>} />
        <Route path="/students" element={<ProtectedRoute roles={staff}><AppLayout><Students /></AppLayout></ProtectedRoute>} />
        <Route path="/students/:id" element={<ProtectedRoute roles={staff}><AppLayout><StudentProfile /></AppLayout></ProtectedRoute>} />
        <Route path="/face-registration" element={<ProtectedRoute roles={staff}><AppLayout><FaceRegistration /></AppLayout></ProtectedRoute>} />
        <Route path="/attendance/live" element={<ProtectedRoute roles={staff}><AppLayout><AttendanceLive /></AppLayout></ProtectedRoute>} />
        <Route path="/attendance/history" element={<ProtectedRoute roles={staff}><AppLayout><AttendanceHistory /></AppLayout></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute roles={staff}><AppLayout><Reports /></AppLayout></ProtectedRoute>} />
        <Route path="/subjects" element={<ProtectedRoute roles={['admin', 'faculty']}><AppLayout><Subjects /></AppLayout></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute roles={['admin']}><AppLayout><UsersPage /></AppLayout></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
