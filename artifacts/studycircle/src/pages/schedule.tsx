import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TimePicker } from "@/components/ui/time-picker";
import {
  Calendar, Plus, Clock, Trash2, CheckCircle2, Circle, Play,
  Trophy, AlertTriangle, Sun, Sunset, Moon, Edit2, Timer,
  PartyPopper, ChevronRight, Repeat2,
} from "lucide-react";
import { format, addDays, startOfWeek, isSameDay, getDay } from "date-fns";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Subject = { id: string; name: string; color: string };
type ScheduleSlot = {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  date: string | null;
  type: "study_session" | "mock_test" | "event";
  isRecurring: boolean;
  daysOfWeek: string | null;
  isCompleted: boolean;
  subject?: Subject;
};
type SlotFormState = {
  title: string;
  type: "study_session" | "mock_test" | "event";
  subjectName: string;
  startTime: string;
  endTime: string;
  isRecurring: boolean;
  daysOfWeek: number[]; // 0=Sun…6=Sat
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToDuration(mins: number) {
  if (mins <= 0) return "0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function getSection(t: string): "morning" | "afternoon" | "evening" {
  const h = parseInt(t.split(":")[0]);
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function fmt12(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function slotMatchesDay(slot: ScheduleSlot, dateStr: string, dow: number): boolean {
  if (slot.isRecurring && slot.daysOfWeek) {
    try {
      const days: number[] = JSON.parse(slot.daysOfWeek);
      return days.includes(dow);
    } catch { return false; }
  }
  return !slot.date || slot.date === dateStr;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SECTIONS = {
  morning:   { label: "Morning",   Icon: Sun,    cls: "text-amber-400",  range: "Before 12pm" },
  afternoon: { label: "Afternoon", Icon: Sunset, cls: "text-orange-400", range: "12 – 5pm"   },
  evening:   { label: "Evening",   Icon: Moon,   cls: "text-indigo-400", range: "After 5pm"  },
} as const;

const DOW_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const DOW_FULL   = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DEFAULT_FORM: SlotFormState = {
  title: "", type: "study_session", subjectName: "",
  startTime: "09:00", endTime: "10:00",
  isRecurring: false, daysOfWeek: [],
};

// ─── SlotTypeBadge ────────────────────────────────────────────────────────────

function SlotTypeBadge({ slot }: { slot: ScheduleSlot }) {
  if (slot.type === "mock_test") return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-yellow-500/20 text-yellow-400 flex items-center gap-1 shrink-0">
      <Trophy className="w-2.5 h-2.5" /> MOCK
    </span>
  );
  if (slot.type === "event") return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-400 flex items-center gap-1 shrink-0">
      <Calendar className="w-2.5 h-2.5" /> EVENT
    </span>
  );
  if (slot.subject) return (
    <span
      className="text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0"
      style={{ backgroundColor: slot.subject.color + "22", color: slot.subject.color }}
    >
      {slot.subject.name}
    </span>
  );
  return null;
}

// ─── SessionRow ───────────────────────────────────────────────────────────────

function SessionRow({
  slot, isNow, onToggle, onDelete, onEdit, onStart,
}: {
  slot: ScheduleSlot;
  isNow?: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onStart: () => void;
}) {
  const duration = minutesToDuration(timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime));
  const barColor = slot.subject?.color ?? (slot.type === "mock_test" ? "#eab308" : "#6366f1");

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: slot.isCompleted ? 0.45 : 1, y: 0 }}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-xl transition-all group",
        isNow
          ? "bg-indigo-500/10 ring-1 ring-indigo-500/30 shadow-[0_0_16px_rgba(99,102,241,0.08)]"
          : slot.isCompleted
          ? "bg-muted/30"
          : "hover:bg-muted/50",
      )}
    >
      <div className="w-0.5 h-10 rounded-full shrink-0" style={{ backgroundColor: barColor }} />

      <button onClick={onToggle} className="shrink-0 text-muted-foreground hover:text-indigo-400 transition-colors">
        {slot.isCompleted
          ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          : <Circle className="w-5 h-5" />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {isNow && (
            <span className="text-[9px] font-black tracking-widest px-1.5 py-0.5 rounded bg-indigo-500/30 text-indigo-300 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              NOW
            </span>
          )}
          {slot.isRecurring && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground flex items-center gap-1">
              <Repeat2 className="w-2.5 h-2.5" /> RECURRING
            </span>
          )}
          <SlotTypeBadge slot={slot} />
        </div>
        <p className={cn(
          "text-sm font-semibold mt-0.5 truncate",
          slot.isCompleted ? "line-through text-muted-foreground" : "text-foreground",
        )}>
          {slot.title}
        </p>
        <div className="flex items-center gap-1 mt-0.5 text-[11px] text-muted-foreground font-mono">
          <Clock className="w-2.5 h-2.5" />
          {fmt12(slot.startTime)} – {fmt12(slot.endTime)}
          <span className="text-muted-foreground/40 mx-0.5">·</span>
          {duration}
          {slot.isRecurring && slot.daysOfWeek && (() => {
            try {
              const days: number[] = JSON.parse(slot.daysOfWeek);
              return <span className="text-muted-foreground/40 mx-0.5">· {days.map(d => DOW_FULL[d]).join(", ")}</span>;
            } catch { return null; }
          })()}
        </div>
      </div>

      <div className={cn(
        "flex items-center gap-1 shrink-0 transition-opacity",
        isNow ? "opacity-100" : "opacity-0 group-hover:opacity-100",
      )}>
        {!slot.isCompleted && (
          <Button
            size="sm"
            variant="secondary"
            className="h-7 px-2.5 text-xs bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 border-0"
            onClick={onStart}
          >
            <Play className="w-3 h-3 mr-1" fill="currentColor" /> Start
          </Button>
        )}
        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={onEdit}>
          <Edit2 className="w-3.5 h-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-red-400" onClick={onDelete}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </motion.div>
  );
}

