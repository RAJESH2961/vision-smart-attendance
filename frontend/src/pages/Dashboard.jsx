import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { reportsAPI, attendanceAPI } from '../services/api';
import {
  Users, UserCheck, UserX, BarChart3,
  Clock, Play, UserPlus, BookOpen,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Skeleton, EmptyState } from '../components/ui';

const REFRESH_INTERVAL = 30000; // auto-refresh every 30s

export default function Dashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [recentSessions, setRecentSessions] = useState([]);
  const [todayClasses, setTodayClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const [summaryRes, sessionsRes, todayRes] = await Promise.all([
        reportsAPI.getSummary({ days: 7 }),
        attendanceAPI.listSessions({ page: 1, page_size: 5 }),
        attendanceAPI.listSessions({ page: 1, page_size: 20, date: today }),
      ]);
      setSummary(summaryRes.data.summary);
      setRecentSessions(sessionsRes.data.sessions);
      setTodayClasses(todayRes.data.sessions);
    } catch (error) {
      console.error('Failed to fetch dashboard data', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData(true);
    // Auto-refresh so the dashboard updates after each session
    const interval = setInterval(() => fetchDashboardData(false), REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

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
            Start Attendance
          </Link>
          <Link to="/students" className="btn btn-secondary hidden sm:flex">
            <UserPlus size={18} />
            Register Student
          </Link>
          <Link to="/reports" className="btn btn-secondary hidden sm:flex">
            <BarChart3 size={18} />
            View Reports
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {loading ? (
          [1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)
        ) : (
          <>
            <StatCard title="Total Students" value={summary?.total_students || 0} icon={<Users className="text-indigo-400" size={24} />} colorClass="indigo" />
            <StatCard title="Present Today" value={summary?.present_today || 0} icon={<UserCheck className="text-emerald-400" size={24} />} colorClass="emerald" />
            <StatCard title="Absent Today" value={summary?.absent_today || 0} icon={<UserX className="text-rose-400" size={24} />} colorClass="rose" />
            <StatCard title="Attendance Rate" value={`${summary?.attendance_percentage || 0}%`} icon={<BarChart3 className="text-cyan-400" size={24} />} colorClass="cyan" />
          </>
        )}
      </div>

      {/* Today's Classes */}
      <div className="glass-card p-6 mb-6">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
          <BookOpen size={20} className="text-cyan-400" />
          Today's Classes ({todayClasses.length})
        </h2>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : todayClasses.length === 0 ? (
          <p className="text-sm text-slate-500">No classes held today yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {todayClasses.map(s => (
              <div key={s.id} className="p-4 rounded-xl border border-slate-700/50 bg-slate-800/30">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium text-white">{s.subject}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {s.classroom}
                      {s.year ? ` · Y${s.year}` : ''}{s.branch ? ` ${s.branch}` : ''}{s.section ? `-${s.section}` : ''}
                    </p>
                  </div>
                  <span className={`badge ${s.status === 'completed' ? 'badge-success' : s.status === 'running' ? 'badge-info' : 'badge-warning'}`}>
                    {s.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {new Date(s.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {' · '}{s.total_recognized}/{s.total_students || '?'} present
                </p>
              </div>
            ))}
          </div>
        )}
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
                  <th>Class</th>
                  <th>Time</th>
                  <th>Present</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="5"><Skeleton className="h-6 w-full" /></td></tr>
                ) : recentSessions.length === 0 ? (
                  <tr>
                    <td colSpan="5">
                      <EmptyState title="No sessions yet" description="Start your first attendance session to see it here." />
                    </td>
                  </tr>
                ) : (
                  recentSessions.map(session => (
                    <tr key={session.id}>
                      <td className="font-medium text-white">{session.subject}</td>
                      <td>
                        {session.year ? `Y${session.year} ` : ''}{session.branch || ''}{session.section ? `-${session.section}` : ''}
                        <span className="text-slate-500 text-xs block">{session.classroom}</span>
                      </td>
                      <td>{new Date(session.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                      <td>{session.total_recognized}/{session.total_students || '?'}</td>
                      <td>
                        <span className={`badge ${session.status === 'completed' ? 'badge-success' : session.status === 'running' ? 'badge-info' : 'badge-warning'}`}>
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
            <QuickAction to="/attendance/live" icon={<Play size={20} className="text-indigo-400" />} title="Start Attendance" description="Launch face recognition" />
            <QuickAction to="/students" icon={<UserPlus size={20} className="text-emerald-400" />} title="Register Student" description="Add a new student" />
            <QuickAction to="/reports" icon={<BarChart3 size={20} className="text-cyan-400" />} title="View Reports" description="Analytics & exports" />
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
