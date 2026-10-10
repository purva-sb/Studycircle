import { useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { customFetch } from "@workspace/api-client-react";
import {
  GraduationCap, Code, HeartPulse, Building2, ChevronRight,
  Zap, Clock, Users, CheckCircle2, ArrowLeft, BookOpen,
  Loader2, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─── Config ───────────────────────────────────────────────────────────────────

const EXAMS = [
  { id: "GATE", name: "GATE", icon: Code,         color: "from-blue-500 to-cyan-500",     desc: "CS, EC, ME, CE & more" },
  { id: "JEE",  name: "JEE",  icon: Zap,          color: "from-violet-500 to-purple-500", desc: "Mains & Advanced" },
  { id: "NEET", name: "NEET", icon: HeartPulse,   color: "from-rose-500 to-pink-500",     desc: "Medical Entrance" },
  { id: "CAT",  name: "CAT",  icon: Building2,    color: "from-amber-500 to-orange-500",  desc: "MBA & Management" },
  { id: "UPSC", name: "UPSC", icon: GraduationCap,color: "from-emerald-500 to-teal-500", desc: "Civil Services" },
  { id: "Other",name: "Other",icon: BookOpen,     color: "from-slate-500 to-slate-400",   desc: "SSC, State PSC & more" },
];

const YEARS = ["2025", "2026", "2027", "2028"];

const TARGETS = [
  { label: "30 min",   minutes: 30,  desc: "Light study, staying consistent" },
  { label: "1 hour",   minutes: 60,  desc: "Balanced — great starting point" },
  { label: "2 hours",  minutes: 120, desc: "Serious prep mode" },
  { label: "4+ hours", minutes: 240, desc: "Full-time exam prep" },
];

type SampleQuestion = {
  id: string;
  kind: string;
  body: string;
  options: { id: string; body: string }[];
  correctOptionIds: string[];
  explanation: string | null;
  topic: string | null;
  subject: string | null;
};

type DiscoverCircle = {
  id: string;
  name: string;
  exam: string;
  description: string;
  coverColor: string;
  memberCount: number;
};

const TOTAL_STEPS = 4;

// ─── Step indicators ──────────────────────────────────────────────────────────

function StepDots({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 justify-center mb-6">
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "rounded-full transition-all duration-300",
            i < current
              ? "w-2 h-2 bg-primary"
              : i === current
              ? "w-6 h-2 bg-primary"
              : "w-2 h-2 bg-white/20"
          )}
        />
      ))}
    </div>
  );
}

// ─── Step 1: Exam + Year ──────────────────────────────────────────────────────

