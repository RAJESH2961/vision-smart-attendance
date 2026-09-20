import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { attendanceAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import { Play, Square, Users, AlertTriangle, Loader2 } from 'lucide-react';

export default function AttendanceLive() {
  const [sessionState, setSessionState] = useState('setup'); // setup | running | completed
  const [sessionId, setSessionId] = useState(null);
  
  // Setup Form
  const [subject, setSubject] = useState('');
  const [classroom, setClassroom] = useState('');
  const [section, setSection] = useState('');
  const [duration, setDuration] = useState(20);
  
  // Live State
  const [liveFrame, setLiveFrame] = useState(null);
  const [recognitions, setRecognitions] = useState([]);
  const [totalRecognized, setTotalRecognized] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [remaining, setRemaining] = useState(0);
  
  const wsRef = useRef(null);
  const toast = useToast();
  const navigate = useNavigate();

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const handleStart = async (e) => {
    e.preventDefault();
    try {
      const res = await attendanceAPI.startSession({
        subject, classroom, section, duration: parseInt(duration)
      });
      
      const newSessionId = res.data.id;
      setSessionId(newSessionId);
      setSessionState('running');
      connectWebSocket(newSessionId);
      
    } catch (err) {
      toast.error('Failed to start session');
    }
  };

  const connectWebSocket = (id) => {
    // Determine WS URL from current origin
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // If running Vite dev server, we configured proxy for /ws to target backend
    const wsUrl = `${protocol}//${window.location.host}/ws/attendance/session/${id}/live`;
    
    wsRef.current = new WebSocket(wsUrl);
    
    wsRef.current.onopen = () => {
      console.log('Connected to live attendance stream');
    };
    
    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'frame') {
        setLiveFrame(`data:image/jpeg;base64,${data.frame}`);
        setRecognitions(data.recognitions || []);
        setTotalRecognized(data.total_recognized);
        setElapsed(data.elapsed);
        setRemaining(data.remaining);
      } else if (data.type === 'completed') {
        setSessionState('completed');
        wsRef.current.close();
        toast.success(`Session completed. Recognized ${data.total_recognized} students.`);
      }
    };
    
    wsRef.current.onerror = (err) => {
      console.error('WebSocket error:', err);
      toast.error('Connection to camera lost');
    };
  };

  const handleStop = async () => {
    if (!sessionId) return;
    try {
      await attendanceAPI.stopSession(sessionId);
      if (wsRef.current) {
        wsRef.current.send('stop');
      }
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
            <Square size={18} /> Stop Session Early
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
                <input type="text" required className="input-glass" value={subject} onChange={e=>setSubject(e.target.value)} placeholder="e.g. Data Structures" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Classroom</label>
                <input type="text" required className="input-glass" value={classroom} onChange={e=>setClassroom(e.target.value)} placeholder="e.g. Room 302" />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Section</label>
                <input type="text" required className="input-glass" value={section} onChange={e=>setSection(e.target.value)} placeholder="e.g. A" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Duration (Seconds)</label>
                <input type="number" required min="10" max="120" className="input-glass" value={duration} onChange={e=>setDuration(e.target.value)} />
              </div>
            </div>
            
            <button type="submit" className="btn btn-primary w-full mt-4">
              Launch Camera & Start Scanning
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
                <>
                  <img src={liveFrame} alt="Live camera feed" className="w-full h-auto object-cover" />
                  
                  {/* Bounding Boxes overlay */}
                  {recognitions.map((rec, i) => {
                    const [x1, y1, x2, y2] = rec.bbox;
                    const width = x2 - x1;
                    const height = y2 - y1;
                    const color = rec.is_unknown ? '#ef4444' : '#10b981';
                    
                    return (
                      <div 
                        key={i}
                        className="absolute border-2 pointer-events-none"
                        style={{
                          left: `${x1}px`, top: `${y1}px`, width: `${width}px`, height: `${height}px`,
                          borderColor: color
                        }}
                      >
                        <div className="absolute -top-6 left-[-2px] px-2 py-0.5 text-xs text-white whitespace-nowrap" style={{ backgroundColor: color }}>
                          {rec.is_unknown ? 'Unknown' : `${rec.student_roll} (${(rec.confidence*100).toFixed(0)}%)`}
                        </div>
                      </div>
                    );
                  })}
                </>
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
            </div>
            
            {/* Progress bar */}
            <div className="mt-4 glass-card p-4 flex items-center gap-4">
              <div className="text-sm font-medium text-slate-300 w-16">{remaining.toFixed(1)}s</div>
              <div className="flex-1 bg-slate-800 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-indigo-500 h-full transition-all duration-300 ease-linear"
                  style={{ width: `${(elapsed / duration) * 100}%` }}
                />
              </div>
            </div>
          </div>
          
          {/* Real-time Stats sidebar */}
          <div className="space-y-4">
            <div className="glass-card p-6 border-emerald-500/30 bg-emerald-500/5">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-slate-300 font-medium">Recognized</h3>
                <Users className="text-emerald-400" size={20} />
              </div>
              <div className="text-4xl font-bold text-white">{totalRecognized}</div>
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
                Recent Detections
              </h3>
              <div className="space-y-3">
                {recognitions.slice(0, 8).map((rec, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <div>
                      <div className={`font-medium ${rec.is_unknown ? 'text-rose-400' : 'text-white'}`}>
                        {rec.student_name || 'Unknown Person'}
                      </div>
                      <div className="text-xs text-slate-500">{rec.student_roll || '--'}</div>
                    </div>
                    {!rec.is_unknown && (
                      <span className="text-xs font-mono text-emerald-400">
                        {(rec.confidence * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                ))}
                {recognitions.length === 0 && (
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
          <p className="text-slate-400 mb-8">Successfully recognized {totalRecognized} students.</p>
          
          <div className="flex gap-4 justify-center">
            <button onClick={() => navigate('/attendance/history')} className="btn btn-secondary">
              View History
            </button>
            <button onClick={() => setSessionState('setup')} className="btn btn-primary">
              Start New
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
