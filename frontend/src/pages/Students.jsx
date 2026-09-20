import { useState, useEffect } from 'react';
import { studentsAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import { Search, Plus, Edit2, Trash2, Fingerprint, X, Loader2 } from 'lucide-react';

export default function Students() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentStudent, setCurrentStudent] = useState(null);
  
  const toast = useToast();

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await studentsAPI.list({ search, department, page: 1, page_size: 50 });
      setStudents(res.data.students);
    } catch (err) {
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchStudents();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [search, department]);

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this student? All face data and attendance records will be lost.')) return;
    
    try {
      await studentsAPI.delete(id);
      toast.success('Student deleted');
      fetchStudents();
    } catch (err) {
      toast.error('Failed to delete student');
    }
  };

  const openEditModal = (student = null) => {
    setCurrentStudent(student || {
      roll_number: '', name: '', department: '', section: '', year: 1, email: '', phone: ''
    });
    setIsModalOpen(true);
  };

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
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by name or roll number..."
              className="input-glass pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select 
            className="input-glass md:w-48"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          >
            <option value="">All Departments</option>
            <option value="Computer Science">Computer Science</option>
            <option value="Electrical Engineering">Electrical Engineering</option>
            <option value="Mechanical Engineering">Mechanical Engineering</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Roll No</th>
                <th>Name</th>
                <th>Department</th>
                <th>Year & Sec</th>
                <th>Face Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-8">
                    <Loader2 className="animate-spin mx-auto text-indigo-500 mb-2" size={24} />
                    <p className="text-slate-400">Loading students...</p>
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-slate-500">
                    No students found.
                  </td>
                </tr>
              ) : (
                students.map(s => (
                  <tr key={s.id}>
                    <td className="font-medium text-white">{s.roll_number}</td>
                    <td>{s.name}</td>
                    <td>{s.department}</td>
                    <td>Yr {s.year} - {s.section}</td>
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
                        <button onClick={() => openEditModal(s)} className="p-2 text-slate-400 hover:text-indigo-400 transition-colors">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => handleDelete(s.id)} className="p-2 text-slate-400 hover:text-rose-400 transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <StudentModal 
          student={currentStudent} 
          onClose={() => setIsModalOpen(false)} 
          onSuccess={() => {
            setIsModalOpen(false);
            fetchStudents();
          }}
        />
      )}
    </div>
  );
}

function StudentModal({ student, onClose, onSuccess }) {
  const [formData, setFormData] = useState(student);
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  const isEditing = !!student.id;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isEditing) {
        await studentsAPI.update(student.id, formData);
        toast.success('Student updated');
      } else {
        await studentsAPI.create(formData);
        toast.success('Student added');
      }
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save student');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content p-6">
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
              <input type="text" required className="input-glass" value={formData.roll_number} onChange={e => setFormData({...formData, roll_number: e.target.value})} disabled={isEditing} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Full Name</label>
              <input type="text" required className="input-glass" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Department</label>
              <input type="text" required className="input-glass" value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Year</label>
                <input type="number" min="1" max="5" required className="input-glass" value={formData.year} onChange={e => setFormData({...formData, year: parseInt(e.target.value)})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Section</label>
                <input type="text" required className="input-glass" value={formData.section} onChange={e => setFormData({...formData, section: e.target.value})} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Email (Optional)</label>
              <input type="email" className="input-glass" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Phone (Optional)</label>
              <input type="text" className="input-glass" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
            </div>
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
