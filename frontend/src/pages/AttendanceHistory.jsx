import { useState, useEffect } from 'react';
import { attendanceAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import { History, Search, Check, X, Edit2, Loader2 } from 'lucide-react';

export default function AttendanceHistory() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  
  const [editingId, setEditingId] = useState(null);
  
  const toast = useToast();

  const fetchRecords = async () => {
    setLoading(true);
    try {
      // For this demo, we'll just fetch today's attendance
      // In a full app, we'd add date pickers to pass range params
      const res = await attendanceAPI.getToday({ page, page_size: 50 });
      setRecords(res.data.records);
      setTotal(res.data.total);
    } catch (err) {
      toast.error('Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [page]);

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

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <History className="text-indigo-400" /> Attendance History
        </h1>
        <p className="text-slate-400 mt-1">View today's records and make manual corrections.</p>
      </div>

      <div className="glass-card p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-white">Today's Records ({total})</h2>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Filter..."
              className="input-glass pl-9 text-sm py-1.5"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Roll No</th>
                <th>Student Name</th>
                <th>Confidence</th>
                <th>Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-8">
                    <Loader2 className="animate-spin mx-auto text-indigo-500 mb-2" size={24} />
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-slate-500">
                    No attendance records for today.
                  </td>
                </tr>
              ) : (
                records.map(record => (
                  <tr key={record.id}>
                    <td>{new Date(record.recognized_at).toLocaleTimeString()}</td>
                    <td className="font-medium text-white">{record.student_roll}</td>
                    <td>{record.student_name}</td>
                    <td className="font-mono text-xs">
                      {record.confidence ? `${(record.confidence * 100).toFixed(1)}%` : '--'}
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
                        <span className={`badge ${
                          record.status === 'present' ? 'badge-success' : 
                          record.status === 'absent' ? 'badge-danger' : 'badge-warning'
                        } capitalize`}>
                          {record.status}
                        </span>
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
      </div>
    </div>
  );
}