function Step1({
  exam, year,
  onExam, onYear, onNext,
}: {
  exam: string; year: string;
  onExam: (e: string) => void; onYear: (y: string) => void; onNext: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center mb-4 shadow-xl shadow-violet-500/20">
          <GraduationCap className="h-7 w-7 text-white" />
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight">Welcome to StudyCircle!</h2>
        <p className="text-sm text-muted-foreground mt-1">What exam are you preparing for?</p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {EXAMS.map(ex => (
          <button
            key={ex.id}
            onClick={() => onExam(ex.id)}
            className={cn(
              "text-left p-3 rounded-xl border transition-all flex items-center gap-3",
              exam === ex.id
                ? "border-primary bg-primary/10 shadow shadow-primary/10"
                : "border-white/10 bg-white/5 hover:bg-white/8 hover:border-white/20"
            )}
          >
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${ex.color} flex items-center justify-center shrink-0`}>
              <ex.icon className="h-4 w-4 text-white" />
            </div>
            <div>
              <div className="font-bold text-sm">{ex.name}</div>
              <div className="text-[10px] text-muted-foreground">{ex.desc}</div>
            </div>
          </button>
        ))}
      </div>

      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">Target year</p>
        <div className="flex gap-2">
          {YEARS.map(y => (
            <button
              key={y}
              onClick={() => onYear(y)}
              className={cn(
                "flex-1 py-2 rounded-lg text-sm font-semibold border transition-all",
                year === y
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-white/10 bg-white/5 hover:bg-white/8"
              )}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      <Button onClick={onNext} disabled={!exam || !year} className="w-full gap-2">
        Continue <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ─── Step 2: Daily target ─────────────────────────────────────────────────────

function Step2({
  minutes, onMinutes, onBack, onNext,
}: { minutes: number; onMinutes: (m: number) => void; onBack: () => void; onNext: () => void }) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center mb-4 shadow-xl shadow-orange-500/20">
          <Clock className="h-7 w-7 text-white" />
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight">Daily study goal</h2>
        <p className="text-sm text-muted-foreground mt-1">How much time can you commit each day?</p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {TARGETS.map(t => (
          <button
            key={t.minutes}
            onClick={() => onMinutes(t.minutes)}
            className={cn(
              "text-left p-4 rounded-xl border transition-all",
              minutes === t.minutes
                ? "border-primary bg-primary/10"
                : "border-white/10 bg-white/5 hover:bg-white/8 hover:border-white/20"
            )}
          >
            <div className="font-bold text-lg">{t.label}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{t.desc}</div>
          </button>
        ))}
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button onClick={onNext} disabled={!minutes} className="flex-1 gap-2">
          Continue <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Step 3: Join a circle ────────────────────────────────────────────────────

function Step3({
  exam, onBack, onNext,
}: { exam: string; onBack: () => void; onNext: () => void }) {
  const qc = useQueryClient();
  const [joined, setJoined] = useState<string | null>(null);
  const [joining, setJoining] = useState<string | null>(null);

  const { data: circles = [], isLoading } = useQuery<DiscoverCircle[]>({
    queryKey: ["onboarding-circles", exam],
    queryFn: () => customFetch(`/api/circles/discover?exam=${encodeURIComponent(exam)}`),
    staleTime: Infinity,
  });

  const joinCircle = async (id: string) => {
    setJoining(id);
    try {
      await customFetch(`/api/circles/${id}/join`, { method: "POST" });
      setJoined(id);
      qc.invalidateQueries({ queryKey: ["circles"] });
    } catch {
      toast.error("Couldn't join circle, try again later.");
    } finally {
      setJoining(null);
    }
  };

  const top3 = circles.slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mb-4 shadow-xl shadow-emerald-500/20">
          <Users className="h-7 w-7 text-white" />
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight">Join a study circle</h2>
        <p className="text-sm text-muted-foreground mt-1">Study with others preparing for {exam}</p>
      </div>

      <div className="space-y-2.5 min-h-[140px]">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Finding circles…
          </div>
        ) : top3.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No public circles yet — you can create one after setup.
          </div>
        ) : (
          top3.map(c => (
            <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/[0.03]">
              <div
                className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center text-sm font-bold text-white"
                style={{ background: c.coverColor || "#6366f1" }}
              >
                {c.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{c.name}</p>
                <p className="text-[11px] text-muted-foreground">{c.memberCount} members</p>
              </div>
              {joined === c.id ? (
                <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold">
                  <Check className="h-3.5 w-3.5" /> Joined
                </span>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 h-7 text-xs"
                  disabled={joining === c.id || joined !== null}
                  onClick={() => joinCircle(c.id)}
                >
                  {joining === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Join"}
                </Button>
              )}
            </div>
          ))
        )}
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button onClick={onNext} className="flex-1 gap-2">
          {joined ? "Next" : "Skip for now"} <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Step 4: Sample question ──────────────────────────────────────────────────

function Step4({ onFinish, saving }: { onFinish: () => void; saving: boolean }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  const { data: q, isLoading } = useQuery<SampleQuestion>({
    queryKey: ["onboarding-sample-q"],
    queryFn: () => customFetch("/api/onboarding/sample-question"),
    staleTime: Infinity,
  });

  const handleOption = (id: string) => {
    if (revealed) return;
    setSelected(id);
  };

  const handleCheck = () => setRevealed(true);

  const isCorrect = q && selected && q.correctOptionIds.includes(selected);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center mb-4 shadow-xl shadow-violet-500/20">
          <BookOpen className="h-7 w-7 text-white" />
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight">Try a sample question</h2>
        <p className="text-sm text-muted-foreground mt-1">Get a feel for how mock exams work</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading question…
        </div>
      ) : q ? (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed font-medium">{q.body}</p>

          <div className="space-y-2">
            {q.options.map((opt, i) => {
              const isSelected = selected === opt.id;
              const isRight = q.correctOptionIds.includes(opt.id);
              let cls = "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]";
              if (revealed) {
                if (isRight) cls = "border-emerald-500/60 bg-emerald-500/10";
                else if (isSelected && !isRight) cls = "border-rose-500/60 bg-rose-500/10";
              } else if (isSelected) {
                cls = "border-primary bg-primary/10";
              }
              return (
                <button
                  key={opt.id}
                  onClick={() => handleOption(opt.id)}
                  disabled={revealed}
                  className={cn("w-full text-left p-3 rounded-xl border text-sm transition-all flex items-center gap-3", cls)}
                >
                  <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px] font-bold shrink-0 opacity-60">
                    {String.fromCharCode(65 + i)}
                  </span>
                  {opt.body}
                  {revealed && isRight && <Check className="h-4 w-4 text-emerald-400 ml-auto shrink-0" />}
                </button>
              );
            })}
          </div>

          {revealed && q.explanation && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground/80">Explanation: </span>{q.explanation}
            </div>
          )}

          {revealed && (
            <p className={cn("text-center text-sm font-semibold", isCorrect ? "text-emerald-400" : "text-rose-400")}>
              {isCorrect ? "Correct! Great start." : "Not quite — but that's why we practice!"}
            </p>
          )}
        </div>
      ) : null}

      <div className="flex gap-3">
        {!revealed ? (
          <Button onClick={handleCheck} disabled={!selected || isLoading} variant="outline" className="flex-1">
            Check Answer
          </Button>
        ) : null}
        <Button
          onClick={onFinish}
          disabled={saving}
          className={cn("gap-2", !revealed ? "flex-1" : "w-full")}
        >
          {saving ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Setting up…</>
          ) : (
            <><CheckCircle2 className="h-4 w-4" /> Start Studying</>
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

export function OnboardingModal() {
  const { user, isLoaded } = useUser();
  const [step, setStep] = useState(0);
  const [exam,    setExam]    = useState("");
  const [year,    setYear]    = useState("");
  const [minutes, setMinutes] = useState(0);
  const [saving,  setSaving]  = useState(false);

  if (!isLoaded || !user) return null;
  if (user.unsafeMetadata?.examFocus) return null;

  const handleFinish = async () => {
    setSaving(true);
    try {
      await customFetch("/api/me/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examFocus: exam, dailyTargetMinutes: minutes || 120 }),
      });
      await user.update({
        unsafeMetadata: { ...user.unsafeMetadata, examFocus: exam, targetYear: year },
      });
      // mark checklist step 1 done
      localStorage.setItem("sc_onboarding_goal_done", "1");
    } catch {
      toast.error("Setup failed, please try again.");
      setSaving(false);
    }
  };

  const slideVariants = {
    enter: { x: 40, opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: { x: -40, opacity: 0 },
  };

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden bg-card border-white/10 shadow-2xl shadow-black [&>button]:hidden">
        <div className="p-7 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/8 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-600/8 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />

          <div className="relative z-10">
            <StepDots current={step} />

            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.2 }}
              >
                {step === 0 && (
                  <Step1
                    exam={exam} year={year}
                    onExam={setExam} onYear={setYear}
                    onNext={() => setStep(1)}
                  />
                )}
                {step === 1 && (
                  <Step2
                    minutes={minutes}
                    onMinutes={setMinutes}
                    onBack={() => setStep(0)}
                    onNext={() => setStep(2)}
                  />
                )}
                {step === 2 && (
                  <Step3
                    exam={exam}
                    onBack={() => setStep(1)}
                    onNext={() => setStep(3)}
                  />
                )}
                {step === 3 && (
                  <Step4
                    onFinish={handleFinish}
                    saving={saving}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
