import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { studentsAPI, attendanceAPI, reportsAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import { CalendarCheck, CalendarX, Clock, GraduationCap, BookOpen } from 'lucide-react';
import { EmptyState, PercentBadge, StatusBadge, TableSkeleton } from '../components/ui';

export default function StudentHome() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [records, setRecords] = useState([]);
  const [subjectWise, setSubjectWise] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [statsRes, histRes, subjRes] = await Promise.all([
          studentsAPI.stats(user.id),
          attendanceAPI.getMyHistory({ page: 1, page_size: 20 }),
          reportsAPI.studentSubjectWise(user.id),
        ]);
        setStats(statsRes.data);
        setRecords(histRes.data.records);
        setSubjectWise(subjRes.data);
      } catch (err) {
        toast.error('Failed to load your attendance');
      } finally {
        setLoading(false);
      }
    };
    if (user?.id) load();
  }, [user?.id]);

  const present = stats?.present || 0;
  const absent = stats?.absent || 0;
  const late = stats?.late || 0;
  const pct = stats?.attendance_percentage || 0;

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <GraduationCap className="text-indigo-400" /> My Attendance
        </h1>
        <p className="text-slate-400 mt-1">
          {user?.name} · {user?.roll_number}
          {user?.year ? ` · Y${user.year}` : ''}{user?.branch ? ` ${user.branch}` : ''}{user?.section ? `-${user.section}` : ''}
        </p>
      </div>

      {/* Attendance summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="glass-card p-6 col-span-2 lg:col-span-1 flex flex-col items-center justify-center">
          <p className="text-xs text-slate-400 mb-2">Overall Attendance</p>
          <div className="text-4xl font-extrabold mb-2" style={{ color: pct >= 75 ? '#34d399' : pct >= 50 ? '#fbbf24' : '#fb7185' }}>
            {pct}%
          </div>
          <PercentBadge value={pct} />
        </div>
        <div className="glass-card p-6">
          <p className="text-xs text-slate-400 mb-1 flex items-center gap-1"><CalendarCheck size={12} /> Present</p>
          <p className="text-3xl font-bold text-emerald-400">{present}</p>
        </div>
        <div className="glass-card p-6">
          <p className="text-xs text-slate-400 mb-1 flex items-center gap-1"><CalendarX size={12} /> Absent</p>
          <p className="text-3xl font-bold text-rose-400">{absent}</p>
        </div>
        <div className="glass-card p-6">
          <p className="text-xs text-slate-400 mb-1 flex items-center gap-1"><Clock size={12} /> Late</p>
          <p className="text-3xl font-bold text-amber-400">{late}</p>
        </div>
      </div>

      {pct > 0 && pct < 75 && (
        <div className="glass-card p-4 mb-6 border-amber-500/30 bg-amber-500/5 text-amber-400 text-sm">
          Your attendance is below 75%. Attend more classes to avoid shortage.
        </div>
      )}

      {/* Subject-wise attendance */}
      <div className="glass-card p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <BookOpen size={18} className="text-cyan-400" /> Subject-wise Attendance
        </h2>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Present</th>
                <th>Absent</th>
                <th>Late</th>
                <th>Total</th>
                <th>Attendance</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSkeleton rows={4} cols={6} />
              ) : subjectWise.length === 0 ? (
                <tr><td colSpan="6"><EmptyState title="No subject-wise data yet" /></td></tr>
              ) : (
                subjectWise.map(s => (
                  <tr key={s.subject}>
                    <td className="font-medium text-white">{s.subject}</td>
                    <td className="text-emerald-400">{s.present}</td>
                    <td className="text-rose-400">{s.absent}</td>
                    <td className="text-amber-400">{s.late}</td>
                    <td>{s.total}</td>
                    <td><PercentBadge value={s.percentage} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Records */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Attendance Records</h2>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Session</th>
                <th>Time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSkeleton rows={6} cols={3} />
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan="3">
                    <EmptyState title="No attendance records" description="Your attendance records will appear here after classes." />
                  </td>
                </tr>
              ) : (
                records.map(r => (
                  <tr key={r.id}>
                    <td className="text-slate-400">Session #{r.session_id}</td>
                    <td>{r.recognized_at ? new Date(r.recognized_at).toLocaleString() : '—'}</td>
                    <td><StatusBadge status={r.status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
