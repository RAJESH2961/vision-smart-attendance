import { useState, useEffect } from 'react';
import { subjectsAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import { BookOpen, Plus, X, Loader2, Trash2, Edit2 } from 'lucide-react';
import { EmptyState, TableSkeleton } from '../components/ui';

const COURSES = ['B.Tech', 'M.Tech', 'MBA', 'MCA', 'B.Pharm', 'M.Pharm'];
const BRANCHES = ['CSE', 'ECE', 'EEE', 'CSM', 'AIML', 'DS', 'IT', 'MECH', 'CIVIL'];

export default function Subjects() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const res = await subjectsAPI.list({ page_size: 500 });
      setSubjects(res.data.subjects);
    } catch {
      toast.error('Failed to load subjects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this subject?')) return;
    try {
      await subjectsAPI.delete(id);
      toast.success('Subject deleted');
      load();
    } catch {
      toast.error('Failed to delete subject');
    }
  };

  const openEdit = (s) => { setEditing(s); setIsModalOpen(true); };
  const openCreate = () => { setEditing(null); setIsModalOpen(true); };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BookOpen className="text-indigo-400" /> Subjects
          </h1>
          <p className="text-slate-400 mt-1">Configure courses/subjects for attendance sessions.</p>
        </div>
        <button onClick={openCreate} className="btn btn-primary">
          <Plus size={18} /> Add Subject
        </button>
      </div>

      <div className="glass-card p-6">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Course</th>
                <th>Branch</th>
                <th>Year</th>
                <th>Semester</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <TableSkeleton rows={5} cols={7} /> : subjects.length === 0 ? (
                <tr><td colSpan="7"><EmptyState title="No subjects configured" description="Add subjects before starting attendance." /></td></tr>
              ) : subjects.map(s => (
                <tr key={s.id}>
                  <td className="font-medium text-white">{s.code}</td>
                  <td>{s.name}</td>
                  <td>{s.course || '—'}</td>
                  <td>{s.branch || '—'}</td>
                  <td>{s.year || '—'}</td>
                  <td>{s.semester || '—'}</td>
                  <td className="text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openEdit(s)} className="p-2 text-slate-400 hover:text-indigo-400"><Edit2 size={16} /></button>
                      <button onClick={() => handleDelete(s.id)} className="p-2 text-slate-400 hover:text-rose-400"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <SubjectModal
          subject={editing}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => { setIsModalOpen(false); load(); }}
        />
      )}
    </div>
  );
}

function SubjectModal({ subject, onClose, onSuccess }) {
  const [form, setForm] = useState(subject || { code: '', name: '', course: '', branch: '', year: '', semester: '' });
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const data = {
        ...form,
        year: form.year ? Number(form.year) : null,
        semester: form.semester ? Number(form.semester) : null,
      };
      if (subject) await subjectsAPI.update(subject.id, data);
      else await subjectsAPI.create(data);
      toast.success(subject ? 'Subject updated' : 'Subject created');
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save subject');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-white">{subject ? 'Edit Subject' : 'Add Subject'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Subject Code</label>
              <input required disabled={!!subject} className="input-glass" value={form.code} onChange={set('code')} placeholder="CS-101" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Subject Name</label>
              <input required className="input-glass" value={form.name} onChange={set('name')} placeholder="Data Structures" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Course</label>
              <input list="course-opts" className="input-glass" value={form.course} onChange={set('course')} placeholder="B.Tech" />
              <datalist id="course-opts">{COURSES.map(c => <option key={c} value={c} />)}</datalist>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Branch</label>
              <input list="branch-opts" className="input-glass" value={form.branch} onChange={set('branch')} placeholder="CSE" />
              <datalist id="branch-opts">{BRANCHES.map(b => <option key={b} value={b} />)}</datalist>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Year</label>
              <input type="number" min="1" max="5" className="input-glass" value={form.year} onChange={set('year')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Semester</label>
              <input type="number" min="1" max="8" className="input-glass" value={form.semester} onChange={set('semester')} />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" size={18} /> : 'Save Subject'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
