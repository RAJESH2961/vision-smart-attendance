import { useState, useEffect } from 'react';
import { reportsAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import { BarChart3, Download, TrendingUp, Users, Loader2 } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function Reports() {
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

  const handleExport = async () => {
    try {
      const res = await reportsAPI.exportCSV();
      
      // Create blob link to download
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `attendance_report_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      
      toast.success('Report exported successfully');
    } catch (err) {
      toast.error('Failed to export report');
    }
  };

  if (loading && !data) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="animate-spin text-indigo-500" size={40} />
      </div>
    );
  }

  const { summary, daily_trend, department_wise, top_absentees } = data;

  const COLORS = ['#10b981', '#f43f5e', '#f59e0b', '#06b6d4', '#6366f1'];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="text-cyan-400" /> Analytics & Reports
          </h1>
          <p className="text-slate-400 mt-1">Comprehensive view of attendance data.</p>
        </div>
        
        <div className="flex gap-4">
          <select 
            className="input-glass"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value="7">Last 7 Days</option>
            <option value="30">Last 30 Days</option>
            <option value="90">Last 90 Days</option>
          </select>
          
          <button onClick={handleExport} className="btn btn-primary">
            <Download size={18} /> Export CSV
          </button>
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="glass-card p-6 border-t-4 border-indigo-500">
          <h3 className="text-sm font-medium text-slate-400 mb-1">Total Classes</h3>
          <p className="text-3xl font-bold text-white">{summary.total_sessions}</p>
        </div>
        <div className="glass-card p-6 border-t-4 border-emerald-500">
          <h3 className="text-sm font-medium text-slate-400 mb-1">Avg Attendance Rate</h3>
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
        {/* Daily Trend Line Chart */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <TrendingUp size={20} className="text-indigo-400" /> Daily Attendance Trend
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={daily_trend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="date" stroke="#94a3b8" tick={{fontSize: 12}} tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, {month:'short', day:'numeric'})} />
                <YAxis stroke="#94a3b8" tick={{fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Legend />
                <Line type="monotone" dataKey="present" name="Present" stroke="#10b981" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} />
                <Line type="monotone" dataKey="absent" name="Absent" stroke="#f43f5e" strokeWidth={3} dot={{r: 4}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Department Bar Chart */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <Users size={20} className="text-cyan-400" /> Department Comparison
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={department_wise} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="department" stroke="#94a3b8" tick={{fontSize: 12}} />
                <YAxis stroke="#94a3b8" tick={{fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px' }}
                  cursor={{fill: '#334155', opacity: 0.4}}
                />
                <Legend />
                <Bar dataKey="present" name="Present" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} />
                <Bar dataKey="absent" name="Absent" stackId="a" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Absentees Table */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-white mb-6">Attention Required (Top Absentees)</h3>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Roll No</th>
                <th>Department</th>
                <th>Classes Attended</th>
                <th>Absence Rate</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {top_absentees.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-slate-500">
                    No data available yet.
                  </td>
                </tr>
              ) : (
                top_absentees.map((student, i) => (
                  <tr key={i}>
                    <td className="font-medium text-white">{student.student_name}</td>
                    <td>{student.roll_number}</td>
                    <td>{student.department}</td>
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
    </div>
  );
}
