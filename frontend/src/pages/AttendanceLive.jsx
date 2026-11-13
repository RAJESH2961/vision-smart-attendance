import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { attendanceAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import { Play, Square, Users, AlertTriangle, Loader2, CheckCircle2, Timer } from 'lucide-react';
import ClassSelector from '../components/ClassSelector';
import { subjectsAPI } from '../services/api';

function formatTime(seconds) {
  const s = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export default function AttendanceLive() {
  const [sessionState, setSessionState] = useState('setup'); // setup | running | completed
  const [sessionId, setSessionId] = useState(null);

  // Setup Form
  const [subjectMode, setSubjectMode] = useState('select'); // select | custom
  const [subject, setSubject] = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [classroom, setClassroom] = useState('');
  const [cls, setCls] = useState({ year: '', branch: '', section: '' });
  const [duration, setDuration] = useState(60);
  const [subjects, setSubjects] = useState([]);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    subjectsAPI.list({ page_size: 500 }).then(res => setSubjects(res.data.subjects)).catch(() => {});
  }, []);

  // Live State
  const [liveFrame, setLiveFrame] = useState(null);
  const [recognitions, setRecognitions] = useState([]);
  const [totalRecognized, setTotalRecognized] = useState(0);
  const [totalStudents, setTotalStudents] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [remaining, setRemaining] = useState(0);

  const wsRef = useRef(null);
  const unknownAlertedRef = useRef(false);
  const toast = useToast();
  const navigate = useNavigate();

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const handleStart = async (e) => {
    e.preventDefault();
    setStarting(true);
    try {
      const res = await attendanceAPI.startSession({
        subject,
        classroom,
        section: cls.section,
        year: cls.year || null,
        branch: cls.branch || null,
        duration: parseInt(duration),
      });

      const newSessionId = res.data.id;
      setSessionId(newSessionId);
      setTotalStudents(res.data.total_students || 0);
      setSessionState('running');
      unknownAlertedRef.current = false;
      connectWebSocket(newSessionId);
    } catch (err) {
      toast.error('Failed to start session');
    } finally {
      setStarting(false);
    }
  };

  const connectWebSocket = (id) => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/attendance/session/${id}/live`;

    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'frame') {
        setLiveFrame(`data:image/jpeg;base64,${data.frame}`);
        const recs = data.recognitions || [];
        setRecognitions(recs);
        setTotalRecognized(data.total_recognized);
        setElapsed(data.elapsed);
        setRemaining(data.remaining);

        // Unknown face notification (once per session)
        if (recs.some(r => r.is_unknown) && !unknownAlertedRef.current) {
          unknownAlertedRef.current = true;
          toast.error('Unknown face detected in frame');
        }
      } else if (data.type === 'completed') {
        setSessionState('completed');
        setTotalRecognized(data.total_recognized);
        wsRef.current?.close();
        toast.success(`Session completed. ${data.total_recognized} students present.`);
      }
    };

    wsRef.current.onerror = () => {
      toast.error('Connection to camera lost');
    };
  };

  const handleStop = async () => {
    if (!sessionId) return;
    try {
      await attendanceAPI.stopSession(sessionId);
      wsRef.current?.send('stop');
      toast.info('Session stopped manually');
    } catch (err) {
      toast.error('Failed to stop session');
    }
  };

  const unknownCount = recognitions.filter(r => r.is_unknown).length;

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto animate-fade-in">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Play className="text-indigo-400" /> Live Attendance
          </h1>
          <p className="text-slate-400 mt-1">AI facial recognition session.</p>
        </div>

        {sessionState === 'running' && (
          <button onClick={handleStop} className="btn btn-danger">
            <Square size={18} /> Stop Attendance
          </button>
        )}
      </div>

      {sessionState === 'setup' && (
        <div className="glass-card p-6 max-w-2xl">
          <h2 className="text-lg font-semibold text-white mb-6">Session Details</h2>
          <form onSubmit={handleStart} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Subject</label>
                {subjectMode === 'select' ? (
                  <div className="relative">
                    <select
                      required
                      className="input-glass appearance-none pr-8"
                      value={subject}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === '__custom__') {
                          setSubjectMode('custom');
                          setSubject('');
                        } else {
                          setSubject(val);
                        }
                      }}
                    >
                      <option value="">Select subject</option>
                      {subjects.map(s => (
                        <option key={s.id} value={s.name}>{s.name} {s.code ? `(${s.code})` : ''}</option>
                      ))}
                      <option value="__custom__">+ Other / Type custom</option>
                    </select>
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">▼</span>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      className="input-glass"
                      value={customSubject}
                      onChange={e => { setCustomSubject(e.target.value); setSubject(e.target.value); }}
                      placeholder="Type subject name"
                    />
                    <button
                      type="button"
                      onClick={() => { setSubjectMode('select'); setSubject(''); setCustomSubject(''); }}
                      className="btn btn-secondary btn-sm whitespace-nowrap"
                    >
                      Back
                    </button>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Classroom</label>
                <input type="text" required className="input-glass" value={classroom} onChange={e => setClassroom(e.target.value)} placeholder="e.g. Room 302" />
              </div>
            </div>

            <ClassSelector value={cls} onChange={setCls} required />

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Duration</label>
              <div className="relative">
                <select
                  required
                  className="input-glass appearance-none pr-8"
                  value={duration}
                  onChange={e => setDuration(Number(e.target.value))}
                >
                  <option value="30">30 seconds</option>
                  <option value="60">1 minute</option>
                  <option value="120">2 minutes</option>
                  <option value="300">5 minutes</option>
                  <option value="600">10 minutes</option>
                </select>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">▼</span>
              </div>
            </div>

            <button type="submit" className="btn btn-primary w-full mt-4" disabled={starting}>
              {starting ? <Loader2 size={18} className="animate-spin" /> : 'Launch Camera & Start Scanning'}
            </button>
          </form>
        </div>
      )}

      {sessionState === 'running' && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Video Feed */}
          <div className="lg:col-span-2">
            <div className="glass-card overflow-hidden relative min-h-[480px] flex items-center justify-center bg-black">
              {liveFrame ? (
                <img src={liveFrame} alt="Live camera feed" className="w-full h-auto object-cover" />
              ) : (
                <div className="text-center">
                  <Loader2 className="animate-spin text-indigo-500 mx-auto mb-4" size={40} />
                  <p className="text-slate-400">Connecting to AI engine & camera...</p>
                </div>
              )}

              <div className="absolute top-4 left-4">
                <span className="live-indicator shadow-lg">
                  <div className="live-dot" /> LIVE
                </span>
              </div>

              {/* Session timer overlay */}
              <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-700 text-sm font-mono text-white">
                <Timer size={14} className="text-indigo-400" />
                {formatTime(remaining)}
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-4 glass-card p-4 flex items-center gap-4">
              <div className="text-sm font-medium text-slate-300 w-16">{formatTime(elapsed)}</div>
              <div className="flex-1 bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-indigo-500 h-full transition-all duration-300 ease-linear"
                  style={{ width: `${Math.min(100, (elapsed / duration) * 100)}%` }}
                />
              </div>
              <div className="text-sm font-medium text-slate-300 w-16 text-right">{formatTime(duration)}</div>
            </div>
          </div>

          {/* Real-time Stats sidebar */}
          <div className="space-y-4">
            <div className="glass-card p-6 border-emerald-500/30 bg-emerald-500/5">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-slate-300 font-medium">Present</h3>
                <Users className="text-emerald-400" size={20} />
              </div>
              <div className="text-4xl font-bold text-white">
                {totalRecognized}
                {totalStudents > 0 && <span className="text-lg text-slate-400 font-normal">/{totalStudents}</span>}
              </div>
              {totalStudents > 0 && (
                <div className="mt-2 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full transition-all"
                    style={{ width: `${Math.min(100, (totalRecognized / totalStudents) * 100)}%` }}
                  />
                </div>
              )}
            </div>

            {unknownCount > 0 && (
              <div className="glass-card p-6 border-rose-500/30 bg-rose-500/5 animate-pulse">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-slate-300 font-medium">Unknown Faces</h3>
                  <AlertTriangle className="text-rose-400" size={20} />
                </div>
                <div className="text-3xl font-bold text-rose-400">{unknownCount}</div>
              </div>
            )}

            <div className="glass-card p-4 max-h-[300px] overflow-y-auto">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-700 pb-2">
                Recognized Students
              </h3>
              <div className="space-y-3">
                {recognitions.filter(r => !r.is_unknown).slice(0, 10).map((rec, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <div>
                      <div className="font-medium text-white">{rec.student_name}</div>
                      <div className="text-xs text-slate-500">{rec.student_roll}</div>
                    </div>
                    <span className="text-xs font-mono text-emerald-400">
                      {(rec.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
                {recognitions.filter(r => !r.is_unknown).length === 0 && (
                  <div className="text-sm text-slate-500 text-center py-4">Scanning...</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {sessionState === 'completed' && (
        <div className="glass-card p-8 text-center max-w-md mx-auto mt-12 animate-slide-in">
          <div className="w-20 h-20 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-indigo-500/30">
            <CheckCircle2 size={40} className="text-indigo-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Session Complete</h2>
          <p className="text-slate-400 mb-8">
            {totalRecognized}{totalStudents ? `/${totalStudents}` : ''} students marked present.
          </p>

          <div className="flex gap-4 justify-center">
            <button onClick={() => navigate('/attendance/history')} className="btn btn-secondary">
              View History
            </button>
            <button onClick={() => { setSessionState('setup'); setLiveFrame(null); setRecognitions([]); }} className="btn btn-primary">
              Start New
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
