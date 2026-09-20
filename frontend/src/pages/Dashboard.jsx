import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { reportsAPI, attendanceAPI } from '../services/api';
import { 
  Users, UserCheck, UserX, BarChart3, 
  Clock, Play, UserPlus, Fingerprint 
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [recentSessions, setRecentSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [summaryRes, sessionsRes] = await Promise.all([
          reportsAPI.getSummary(),
          attendanceAPI.listSessions({ page: 1, page_size: 5 })
        ]);
        setSummary(summaryRes.data.summary);
        setRecentSessions(sessionsRes.data.sessions);
      } catch (error) {
        console.error('Failed to fetch dashboard data', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="p-8 animate-pulse">
        <div className="h-8 bg-slate-800 rounded w-64 mb-8"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-slate-800 rounded-xl"></div>)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Welcome back, {user?.name}</h1>
          <p className="text-slate-400 mt-1">Here's your attendance overview for today.</p>
        </div>
        
        <div className="flex gap-3">
          <Link to="/attendance/live" className="btn btn-primary">
            <Play size={18} />
            Start Session
          </Link>
          <Link to="/students" className="btn btn-secondary hidden sm:flex">
            <UserPlus size={18} />
            Add Student
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard 
          title="Total Students" 
          value={summary?.total_students || 0} 
          icon={<Users className="text-indigo-400" size={24} />} 
          colorClass="indigo"
        />
        <StatCard 
          title="Present Today" 
          value={summary?.present_today || 0} 
          icon={<UserCheck className="text-emerald-400" size={24} />} 
          colorClass="emerald"
        />
        <StatCard 
          title="Absent Today" 
          value={summary?.absent_today || 0} 
          icon={<UserX className="text-rose-400" size={24} />} 
          colorClass="rose"
        />
        <StatCard 
          title="Attendance Rate" 
          value={`${summary?.attendance_percentage || 0}%`} 
          icon={<BarChart3 className="text-cyan-400" size={24} />} 
          colorClass="cyan"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Sessions */}
        <div className="glass-card p-6 lg:col-span-2">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Clock size={20} className="text-indigo-400" />
              Recent Sessions
            </h2>
            <Link to="/attendance/history" className="text-sm text-indigo-400 hover:text-indigo-300">
              View All
            </Link>
          </div>
          
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Classroom</th>
                  <th>Time</th>
                  <th>Recognized</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentSessions.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-8 text-slate-500">
                      No recent sessions found.
                    </td>
                  </tr>
                ) : (
                  recentSessions.map(session => (
                    <tr key={session.id}>
                      <td className="font-medium text-white">{session.subject}</td>
                      <td>{session.classroom}</td>
                      <td>
                        {new Date(session.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </td>
                      <td>{session.total_recognized}</td>
                      <td>
                        <span className={`badge ${session.status === 'completed' ? 'badge-success' : 'badge-warning'}`}>
                          {session.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-white mb-6">Quick Actions</h2>
          <div className="space-y-4">
            <QuickAction 
              to="/attendance/live"
              icon={<Play size={20} className="text-indigo-400" />}
              title="Start Attendance"
              description="Launch face recognition"
            />
            <QuickAction 
              to="/face-registration"
              icon={<Fingerprint size={20} className="text-emerald-400" />}
              title="Register Face"
              description="Enroll new student faces"
            />
            <QuickAction 
              to="/reports"
              icon={<BarChart3 size={20} className="text-cyan-400" />}
              title="Analytics"
              description="View attendance reports"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, colorClass }) {
  return (
    <div className={`glass-card p-6 stat-card ${colorClass}`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-slate-400 mb-1">{title}</p>
          <h3 className="text-3xl font-bold text-white">{value}</h3>
        </div>
        <div className="p-3 bg-slate-800/50 rounded-lg">
          {icon}
        </div>
      </div>
    </div>
  );
}

function QuickAction({ to, icon, title, description }) {
  return (
    <Link 
      to={to} 
      className="flex items-center gap-4 p-4 rounded-xl border border-slate-700/50 bg-slate-800/30 hover:bg-slate-700/50 hover:border-slate-600 transition-colors"
    >
      <div className="p-3 bg-slate-900/50 rounded-lg shrink-0">
        {icon}
      </div>
      <div>
        <h4 className="font-medium text-white mb-0.5">{title}</h4>
        <p className="text-xs text-slate-400">{description}</p>
      </div>
    </Link>
  );
}
