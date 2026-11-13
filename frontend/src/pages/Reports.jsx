import { useState, useEffect, useCallback } from 'react';
import { reportsAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import { BarChart3, Download, TrendingUp, Users, Loader2, CalendarDays } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';
import { useAcademicMeta } from '../components/ClassSelector';
import { EmptyState, PercentBadge, Skeleton, TableSkeleton } from '../components/ui';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'student', label: 'Student-wise' },
  { id: 'section', label: 'Section-wise' },
  { id: 'branch', label: 'Branch-wise' },
  { id: 'subject', label: 'Subject-wise' },
];

const pctColor = (v) => (v >= 75 ? '#10b981' : v >= 50 ? '#f59e0b' : '#f43f5e');

export default function Reports() {
  const [tab, setTab] = useState('overview');
  const toast = useToast();

  const handleExport = async (params = {}) => {
    try {
      const res = await reportsAPI.exportCSV(params);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `attendance_report_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Report exported successfully');
    } catch (err) {
      toast.error('Failed to export report');
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="text-cyan-400" /> Analytics & Reports
          </h1>
          <p className="text-slate-400 mt-1">Comprehensive view of attendance data.</p>
        </div>
        <button onClick={() => handleExport()} className="btn btn-primary">
          <Download size={18} /> Export All CSV
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-800 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t.id
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab />}
      {tab === 'student' && <StudentWiseTab onExport={handleExport} />}
      {tab === 'section' && <GroupTab title="Section-wise" fetcher={reportsAPI.sectionWise} />}
      {tab === 'branch' && <GroupTab title="Branch-wise" fetcher={reportsAPI.branchWise} />}
      {tab === 'subject' && <GroupTab title="Subject-wise" fetcher={reportsAPI.subjectWise} />}
    </div>
  );
}

function OverviewTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const toast = useToast();

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      try {
        const res = await reportsAPI.getSummary({ days });
        setData(res.data);
      } catch (err) {
        toast.error('Failed to load reports');
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, [days]);

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  const { summary, daily_trend, monthly_trend, branch_wise, section_wise, top_absentees } = data;

  const tooltipStyle = {
    contentStyle: { backgroundColor: 'var(--app-bg-secondary)', borderColor: 'var(--app-border)', borderRadius: '8px' },
    itemStyle: { color: 'var(--app-text)' },
  };

  return (
    <>
      <div className="flex justify-end mb-4">
        <select className="input-glass w-44" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value="7">Last 7 Days</option>
          <option value="30">Last 30 Days</option>
          <option value="90">Last 90 Days</option>
        </select>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="glass-card p-6 border-t-4 border-indigo-500">
          <h3 className="text-sm font-medium text-slate-400 mb-1">Total Classes</h3>
          <p className="text-3xl font-bold text-white">{summary.total_sessions}</p>
        </div>
        <div className="glass-card p-6 border-t-4 border-emerald-500">
          <h3 className="text-sm font-medium text-slate-400 mb-1">Today's Rate</h3>
          <p className="text-3xl font-bold text-emerald-400">{summary.attendance_percentage}%</p>
        </div>
        <div className="glass-card p-6 border-t-4 border-cyan-500">
          <h3 className="text-sm font-medium text-slate-400 mb-1">Total Students</h3>
          <p className="text-3xl font-bold text-white">{summary.total_students}</p>
        </div>
        <div className="glass-card p-6 border-t-4 border-amber-500">
          <h3 className="text-sm font-medium text-slate-400 mb-1">Classes Today</h3>
          <p className="text-3xl font-bold text-white">{summary.total_classes_today}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Daily Trend */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <TrendingUp size={20} className="text-indigo-400" /> Daily Attendance
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={daily_trend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 12 }} tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} />
                <Tooltip {...tooltipStyle} />
                <Legend />
                <Line type="monotone" dataKey="present" name="Present" stroke="#10b981" strokeWidth={3} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="absent" name="Absent" stroke="#f43f5e" strokeWidth={3} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Trend */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <CalendarDays size={20} className="text-cyan-400" /> Monthly Attendance %
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly_trend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="month" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} domain={[0, 100]} />
                <Tooltip {...tooltipStyle} cursor={{ fill: '#334155', opacity: 0.4 }} />
                <Bar dataKey="percentage" name="Attendance %" radius={[4, 4, 0, 0]}>
                  {monthly_trend.map((m, i) => <Cell key={i} fill={pctColor(m.percentage)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Section-wise % */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <Users size={20} className="text-indigo-400" /> Attendance % by Section
          </h3>
          <div className="h-72">
            {section_wise.length === 0 ? (
              <EmptyState title="No data yet" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={section_wise} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} domain={[0, 100]} />
                  <Tooltip {...tooltipStyle} cursor={{ fill: '#334155', opacity: 0.4 }} />
                  <Bar dataKey="percentage" name="Attendance %" radius={[4, 4, 0, 0]}>
                    {section_wise.map((s, i) => <Cell key={i} fill={pctColor(s.percentage)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Branch-wise % */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <Users size={20} className="text-cyan-400" /> Attendance % by Branch
          </h3>
          <div className="h-72">
            {branch_wise.length === 0 ? (
              <EmptyState title="No data yet" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={branch_wise} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} domain={[0, 100]} />
                  <Tooltip {...tooltipStyle} cursor={{ fill: '#334155', opacity: 0.4 }} />
                  <Bar dataKey="percentage" name="Attendance %" radius={[4, 4, 0, 0]}>
                    {branch_wise.map((b, i) => <Cell key={i} fill={pctColor(b.percentage)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Top Absentees */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-white mb-6">Attention Required (Top Absentees)</h3>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Roll No</th>
                <th>Branch</th>
                <th>Classes Attended</th>
                <th>Absence Rate</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {top_absentees.length === 0 ? (
                <tr><td colSpan="6"><EmptyState title="No data available yet" /></td></tr>
              ) : (
                top_absentees.map((student) => (
                  <tr key={student.student_id}>
                    <td className="font-medium text-white">{student.student_name}</td>
                    <td>{student.roll_number}</td>
                    <td>{student.branch || '—'}</td>
                    <td>{student.total_classes - student.total_absent} / {student.total_classes}</td>
                    <td className="text-rose-400 font-bold">{student.absence_percentage}%</td>
                    <td>
                      <span className={`badge ${student.absence_percentage > 50 ? 'badge-danger' : 'badge-warning'}`}>
                        {student.absence_percentage > 50 ? 'Critical' : 'Warning'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function StudentWiseTab({ onExport }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState('');
  const [branch, setBranch] = useState('');
  const [section, setSection] = useState('');
  const [search, setSearch] = useState('');
  const { meta, loading: metaLoading } = useAcademicMeta();
  const toast = useToast();

  const years = meta.years.length ? meta.years : [1, 2, 3, 4];
  const branches = meta.branches.length ? meta.branches : ['CSE', 'ECE', 'CSM', 'AIML'];
  const sections = meta.sections.length ? meta.sections : ['A', 'B', 'C'];

  const ordinal = (y) => {
    const suffix = ['st', 'nd', 'rd', 'th'];
    return `${y}${suffix[Math.min(y, 4) - 1]}`;
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (year) params.year = year;
      if (branch) params.branch = branch;
      if (section) params.section = section;
      const res = await reportsAPI.studentWise(params);
      setRows(res.data);
    } catch {
      toast.error('Failed to load student report');
    } finally {
      setLoading(false);
    }
  }, [year, branch, section]);

  useEffect(() => { load(); }, [load]);

  const filtered = search
    ? rows.filter(r => r.student_name.toLowerCase().includes(search.toLowerCase()) || r.roll_number.toLowerCase().includes(search.toLowerCase()))
    : rows;

  return (
    <div className="glass-card p-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div className="relative">
          <select className="input-glass text-sm py-2 appearance-none pr-8" value={year} onChange={e => setYear(e.target.value)} disabled={metaLoading}>
            <option value="">All Years</option>
            {years.map(y => <option key={y} value={y}>{ordinal(y)} Year</option>)}
          </select>
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs">▼</span>
        </div>
        <div className="relative">
          <select className="input-glass text-sm py-2 appearance-none pr-8" value={branch} onChange={e => setBranch(e.target.value)} disabled={metaLoading}>
            <option value="">All Branches</option>
            {branches.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs">▼</span>
        </div>
        <div className="relative">
          <select className="input-glass text-sm py-2 appearance-none pr-8" value={section} onChange={e => setSection(e.target.value)} disabled={metaLoading}>
            <option value="">All Sections</option>
            {sections.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs">▼</span>
        </div>
        <input type="text" placeholder="Search..." className="input-glass text-sm py-2" value={search} onChange={e => setSearch(e.target.value)} />
        <button onClick={() => onExport({ year, branch, section })} className="btn btn-secondary btn-sm">
          <Download size={16} /> CSV
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Roll No</th>
              <th>Student</th>
              <th>Class</th>
              <th>Present</th>
              <th>Absent</th>
              <th>Late</th>
              <th>Attendance</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton rows={8} cols={7} />
            ) : filtered.length === 0 ? (
              <tr><td colSpan="7"><EmptyState title="No students found" /></td></tr>
            ) : (
              filtered.map(r => (
                <tr key={r.student_id}>
                  <td className="font-medium text-white">{r.roll_number}</td>
                  <td>{r.student_name}</td>
                  <td className="text-xs">{r.year ? `Y${r.year} ` : ''}{r.branch || ''}{r.section ? `-${r.section}` : ''}</td>
                  <td className="text-emerald-400">{r.present}</td>
                  <td className="text-rose-400">{r.absent}</td>
                  <td className="text-amber-400">{r.late}</td>
                  <td><PercentBadge value={r.percentage} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GroupTab({ title, fetcher }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    fetcher()
      .then(res => setRows(res.data))
      .catch(() => toast.error(`Failed to load ${title.toLowerCase()} report`))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="glass-card p-6">
      <h3 className="text-lg font-semibold text-white mb-6">{title} Attendance</h3>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>{title.split('-')[0]}</th>
              <th>Present</th>
              <th>Absent</th>
              <th>Late</th>
              <th>Total Records</th>
              <th>Attendance</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton rows={5} cols={6} />
            ) : rows.length === 0 ? (
              <tr><td colSpan="6"><EmptyState title="No data available" /></td></tr>
            ) : (
              rows.map(r => (
                <tr key={r.name}>
                  <td className="font-medium text-white">{r.name}</td>
                  <td className="text-emerald-400">{r.present}</td>
                  <td className="text-rose-400">{r.absent}</td>
                  <td className="text-amber-400">{r.late}</td>
                  <td>{r.total}</td>
                  <td><PercentBadge value={r.percentage} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
