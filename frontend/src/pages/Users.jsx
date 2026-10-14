import { useState, useEffect } from 'react';
import { authAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import { ShieldCheck, Plus, X, Loader2 } from 'lucide-react';
import { EmptyState, TableSkeleton } from '../components/ui';

export default function Users() {
  const [faculty, setFaculty] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const res = await authAPI.listFaculty();
      setFaculty(res.data);
    } catch {
      toast.error('Failed to load staff accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="text-indigo-400" /> Staff Accounts
          </h1>
          <p className="text-slate-400 mt-1">Manage admin and faculty logins.</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="btn btn-primary">
          <Plus size={18} /> Add Staff
        </button>
      </div>

      <div className="glass-card p-6">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Department</th>
                <th>Role</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSkeleton rows={4} cols={5} />
              ) : faculty.length === 0 ? (
                <tr><td colSpan="5"><EmptyState title="No staff accounts" /></td></tr>
              ) : (
                faculty.map(f => (
                  <tr key={f.id}>
                    <td className="font-medium text-white">{f.name}</td>
                    <td>{f.email}</td>
                    <td>{f.department || '—'}</td>
                    <td>
                      <span className={`badge ${f.role === 'admin' ? 'badge-info' : 'badge-success'} capitalize`}>
                        {f.role}
                      </span>
                    </td>
                    <td className="text-xs">{f.created_at ? new Date(f.created_at).toLocaleDateString() : '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <StaffModal
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => { setIsModalOpen(false); load(); }}
        />
      )}
    </div>
  );
}

function StaffModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'faculty', department: '' });
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await authAPI.createFaculty({ ...form, department: form.department || null });
      toast.success('Staff account created');
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create account');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-white">Add Staff Account</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Name</label>
              <input required className="input-glass" value={form.name} onChange={set('name')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
              <input type="email" required className="input-glass" value={form.email} onChange={set('email')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Role</label>
              <select className="input-glass" value={form.role} onChange={set('role')}>
                <option value="faculty">Faculty</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Department</label>
              <input className="input-glass" value={form.department} onChange={set('department')} placeholder="e.g. CSE" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
            <input type="password" required minLength={6} className="input-glass" value={form.password} onChange={set('password')} />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" size={18} /> : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
