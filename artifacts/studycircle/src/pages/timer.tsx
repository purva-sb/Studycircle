import { useState, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { useCreateStudySession, useListSubjects } from "@workspace/api-client-react";
import { Play, Square, Settings2, ArrowLeft, Maximize, Clock, Pause, Flame } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export default function TimerPage() {
  const [location, setLocation] = useLocation();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const initialMode = searchParams.get("mode") === "stopwatch" ? "stopwatch" : "pomodoro";

  const [mode, setMode] = useState<"pomodoro" | "stopwatch">(initialMode);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Settings
  const [subjectId, setSubjectId] = useState<string>("");
  const [note, setNote] = useState("");
  const [pomodoroLength, setPomodoroLength] = useState(25); // minutes
  
  // Timer State
  const [isRunning, setIsRunning] = useState(false);
  const [seconds, setSeconds] = useState(mode === "pomodoro" ? pomodoroLength * 60 : 0);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const createSession = useCreateStudySession();
  const { data: subjects } = useListSubjects();

  useEffect(() => {
    if (subjects && subjects.length > 0 && !subjectId) {
      setSubjectId(subjects[0].name);
    }
  }, [subjects, subjectId]);

  // Handle Fullscreen changes natively
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      // If user pressed ESC and timer is running, maybe they just wanted to leave fullscreen but keep timer?
      // We will let it keep running.
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Timer tick logic (pure state update)
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setSeconds(prev => {
          if (mode === "pomodoro") {
            return prev > 0 ? prev - 1 : 0;
          }
          return prev + 1; // Stopwatch
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, mode]);

  // Pomodoro completion watcher (side-effects)
  useEffect(() => {
    if (isRunning && mode === "pomodoro" && seconds === 0) {
      setIsRunning(false);
      handleSaveSession(pomodoroLength * 60);
      if (document.fullscreenElement) document.exitFullscreen();
    }
  }, [seconds, isRunning, mode, pomodoroLength]);

  const toggleFullscreenAndStart = async () => {
    if (!subjectId) {
      toast.error("Please enter a subject first");
      return;
    }
    
    try {
      if (!document.fullscreenElement && containerRef.current) {
        await containerRef.current.requestFullscreen();
      }
      // Do not auto-start the timer based on user request. Let them press start in the immersive view.
      if (mode === "pomodoro" && seconds === 0) {
        setSeconds(pomodoroLength * 60);
      }
    } catch (err) {
      toast.error("Could not enter full screen.");
    }
  };

  const handleStopAndSave = async () => {
    setIsRunning(false);
    let elapsedSeconds = 0;
    
    if (mode === "pomodoro") {
      elapsedSeconds = (pomodoroLength * 60) - seconds;
    } else {
      elapsedSeconds = seconds;
    }
    
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
    
    if (elapsedSeconds < 60) {
      toast.info("Session too short to save.");
      setSeconds(mode === "pomodoro" ? pomodoroLength * 60 : 0);
      return;
    }
    
    handleSaveSession(elapsedSeconds);
  };

  const handleSaveSession = (elapsedSeconds: number) => {
    createSession.mutate({
      data: {
        mode,
        durationMinutes: Math.floor(elapsedSeconds / 60),
        subjectId,
        note
      }
    }, {
      onSuccess: () => {
        toast.success(`Saved ${Math.floor(elapsedSeconds / 60)} minutes!`);
        setSeconds(mode === "pomodoro" ? pomodoroLength * 60 : 0);
      }
    });
  };

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const rs = s % 60;
    if (h > 0) return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${rs.toString().padStart(2, "0")}`;
    return `${m.toString().padStart(2, "0")}:${rs.toString().padStart(2, "0")}`;
  };

  return (
    <div ref={containerRef} className="bg-background min-h-screen text-foreground relative font-sans overflow-hidden">
      <AnimatePresence mode="wait">
        {!isFullscreen ? (
          /* =========================================
             SETUP LOBBY
             ========================================= */
          <motion.div 
            key="lobby"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col h-screen"
          >
            <div className="p-6">
              <Button variant="ghost" onClick={() => setLocation("/focus-rooms")} className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto w-full">
              <div className="min-h-full w-full flex items-center justify-center p-4 pb-32">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md bg-card border border-border rounded-3xl overflow-hidden shadow-2xl relative p-8"
              >
                <div className="text-center mb-8">
                  <h1 className="text-3xl font-black mb-2 tracking-tight">Solo Study</h1>
                  <p className="text-muted-foreground">Setup your perfect distraction-free environment.</p>
                </div>
                
                <div className="space-y-6">
                  {/* Mode Selector */}
                  <div className="bg-muted/50 p-1.5 rounded-2xl flex relative">
                    <button 
                      onClick={() => { setMode("pomodoro"); setSeconds(pomodoroLength * 60); }}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${mode === "pomodoro" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      Pomodoro
                    </button>
                    <button 
                      onClick={() => { setMode("stopwatch"); setSeconds(0); }}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${mode === "stopwatch" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      Focus Timer
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Subject</label>
                    <Input 
                      value={subjectId}
                      onChange={e => setSubjectId(e.target.value)}
                      placeholder="What are you studying? (e.g. Math, React, History)"
                      className="bg-background/50 border-border h-12 rounded-xl"
                    />
                    {subjects && subjects.length > 0 && (
                      <div className="flex overflow-x-auto gap-2 mt-2 pb-2 w-full [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                        {subjects.slice(0, 5).map(s => (
                          <button
                            key={s.id}
                            onClick={() => setSubjectId(s.name)}
                            className={`whitespace-nowrap shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${subjectId === s.name ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400' : 'bg-muted/50 border-border text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                          >
                            {s.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Goal / Note (Optional)</label>
                    <Input 
                      value={note}
                      onChange={e => setNote(e.target.value)}
                      placeholder="What are you focusing on?"
                      className="bg-background/50 border-border h-12 rounded-xl"
                    />
                  </div>
                  
                  {mode === "pomodoro" && (
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Focus Duration</label>
                        <span className="text-xs font-bold text-indigo-400">{pomodoroLength} min</span>
                      </div>
                      <input 
                        type="range" 
                        min="5" max="120" step="5"
                        value={pomodoroLength}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setPomodoroLength(val);
                          if (!isRunning) setSeconds(val * 60);
                        }}
                        className="w-full accent-indigo-500"
                      />
                    </div>
                  )}

                  <Button 
                    onClick={toggleFullscreenAndStart}
                    className="w-full h-14 rounded-2xl text-lg font-bold shadow-xl shadow-indigo-500/25 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white mt-4"
                  >
                    Enter Focus Room
                  </Button>
                </div>
              </motion.div>
              </div>
            </div>
          </motion.div>
        ) : (
          /* =========================================
             FULLSCREEN IMMERSIVE TIMER (Image 3)
             ========================================= */
          <motion.div 
            key="immersive"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col h-screen w-full bg-[#0a0a0a]"
          >
            {/* Header */}
            <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-center z-20">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full backdrop-blur-md">
                  <Flame className="w-4 h-4 text-indigo-400" />
                  <span className="text-sm font-semibold tracking-wide text-indigo-100">DEEP FOCUS ZONE</span>
                </div>
                {subjectId && (
                  <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: subjects?.find(s => s.name === subjectId)?.color || '#818cf8' }} />
                    {subjectId}
                  </div>
                )}
              </div>
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={handleStopAndSave}
                className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20 transition-all rounded-full px-6"
              >
                End & Save
              </Button>
            </div>

            {/* Main Timer Display */}
            <div className="flex-1 flex items-center justify-center relative">
              {/* Background ambient animations based on mode */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <motion.div 
                  animate={{ 
                    scale: isRunning ? [1, 1.05, 1] : 1,
                    opacity: isRunning ? [0.05, 0.1, 0.05] : 0.05
                  }}
                  transition={{ 
                    duration: 10, 
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className={`w-[600px] h-[600px] rounded-full blur-[100px] pointer-events-none ${
                    mode === "pomodoro" ? "bg-indigo-500" : "bg-emerald-500"
                  }`} 
                />
              </div>

              <div className="relative z-10 flex flex-col items-center">
                <div className="relative flex items-center justify-center w-[400px] h-[400px]">
                  {/* Circular progress track */}
                  {mode === "pomodoro" && (
                    <svg className="absolute w-[440px] h-[440px] -rotate-90 pointer-events-none drop-shadow-2xl">
                      <circle cx="220" cy="220" r="200" stroke="rgba(255,255,255,0.05)" strokeWidth="8" fill="none" />
                      <motion.circle 
                        cx="220" cy="220" r="200" 
                        stroke="url(#timerGrad)" 
                        strokeWidth="12" 
                        fill="none" 
                        strokeLinecap="round"
                        initial={{ strokeDasharray: "1256", strokeDashoffset: "0" }}
                        animate={{ 
                          strokeDashoffset: isRunning 
                            ? ((pomodoroLength * 60 - seconds) / (pomodoroLength * 60)) * -1256 
                            : ((pomodoroLength * 60 - seconds) / (pomodoroLength * 60)) * -1256
                        }}
                        transition={{ duration: 1, ease: "linear" }}
                      />
                      <defs>
                        <linearGradient id="timerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#818cf8" />
                          <stop offset="100%" stopColor="#c084fc" />
                        </linearGradient>
                      </defs>
                    </svg>
                  )}
                  
                  {mode === "stopwatch" && (
                    <div className="absolute w-[440px] h-[440px] rounded-full border-[8px] border-emerald-500/20 shadow-[0_0_100px_rgba(16,185,129,0.1)]" />
                  )}

                  <div className="flex flex-col items-center">
                    <span className="text-zinc-500 font-bold tracking-[0.2em] uppercase text-sm mb-4">
                      {mode === "pomodoro" ? "Pomodoro Timer" : "Focus Timer"}
                    </span>
                    <h2 className={`text-[120px] font-black tracking-tighter drop-shadow-2xl leading-none font-mono tabular-nums ${
                      mode === "pomodoro" ? "text-white" : "text-emerald-50"
                    }`}>
                      {formatTime(seconds)}
                    </h2>
                  </div>
                </div>

                <div className="flex items-center gap-6 mt-12">
                  <Button 
                    onClick={() => setIsRunning(!isRunning)}
                    className={`w-48 h-16 rounded-full text-xl font-bold shadow-2xl transition-all hover:scale-105 active:scale-95 ${
                      isRunning 
                        ? "bg-white/10 text-white hover:bg-white/20 border-0 backdrop-blur-md" 
                        : mode === "pomodoro"
                          ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-0 shadow-indigo-500/25"
                          : "bg-emerald-500 hover:bg-emerald-400 text-white border-0 shadow-emerald-500/25"
                    }`}
                  >
                    {isRunning ? (
                      <><Pause className="w-6 h-6 mr-3" /> Pause</>
                    ) : (
                      <><Play className="w-6 h-6 mr-3" /> Resume</>
                    )}
                  </Button>
                </div>
                
                {note && (
                  <div className="mt-12 text-zinc-400 bg-white/5 border border-white/10 px-6 py-3 rounded-full max-w-md text-center truncate backdrop-blur-sm">
                    {note}
                  </div>
                )}
              </div>
            </div>
            
            {/* ESC Hint */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-zinc-600 text-sm">
              Press <kbd className="px-2 py-1 bg-white/5 rounded mx-1 font-sans border border-white/10">Esc</kbd> to exit full screen
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
