import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Loader2 } from 'lucide-react';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import FaceRegistration from './pages/FaceRegistration';
import AttendanceLive from './pages/AttendanceLive';
import AttendanceHistory from './pages/AttendanceHistory';
import Reports from './pages/Reports';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
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
  
  return children;
};

// Helper component for navigation links using SPA routing
const NavLink = ({ to, children }) => {
  const location = useLocation();
  const isActive = location.pathname === to || 
                  (to !== '/' && location.pathname.startsWith(to));
  return (
    <Link 
      to={to}
      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
        isActive 
          ? 'bg-slate-800 text-white' 
          : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
      }`}
    >
      {children}
    </Link>
  );
};

// Top navigation layout for protected routes
const AppLayout = ({ children }) => {
  const { logout, user } = useAuth();
  
  return (
    <div className="min-h-screen bg-slate-900 text-slate-200">
      <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-8">
              <span className="text-xl font-bold text-white flex items-center gap-2">
                <div className="w-8 h-8 rounded bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-extrabold text-sm">SA</div>
                SmartAttendance
              </span>
              
              <div className="hidden md:flex gap-1">
                <NavLink to="/">Dashboard</NavLink>
                <NavLink to="/students">Students</NavLink>
                <NavLink to="/face-registration">Face Auth</NavLink>
                <NavLink to="/attendance/live">Live Session</NavLink>
                <NavLink to="/attendance/history">History</NavLink>
                <NavLink to="/reports">Reports</NavLink>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-400 hidden sm:block">{user?.name}</span>
              <button onClick={logout} className="text-sm text-rose-400 hover:text-rose-300 font-medium">Logout</button>
            </div>
          </div>
        </div>
      </nav>
      
      <main className="pb-12">
        {children}
      </main>
    </div>
  );
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route path="/" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
        <Route path="/students" element={<ProtectedRoute><AppLayout><Students /></AppLayout></ProtectedRoute>} />
        <Route path="/face-registration" element={<ProtectedRoute><AppLayout><FaceRegistration /></AppLayout></ProtectedRoute>} />
        <Route path="/attendance/live" element={<ProtectedRoute><AppLayout><AttendanceLive /></AppLayout></ProtectedRoute>} />
        <Route path="/attendance/history" element={<ProtectedRoute><AppLayout><AttendanceHistory /></AppLayout></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><AppLayout><Reports /></AppLayout></ProtectedRoute>} />
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
