import { useState, useMemo, useEffect } from "react";
import {
  useGetTodayGoals,
  useToggleGoal, useCreateGoal, getGetTodayGoalsQueryKey,
  useListFocusRooms, useGetMe, useGetLeaderboard,
  useListStickyNotes, useCreateStickyNote, usePinStickyNote, useDeleteStickyNote, getListStickyNotesQueryKey,
  useGetAim, useUpsertAim, useDeleteAim, getAimQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  Flame, Target, Trophy, Play, Plus, Zap,
  Sparkles, AlertTriangle, CheckCircle2, Calendar,
  MessageSquare, BookOpen, Radio, TrendingUp,
  ArrowRight, Circle, Clock, Timer,
  Pin, PinOff, X, StickyNote as StickyNoteIcon, Pencil,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { format, differenceInDays } from "date-fns";
import { toast } from "sonner";
import { slowDataQueryOptions, profileQueryOptions, dashboardQueryOptions } from "@/lib/query-client";
import { customFetch } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { useUser } from "@clerk/clerk-react";
import { StudyHeatmap } from "@/components/study-heatmap";
import { WeakTopicDrill } from "@/components/weak-topic-drill";

// ─── Constants ───────────────────────────────────────────────────────────────

const EXAM_DATES: Record<string, { label: string; date: Date; color: string }> = {
  "GATE CSE":     { label: "GATE 2026",     date: new Date("2026-02-01"), color: "from-violet-600 to-indigo-600" },
  "GATE ECE":     { label: "GATE 2026",     date: new Date("2026-02-01"), color: "from-violet-600 to-indigo-600" },
  "JEE Advanced": { label: "JEE Adv 2026",  date: new Date("2026-05-17"), color: "from-orange-600 to-amber-600" },
  "NEET":         { label: "NEET 2026",     date: new Date("2026-05-03"), color: "from-emerald-600 to-teal-600" },
  "CAT":          { label: "CAT 2026",      date: new Date("2026-11-22"), color: "from-rose-600 to-pink-600" },
  "UPSC":         { label: "UPSC Pre 2026", date: new Date("2026-05-24"), color: "from-amber-600 to-yellow-600" },
  "Placements":   { label: "Placement Season", date: new Date("2026-08-01"), color: "from-cyan-600 to-blue-600" },
};



// ─── Getting Started Checklist ───────────────────────────────────────────────

const CHECKLIST = [
  { id: "goal",      label: "Set your exam goal",    href: null,              desc: "Done during setup" },
  { id: "circle",    label: "Join a study circle",   href: "/circles",        desc: "Study with others" },
  { id: "mock",      label: "Take your first mock",  href: "/exams",          desc: "See how you perform" },
  { id: "flashcard", label: "Add a flashcard",       href: "/study?tab=flashcards", desc: "Start building memory" },
  { id: "room",      label: "Try a focus room",      href: "/focus-rooms",    desc: "Study live with friends" },
] as const;

type ChecklistId = typeof CHECKLIST[number]["id"];

function useChecklist(examFocus: string | undefined) {
  const [done, setDone] = useState<Set<ChecklistId>>(() => {
    const stored = localStorage.getItem("sc_checklist");
    const parsed: ChecklistId[] = stored ? JSON.parse(stored) : [];
    const set = new Set<ChecklistId>(parsed);
    if (examFocus) set.add("goal");
    return set;
  });

  const mark = (id: ChecklistId) => {
    setDone(prev => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem("sc_checklist", JSON.stringify([...next]));
      return next;
    });
  };

  // Auto-mark goal if examFocus is set
  useState(() => { if (examFocus && !done.has("goal")) mark("goal"); });

  return { done, mark };
}