// ─── SlotSection ──────────────────────────────────────────────────────────────

function SlotSection({
  section, slots, currentSlotId, onToggle, onDelete, onEdit, onStart,
}: {
  section: keyof typeof SECTIONS;
  slots: ScheduleSlot[];
  currentSlotId?: string;
  onToggle: (id: string, val: boolean) => void;
  onDelete: (id: string) => void;
  onEdit: (slot: ScheduleSlot) => void;
  onStart: (slot: ScheduleSlot) => void;
}) {
  const cfg = SECTIONS[section];
  const done = slots.filter(s => s.isCompleted).length;

  return (
    <div>
      <div className="flex items-center gap-2 px-1 mb-2">
        <cfg.Icon className={cn("w-3.5 h-3.5", cfg.cls)} />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{cfg.label}</span>
        <span className="text-[10px] text-muted-foreground/60">{cfg.range}</span>
        <span className="ml-auto text-[10px] text-muted-foreground/60 tabular-nums">{done}/{slots.length}</span>
      </div>
      <div className="space-y-1">
        {slots.map(slot => (
          <SessionRow
            key={slot.id}
            slot={slot}
            isNow={slot.id === currentSlotId}
            onToggle={() => onToggle(slot.id, !slot.isCompleted)}
            onDelete={() => onDelete(slot.id)}
            onEdit={() => onEdit(slot)}
            onStart={() => onStart(slot)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── SlotDialog ───────────────────────────────────────────────────────────────

function SlotDialog({
  open, onOpenChange, initial, subjects, selectedDate, onSave, isSaving,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: SlotFormState & { id?: string };
  subjects: Subject[];
  selectedDate: Date;
  onSave: (data: SlotFormState & { id?: string }) => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<SlotFormState>(initial ?? DEFAULT_FORM);
  const isEdit = !!initial?.id;

  useEffect(() => { setForm(initial ?? DEFAULT_FORM); }, [initial, open]);

  const set = <K extends keyof SlotFormState>(k: K, v: SlotFormState[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const toggleDow = (d: number) =>
    setForm(f => ({
      ...f,
      daysOfWeek: f.daysOfWeek.includes(d)
        ? f.daysOfWeek.filter(x => x !== d)
        : [...f.daysOfWeek, d].sort(),
    }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    if (form.type === "study_session" && !form.subjectName.trim()) {
      toast.error("Subject is required"); return;
    }
    if (form.isRecurring && form.daysOfWeek.length === 0) {
      toast.error("Pick at least one day for recurring sessions"); return;
    }
    onSave({ ...form, id: initial?.id });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Session" : "Add Session"}</DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">{format(selectedDate, "EEEE, MMMM d")}</p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={form.type} onValueChange={v => set("type", v as SlotFormState["type"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="study_session">Study Session</SelectItem>
                <SelectItem value="mock_test">Mock Test</SelectItem>
                <SelectItem value="event">Other Event</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input
              required
              value={form.title}
              onChange={e => set("title", e.target.value)}
              placeholder={form.type === "mock_test" ? "e.g. GATE Full Mock 1" : "e.g. Practice Set 3"}
            />
          </div>

          {form.type === "study_session" && (
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input
                required
                value={form.subjectName}
                onChange={e => set("subjectName", e.target.value)}
                placeholder="e.g. Mathematics"
                list="subject-suggestions"
              />
              <datalist id="subject-suggestions">
                {subjects.map(s => <option key={s.id} value={s.name} />)}
              </datalist>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start</Label>
              <TimePicker value={form.startTime} onChange={v => set("startTime", v)} />
            </div>
            <div className="space-y-1.5">
              <Label>End</Label>
              <TimePicker value={form.endTime} onChange={v => set("endTime", v)} />
            </div>
          </div>

          {/* Recurring toggle */}
          <div className="rounded-xl border border-border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <Repeat2 className="w-3.5 h-3.5 text-indigo-400" /> Recurring session
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Repeats automatically every selected day</p>
              </div>
              <Switch
                checked={form.isRecurring}
                onCheckedChange={v => set("isRecurring", v)}
              />
            </div>

            <AnimatePresence>
              {form.isRecurring && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <p className="text-[11px] text-muted-foreground mb-2">Repeat on</p>
                  <div className="flex gap-1.5">
                    {DOW_LABELS.map((label, d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleDow(d)}
                        className={cn(
                          "flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all",
                          form.daysOfWeek.includes(d)
                            ? "bg-indigo-600 text-white"
                            : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Button type="submit" className="w-full" disabled={isSaving}>
            {isSaving ? "Saving…" : isEdit ? "Update Session" : "Add Session"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── DayCompleteCard ──────────────────────────────────────────────────────────

function DayCompleteCard({ date, onPlanTomorrow }: { date: Date; onPlanTomorrow: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 p-6 flex flex-col items-center text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.15 }}
        className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4"
      >
        <PartyPopper className="w-8 h-8 text-emerald-400" />
      </motion.div>
      <h3 className="text-lg font-black text-emerald-300 mb-1">Day Complete!</h3>
      <p className="text-sm text-zinc-400 mb-5">
        All sessions done for {format(date, "EEEE")}. Great discipline — keep the streak going!
      </p>
      <Button
        size="sm"
        className="bg-emerald-600/80 hover:bg-emerald-600 text-white border-0 gap-1.5"
        onClick={onPlanTomorrow}
      >
        Plan Tomorrow <ChevronRight className="w-3.5 h-3.5" />
      </Button>
    </motion.div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showAdd, setShowAdd] = useState(false);
  const [editSlot, setEditSlot] = useState<(SlotFormState & { id: string }) | null>(null);
  const [overdueVisible, setOverdueVisible] = useState(true);

  // ── Data ──
  const { data: slots = [], isLoading } = useQuery<ScheduleSlot[]>({
    queryKey: ["scheduleSlots"],
    queryFn: () => customFetch<ScheduleSlot[]>("/api/schedule"),
    staleTime: 5 * 60 * 1000,
  });

  const { data: subjects = [] } = useQuery<Subject[]>({
    queryKey: ["subjects"],
    queryFn: () => customFetch<Subject[]>("/api/subjects"),
    staleTime: 5 * 60 * 1000,
  });

  const { data: overdueSlots = [] } = useQuery<ScheduleSlot[]>({
    queryKey: ["overdueSlots"],
    queryFn: () => customFetch<ScheduleSlot[]>(`/api/schedule/overdue?date=${format(new Date(), "yyyy-MM-dd")}`),
    staleTime: 5 * 60 * 1000,
  });

  // ── Mutations ──
  const addSlot = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      customFetch("/api/schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["scheduleSlots"] }); toast.success("Session added!"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateSlot = useMutation({
    mutationFn: ({ id, ...data }: Record<string, unknown>) =>
      customFetch(`/api/schedule/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["scheduleSlots"] }); toast.success("Session updated!"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteSlot = useMutation({
    mutationFn: (id: string) => customFetch(`/api/schedule/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduleSlots"] });
      queryClient.invalidateQueries({ queryKey: ["overdueSlots"] });
      toast.success("Session deleted");
    },
  });

  const toggleSlot = useMutation({
    mutationFn: ({ id, isCompleted }: { id: string; isCompleted: boolean }) =>
      customFetch(`/api/schedule/${id}/toggle`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isCompleted }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduleSlots"] });
      queryClient.invalidateQueries({ queryKey: ["overdueSlots"] });
    },
  });

  // ── Week ──
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  // Per-day stats for color-coded dots
  const weekStats = useMemo(() => {
    return weekDays.reduce((acc, day) => {
      const dateStr = format(day, "yyyy-MM-dd");
      const dow = getDay(day);
      const daySlots = slots.filter(s => slotMatchesDay(s, dateStr, dow));
      acc[dateStr] = { total: daySlots.length, done: daySlots.filter(s => s.isCompleted).length };
      return acc;
    }, {} as Record<string, { total: number; done: number }>);
  }, [slots, weekDays]);

  // ── Selected day's slots ──
  const todayStr = format(selectedDate, "yyyy-MM-dd");
  const selectedDow = getDay(selectedDate);

  const todaySlots = useMemo(
    () => slots
      .filter(s => slotMatchesDay(s, todayStr, selectedDow))
      .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [slots, todayStr, selectedDow],
  );

  // ── Working Now ──
  const nowHHmm = format(new Date(), "HH:mm");
  const isViewingToday = isSameDay(selectedDate, new Date());
  const currentSlot = useMemo(
    () => isViewingToday
      ? todaySlots.find(s => !s.isCompleted && s.startTime <= nowHHmm && s.endTime > nowHHmm)
      : undefined,
    [todaySlots, nowHHmm, isViewingToday],
  );

  // ── Stats ──
  const totalMins = useMemo(
    () => todaySlots.reduce((sum, s) => sum + Math.max(0, timeToMinutes(s.endTime) - timeToMinutes(s.startTime)), 0),
    [todaySlots],
  );
  const doneCount = todaySlots.filter(s => s.isCompleted).length;
  const dayComplete = todaySlots.length > 0 && doneCount === todaySlots.length;
  const donePct = todaySlots.length > 0 ? Math.round((doneCount / todaySlots.length) * 100) : 0;

  // ── Sections ──
  const sections = useMemo(() => ({
    morning:   todaySlots.filter(s => getSection(s.startTime) === "morning"),
    afternoon: todaySlots.filter(s => getSection(s.startTime) === "afternoon"),
    evening:   todaySlots.filter(s => getSection(s.startTime) === "evening"),
  }), [todaySlots]);

  // ── Save handler ──
  const handleSave = async (form: SlotFormState & { id?: string }) => {
    let subjectId: string | undefined;
    if (form.type === "study_session") {
      const existing = subjects.find(s => s.name.toLowerCase() === form.subjectName.trim().toLowerCase());
      if (existing) {
        subjectId = existing.id;
      } else {
        try {
          const newSubj = await customFetch<Subject>("/api/subjects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: form.subjectName.trim(), color: "#8b5cf6" }),
          });
          queryClient.invalidateQueries({ queryKey: ["subjects"] });
          subjectId = newSubj.id;
        } catch {
          toast.error("Failed to create subject");
          return;
        }
      }
    }

    const payload = {
      title: form.title,
      type: form.type,
      subjectId: subjectId ?? null,
      startTime: form.startTime,
      endTime: form.endTime,
      isRecurring: form.isRecurring,
      daysOfWeek: form.isRecurring ? JSON.stringify(form.daysOfWeek) : null,
      date: form.isRecurring ? null : todayStr,
    };

    if (form.id) {
      updateSlot.mutate({ id: form.id, ...payload }, { onSuccess: () => setEditSlot(null) });
    } else {
      addSlot.mutate(payload, { onSuccess: () => setShowAdd(false) });
    }
  };

  const isSaving = addSlot.isPending || updateSlot.isPending;

  return (
    <div className="flex flex-col gap-5 max-w-3xl mx-auto pb-10">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Schedule</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Plan and track your daily study sessions</p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="w-4 h-4 mr-1.5" /> Add Session
        </Button>
      </div>

      {/* ── Week picker ── */}
      <div className="grid grid-cols-7 gap-1.5">
        {weekDays.map(day => {
          const dateStr = format(day, "yyyy-MM-dd");
          const isSelected = isSameDay(selectedDate, day);
          const isTodayDay = isSameDay(day, new Date());
          const stat = weekStats[dateStr] ?? { total: 0, done: 0 };
          const allDone = stat.total > 0 && stat.done === stat.total;
          const someDone = stat.total > 0 && stat.done > 0 && !allDone;
          const hasSessions = stat.total > 0;

          return (
            <button
              key={dateStr}
              onClick={() => setSelectedDate(day)}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 rounded-xl border transition-all",
                isSelected
                  ? "bg-indigo-600/20 border-indigo-500/50 text-indigo-300 shadow-[0_0_12px_rgba(99,102,241,0.2)]"
                  : isTodayDay
                  ? "bg-muted border-border text-foreground"
                  : "bg-card/50 border-border text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wide">{format(day, "EEE")}</span>
              <span className={cn("text-base font-black", isSelected && "text-indigo-200")}>{format(day, "d")}</span>
              {/* Color-coded completion dot */}
              <div className={cn(
                "w-1.5 h-1.5 rounded-full transition-colors",
                !hasSessions   ? "opacity-0" :
                allDone        ? "bg-emerald-400" :
                someDone       ? "bg-amber-400" :
                isSelected     ? "bg-indigo-400" :
                               "bg-muted-foreground/40",
              )} />
            </button>
          );
        })}
      </div>

      {/* ── Stat chips + progress bar ── */}
      <div className="space-y-2">
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Sessions", value: String(todaySlots.length)          },
            { label: "Hours",    value: minutesToDuration(totalMins)        },
            { label: "Done",     value: `${doneCount}/${todaySlots.length}` },
            { label: "Overdue",  value: String(overdueSlots.length), warn: overdueSlots.length > 0 },
          ].map(stat => (
            <div
              key={stat.label}
              className={cn(
                "rounded-xl border p-3 text-center",
                stat.warn ? "bg-red-500/5 border-red-500/20" : "bg-muted/60 border-border",
              )}
            >
              <p className={cn("text-xl font-black tabular-nums", stat.warn ? "text-red-400" : "text-foreground")}>
                {stat.value}
              </p>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Day progress bar */}
        {todaySlots.length > 0 && (
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${donePct}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className={cn(
                "h-full rounded-full",
                dayComplete ? "bg-emerald-500" : "bg-indigo-500",
              )}
            />
          </div>
        )}
      </div>

      {/* ── Working Now hero ── */}
      <AnimatePresence>
        {currentSlot && !dayComplete && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 flex items-center gap-4"
          >
            <div className="shrink-0 w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500" />
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-0.5">Working Now</p>
              <p className="text-sm font-bold text-foreground truncate">{currentSlot.title}</p>
              <p className="text-[11px] text-muted-foreground font-mono">{fmt12(currentSlot.startTime)} – {fmt12(currentSlot.endTime)}</p>
            </div>
            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-500 text-white shrink-0"
              onClick={() => navigate(`/timer?mode=pomodoro&title=${encodeURIComponent(currentSlot.title)}`)}
            >
              <Timer className="w-3.5 h-3.5 mr-1.5" /> Timer
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Overdue banner ── */}
      <AnimatePresence>
        {overdueSlots.length > 0 && overdueVisible && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className="rounded-xl border border-red-500/30 bg-red-500/5 overflow-hidden"
          >
            <button
              className="w-full flex items-center gap-2 px-4 py-3 hover:bg-red-500/5 transition-colors"
              onClick={() => setOverdueVisible(false)}
            >
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="text-sm font-semibold text-red-300 flex-1 text-left">
                {overdueSlots.length} overdue session{overdueSlots.length > 1 ? "s" : ""} from previous days
              </span>
              <span className="text-[10px] text-red-500">Dismiss</span>
            </button>
            <div className="px-4 pb-3 space-y-2">
              {overdueSlots.slice(0, 3).map(slot => (
                <div key={slot.id} className="flex items-center gap-2.5">
                  <span className="text-[10px] text-red-500 font-mono w-12 shrink-0">
                    {slot.date ? format(new Date(slot.date + "T00:00:00"), "MMM d") : "—"}
                  </span>
                  <SlotTypeBadge slot={slot} />
                  <span className="flex-1 text-xs text-zinc-300 truncate">{slot.title}</span>
                  <button
                    onClick={() => toggleSlot.mutate({ id: slot.id, isCompleted: true })}
                    className="text-[11px] text-emerald-500 hover:text-emerald-400 font-medium shrink-0"
                  >
                    Mark done
                  </button>
                </div>
              ))}
              {overdueSlots.length > 3 && (
                <p className="text-[10px] text-red-600">+{overdueSlots.length - 3} more</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Sessions ── */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 rounded-xl bg-muted/60 border border-border animate-pulse" />
          ))}
        </div>
      ) : dayComplete ? (
        <DayCompleteCard
          date={selectedDate}
          onPlanTomorrow={() => setSelectedDate(addDays(selectedDate, 1))}
        />
      ) : todaySlots.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-border rounded-2xl bg-muted/20">
          <div className="w-14 h-14 rounded-full bg-indigo-500/10 flex items-center justify-center mb-4">
            <Calendar className="w-7 h-7 text-indigo-400" />
          </div>
          <p className="text-base font-semibold text-foreground mb-1">Nothing planned for {format(selectedDate, "EEEE")}</p>
          <p className="text-sm text-muted-foreground mb-5 max-w-xs">Add study blocks or set up a recurring timetable to stay consistent.</p>
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Create Session
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {(["morning", "afternoon", "evening"] as const).map(section => {
            const sectionSlots = sections[section];
            if (!sectionSlots.length) return null;
            return (
              <SlotSection
                key={section}
                section={section}
                slots={sectionSlots}
                currentSlotId={currentSlot?.id}
                onToggle={(id, val) => toggleSlot.mutate({ id, isCompleted: val })}
                onDelete={id => deleteSlot.mutate(id)}
                onEdit={slot => setEditSlot({
                  id: slot.id,
                  title: slot.title,
                  type: slot.type,
                  subjectName: slot.subject?.name ?? "",
                  startTime: slot.startTime,
                  endTime: slot.endTime,
                  isRecurring: slot.isRecurring,
                  daysOfWeek: (() => {
                    try { return JSON.parse(slot.daysOfWeek ?? "[]"); } catch { return []; }
                  })(),
                })}
                onStart={slot => navigate(`/timer?mode=pomodoro&title=${encodeURIComponent(slot.title)}`)}
              />
            );
          })}
        </div>
      )}

      {/* ── Dialogs ── */}
      <SlotDialog
        open={showAdd}
        onOpenChange={setShowAdd}
        subjects={subjects}
        selectedDate={selectedDate}
        onSave={handleSave}
        isSaving={isSaving}
      />
      <SlotDialog
        open={!!editSlot}
        onOpenChange={v => !v && setEditSlot(null)}
        initial={editSlot ?? undefined}
        subjects={subjects}
        selectedDate={selectedDate}
        onSave={handleSave}
        isSaving={isSaving}
      />
    </div>
  );
}
