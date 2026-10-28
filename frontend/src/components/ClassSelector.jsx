/**
 * Cascading Year → Branch → Section selector fed by /api/students/meta.
 * value = { year, branch, section } — onChange receives the whole object.
 */

import { useState, useEffect } from 'react';
import { studentsAPI } from '../services/api';

export function useAcademicMeta() {
  const [meta, setMeta] = useState({ years: [], branches: [], sections: [], courses: [], batches: [] });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    studentsAPI.meta()
      .then(res => setMeta(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  return { meta, loading };
}

export default function ClassSelector({ value, onChange, required = false, className = '' }) {
  const { meta, loading } = useAcademicMeta();
  const years = meta.years.length ? meta.years : [1, 2, 3, 4];
  const branches = meta.branches.length ? meta.branches : ['CSE', 'ECE', 'CSM', 'AIML'];
  const sections = meta.sections.length ? meta.sections : ['A', 'B', 'C'];

  const update = (patch) => onChange({ ...value, ...patch });

  const ordinal = (y) => {
    const suffix = ['st', 'nd', 'rd', 'th'];
    return `${y}${suffix[Math.min(y, 4) - 1]}`;
  };

  return (
    <div className={`grid grid-cols-3 gap-4 ${className}`}>
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Year</label>
        <div className="relative">
          <select
            className="input-glass appearance-none pr-8"
            required={required}
            value={value.year || ''}
            onChange={e => update({ year: e.target.value ? Number(e.target.value) : '' })}
            disabled={loading}
          >
            <option value="">Select</option>
            {years.map(y => <option key={y} value={y}>{ordinal(y)} Year</option>)}
          </select>
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">▼</span>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Branch</label>
        <div className="relative">
          <select
            className="input-glass appearance-none pr-8"
            required={required}
            value={value.branch || ''}
            onChange={e => update({ branch: e.target.value })}
            disabled={loading}
          >
            <option value="">Select</option>
            {branches.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">▼</span>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Section</label>
        <div className="relative">
          <select
            className="input-glass appearance-none pr-8"
            required={required}
            value={value.section || ''}
            onChange={e => update({ section: e.target.value })}
            disabled={loading}
          >
            <option value="">Select</option>
            {sections.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">▼</span>
        </div>
      </div>
    </div>
  );
}