function GettingStartedCard({ examFocus }: { examFocus: string | undefined }) {
  const { done, mark } = useChecklist(examFocus);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem("sc_checklist_dismissed") === "1");
  const [, navigate] = useLocation();

  const completedCount = CHECKLIST.filter(t => done.has(t.id)).length;
  const allDone = completedCount === CHECKLIST.length;

  // Auto-dismiss once all done
  if (allDone || dismissed) return null;
  // Only show after onboarding is complete
  if (!examFocus) return null;

  const dismiss = () => {
    localStorage.setItem("sc_checklist_dismissed", "1");
    setDismissed(true);
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-sm">Getting Started</h3>
          <p className="text-xs text-muted-foreground">{completedCount} of {CHECKLIST.length} done</p>
        </div>
        <button onClick={dismiss} className="text-muted-foreground hover:text-foreground transition-colors text-xs">
          Dismiss
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${(completedCount / CHECKLIST.length) * 100}%` }}
        />
      </div>

      <div className="space-y-1.5">
        {CHECKLIST.map(task => {
          const isDone = done.has(task.id);
          return (
            <button
              key={task.id}
              disabled={isDone}
              onClick={() => {
                mark(task.id);
                if (task.href) navigate(task.href);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                isDone
                  ? "opacity-50 cursor-default"
                  : "hover:bg-white/5 cursor-pointer"
              }`}
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                isDone ? "border-primary bg-primary" : "border-white/30"
              }`}>
                {isDone && <CheckCircle2 className="h-3 w-3 text-white fill-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${isDone ? "line-through text-muted-foreground" : ""}`}>
                  {task.label}
                </p>
                <p className="text-xs text-muted-foreground">{task.desc}</p>
              </div>
              {!isDone && task.href && (
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function fmtMins(m: number): string {
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60), rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

/** SVG circular arc progress */
function FocusRing({ pct, minutes, target }: { pct: number; minutes: number; target: number }) {
  const r = 46;
  const circ = 2 * Math.PI * r;
  const dash = circ * Math.min(pct / 100, 1);
  const tierColor =
    minutes / 60 >= 10 ? "#facc15" :
    minutes / 60 >= 9  ? "#ec4899" :
    minutes / 60 >= 5  ? "#f97316" :
    minutes / 60 >= 3  ? "#a855f7" :
    minutes / 60 >= 1  ? "#06b6d4" : "#6366f1";

  return (
    <div className="relative w-36 h-36 shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120" overflow="visible">
        <circle cx="60" cy="60" r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
        <motion.circle
          cx="60" cy="60" r={r} fill="none"
          stroke={tierColor}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - dash }}
          transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
          style={{ filter: `drop-shadow(0 0 6px ${tierColor})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-black tabular-nums leading-tight">{fmtMins(minutes)}</span>
        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">/ {fmtMins(target)}</span>
      </div>
    </div>
  );
}

/** 7-day dot streak visualizer */
function StreakDots({ activeDays }: { activeDays: string[] }) {
  const activeSet = new Set(activeDays);
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    const dateStr = d.toISOString().split("T")[0];
    const studied = activeSet.has(dateStr);
    const isToday = i === 6;
    return { d, studied, isToday };
  });
  const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  return (
    <div className="flex gap-2 items-end">
      {days.map(({ d, studied, isToday }, i) => (
        <div key={i} className="flex flex-col items-center gap-1.5">
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
            studied
              ? "bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.4)]"
              : "bg-muted",
            isToday && studied && "ring-2 ring-orange-300 ring-offset-1 ring-offset-background"
          )}>
            {studied ? (
              <Flame className="w-4 h-4 text-white" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-muted-foreground/30" />
            )}
          </div>
          <span className={cn(
            "text-[10px] font-semibold",
            isToday ? "text-foreground" : "text-muted-foreground"
          )}>
            {DAY_LABELS[d.getDay()]}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Sticky Notes color map ───────────────────────────────────────────────────
const NOTE_COLORS: Record<string, { bg: string; header: string; border: string; text: string; btn: string }> = {
  yellow: { bg: "bg-yellow-200/95 dark:bg-yellow-900/50", header: "bg-yellow-300/80 dark:bg-yellow-800/60", border: "border-yellow-300/80 dark:border-yellow-700/60", text: "text-yellow-950 dark:text-yellow-100", btn: "hover:bg-yellow-400/30 dark:hover:bg-yellow-700/60" },
  blue:   { bg: "bg-sky-200/95 dark:bg-sky-900/50",       header: "bg-sky-300/80 dark:bg-sky-800/60",       border: "border-sky-300/80 dark:border-sky-700/60",     text: "text-sky-950 dark:text-sky-100",     btn: "hover:bg-sky-400/30 dark:hover:bg-sky-700/60"     },
  green:  { bg: "bg-emerald-200/95 dark:bg-emerald-900/50", header: "bg-emerald-300/80 dark:bg-emerald-800/60", border: "border-emerald-300/80 dark:border-emerald-700/60", text: "text-emerald-950 dark:text-emerald-100", btn: "hover:bg-emerald-400/30 dark:hover:bg-emerald-700/60" },
  pink:   { bg: "bg-pink-200/95 dark:bg-pink-900/50",     header: "bg-pink-300/80 dark:bg-pink-800/60",     border: "border-pink-300/80 dark:border-pink-700/60",   text: "text-pink-950 dark:text-pink-100",   btn: "hover:bg-pink-400/30 dark:hover:bg-pink-700/60"   },
  violet: { bg: "bg-violet-200/95 dark:bg-violet-900/50", header: "bg-violet-300/80 dark:bg-violet-800/60", border: "border-violet-300/80 dark:border-violet-700/60", text: "text-violet-950 dark:text-violet-100", btn: "hover:bg-violet-400/30 dark:hover:bg-violet-700/60" },
};
const COLOR_KEYS = Object.keys(NOTE_COLORS) as (keyof typeof NOTE_COLORS)[];
const COLOR_DOT: Record<string, string> = {
  yellow: "bg-yellow-400", blue: "bg-sky-400", green: "bg-emerald-400", pink: "bg-pink-400", violet: "bg-violet-400",
};

function StickyNotesWidget() {
  const queryClient = useQueryClient();
  const { data: notes = [] } = useListStickyNotes();
  const createNote = useCreateStickyNote();
  const pinNote = usePinStickyNote();
  const deleteNote = useDeleteStickyNote();

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [color, setColor] = useState("yellow");

  const pinnedNotes = notes.filter(n => n.pinned === "true");
  const unpinnedNotes = notes.filter(n => n.pinned !== "true");
  const orderedNotes = [...pinnedNotes, ...unpinnedNotes];

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const content = body.trim() ? `${title.trim()}\n${body.trim()}` : title.trim();
    createNote.mutate({ data: { content, color } }, {
      onSuccess: () => {
        setTitle(""); setBody(""); setShowForm(false);
        queryClient.invalidateQueries({ queryKey: getListStickyNotesQueryKey() });
      },
    });
  };

  const handlePin = (id: string) => {
    pinNote.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListStickyNotesQueryKey() }),
    });
  };

  const handleDelete = (id: string) => {
    deleteNote.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListStickyNotesQueryKey() }),
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <StickyNoteIcon className="w-3.5 h-3.5 text-yellow-500" /> Sticky Notes
          {notes.length > 0 && <span className="text-[10px] text-muted-foreground font-normal">{notes.length}</span>}
        </h3>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <Plus className="w-3.5 h-3.5" /> New Note
        </button>
      </div>
      <div className="h-px bg-border/40 mb-4" />

      {showForm && (
        <form onSubmit={handleAdd} className="mb-5 p-4 rounded-2xl bg-muted/30 border border-border/50 space-y-2.5">
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Color</span>
            <div className="flex gap-1.5">
              {COLOR_KEYS.map(c => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={cn("w-5 h-5 rounded-full transition-all", COLOR_DOT[c],
                    color === c ? "ring-2 ring-offset-1 ring-offset-background ring-foreground/50 scale-110" : "opacity-50 hover:opacity-100"
                  )} />
              ))}
            </div>
          </div>
          <Input value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Title" autoFocus
            className="h-9 text-sm font-semibold bg-muted/40" maxLength={80} />
          <textarea value={body} onChange={e => setBody(e.target.value)}
            placeholder="Note content… (optional)"
            rows={3} maxLength={500}
            className="w-full resize-none text-xs bg-muted/40 rounded-lg border border-input px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          <div className="flex gap-2 justify-end">
            <Button type="button" size="sm" variant="ghost" className="h-8 px-3 text-xs" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" size="sm" className="h-8 px-3 text-xs" disabled={!title.trim() || createNote.isPending}>
              Add Note
            </Button>
          </div>
        </form>
      )}

      {notes.length === 0 && !showForm ? (
        <p className="text-xs text-muted-foreground text-center py-10">No notes yet — click New Note to add one.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
          {orderedNotes.map(note => (
            <NoteCard key={note.id} note={note} onPin={handlePin} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

function NoteCard({ note, onPin, onDelete }: {
  note: { id: string; content: string; color: string; pinned: string };
  onPin: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const c = NOTE_COLORS[note.color] ?? NOTE_COLORS.yellow;
  const isPinned = note.pinned === "true";
  const [titleLine, ...rest] = note.content.split("\n");
  const bodyText = rest.join("\n").trim();

  return (
    <div className={cn(
      "relative rounded-xl overflow-hidden border shadow-md flex flex-col min-h-[220px]",
      "group transition-all duration-200 hover:-translate-y-1 hover:shadow-xl",
      "min-h-55",
      c.bg, c.border,
      isPinned && "ring-2 ring-yellow-400/60 ring-offset-2 ring-offset-background"
    )}>
      {/* Header strip */}
      <div className={cn("flex items-center justify-between gap-1 px-3 py-2 border-b", c.header, c.border)}>
        <span className={cn("text-[11px] font-bold truncate flex-1 leading-tight", c.text)}>
          {isPinned && <span className="mr-1">📌</span>}
          {titleLine || "Note"}
        </span>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={() => onPin(note.id)}
            className={cn("p-1 rounded transition-colors", c.btn, c.text)}
            title={isPinned ? "Unpin" : "Pin"}>
            {isPinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
          </button>
          <button onClick={() => onDelete(note.id)}
            className={cn("p-1 rounded transition-colors", c.btn, c.text)}>
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
      {/* Body */}
      <div className={cn("flex-1 px-3 py-3 text-xs leading-relaxed whitespace-pre-wrap wrap-break-word", c.text)}>
        {bodyText || <span className="opacity-40 italic">—</span>}
      </div>
    </div>
  );
}

// ─── Aim Widget ───────────────────────────────────────────────────────────────

function AimWidget() {
  const queryClient = useQueryClient();
  const { data: aim } = useGetAim();
  const upsertAim = useUpsertAim();
  const deleteAimMutation = useDeleteAim();

  const [open, setOpen] = useState(false);
  const [examName, setExamName] = useState("");
  const [examDate, setExamDate] = useState("");
  const [targetScore, setTargetScore] = useState("");
  const [personalNote, setPersonalNote] = useState("");

  const openEdit = () => {
    setExamName(aim?.examName ?? "");
    setExamDate(aim?.examDate ?? "");
    setTargetScore(aim?.targetScore ?? "");
    setPersonalNote(aim?.personalNote ?? "");
    setOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!examName.trim() || !examDate) return;
    upsertAim.mutate({ data: { examName: examName.trim(), examDate, targetScore: targetScore || null, personalNote: personalNote || null } }, {
      onSuccess: () => {
        setOpen(false);
        queryClient.invalidateQueries({ queryKey: getAimQueryKey() });
      },
    });
  };

  const handleDelete = () => {
    deleteAimMutation.mutate(undefined, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getAimQueryKey() }),
    });
  };

  if (!aim) {
    return (
      <div className="rounded-2xl border bg-card p-5 flex flex-col items-center justify-center gap-3 min-h-[100px]">
        <Target className="w-8 h-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground font-medium">No aim set yet</p>
        <Button size="sm" variant="outline" onClick={openEdit} className="gap-1.5 text-xs">
          <Plus className="w-3.5 h-3.5" /> Set Your Aim
        </Button>
        <AimDialog open={open} onOpenChange={setOpen} examName={examName} setExamName={setExamName}
          examDate={examDate} setExamDate={setExamDate} targetScore={targetScore} setTargetScore={setTargetScore}
          personalNote={personalNote} setPersonalNote={setPersonalNote} onSave={handleSave} saving={upsertAim.isPending} />
      </div>
    );
  }

  const examDateObj = new Date(aim.examDate);
  const daysLeft = differenceInDays(examDateObj, new Date());
  const totalDays = differenceInDays(examDateObj, new Date(aim.updatedAt));
  const elapsed = totalDays - daysLeft;
  const pct = totalDays > 0 ? Math.min(100, Math.max(0, (elapsed / totalDays) * 100)) : 100;

  const urgencyColor = daysLeft <= 7 ? "text-rose-400" : daysLeft <= 30 ? "text-amber-400" : "text-emerald-400";
  const barColor    = daysLeft <= 7 ? "from-rose-500 to-red-500"   : daysLeft <= 30 ? "from-amber-500 to-orange-500" : "from-emerald-500 to-teal-500";

  return (
    <>
      <div className="rounded-2xl border bg-card p-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Your Aim</p>
            <p className="font-bold text-base mt-0.5">{aim.examName}</p>
            <p className="text-xs text-muted-foreground">{format(examDateObj, "MMMM d, yyyy")}</p>
          </div>
          <div className="text-right shrink-0">
            {daysLeft >= 0 ? (
              <>
                <p className={cn("text-3xl font-black tabular-nums", urgencyColor)}>{daysLeft}</p>
                <p className="text-[10px] text-muted-foreground font-medium">days left</p>
              </>
            ) : (
              <p className="text-sm font-bold text-muted-foreground">Exam passed</p>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {daysLeft >= 0 && (
          <div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className={cn("h-full rounded-full bg-gradient-to-r", barColor)}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">{Math.round(pct)}% of prep time elapsed</p>
          </div>
        )}

        {(aim.targetScore || aim.personalNote) && (
          <div className="pt-1 border-t border-border/50 space-y-0.5">
            {aim.targetScore && <p className="text-xs text-muted-foreground">Target: <span className="font-semibold text-foreground">{aim.targetScore}</span></p>}
            {aim.personalNote && <p className="text-xs text-muted-foreground/70 italic">"{aim.personalNote}"</p>}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button size="sm" variant="ghost" onClick={openEdit} className="h-7 text-xs gap-1 flex-1">
            <Pencil className="w-3 h-3" /> Edit
          </Button>
          <Button size="sm" variant="ghost" onClick={handleDelete} className="h-7 text-xs gap-1 text-muted-foreground hover:text-rose-400">
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>
      <AimDialog open={open} onOpenChange={setOpen} examName={examName} setExamName={setExamName}
        examDate={examDate} setExamDate={setExamDate} targetScore={targetScore} setTargetScore={setTargetScore}
        personalNote={personalNote} setPersonalNote={setPersonalNote} onSave={handleSave} saving={upsertAim.isPending} />
    </>
  );
}

function AimDialog({ open, onOpenChange, examName, setExamName, examDate, setExamDate,
  targetScore, setTargetScore, personalNote, setPersonalNote, onSave, saving }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  examName: string; setExamName: (v: string) => void;
  examDate: string; setExamDate: (v: string) => void;
  targetScore: string; setTargetScore: (v: string) => void;
  personalNote: string; setPersonalNote: (v: string) => void;
  onSave: (e: React.FormEvent) => void; saving: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Target className="w-4 h-4" /> Set Your Aim</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSave} className="space-y-3 pt-1">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Exam Name *</label>
            <Input value={examName} onChange={e => setExamName(e.target.value)} placeholder="e.g. NEET 2026, JEE Advanced" className="mt-1" required />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Exam Date *</label>
            <Input type="date" value={examDate} onChange={e => setExamDate(e.target.value)} className="mt-1" required />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Target Score <span className="text-muted-foreground/50">(optional)</span></label>
            <Input value={targetScore} onChange={e => setTargetScore(e.target.value)} placeholder="e.g. 680/720 or 99 percentile" className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Personal Note <span className="text-muted-foreground/50">(optional)</span></label>
            <Input value={personalNote} onChange={e => setPersonalNote(e.target.value)} placeholder="Your why… e.g. For my family" className="mt-1" maxLength={100} />
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !examName.trim() || !examDate} className="bg-violet-600 hover:bg-violet-500 text-white">
              {saving ? "Saving…" : "Save Aim"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}



/** Today's actionable focus — flashcards due + next exam + weak topic drill */
function TodayActionsCard({
  weakTopics,
}: {
  weakTopics: Array<{ subtopic: string; topic: string; accuracy: number }>;
}) {
  const { data: focus } = useQuery({
    queryKey: ["today-focus"],
    queryFn: () => customFetch<{ flashcardsDue: number; nextExam: { id: string; title: string; scheduledAt: string } | null }>("/api/me/today-focus"),
    staleTime: 5 * 60 * 1000,
  });

  const topWeak = weakTopics.find(t => t.accuracy < 70);
  const hasSomething = (focus?.flashcardsDue ?? 0) > 0 || topWeak || focus?.nextExam;
  if (!hasSomething) return null;

  return (
    <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-violet-500/10">
        <Sparkles className="w-3.5 h-3.5 text-violet-400" />
        <h3 className="text-sm font-semibold">Today's Actions</h3>
      </div>
      <div className="p-3 space-y-2">

        {(focus?.flashcardsDue ?? 0) > 0 && (
          <Link href="/revision">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer group">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
                <BookOpen className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold leading-tight">
                  {focus!.flashcardsDue} flashcard{focus!.flashcardsDue === 1 ? "" : "s"} due
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Review now to keep streak</p>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </div>
          </Link>
        )}

        {topWeak && (
          <Link href={`/practice?topic=${encodeURIComponent(topWeak.subtopic || topWeak.topic)}`}>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/60 hover:border-rose-500/40 hover:bg-rose-500/5 transition-all cursor-pointer group">
              <div className="w-9 h-9 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-400 shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold leading-tight truncate">
                  Practice: {topWeak.subtopic || topWeak.topic}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{topWeak.accuracy}% accuracy — needs work</p>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </div>
          </Link>
        )}

        {focus?.nextExam && (
          <Link href={`/exams/${focus.nextExam.id}`}>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/60 hover:border-violet-500/40 hover:bg-violet-500/5 transition-all cursor-pointer group">
              <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-400 shrink-0">
                <Timer className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold leading-tight truncate">{focus.nextExam.title}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Starts {format(new Date(focus.nextExam.scheduledAt), "MMM d 'at' h:mm a")}
                </p>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </div>
          </Link>
        )}

      </div>
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [drillTopic, setDrillTopic] = useState<string | null>(null);
  const { user } = useUser();
  const localDate = format(new Date(), "yyyy-MM-dd");
  const { data: summary, isLoading: loadingSummary } = useQuery({
    ...dashboardQueryOptions,
    queryKey: ["dashboard-summary", localDate],
    queryFn: () => customFetch<any>(`/api/dashboard/summary?localDate=${localDate}`),
  });
  const { data: me } = useGetMe({ query: profileQueryOptions });
  const { data: goals, isLoading: loadingGoals } = useGetTodayGoals({
    query: { staleTime: 3 * 60 * 1000, gcTime: 10 * 60 * 1000, refetchOnWindowFocus: false },
  });
  const { data: focusRooms } = useListFocusRooms({ query: slowDataQueryOptions });
  const { data: leaderboardData } = useGetLeaderboard({ query: slowDataQueryOptions });
  const inlineRank = useMemo(() => {
    if (!leaderboardData || !me) return null;
    const arr = Array.isArray(leaderboardData) ? leaderboardData : [];
    const entry = arr.find((e: any) => e.userId === (me as any).id);
    return entry ? { rank: (entry as any).rank, total: arr.length } : null;
  }, [leaderboardData, me]);
  const toggleGoal = useToggleGoal();
  const createGoal = useCreateGoal();

  const [goalDialog, setGoalDialog] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [newGoalXp, setNewGoalXp] = useState("50");

  const { data: recommendedExams = [], isLoading: loadingRecommended } = useQuery({
    queryKey: ["recommended-exams"],
    queryFn: () => customFetch<Array<{ id: string; title: string; exam: string; kind: string; durationMinutes: number; totalQuestions: number; difficulty: string; matchScore: number; matchReasons: string[] }>>("/api/mock/performance/recommended-exams"),
    staleTime: 10 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
  });

  const { data: weakTopics = [], isLoading: loadingWeakTopics } = useQuery({
    queryKey: ["weak-subtopics"],
    queryFn: () => customFetch<Array<{ subtopic: string; subject: string; topic: string; accuracy: number; total: number }>>("/api/mock/performance/weak-subtopics"),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  const { data: scheduleSlots = [], isLoading: loadingSchedule } = useQuery({
    queryKey: ["scheduleSlots"],
    queryFn: () => customFetch<any[]>("/api/schedule"),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: overdueSlots = [], isLoading: loadingOverdue } = useQuery({
    queryKey: ["overdueSlots"],
    queryFn: () => {
      const localDate = format(new Date(), "yyyy-MM-dd");
      return customFetch<any[]>(`/api/schedule/overdue?date=${localDate}`);
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const toggleSlot = useMutation({
    mutationFn: ({ id, isCompleted }: { id: string; isCompleted: boolean }) => 
      customFetch(`/api/schedule/${id}/toggle`, { method: "PATCH", body: JSON.stringify({ isCompleted }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduleSlots"] });
      queryClient.invalidateQueries({ queryKey: ["overdueSlots"] });
    },
  });

  const todaySlots = scheduleSlots
    .filter(s => !s.date || s.date === format(new Date(), "yyyy-MM-dd"))
    .sort((a: any, b: any) => a.startTime.localeCompare(b.startTime));
  const doneSlots = todaySlots.filter((s: any) => s.isCompleted).length;

  const nowTime = format(new Date(), "HH:mm");
  const nowSlot = todaySlots.find((s: any) => !s.isCompleted && s.startTime <= nowTime && s.endTime > nowTime);
  const upNextSlot = todaySlots.find((s: any) => !s.isCompleted && s.startTime > nowTime);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 5)  return "Late Night Grind";
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    if (h < 21) return "Good Evening";
    return "Night Owl Mode";
  }, []);

  const greetingEmoji = useMemo(() => {
    const h = new Date().getHours();
    if (h < 5)  return "🌙";
    if (h < 12) return "☀️";
    if (h < 17) return "⚡";
    if (h < 21) return "🌆";
    return "🌙";
  }, []);

  const displayName = user?.firstName || (summary as any)?.displayName?.split(" ")[0] || "Scholar";
  const examFocus = (user?.unsafeMetadata?.examFocus as string) || me?.examFocus;
  const todayPct = summary ? Math.min(100, (summary.todayMinutes / summary.dailyTargetMinutes) * 100) : 0;
  const xpPct = summary ? Math.min(100, (summary.xp / summary.xpForNextLevel) * 100) : 0;

  const handleAddGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalTitle.trim()) return;
    createGoal.mutate({ data: { title: newGoalTitle, xp: parseInt(newGoalXp) || 50 } }, {
      onSuccess: () => {
        toast.success("Goal added! 🎯");
        setNewGoalTitle(""); setNewGoalXp("50"); setGoalDialog(false);
        queryClient.invalidateQueries({ queryKey: getGetTodayGoalsQueryKey() });
      },
    });
  };

  if (loadingSummary || !summary) return <DashboardSkeleton />;

  const itemV = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.18, ease: "easeOut" } } };
  const containerV = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };

  return (
    <>
    <motion.div variants={containerV} initial="hidden" animate="show" className="space-y-8 w-full pb-10">

      {/* ── Greeting + inline stats + actions ── */}
      <motion.div variants={itemV}>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {greeting}, {displayName}! {greetingEmoji}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                <span className="font-bold text-foreground">{fmtMins(summary.todayMinutes)}</span> today
              </span>
              <span className="text-muted-foreground/30 hidden sm:inline">·</span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Flame className="w-3.5 h-3.5 text-orange-500" />
                <span className="font-bold text-foreground">{summary.streakDays}</span> day streak
              </span>
              <span className="text-muted-foreground/30 hidden sm:inline">·</span>
              {inlineRank && (
                <>
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Trophy className="w-3.5 h-3.5 text-amber-500" />
                    <span className={cn("font-bold", inlineRank.rank <= 3 ? "text-amber-400" : "text-foreground")}>#{inlineRank.rank}</span> of {inlineRank.total}
                  </span>
                  <span className="text-muted-foreground/30 hidden sm:inline">·</span>
                </>
              )}
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Zap className="w-3.5 h-3.5 text-violet-500" />
                <span className="font-bold text-foreground">{summary.xp} XP</span> · Lv {summary.level}
              </span>
            </div>
          </div>
          {examFocus && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/60 border text-sm text-muted-foreground shrink-0 self-start">
              <Target className="w-3.5 h-3.5" />
              {examFocus}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <Link href="/focus-rooms">
            <Button className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 rounded-full px-5">
              <Play className="w-3.5 h-3.5" fill="currentColor" /> Start Session
            </Button>
          </Link>
          <Link href="/doubts">
            <Button variant="outline" className="gap-2 rounded-full px-5">
              <MessageSquare className="w-3.5 h-3.5" /> Ask a Doubt
            </Button>
          </Link>
          <Link href="/revision">
            <Button variant="outline" className="gap-2 rounded-full px-5">
              <BookOpen className="w-3.5 h-3.5" /> Flashcards
            </Button>
          </Link>
        </div>
      </motion.div>

      {/* ── Streak At Risk Banner ── */}
      {summary.streakDays > 0 && summary.todayMinutes === 0 && new Date().getHours() >= 20 && (
        <motion.div variants={itemV}>
          <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-orange-500/10 border border-orange-500/30 text-orange-400">
            <Flame className="w-5 h-5 shrink-0 animate-pulse" />
            <p className="text-sm font-bold flex-1">
              Your {summary.streakDays}-day streak ends at midnight — study now to keep it alive!
            </p>
            <Link href="/focus-rooms">
              <Button size="sm" className="bg-orange-500 hover:bg-orange-400 text-white border-none h-8 px-4 text-xs font-bold shrink-0">
                Study Now
              </Button>
            </Link>
          </div>
        </motion.div>
      )}

      {/* ── Weekly Pulse Strip ── */}
      {summary.weeklyMinutes > 0 && (
        <motion.div variants={itemV}>
          <div className="rounded-2xl border border-violet-500/25 bg-linear-to-r from-violet-500/8 to-cyan-500/5 px-5 py-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <Sparkles className="w-4 h-4 text-violet-400 shrink-0" />
                <div className="text-sm leading-snug">
                  <span className="font-bold text-foreground">This week: </span>
                  <span className="text-primary font-bold">
                    {(() => { const h = Math.floor(summary.weeklyMinutes / 60); const m = summary.weeklyMinutes % 60; return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m}m`; })()}
                  </span>
                  {" studied · "}
                  <span className="font-bold text-orange-400">{summary.streakDays}d streak</span>
                  {weakTopics[0] && (
                    <span className="text-muted-foreground">
                      {" · "}⚠️ Weak: <span className="text-rose-400 font-semibold">{weakTopics[0].subtopic || weakTopics[0].topic}</span>
                      <span className="text-muted-foreground/70"> ({weakTopics[0].accuracy}%)</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {weakTopics[0] && (
                    <button
                      onClick={() => setDrillTopic(weakTopics[0].subtopic || weakTopics[0].topic)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-primary/15 hover:bg-primary/25 text-primary text-xs font-bold border border-primary/30 transition-all"
                    >
                      <Zap className="w-3 h-3" /> Practice Now
                    </button>
                  )}
                </div>
              </div>
              <Link href="/analytics">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs text-violet-400 border-violet-500/30 hover:bg-violet-500/10 shrink-0 h-8">
                  <TrendingUp className="w-3.5 h-3.5" /> Full Report
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Two-column grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

        {/* Left (2/3) */}
        <div className="md:col-span-2 space-y-8">

          {/* Focus + Streak — single subtle-tint section */}
          <motion.div variants={itemV}>
            <div className="rounded-2xl bg-white/[0.025] border border-white/[0.06] p-5 space-y-5">
              <div className="flex items-center gap-5">
                <FocusRing pct={todayPct} minutes={summary.todayMinutes} target={summary.dailyTargetMinutes} />
                <div className="flex-1">
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">Today's Focus</p>
                  <p className="text-2xl font-black mt-0.5">{Math.round(todayPct)}%</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {summary.dailyTargetMinutes - summary.todayMinutes > 0
                      ? `${fmtMins(summary.dailyTargetMinutes - summary.todayMinutes)} left`
                      : "Daily goal hit! 🎉"}
                  </p>
                  {todayPct >= 100 && (
                    <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3" /> Goal complete
                    </span>
                  )}
                </div>
              </div>
              <div className="border-t border-white/[0.06] pt-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Flame className="w-3.5 h-3.5 text-orange-500" />
                    <span className="text-sm font-bold">{summary.streakDays} day streak</span>
                  </div>
                  <span className="text-xs text-muted-foreground">Level {summary.level} · {summary.xp} / {summary.xpForNextLevel} XP</span>
                </div>
                <StreakDots activeDays={summary.activeDaysThisWeek} />
                <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${xpPct}%` }}
                    transition={{ duration: 1, ease: "easeOut", delay: 0.5 }}
                    className="h-full rounded-full bg-linear-to-r from-violet-500 to-fuchsia-500"
                  />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Overdue Catch-up Section (only shows if there are overdue tasks) */}
          {overdueSlots.length > 0 && (
            <motion.div variants={itemV}>
              <div className="rounded-2xl border border-red-500/30 bg-red-500/5 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-red-500/20 bg-red-500/10">
                  <div>
                    <h2 className="font-bold text-base flex items-center gap-2 text-red-500">
                      <AlertTriangle className="w-4 h-4" />
                      Catch Up: Overdue Tasks
                    </h2>
                    <p className="text-xs text-red-400/80 mt-0.5">
                      You missed {overdueSlots.length} task{overdueSlots.length > 1 ? 's' : ''} from previous days. Let's finish them!
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-red-500/10">
                  {overdueSlots.map((slot) => (
                    <div
                      key={slot.id}
                      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-red-500/10"
                    >
                      <span className="text-[11px] text-red-400 font-mono w-[90px] shrink-0 flex items-center gap-1">
                        <Timer className="w-3 h-3" /> {format(new Date(slot.date), "MMM d")}
                      </span>
                      {slot.type === 'mock_test' ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 min-w-[64px] text-center bg-yellow-500/20 text-yellow-500">MOCK</span>
                      ) : slot.type === 'event' ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 min-w-[64px] text-center bg-indigo-500/20 text-indigo-400">EVENT</span>
                      ) : slot.subject ? (
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 min-w-[64px] text-center"
                          style={{ backgroundColor: slot.subject.color + "22", color: slot.subject.color }}
                        >
                          {slot.subject.name}
                        </span>
                      ) : <span className="min-w-[64px] shrink-0" />}
                      <span className="flex-1 text-sm truncate text-red-100">{slot.title}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <button 
                          onClick={() => toggleSlot.mutate({ id: slot.id, isCompleted: !slot.isCompleted })}
                          className="text-red-400 hover:text-emerald-400 transition-colors"
                        >
                          <Circle className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Today's Schedule */}
          <motion.div variants={itemV}>
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="font-bold text-base flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    Today's Schedule
                    {nowSlot && (
                      <span className="text-[9px] font-black tracking-widest px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                        LIVE
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {doneSlots} of {todaySlots.length} sessions done
                    {nowSlot && <span className="text-indigo-400 ml-1">· {nowSlot.title} in progress</span>}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="text-xs h-8 gap-1" onClick={() => setLocation("/schedule")}>
                    <Plus className="w-3.5 h-3.5" /> Plan Week
                  </Button>
                  <Link href="/focus-rooms">
                    <Button size="sm" className="gap-1.5 text-xs h-8 rounded-md">
                      <Play className="w-3 h-3" fill="currentColor" /> Start
                    </Button>
                  </Link>
                </div>
              </div>

              <div className="divide-y divide-border/40">
                {loadingSchedule ? (
                  <div className="divide-y divide-border/40">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-3 px-5 py-3">
                        <Skeleton className="w-16 h-4" />
                        <Skeleton className="w-12 h-5 rounded-md" />
                        <Skeleton className="flex-1 h-4" />
                        <Skeleton className="w-5 h-5 rounded-full" />
                      </div>
                    ))}
                  </div>
                ) : todaySlots.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-sm text-muted-foreground mb-2">No sessions planned for today.</p>
                    <Button variant="ghost" size="sm" onClick={() => setLocation("/schedule")}>Create one now</Button>
                  </div>
                ) : (
                  todaySlots.map((slot: any) => {
                    const isNow = slot.id === nowSlot?.id;
                    const isNext = !isNow && slot.id === upNextSlot?.id;
                    return (
                      <div
                        key={slot.id}
                        className={cn(
                          "flex items-center gap-3 px-5 py-3 transition-all",
                          isNow && "bg-indigo-500/10 border-l-2 border-indigo-500",
                          isNext && "bg-zinc-800/30",
                          slot.isCompleted && "opacity-40",
                          !slot.isCompleted && !isNow && "hover:bg-muted/30",
                        )}
                      >
                        {/* Time + live badge */}
                        <div className="w-[90px] shrink-0 flex flex-col gap-0.5">
                          <span className="text-[11px] text-muted-foreground font-mono">{slot.startTime} – {slot.endTime}</span>
                          {isNow && (
                            <span className="text-[9px] font-black tracking-widest text-indigo-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse inline-block" />
                              NOW
                            </span>
                          )}
                          {isNext && (
                            <span className="text-[9px] font-bold tracking-widest text-zinc-500 uppercase">Up Next</span>
                          )}
                        </div>

                        {/* Type badge */}
                        {slot.type === 'mock_test' ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 min-w-[56px] text-center bg-yellow-500/20 text-yellow-500 flex items-center gap-1 justify-center">
                            <Trophy className="w-3 h-3" /> MOCK
                          </span>
                        ) : slot.type === 'event' ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 min-w-[56px] text-center bg-indigo-500/20 text-indigo-400 flex items-center gap-1 justify-center">
                            <Calendar className="w-3 h-3" /> EVENT
                          </span>
                        ) : slot.subject ? (
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 min-w-[56px] text-center"
                            style={{ backgroundColor: slot.subject.color + "22", color: slot.subject.color }}
                          >
                            {slot.subject.name}
                          </span>
                        ) : <span className="min-w-[56px] shrink-0" />}

                        {/* Title */}
                        <span className={cn(
                          "flex-1 text-sm truncate",
                          slot.isCompleted ? "line-through text-zinc-500" : isNow ? "text-zinc-100 font-semibold" : "text-zinc-200",
                        )}>
                          {slot.title}
                        </span>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          {isNow && !slot.isCompleted && (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-6 px-2 text-[10px] bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 border-0"
                              onClick={() => setLocation(`/timer?mode=pomodoro&title=${encodeURIComponent(slot.title)}`)}
                            >
                              <Play className="w-2.5 h-2.5 mr-1" fill="currentColor" /> Start
                            </Button>
                          )}
                          <button
                            onClick={() => toggleSlot.mutate({ id: slot.id, isCompleted: !slot.isCompleted })}
                            className="text-zinc-400 hover:text-indigo-400 transition-colors"
                          >
                            {slot.isCompleted ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Circle className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </motion.div>

          {/* Getting Started checklist — shown until all 5 tasks done */}
          <motion.div variants={itemV}>
            <GettingStartedCard examFocus={me?.examFocus} />
          </motion.div>

          {/* Today's Actions */}
          <motion.div variants={itemV}>
            <TodayActionsCard weakTopics={weakTopics} />
          </motion.div>

          {/* Today's Goals */}
          <motion.div variants={itemV}>
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="font-bold text-base">Today's Goals</h2>
                  {goals && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {goals.filter(g => g.completed).length} of {goals.length} completed
                    </p>
                  )}
                </div>
                <Dialog open={goalDialog} onOpenChange={setGoalDialog}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 text-xs gap-1">
                      <Plus className="w-3.5 h-3.5" /> Add Goal
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Add Daily Goal</DialogTitle></DialogHeader>
                    <form onSubmit={handleAddGoal} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">Goal Title</label>
                        <Input value={newGoalTitle} onChange={e => setNewGoalTitle(e.target.value)} placeholder="E.g. Complete Chapter 5" required />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">XP Reward</label>
                        <Input type="number" value={newGoalXp} onChange={e => setNewGoalXp(e.target.value)} min={10} max={200} />
                      </div>
                      <DialogFooter><Button type="submit" disabled={createGoal.isPending}>Add Goal</Button></DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <div>
                {loadingGoals ? (
                  <div className="space-y-2.5">{[1,2,3].map(i => <Skeleton key={i} className="h-9 w-full rounded-lg" />)}</div>
                ) : goals && goals.length > 0 ? (
                  <div className="space-y-1">
                    {goals.map((goal) => (
                      <div
                        key={goal.id}
                        className="flex items-center gap-3 p-2 hover:bg-muted/40 rounded-lg transition-colors group cursor-pointer"
                        onClick={() => toggleGoal.mutate({ id: goal.id }, {
                          onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetTodayGoalsQueryKey() }),
                        })}
                      >
                        <Checkbox
                          id={goal.id}
                          checked={goal.completed}
                          className="pointer-events-none"
                        />
                        <label
                          className={cn(
                            "flex-1 text-sm cursor-pointer select-none transition-all",
                            goal.completed && "line-through text-muted-foreground"
                          )}
                        >
                          {goal.title}
                        </label>
                        <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                          +{goal.xp} XP
                        </span>
                      </div>
                    ))}
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <Progress value={(goals.filter(g => g.completed).length / goals.length) * 100} className="h-1" />
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 flex flex-col items-center gap-2">
                    <Target className="w-8 h-8 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">No goals yet — set your first one!</p>
                    <Button variant="outline" size="sm" onClick={() => setGoalDialog(true)} className="mt-1 text-xs">
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add Goal
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

        </div>

        {/* Right Sidebar */}
        <div className="space-y-5">

          {/* Aim Widget */}
          <motion.div variants={itemV}>
            <AimWidget />
          </motion.div>

          {/* Recommended Next Mock */}
          {(loadingRecommended || recommendedExams.length > 0) && (
            <motion.div variants={itemV}>
              <div className="rounded-2xl border bg-card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3.5 border-b border-border/50">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Trophy className="w-3.5 h-3.5 text-violet-400" /> Recommended Mocks
                  </h3>
                  <Link href="/exams">
                    <Button variant="ghost" size="sm" className="text-xs h-7 px-2">All →</Button>
                  </Link>
                </div>
                <div className="p-3 space-y-1">
                  {loadingRecommended ? (
                    <div className="space-y-2 p-1">
                      {[1,2].map(i => <div key={i} className="h-14 bg-muted/50 rounded-xl animate-pulse" />)}
                    </div>
                  ) : (
                    recommendedExams.slice(0, 3).map(exam => (
                      <Link key={exam.id} href={`/exams/${exam.id}`}>
                        <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer group">
                          <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-400 shrink-0 text-xs font-bold">
                            {exam.difficulty === "hard" ? "H" : exam.difficulty === "easy" ? "E" : "M"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate">{exam.title}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {exam.totalQuestions}Q · {exam.durationMinutes}m
                              {exam.matchScore > 0 && (
                                <span className="ml-1 text-violet-400">· matches weak topics</span>
                              )}
                            </p>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* Active Focus Rooms */}
          <motion.div variants={itemV}>
            <div className="rounded-2xl border bg-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-border/50">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Radio className="w-3.5 h-3.5 text-primary" /> Active Rooms
                </h3>
                <div className="flex items-center gap-2">
                  {focusRooms && focusRooms.reduce((s, r) => s + r.activeUsers.length, 0) > 0 && (
                    <span className="text-[10px] text-emerald-400 font-semibold">
                      {focusRooms.reduce((s, r) => s + r.activeUsers.length, 0)} online
                    </span>
                  )}
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                </div>
              </div>
              <div className="p-3 space-y-1">
                {focusRooms?.slice(0, 3).map(room => (
                  <Link key={room.id} href={`/focus-rooms/${room.id}`}>
                    <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer group">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <Radio className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{room.name}</p>
                        <p className="text-[10px] text-muted-foreground">{room.participantCount} studying</p>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </Link>
                )) ?? (
                  <div className="text-center py-4">
                    <p className="text-xs text-muted-foreground mb-2">No active rooms</p>
                    <Link href="/focus-rooms">
                      <Button variant="outline" size="sm" className="w-full text-xs">Create a Room</Button>
                    </Link>
                  </div>
                )}
                {focusRooms && focusRooms.length > 0 && (
                  <Link href="/focus-rooms">
                    <Button variant="ghost" size="sm" className="w-full text-xs mt-1">
                      View All Rooms <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </motion.div>

          {/* Weak Topics */}
          <motion.div variants={itemV}>
            <div className="rounded-2xl border bg-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-border/50">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-rose-400" /> Weak Topics
                </h3>
                <Link href="/exams">
                  <Button variant="ghost" size="sm" className="text-xs h-7 px-2">Practice →</Button>
                </Link>
              </div>
              <div className="px-4 py-3 space-y-3">
                {loadingWeakTopics ? (
                  <div className="space-y-3 py-1">
                    {[1,2,3].map(i => <div key={i} className="space-y-1.5"><div className="h-3 bg-muted rounded w-3/4" /><div className="h-1 bg-muted rounded" /></div>)}
                  </div>
                ) : weakTopics.length === 0 ? (
                  <div className="py-6 text-center">
                    <p className="text-xs text-muted-foreground">Take a mock test to see your weak topics here.</p>
                    <Link href="/exams">
                      <Button variant="ghost" size="sm" className="mt-2 text-xs h-7">Browse Tests →</Button>
                    </Link>
                  </div>
                ) : (
                  weakTopics.map((t, i) => {
                    const barColor =
                      t.accuracy < 40 ? "bg-rose-500" :
                      t.accuracy < 55 ? "bg-orange-500" :
                      t.accuracy < 70 ? "bg-amber-500" : "bg-emerald-500";
                    return (
                      <Link key={i} href={`/practice?topic=${encodeURIComponent(t.subtopic || t.topic)}`}>
                      <div className="hover:bg-muted/30 rounded-lg px-1 py-1 -mx-1 transition-colors cursor-pointer">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium text-muted-foreground truncate max-w-[150px]">
                            <span className="text-muted-foreground/50 mr-1.5">{i + 1}.</span>
                            {t.subtopic || t.topic}
                          </span>
                          <span className="font-bold text-foreground/70 shrink-0 ml-1">{t.accuracy}%</span>
                        </div>
                        <div className="h-1 rounded-full bg-muted overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${t.accuracy}%` }}
                            transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 + i * 0.05 }}
                            className={cn("h-full rounded-full", barColor)}
                          />
                        </div>
                      </div>
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
          </motion.div>

        </div>
      </div>

      {/* ── Full-width: Study Heatmap ── */}
      <motion.div variants={itemV}>
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-500" />
              <h2 className="font-bold text-base">Study Heatmap</h2>
            </div>
          </div>
          <StudyHeatmap />
        </div>
      </motion.div>

      {/* ── Full-width: Sticky Notes ── */}
      <motion.div variants={itemV}>
        <StickyNotesWidget />
      </motion.div>

    </motion.div>

    {drillTopic && (
      <WeakTopicDrill
        open={!!drillTopic}
        onClose={() => setDrillTopic(null)}
        topic={drillTopic}
      />
    )}
    </>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-5 w-full pb-10">
      <Skeleton className="h-12 w-64 rounded-xl" />
      <div className="flex gap-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-9 w-32 rounded-full" />)}</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl sm:col-span-2" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-22 rounded-2xl" />
        <Skeleton className="h-22 rounded-2xl" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-5">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-56 rounded-2xl" />
        </div>
        <div className="space-y-5">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
