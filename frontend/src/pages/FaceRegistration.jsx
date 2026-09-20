import { useState, useEffect, useRef, useCallback } from 'react';
import { studentsAPI, facesAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import { Camera, CheckCircle2, Fingerprint, Loader2, RefreshCcw } from 'lucide-react';
import Webcam from 'react-webcam';

export default function FaceRegistration() {
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const selectedStudentRef = useRef('');
  
  const [isCapturing, setIsCapturing] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 20
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [isSuccess, setIsSuccess] = useState(false);
  
  const webcamRef = useRef(null);
  const toast = useToast();
  
  // Track captured frames
  const framesRef = useRef([]);

  useEffect(() => {
    // Load students for dropdown
    const loadStudents = async () => {
      try {
        const res = await studentsAPI.list({ page: 1, page_size: 1000 });
        setStudents(res.data.students);
      } catch (err) {
        toast.error('Failed to load students');
      }
    };
    loadStudents();
  }, []);

  const startCapture = () => {
    if (!selectedStudent) {
      toast.error('Please select a student first');
      return;
    }
    
    setIsCapturing(true);
    setProgress(0);
    setIsSuccess(false);
    framesRef.current = [];
  };

  const captureFrames = useCallback(async () => {
    if (!webcamRef.current) return;
    
    if (framesRef.current.length < 20) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        // Convert base64 to blob
        const res = await fetch(imageSrc);
        const blob = await res.blob();
        framesRef.current.push(blob);
        setProgress(framesRef.current.length);
      }
      
      // Schedule next capture
      setTimeout(captureFrames, 200); // 5 FPS
    } else {
      // Done capturing
      setIsCapturing(false);
      submitFrames();
    }
  }, [webcamRef]);

  // Start auto-capture loop when isCapturing becomes true
  useEffect(() => {
    if (isCapturing) {
      // Give webcam a second to focus/adjust lighting before starting
      const timer = setTimeout(() => {
        captureFrames();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isCapturing, captureFrames]);

  const submitFrames = async () => {
    setIsProcessing(true);
    
    try {
      const formData = new FormData();
      framesRef.current.forEach((blob, index) => {
        formData.append('files', blob, `frame_${index}.jpg`);
      });
      
      await facesAPI.register(selectedStudentRef.current, formData);
      toast.success('Face registered successfully!');
      setIsSuccess(true);
      
      // Update local student list to reflect registration
      setStudents(prev => prev.map(s => 
        s.id.toString() === selectedStudentRef.current ? { ...s, face_registered: 1 } : s
      ));
      
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Registration failed');
    } finally {
      setIsProcessing(false);
      framesRef.current = [];
    }
  };

  const selectedStudentObj = students.find(s => s.id.toString() === selectedStudent);

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Fingerprint className="text-indigo-400" /> Face Registration
        </h1>
        <p className="text-slate-400 mt-1">Capture facial data for student attendance.</p>
      </div>

      <div className="glass-card p-6 mb-6">
        <label className="block text-sm font-medium text-slate-300 mb-2">Select Student</label>
        <select 
          className="input-glass w-full md:w-1/2"
          value={selectedStudent}
          onChange={(e) => {
            setSelectedStudent(e.target.value);
            selectedStudentRef.current = e.target.value;
            setIsSuccess(false);
          }}
          disabled={isCapturing || isProcessing}
        >
          <option value="">-- Select a student --</option>
          {students.map(s => (
            <option key={s.id} value={s.id}>
              {s.roll_number} - {s.name} {s.face_registered > 0 ? '(Already Registered)' : ''}
            </option>
          ))}
        </select>
        
        {selectedStudentObj?.face_registered > 0 && !isSuccess && (
          <div className="mt-3 text-amber-400 text-sm flex items-center gap-1">
            <RefreshCcw size={14} /> This student is already registered. Re-capturing will overwrite existing data.
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Camera Section */}
        <div className="glass-card p-6 flex flex-col items-center justify-center min-h-[400px]">
          {(!isCapturing && !isProcessing && !isSuccess) ? (
            <div className="text-center">
              <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-700">
                <Camera size={32} className="text-slate-400" />
              </div>
              <p className="text-slate-400 mb-6">Select a student and click start to begin.</p>
              <button 
                onClick={startCapture} 
                disabled={!selectedStudent}
                className="btn btn-primary"
              >
                Start Registration
              </button>
            </div>
          ) : isSuccess ? (
            <div className="text-center animate-fade-in">
              <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/30">
                <CheckCircle2 size={40} className="text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Registration Complete</h3>
              <p className="text-slate-400 mb-6">Student face data has been securely saved.</p>
              <button onClick={() => { setIsSuccess(false); setSelectedStudent(''); selectedStudentRef.current = ''; }} className="btn btn-secondary">
                Register Another
              </button>
            </div>
          ) : (
            <div className="w-full relative rounded-xl overflow-hidden bg-black border-2 border-indigo-500/50">
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={{ width: 640, height: 480, facingMode: "user" }}
                className="w-full h-auto"
                mirrored={true}
              />
              
              {/* Overlay guides */}
              <div className="absolute inset-0 border-[3px] border-dashed border-indigo-500/40 rounded-full m-8 pointer-events-none" />
              
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
                <span className="live-indicator">
                  <div className="live-dot" /> Capturing
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Status/Progress Section */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Progress</h3>
          
          <div className="space-y-8">
            <ProgressStep 
              active={isCapturing} 
              completed={isProcessing || isSuccess} 
              title="1. Scanning Face"
              description="Keep head still and look directly at the camera."
            />
            
            {(isCapturing || isProcessing || isSuccess) && (
              <div className="pl-9 -mt-4 mb-4">
                <div className="w-full bg-slate-800 rounded-full h-2.5">
                  <div 
                    className="bg-indigo-500 h-2.5 rounded-full transition-all duration-300" 
                    style={{ width: `${(progress / 20) * 100}%` }}
                  ></div>
                </div>
                <div className="text-xs text-slate-400 mt-2 text-right">
                  {progress} / 20 frames
                </div>
              </div>
            )}

            <ProgressStep 
              active={isProcessing} 
              completed={isSuccess} 
              title="2. AI Processing"
              description="Extracting facial embeddings (InsightFace buffalo_l)."
              showSpinner={isProcessing}
            />

            <ProgressStep 
              active={false} 
              completed={isSuccess} 
              title="3. Finalizing"
              description="Saving 512-dimensional vector to database."
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ProgressStep({ active, completed, title, description, showSpinner }) {
  let circleClass = "border-slate-600 bg-slate-800 text-slate-500";
  let titleClass = "text-slate-500";
  
  if (completed) {
    circleClass = "border-emerald-500 bg-emerald-500/20 text-emerald-400";
    titleClass = "text-emerald-400 font-medium";
  } else if (active) {
    circleClass = "border-indigo-500 bg-indigo-500/20 text-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.3)]";
    titleClass = "text-white font-medium";
  }

  return (
    <div className="flex gap-4 relative">
      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 z-10 ${circleClass}`}>
        {completed && <CheckCircle2 size={12} />}
      </div>
      <div>
        <h4 className={`text-sm flex items-center gap-2 ${titleClass}`}>
          {title}
          {showSpinner && <Loader2 size={14} className="animate-spin text-indigo-400" />}
        </h4>
        <p className="text-xs text-slate-400 mt-1">{description}</p>
      </div>
    </div>
  );
}
