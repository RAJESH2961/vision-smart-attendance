import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { LogIn, Loader2, Fingerprint, GraduationCap, Briefcase } from 'lucide-react';

export default function Login() {
  const [mode, setMode] = useState('staff'); // staff | student
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!identifier || !password) {
      toast.error('Please enter your credentials');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(identifier.trim(), password);
      toast.success('Successfully logged in!');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Login failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center gradient-bg px-4">
      <div className="w-full max-w-md">

        <div className="text-center mb-8 animate-slide-in">
          <div className="mx-auto w-16 h-16 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center mb-4 border border-indigo-500/30">
            <Fingerprint size={32} />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">VisionAttend</h1>
          <p className="text-slate-400">AI-powered classroom attendance</p>
        </div>

        <div className="glass-card p-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          {/* Role tabs */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-slate-800/60 mb-6">
            <button
              type="button"
              onClick={() => { setMode('staff'); setIdentifier(''); }}
              className={`flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === 'staff' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-400 hover:text-white border border-transparent'
              }`}
            >
              <Briefcase size={16} /> Staff
            </button>
            <button
              type="button"
              onClick={() => { setMode('student'); setIdentifier(''); }}
              className={`flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === 'student' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-400 hover:text-white border border-transparent'
              }`}
            >
              <GraduationCap size={16} /> Student
            </button>
          </div>

          <h2 className="text-xl font-semibold mb-6 text-white flex items-center gap-2">
            <LogIn size={20} className="text-indigo-400" />
            {mode === 'staff' ? 'Staff Login' : 'Student Login'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                {mode === 'staff' ? 'Email Address' : 'Roll Number'}
              </label>
              <input
                type="text"
                className="input-glass"
                placeholder={mode === 'staff' ? 'faculty@college.edu' : 'e.g. 21CSE01'}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                disabled={isSubmitting}
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <input
                type="password"
                className="input-glass"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
              />
              {mode === 'student' && (
                <p className="text-xs text-slate-500 mt-1.5">Default password is your roll number.</p>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full mt-6"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
