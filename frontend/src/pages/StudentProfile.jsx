import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { studentsAPI, attendanceAPI, reportsAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import { User, Fingerprint, CalendarCheck, CalendarX, Clock, Loader2, ArrowLeft, BookOpen } from 'lucide-react';
import { EmptyState, PercentBadge, StatusBadge } from '../components/ui';

export default function StudentProfile() {
  const { id } = useParams();
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
          studentsAPI.stats(id),
          attendanceAPI.getStudentHistory(id, { page: 1, page_size: 15 }),
          reportsAPI.studentSubjectWise(id),
        ]);
        setStats(statsRes.data);
        setRecords(histRes.data.records);
        setSubjectWise(subjRes.data);
      } catch (err) {
        toast.error('Failed to load student profile');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <Loader2 className="animate-spin text-indigo-500" size={40} />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <EmptyState title="Student not found" action={<Link to="/students" className="btn btn-secondary btn-sm">Back to Students</Link>} />
      </div>
    );
  }

  const { student, total_classes, present, absent, late, attendance_percentage } = stats;

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto animate-fade-in">
      <Link to="/students" className="text-sm text-slate-400 hover:text-white flex items-center gap-1 mb-6 w-max">
        <ArrowLeft size={16} /> Back to Students
      </Link>

      {/* Profile header */}
      <div className="glass-card p-6 mb-6 flex flex-col sm:flex-row sm:items-center gap-6">
        <div className="w-20 h-20 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
          <User size={36} />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">{student.name}</h1>
          <p className="text-slate-400 mt-1">
            {student.roll_number} · {student.course || '—'} · Y{student.year} {student.branch || '—'}-{student.section}
            {student.batch && ` · ${student.batch}`}{student.gender && ` · ${student.gender}`}
          </p>
          {(student.email || student.phone) && (
            <p className="text-sm text-slate-500 mt-1">
              {[student.email, student.phone].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <div className="flex flex-col items-start sm:items-end gap-2">
          {student.face_registered > 0 ? (
            <span className="badge badge-success flex items-center gap-1"><Fingerprint size={12} /> Face Registered</span>
          ) : (
            <span className="badge badge-warning flex items-center gap-1"><Fingerprint size={12} /> Face Pending</span>
          )}
          <Link to={`/face-registration?student=${student.id}`} className="btn btn-secondary btn-sm">
            {student.face_registered > 0 ? 'Re-register Face' : 'Register Face'}
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="glass-card p-5">
          <p className="text-xs text-slate-400 mb-1">Attendance</p>
          <PercentBadge value={attendance_percentage} />
        </div>
        <div className="glass-card p-5">
          <p className="text-xs text-slate-400 mb-1 flex items-center gap-1"><CalendarCheck size={12} /> Total Classes</p>
          <p className="text-2xl font-bold text-white">{total_classes}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs text-slate-400 mb-1">Present</p>
          <p className="text-2xl font-bold text-emerald-400">{present}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs text-slate-400 mb-1 flex items-center gap-1"><CalendarX size={12} /> Absent</p>
          <p className="text-2xl font-bold text-rose-400">{absent}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs text-slate-400 mb-1 flex items-center gap-1"><Clock size={12} /> Late</p>
          <p className="text-2xl font-bold text-amber-400">{late}</p>
        </div>
      </div>

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
              {subjectWise.length === 0 ? (
                <tr>
                  <td colSpan="6">
                    <EmptyState title="No subject-wise data" description="Records will appear here after attendance sessions." />
                  </td>
                </tr>
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

      {/* Recent attendance */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Recent Attendance</h2>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Session</th>
                <th>Time</th>
                <th>Confidence</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan="4">
                    <EmptyState title="No attendance records" description="This student has no attendance history yet." />
                  </td>
                </tr>
              ) : (
                records.map(r => (
                  <tr key={r.id}>
                    <td className="text-slate-400">Session #{r.session_id}</td>
                    <td>{r.recognized_at ? new Date(r.recognized_at).toLocaleString() : '—'}</td>
                    <td className="font-mono text-xs">{r.confidence ? `${(r.confidence * 100).toFixed(1)}%` : '—'}</td>
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
