/**
 * Shared UI primitives: Skeleton, EmptyState, ConfirmDialog,
 * Pagination, StatusBadge, PercentBadge, Breadcrumbs.
 */

import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home, Inbox, Loader2 } from 'lucide-react';

export function Skeleton({ className = '' }) {
  return <div className={`skeleton ${className}`} />;
}

export function TableSkeleton({ rows = 5, cols = 5 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c}><Skeleton className="h-4 w-full" /></td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function EmptyState({ title = 'No data available', description, icon, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 rounded-full bg-slate-800/60 flex items-center justify-center mb-4 border border-slate-700">
        {icon || <Inbox size={28} className="text-slate-500" />}
      </div>
      <h3 className="text-base font-semibold text-white mb-1">{title}</h3>
      {description && <p className="text-sm text-slate-400 max-w-sm mb-4">{description}</p>}
      {action}
    </div>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', onConfirm, onCancel, loading }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-white mb-2">{title}</h2>
        <p className="text-sm text-slate-400 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="btn btn-secondary" disabled={loading}>Cancel</button>
          <button onClick={onConfirm} className="btn btn-danger" disabled={loading}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Pagination({ page, total, pageSize, onPage }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-4 text-sm text-slate-400">
      <span>Page {page} of {pages} · {total} total</span>
      <div className="flex gap-2">
        <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Prev</button>
        <button className="btn btn-secondary btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}

export function StatusBadge({ status }) {
  const cls = status === 'present' ? 'badge-success'
    : status === 'absent' ? 'badge-danger'
    : status === 'late' ? 'badge-warning' : 'badge-info';
  return <span className={`badge ${cls} capitalize`}>{status}</span>;
}

export function PercentBadge({ value }) {
  const cls = value >= 75 ? 'badge-success' : value >= 50 ? 'badge-warning' : 'badge-danger';
  return <span className={`badge ${cls}`}>{value}%</span>;
}

const ROUTE_LABELS = {
  '': 'Dashboard',
  'students': 'Students',
  'face-registration': 'Face Registration',
  'attendance': 'Attendance',
  'live': 'Live Session',
  'history': 'History',
  'reports': 'Reports',
  'subjects': 'Subjects',
  'users': 'Staff Accounts',
};

export function Breadcrumbs() {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);

  return (
    <nav className="flex items-center gap-1 text-sm text-slate-400">
      <Link to="/" className="hover:text-white transition-colors flex items-center gap-1">
        <Home size={14} />
      </Link>
      {segments.map((seg, i) => {
        const path = '/' + segments.slice(0, i + 1).join('/');
        const isLast = i === segments.length - 1;
        const label = ROUTE_LABELS[seg] || seg;
        return (
          <span key={path} className="flex items-center gap-1">
            <ChevronRight size={14} className="text-slate-600" />
            {isLast ? (
              <span className="text-white font-medium">{label}</span>
            ) : (
              <Link to={path} className="hover:text-white transition-colors">{label}</Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
