import { useState, useEffect } from 'react';
import { attendanceAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import { History, Search, Edit2, Download } from 'lucide-react';
import { useAcademicMeta } from '../components/ClassSelector';
import { EmptyState, Pagination, StatusBadge, TableSkeleton } from '../components/ui';
import { reportsAPI } from '../services/api';

const PAGE_SIZE = 20;

export default function AttendanceHistory() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [editingId, setEditingId] = useState(null);

  const [date, setDate] = useState('');
  const [subject, setSubject] = useState('');
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

  const filters = { date, subject, year, branch, section, search };

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const params = { page, page_size: PAGE_SIZE };
      for (const [k, v] of Object.entries(filters)) {
        if (v) params[k] = v;
      }
      const res = await attendanceAPI.getHistory(params);
      setRecords(res.data.records);
      setTotal(res.data.total);
    } catch (err) {
      toast.error('Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(fetchRecords, 400);
    return () => clearTimeout(t);
  }, [page, date, subject, year, branch, section, search]);

  useEffect(() => { setPage(1); }, [date, subject, year, branch, section, search]);

  const handleStatusChange = async (id, newStatus) => {
    try {
      await attendanceAPI.updateAttendance(id, { status: newStatus });
      toast.success('Record updated');
      setRecords(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
      setEditingId(null);
    } catch (err) {
      toast.error('Update failed');
    }
  };

  const handleExport = async () => {
    try {
      const params = {};
      for (const [k, v] of Object.entries({ date, subject, year, branch, section })) {
        if (v) params[k] = v;
      }
      const res = await reportsAPI.exportCSV(params);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `attendance_${date || 'export'}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Attendance exported');
    } catch (err) {
      toast.error('Export failed');
    }
  };

  const selectCls = 'input-glass text-sm py-2';
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <History className="text-indigo-400" /> Attendance History
          </h1>
          <p className="text-slate-400 mt-1">Filter records and make manual corrections.</p>
        </div>
        <button onClick={handleExport} className="btn btn-secondary">
          <Download size={18} /> Export Filtered CSV
        </button>
      </div>

      <div className="glass-card p-6">
        {/* Filters */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <input type="date" className={selectCls} value={date} onChange={e => setDate(e.target.value)} />
          <div className="relative">
            <select className={selectCls} value={subject} onChange={e => setSubject(e.target.value)}>
              <option value="">All Subjects</option>
              {(meta.subjects || []).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">▼</span>
          </div>
          <div className="relative">
            <select className={selectCls} value={year} onChange={e => setYear(e.target.value)} disabled={metaLoading}>
              <option value="">All Years</option>
              {years.map(y => <option key={y} value={y}>{ordinal(y)} Year</option>)}
            </select>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">▼</span>
          </div>
          <div className="relative">
            <select className={selectCls} value={branch} onChange={e => setBranch(e.target.value)} disabled={metaLoading}>
              <option value="">All Branches</option>
              {branches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">▼</span>
          </div>
          <div className="relative">
            <select className={selectCls} value={section} onChange={e => setSection(e.target.value)} disabled={metaLoading}>
              <option value="">All Sections</option>
              {sections.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">▼</span>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search student..."
              className={`${selectCls} pl-9`}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Roll No</th>
                <th>Student</th>
                <th>Subject</th>
                <th>Class</th>
                <th>Confidence</th>
                <th>Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSkeleton rows={8} cols={8} />
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan="8">
                    <EmptyState
                      title={hasFilters ? 'No records match your filters' : 'No attendance records yet'}
                      description={hasFilters ? 'Try clearing some filters.' : 'Records will appear here after attendance sessions.'}
                    />
                  </td>
                </tr>
              ) : (
                records.map(record => (
                  <tr key={record.id}>
                    <td>{record.session_date ? new Date(record.session_date).toLocaleDateString() : '—'}</td>
                    <td className="font-medium text-white">{record.student_roll}</td>
                    <td>{record.student_name}</td>
                    <td>{record.subject || '—'}</td>
                    <td className="text-xs">
                      {record.year ? `Y${record.year} ` : ''}{record.branch || ''}{record.section ? `-${record.section}` : ''}
                    </td>
                    <td className="font-mono text-xs">
                      {record.confidence ? `${(record.confidence * 100).toFixed(1)}%` : '—'}
                    </td>
                    <td>
                      {editingId === record.id ? (
                        <select
                          className="bg-slate-800 border border-slate-600 text-white text-sm rounded px-2 py-1 outline-none focus:border-indigo-500"
                          value={record.status}
                          onChange={(e) => handleStatusChange(record.id, e.target.value)}
                          onBlur={() => setEditingId(null)}
                          autoFocus
                        >
                          <option value="present">Present</option>
                          <option value="absent">Absent</option>
                          <option value="late">Late</option>
                        </select>
                      ) : (
                        <StatusBadge status={record.status} />
                      )}
                    </td>
                    <td className="text-right">
                      {editingId !== record.id && (
                        <button
                          onClick={() => setEditingId(record.id)}
                          className="text-slate-400 hover:text-indigo-400 p-1 transition-colors"
                          title="Manual Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination page={page} total={total} pageSize={PAGE_SIZE} onPage={setPage} />
      </div>
    </div>
  );
}
