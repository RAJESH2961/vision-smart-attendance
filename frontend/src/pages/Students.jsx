import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { studentsAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { Search, Plus, Edit2, Trash2, Fingerprint, X, Loader2, ArrowRightLeft, Users } from 'lucide-react';
import { useAcademicMeta } from '../components/ClassSelector';
import { ConfirmDialog, EmptyState, Pagination, TableSkeleton } from '../components/ui';

const PAGE_SIZE = 15;

export default function Students() {
  const [students, setStudents] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [year, setYear] = useState('');
  const [branch, setBranch] = useState('');
  const [section, setSection] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentStudent, setCurrentStudent] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const { meta, loading: metaLoading } = useAcademicMeta();
  const toast = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const years = meta.years.length ? meta.years : [1, 2, 3, 4];
  const branches = meta.branches.length ? meta.branches : ['CSE', 'ECE', 'CSM', 'AIML'];
  const sections = meta.sections.length ? meta.sections : ['A', 'B', 'C'];
  const courses = meta.courses.length ? meta.courses : ['B.Tech', 'M.Tech', 'MBA', 'MCA', 'B.Pharm', 'M.Pharm'];
  const batches = meta.batches.length ? meta.batches : [];

  const ordinal = (y) => {
    const suffix = ['st', 'nd', 'rd', 'th'];
    return `${y}${suffix[Math.min(y, 4) - 1]}`;
  };

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await studentsAPI.list({
        search: search || undefined,
        year: year || undefined,
        branch: branch || undefined,
        section: section || undefined,
        page,
        page_size: PAGE_SIZE,
      });
      setStudents(res.data.students);
      setTotal(res.data.total);
    } catch (err) {
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(fetchStudents, 400);
    return () => clearTimeout(delayDebounceFn);
  }, [search, year, branch, section, page]);

  useEffect(() => { setPage(1); }, [search, year, branch, section]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await studentsAPI.delete(deleteTarget.id);
      toast.success('Student deleted');
      setDeleteTarget(null);
      fetchStudents();
    } catch (err) {
      toast.error('Failed to delete student');
    } finally {
      setDeleting(false);
    }
  };

  const openEditModal = (student = null) => {
    setCurrentStudent(student || {
      roll_number: '', name: '', branch: '', section: '', year: 1, course: '', batch: '', gender: '', email: '', phone: ''
    });
    setIsModalOpen(true);
  };

  const hasFilters = search || year || branch || section;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Students</h1>
          <p className="text-slate-400 mt-1">Manage enrolled students and face data.</p>
        </div>
        <button onClick={() => openEditModal()} className="btn btn-primary">
          <Plus size={18} />
          Add Student
        </button>
      </div>

      <div className="glass-card p-6 mb-8">
        {/* Filters */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="relative col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by name or roll number..."
              className="input-glass pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="relative">
            <select className="input-glass appearance-none pr-8" value={year} onChange={e => setYear(e.target.value)} disabled={metaLoading}>
              <option value="">All Years</option>
              {years.map(y => <option key={y} value={y}>{ordinal(y)} Year</option>)}
            </select>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">▼</span>
          </div>
          <div className="relative">
            <select className="input-glass appearance-none pr-8" value={branch} onChange={e => setBranch(e.target.value)} disabled={metaLoading}>
              <option value="">All Branches</option>
              {branches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">▼</span>
          </div>
          <div className="relative">
            <select className="input-glass appearance-none pr-8" value={section} onChange={e => setSection(e.target.value)} disabled={metaLoading}>
              <option value="">All Sections</option>
              {sections.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">▼</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Roll No</th>
                <th>Name</th>
                <th>Class</th>
                <th>Face Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSkeleton rows={6} cols={5} />
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan="5">
                    <EmptyState
                      icon={<Users size={28} className="text-slate-500" />}
                      title={hasFilters ? 'No students match your filters' : 'No students yet'}
                      description={hasFilters ? 'Try adjusting your search or filters.' : 'Add your first student to get started.'}
                      action={!hasFilters && (
                        <button onClick={() => openEditModal()} className="btn btn-primary btn-sm">
                          <Plus size={16} /> Add Student
                        </button>
                      )}
                    />
                  </td>
                </tr>
              ) : (
                students.map(s => (
                  <tr key={s.id}>
                    <td className="font-medium text-white">{s.roll_number}</td>
                    <td>
                      <Link to={`/students/${s.id}`} className="hover:text-indigo-400 transition-colors">
                        {s.name}
                      </Link>
                      {s.course && <div className="text-xs text-slate-500">{s.course} · {s.batch || `Batch ${s.year}`}</div>}
                    </td>
                    <td>Y{s.year} {s.branch || '—'}-{s.section}</td>
                    <td>
                      {s.face_registered > 0 ? (
                        <span className="badge badge-success flex items-center gap-1 w-max">
                          <Fingerprint size={12} /> Registered
                        </span>
                      ) : (
                        <span className="badge badge-warning flex items-center gap-1 w-max">
                          <Fingerprint size={12} /> Pending
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="flex justify-end gap-2">
                        <Link to={`/face-registration?student=${s.id}`} className="p-2 text-slate-400 hover:text-emerald-400 transition-colors" title="Register face">
                          <Fingerprint size={16} />
                        </Link>
                        <button onClick={() => openEditModal(s)} className="p-2 text-slate-400 hover:text-indigo-400 transition-colors" title="Edit / Move section">
                          <Edit2 size={16} />
                        </button>
                        {isAdmin && (
                          <button onClick={() => setDeleteTarget(s)} className="p-2 text-slate-400 hover:text-rose-400 transition-colors" title="Delete">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination page={page} total={total} pageSize={PAGE_SIZE} onPage={setPage} />
      </div>

      {isModalOpen && (
        <StudentModal
          student={currentStudent}
          meta={meta}
          batches={batches}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            setIsModalOpen(false);
            fetchStudents();
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Student"
        message={`Are you sure you want to delete ${deleteTarget?.name} (${deleteTarget?.roll_number})? All face data and attendance records will be lost.`}
        confirmLabel="Delete Student"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  );
}

function StudentModal({ student, meta, batches, onClose, onSuccess }) {
  const [formData, setFormData] = useState({ ...student, branch: student.branch || '' });
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  const isEditing = !!student.id;
  const branches = meta.branches.length ? meta.branches : ['CSE', 'ECE', 'CSM', 'AIML'];
  const sections = meta.sections.length ? meta.sections : ['A', 'B', 'C'];
  const years = meta.years.length ? meta.years : [1, 2, 3, 4];
  const courses = meta.courses.length ? meta.courses : ['B.Tech', 'M.Tech', 'MBA', 'MCA', 'B.Pharm', 'M.Pharm'];
  const genders = ['Male', 'Female', 'Other'];

  const ordinal = (y) => {
    const suffix = ['st', 'nd', 'rd', 'th'];
    return `${y}${suffix[Math.min(y, 4) - 1]}`;
  };

  const sectionChanged = isEditing && formData.section !== student.section;

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.roll_number?.trim()) {
      toast.error('Roll number is required');
      return;
    }
    if (!formData.name?.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!formData.year) {
      toast.error('Year is required');
      return;
    }
    if (!formData.branch?.trim()) {
      toast.error('Branch is required');
      return;
    }
    if (!formData.section?.trim()) {
      toast.error('Section is required');
      return;
    }

    setSubmitting(true);
    try {
      if (isEditing) {
        await studentsAPI.update(student.id, formData);
        toast.success(sectionChanged ? `Student moved to section ${formData.section}` : 'Student updated');
      } else {
        await studentsAPI.create(formData);
        toast.success('Student added');
      }
      onSuccess();
    } catch (err) {
      const detail = err.response?.data?.detail;
      let errorMsg = 'Failed to save student';
      if (Array.isArray(detail)) {
        errorMsg = detail.map(d => d.msg).join(', ');
      } else if (typeof detail === 'string') {
        errorMsg = detail;
      }
      toast.error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const set = (field) => (e) => setFormData({ ...formData, [field]: e.target.value });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-white">
            {isEditing ? 'Edit Student' : 'Add New Student'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Roll Number</label>
              <input type="text" required className="input-glass" value={formData.roll_number} onChange={set('roll_number')} disabled={isEditing} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Full Name</label>
              <input type="text" required className="input-glass" value={formData.name} onChange={set('name')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Course</label>
              <div className="relative">
                <select className="input-glass appearance-none pr-8" value={formData.course || ''} onChange={set('course')}>
                  <option value="">Select</option>
                  {courses.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">▼</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Batch</label>
              <input list="batch-options" className="input-glass" value={formData.batch || ''} onChange={set('batch')} placeholder="e.g. 2021-2025" />
              <datalist id="batch-options">{batches.map(b => <option key={b} value={b} />)}</datalist>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Year</label>
              <div className="relative">
                <select required className="input-glass appearance-none pr-8" value={formData.year} onChange={e => setFormData({ ...formData, year: parseInt(e.target.value) })}>
                  {years.map(y => <option key={y} value={y}>{ordinal(y)} Year</option>)}
                </select>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">▼</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Branch</label>
              <div className="relative">
                <select required className="input-glass appearance-none pr-8" value={formData.branch} onChange={set('branch')}>
                  <option value="">Select</option>
                  {branches.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">▼</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Section</label>
              <div className="relative">
                <select required className="input-glass appearance-none pr-8" value={formData.section} onChange={set('section')}>
                  <option value="">Select</option>
                  {sections.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">▼</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Gender</label>
              <div className="relative">
                <select className="input-glass appearance-none pr-8" value={formData.gender || ''} onChange={set('gender')}>
                  <option value="">—</option>
                  {genders.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">▼</span>
              </div>
            </div>
          </div>

          {sectionChanged && (
            <div className="text-sm text-cyan-400 flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/20 rounded-lg px-3 py-2">
              <ArrowRightLeft size={14} /> Student will move from section {student.section} to {formData.section}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Email (Optional)</label>
              <input type="email" className="input-glass" value={formData.email || ''} onChange={set('email')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Phone (Optional)</label>
              <input type="text" className="input-glass" value={formData.phone || ''} onChange={set('phone')} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Portal Password {isEditing ? '(leave blank to keep current)' : '(defaults to roll number)'}
            </label>
            <input type="password" className="input-glass" value={formData.password || ''} onChange={set('password')} placeholder={isEditing ? '••••••••' : formData.roll_number || 'Roll number'} />
          </div>

          <div className="flex justify-end gap-3 mt-8">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" size={18} /> : 'Save Student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
