import { useState, useEffect, useRef, useMemo } from "react";
import { MathText } from "@/components/math-text";
import { useRoute, useLocation } from "wouter";
import {
  useGetExamAttempt, useSubmitAnswer, useSubmitExamAttempt,
  getGetExamAttemptQueryKey,
} from "@workspace/api-client-react";
import { useUser } from "@clerk/clerk-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Sheet, SheetContent, SheetTrigger,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { UserAnswerStatus, SubmitAnswerInputStatus } from "@workspace/api-client-react";
import { ScientificCalculator } from "@/components/scientific-calculator";
import { Lock, Maximize, AlertTriangle, Grid2x2 } from "lucide-react";

const LABELS = ["A", "B", "C", "D", "E"];

/* ─── NTA colour tokens ─────────────────────────────────────── */
const NTA = {
  header:      "#212c5e",
  headerText:  "#ffffff",
  answered:    "#28a745",
  notAnswered: "#dc3545",
  notVisited:  "#ffffff",
  marked:      "#6f42c1",
  timerNormal: "#ffffff",
  timerWarn:   "#ff4444",
  btnPrimary:  "#007bff",
  btnReview:   "#6f42c1",
  border:      "#dee2e6",
  bg:          "#f8f9fa",
};

type Q = {
  id: string;
  kind: "mcq" | "msq" | "nat";
  body: string;
  imageUrl?: string | null;
  explanation?: string | null;
  options: { id: string; body: string }[];
  marks: number;
  negativeMarks: number;
  topic: string;
  sectionId?: string | null;
};
type Sec = { id: string; name: string; displayOrder: number; timeLimitMinutes: number | null };

type SectionMeta = {
  id: string;
  name: string;
  timeLimitMinutes: number | null;
  startIdx: number;
  endIdx: number;
};

function groupQuestions(questions: Q[], sections: Sec[]): { ordered: Q[]; meta: SectionMeta[] } {
  if (sections.length === 0) {
    return {
      ordered: questions,
      meta: [{ id: "_all_", name: "All Questions", timeLimitMinutes: null, startIdx: 0, endIdx: questions.length - 1 }],
    };
  }

  const sorted = [...sections].sort((a, b) => a.displayOrder - b.displayOrder);
  const ordered: Q[] = [];
  const meta: SectionMeta[] = [];

  for (const s of sorted) {
    const qs = questions.filter((q) => (q as any).sectionId === s.id);
    if (qs.length === 0) continue;
    const startIdx = ordered.length;
    ordered.push(...qs);
    meta.push({ id: s.id, name: s.name, timeLimitMinutes: s.timeLimitMinutes, startIdx, endIdx: ordered.length - 1 });
  }

  const unsec = questions.filter((q) => !(q as any).sectionId || !sorted.find((s) => s.id === (q as any).sectionId));
  if (unsec.length > 0) {
    const startIdx = ordered.length;
    ordered.push(...unsec);
    meta.push({ id: "_unsec_", name: "Other", timeLimitMinutes: null, startIdx, endIdx: ordered.length - 1 });
  }

  return { ordered, meta };
}

export default function ExamAttempt() {
  const [, params] = useRoute("/attempts/:id");
  const attemptId = params?.id || "";
  const [, setLocation] = useLocation();
  const { user } = useUser();

  const { data: attempt, isLoading } = useGetExamAttempt(attemptId, {
    query: { enabled: !!attemptId, staleTime: Infinity, queryKey: getGetExamAttemptQueryKey(attemptId) },
  });
  const submitAnswer = useSubmitAnswer();
  const finishExam   = useSubmitExamAttempt();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft]         = useState(0);
  const timerRef      = useRef<number | null>(null);
  // Real-time target end (ms since epoch). The timer ticks against this
  // instead of decrementing — so backgrounded tabs don't "freeze" time and
  // the displayed clock matches the server's enforcement at submit.
  const examEndAtRef  = useRef<number>(0);
  const submittingRef = useRef(false);
  const [visitedIds, setVisitedIds]     = useState<Set<string>>(new Set());
  const [showCalc, setShowCalc]         = useState(false);
  const [lockedSectionIds, setLockedSectionIds] = useState<Set<string>>(new Set());
  const [sectionTimeLeft, setSectionTimeLeft] = useState(0);
  const sectionTimerRef = useRef<number | null>(null);
  const [localAnswers, setLocalAnswers] = useState<
    Record<string, { selectedIds: string[]; natValue: number | null; status: UserAnswerStatus }>
  >({});
  // Per-question timing: qStartRef tracks when user arrived, qAccumRef tracks total seconds
  const qStartRef = useRef<Record<string, number>>({});
  const qAccumRef = useRef<Record<string, number>>({});

  /* ── Fullscreen ── */
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fsBlocked, setFsBlocked]       = useState(false);

  const enterFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    } catch {
      setFsBlocked(true);
    }
  };

  useEffect(() => {
    if (!attempt) return;
    enterFullscreen();

    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    onChange(); // sync initial state

    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!attempt]);

  /* ── Section grouping ── */
  const { ordered: orderedQuestions, meta: sectionMeta } = useMemo(() => {
    if (!attempt) return { ordered: [], meta: [] as SectionMeta[] };
    return groupQuestions(attempt.questions as Q[], ((attempt as any).sections ?? []) as Sec[]);
  }, [attempt]);

  const sectionalMode = useMemo(() => {
    return sectionMeta.length > 1 && sectionMeta.every((s) => s.timeLimitMinutes !== null);
  }, [sectionMeta]);

  const currentSectionIdx = useMemo(() => {
    for (let i = 0; i < sectionMeta.length; i++) {
      if (currentIndex >= sectionMeta[i].startIdx && currentIndex <= sectionMeta[i].endIdx) return i;
    }
    return 0;
  }, [currentIndex, sectionMeta]);

  const currentSection = sectionMeta[currentSectionIdx];

  /* Init once */
  useEffect(() => {
    if (!attempt || Object.keys(localAnswers).length > 0) return;
    const init: any = {};
    attempt.answers.forEach((a) => {
      init[a.questionId] = { selectedIds: a.selectedOptionIds, natValue: a.natValue, status: a.status };
      if (a.timeSpentSeconds) qAccumRef.current[a.questionId] = a.timeSpentSeconds;
    });
    setLocalAnswers(init);
    examEndAtRef.current = Date.now() + attempt.secondsRemaining * 1000;
    setTimeLeft(attempt.secondsRemaining);
    const firstQ = (attempt.questions as Q[])[0];
    if (firstQ) {
      setVisitedIds(new Set([firstQ.id]));
      qStartRef.current[firstQ.id] = Date.now();
    }
  }, [attempt]);

  /* Overall timer — wall-clock based.
     The displayed countdown is derived from (examEndAt - now) on every tick,
     so backgrounded tabs and OS throttling can't make the clock run slow.
     Also re-syncs on visibilitychange so the jump back to the foreground is
     instant rather than waiting up to a full second. */
  useEffect(() => {
    if (!attempt) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((examEndAtRef.current - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        handleFinalSubmit();
      }
    };
    tick();
    timerRef.current = window.setInterval(tick, 1000);
    const onVisible = () => { if (!document.hidden) tick(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!attempt]);

  /* Section timer */
  useEffect(() => {
    if (!sectionalMode || !currentSection || currentSection.timeLimitMinutes === null) {
      if (sectionTimerRef.current) clearInterval(sectionTimerRef.current);
      return;
    }
    if (lockedSectionIds.has(currentSection.id)) return;
    setSectionTimeLeft(currentSection.timeLimitMinutes * 60);
    if (sectionTimerRef.current) clearInterval(sectionTimerRef.current);
    sectionTimerRef.current = window.setInterval(() => {
      setSectionTimeLeft((prev) => {
        if (prev <= 1) { clearInterval(sectionTimerRef.current!); autoAdvanceSection(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => { if (sectionTimerRef.current) clearInterval(sectionTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSectionIdx, sectionalMode]);

  if (isLoading || !attempt) {
    return (
      <div style={{ background: NTA.bg }} className="h-screen w-full flex flex-col p-4 gap-4">
        <Skeleton className="h-14 w-full rounded" />
        <div className="flex flex-1 gap-4">
          <Skeleton className="flex-1 h-full rounded" />
          <Skeleton className="w-64 h-full rounded hidden md:block" />
        </div>
      </div>
    );
  }

  const q      = orderedQuestions[currentIndex];
  const localA = q ? (localAnswers[q.id] || { selectedIds: [], natValue: null, status: "unanswered" }) : null;

  const fmt = (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    const p = (n: number) => String(n).padStart(2, "0");
    return h > 0 ? `${p(h)}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`;
  };

  const isLockedIdx = (idx: number) => {
    if (!sectionalMode) return false;
    for (let i = 0; i < sectionMeta.length; i++) {
      const sm = sectionMeta[i];
      if (idx >= sm.startIdx && idx <= sm.endIdx) return lockedSectionIds.has(sm.id);
    }
    return false;
  };

  const goTo = (idx: number) => {
    if (idx < 0 || idx >= orderedQuestions.length) return;
    if (isLockedIdx(idx)) { toast.error("This section is locked."); return; }
    setCurrentIndex(idx);
    const newQ = orderedQuestions[idx];
    setVisitedIds((prev) => new Set([...prev, newQ.id]));
    qStartRef.current[newQ.id] = Date.now();
  };

  const persist = (qId: string, ids: string[], nat: number | null, st: SubmitAnswerInputStatus) => {
    // Accumulate time spent on this question, reset session start
    const start = qStartRef.current[qId];
    if (start !== undefined) {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      qAccumRef.current[qId] = (qAccumRef.current[qId] ?? 0) + elapsed;
      qStartRef.current[qId] = Date.now();
    }
    submitAnswer.mutate({
      id: attemptId,
      data: { questionId: qId, selectedOptionIds: ids, natValue: nat, status: st, timeSpentSeconds: qAccumRef.current[qId] },
    });
  };

  const handleNext = (review = false) => {
    if (!q || !localA) return;
    const has = localA.selectedIds.length > 0 || localA.natValue !== null;
    const st: SubmitAnswerInputStatus =
      review && has ? "answered-marked" :
      review        ? "marked" :
      has           ? "answered" : "unanswered";
    setLocalAnswers((p) => ({ ...p, [q.id]: { ...p[q.id], status: st as UserAnswerStatus } }));
    persist(q.id, localA.selectedIds, localA.natValue, st);
    if (currentIndex < orderedQuestions.length - 1) goTo(currentIndex + 1);
  };

  const handleClear = () => {
    if (!q) return;
    setLocalAnswers((p) => ({ ...p, [q.id]: { selectedIds: [], natValue: null, status: "unanswered" } }));
    persist(q.id, [], null, "unanswered");
  };

  const handleOptionChange = (optId: string, checked: boolean, msq: boolean) => {
    if (!q) return;
    setLocalAnswers((p) => {
      const cur = p[q.id] || { selectedIds: [], natValue: null, status: "unanswered" };
      const ids = msq
        ? (checked ? [...cur.selectedIds, optId] : cur.selectedIds.filter((x) => x !== optId))
        : [optId];
      return { ...p, [q.id]: { ...cur, selectedIds: ids } };
    });
  };

  function autoAdvanceSection() {
    if (!currentSection) return;
    setLockedSectionIds((prev) => new Set([...prev, currentSection.id]));
    if (currentSectionIdx >= sectionMeta.length - 1) {
      toast.info("All sections complete. Submitting exam.");
      handleFinalSubmit();
      return;
    }
    const next = sectionMeta[currentSectionIdx + 1];
    setCurrentIndex(next.startIdx);
    setVisitedIds((prev) => new Set([...prev, orderedQuestions[next.startIdx].id]));
    toast.info(`Moved to ${next.name}`);
  }

  function manualAdvanceSection() {
    if (!currentSection) return;
    if (currentSectionIdx >= sectionMeta.length - 1) return;
    if (!confirm(`Move to next section? You won't be able to return to ${currentSection.name}.`)) return;
    autoAdvanceSection();
  }

  const handleFinalSubmit = () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    if (q && localA) {
      const has = localA.selectedIds.length > 0 || localA.natValue !== null;
      persist(q.id, localA.selectedIds, localA.natValue, has ? "answered" : "unanswered");
    }
    finishExam.mutate({ id: attemptId }, {
      onSuccess: () => { toast.success("Exam submitted!"); setLocation(`/attempts/${attemptId}/result`); },
      onError: () => { submittingRef.current = false; toast.error("Submission failed."); },
    });
  };

  const palColor = (qId: string, idx: number): React.CSSProperties => {
    const st = localAnswers[qId]?.status || "unanswered";
    const vis = visitedIds.has(qId);
    const active = idx === currentIndex;
    let bg = NTA.notVisited, color = "#333", border = NTA.border;
    if (st === "answered")             { bg = NTA.answered;    color = "#fff"; border = NTA.answered; }
    else if (st === "answered-marked") { bg = NTA.marked;      color = "#fff"; border = NTA.marked; }
    else if (st === "marked")          { bg = NTA.marked;      color = "#fff"; border = NTA.marked; }
    else if (vis)                      { bg = NTA.notAnswered; color = "#fff"; border = NTA.notAnswered; }
    return {
      background: bg, color, border: `2px solid ${active ? "#212c5e" : border}`,
      outline: active ? "2px solid #212c5e" : "none", outlineOffset: "1px",
    };
  };

  const stats = {
    answered:       Object.values(localAnswers).filter((a) => a.status === "answered").length,
    answeredMarked: Object.values(localAnswers).filter((a) => a.status === "answered-marked").length,
    marked:         Object.values(localAnswers).filter((a) => a.status === "marked").length,
    notAnswered:    orderedQuestions.filter((qs) => visitedIds.has(qs.id) && (localAnswers[qs.id]?.status ?? "unanswered") === "unanswered").length,
    notVisited:     orderedQuestions.filter((qs) => !visitedIds.has(qs.id)).length,
  };

  const examName      = (attempt as any).examName  || "";
  const hasCalc       = (attempt as any).hasCalculator || false;
  const candidateName = user?.fullName || user?.primaryEmailAddress?.emailAddress || "Candidate";
  const candidateImg  = user?.imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(candidateName)}&background=3b5fe3&color=fff`;

  const isLastInSection  = currentSection && currentIndex === currentSection.endIdx;
  const isLastSection    = currentSectionIdx >= sectionMeta.length - 1;
  const showNextSectionBtn = sectionalMode && isLastInSection && !isLastSection;

  /* ── Shared palette grid (used in both desktop sidebar + mobile sheet) ── */
  const PaletteGrid = ({ onSelect }: { onSelect?: () => void }) => (
    <div className="flex-1 overflow-y-auto p-3 space-y-3">
      <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider px-1">Question Palette</p>
      {sectionMeta.map((sec) => {
        const locked = lockedSectionIds.has(sec.id);
        return (
          <div key={sec.id} className="space-y-1.5">
            {sectionMeta.length > 1 && (
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-600 uppercase px-1">
                {locked && <Lock className="w-2.5 h-2.5" />}
                <span className="truncate">{sec.name}</span>
              </div>
            )}
            <div className="grid grid-cols-6 gap-1.5">
              {orderedQuestions.slice(sec.startIdx, sec.endIdx + 1).map((qs, j) => {
                const idx = sec.startIdx + j;
                return (
                  <button key={qs.id}
                    onClick={() => { goTo(idx); onSelect?.(); }}
                    disabled={locked}
                    style={{ ...palColor(qs.id, idx), height: 40, borderRadius: 4, fontSize: 13, fontWeight: 700, opacity: locked ? 0.4 : 1, cursor: locked ? "not-allowed" : "pointer" }}
                    className="hover:opacity-80 transition-opacity relative">
                    {idx + 1}
                    {(localAnswers[qs.id]?.status === "answered-marked") && (
                      <span style={{ position: "absolute", bottom: 2, right: 2, width: 6, height: 6, borderRadius: "50%", background: NTA.answered }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );

  const LegendBlock = () => (
    <div style={{ borderTop: `1px solid ${NTA.border}`, background: "#fff" }} className="px-3 py-3 shrink-0">
      <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Legend</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-gray-700">
        {[
          { color: NTA.notVisited,  label: "Not Visited",       count: stats.notVisited,     border: NTA.border },
          { color: NTA.notAnswered, label: "Not Answered",       count: stats.notAnswered },
          { color: NTA.answered,    label: "Answered",           count: stats.answered },
          { color: NTA.marked,      label: "Marked for Review",  count: stats.marked },
          { color: NTA.marked,      label: "Answered + Marked",  count: stats.answeredMarked, dot: true },
        ].map(({ color, label, count, border, dot }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span style={{ width: 18, height: 18, borderRadius: 3, background: color, flexShrink: 0, border: `1px solid ${border || color}`, position: "relative" }}>
              {dot && <span style={{ position: "absolute", bottom: 1, right: 1, width: 5, height: 5, borderRadius: "50%", background: NTA.answered }} />}
            </span>
            <span className="truncate">{label} ({count})</span>
          </div>
        ))}
      </div>
    </div>
  );

  const SubmitBlock = () => (
    <div style={{ borderTop: `1px solid ${NTA.border}` }} className="p-3 shrink-0">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button style={{ background: NTA.header, color: "#fff" }}
            className="w-full py-2.5 rounded text-sm font-bold hover:opacity-90 transition-opacity">
            Submit Test
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Exam?</AlertDialogTitle>
            <AlertDialogDescription>
              Answered: <strong>{stats.answered + stats.answeredMarked}</strong> / {orderedQuestions.length}.
              {stats.notAnswered > 0 && <> <strong>{stats.notAnswered}</strong> not answered.</>}
              {" "}This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Exam</AlertDialogCancel>
            <AlertDialogAction onClick={handleFinalSubmit} disabled={finishExam.isPending}>
              {finishExam.isPending ? "Submitting…" : "Yes, Submit"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  if (!q || !localA) return null;

  return (
    <div style={{ background: NTA.bg, colorScheme: "light" as any, height: "100dvh" }}
      className="w-screen flex flex-col overflow-hidden fixed inset-0 z-50">

      {/* ── Fullscreen warning banner ── */}
      {!isFullscreen && !fsBlocked && (
        <div
          style={{ background: "#fff3cd", borderBottom: "2px solid #ffc107", color: "#664d03" }}
          className="flex items-center justify-between px-4 py-2 shrink-0 text-sm font-medium gap-3 z-60">
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            You have exited fullscreen. Please return to fullscreen for exam integrity.
          </span>
          <button
            onClick={enterFullscreen}
            style={{ background: "#212c5e", color: "#fff", border: "none" }}
            className="px-3 py-1 rounded text-xs font-bold flex items-center gap-1.5 shrink-0 hover:opacity-90">
            <Maximize className="w-3.5 h-3.5" /> Re-enter Fullscreen
          </button>
        </div>
      )}

      {/* Fullscreen blocked: gentle prompt */}
      {fsBlocked && !isFullscreen && (
        <div
          style={{ background: "#e8f4fd", borderBottom: "2px solid #007bff", color: "#004080" }}
          className="flex items-center justify-between px-4 py-2 shrink-0 text-sm font-medium gap-3 z-60">
          <span className="flex items-center gap-2">
            <Maximize className="w-4 h-4 shrink-0" />
            Fullscreen mode is recommended for the best exam experience.
          </span>
          <button
            onClick={() => { setFsBlocked(false); enterFullscreen(); }}
            style={{ background: "#007bff", color: "#fff", border: "none" }}
            className="px-3 py-1 rounded text-xs font-bold flex items-center gap-1.5 shrink-0 hover:opacity-90">
            <Maximize className="w-3.5 h-3.5" /> Enter Fullscreen
          </button>
        </div>
      )}

      {/* ── Row 1: Logo + Exam Title ── */}
      <div style={{ background: NTA.header }} className="flex items-center justify-between px-3 md:px-4 py-2 shrink-0">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <div style={{ background: "rgba(255,255,255,0.18)", border: "1.5px solid rgba(255,255,255,0.35)" }}
            className="w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center text-white font-extrabold text-xs md:text-sm shrink-0">
            SC
          </div>
          <div className="min-w-0">
            <p className="text-white font-bold text-xs md:text-sm leading-tight truncate max-w-45 md:max-w-none">{attempt.examTitle}</p>
            {examName && <p className="text-white/60 text-[10px] truncate hidden md:block">{examName}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Overall timer (always visible in header) */}
          <div style={{
            background: timeLeft < 300 ? "#fff3cd" : "#e8f5e9",
            border: `1px solid ${timeLeft < 300 ? "#ffc107" : "#a5d6a7"}`,
            color: timeLeft < 300 ? "#856404" : "#1b5e20",
          }} className="flex items-center gap-1 px-2 md:px-3 py-1 rounded font-mono text-xs md:text-sm font-bold">
            ⏱ {fmt(timeLeft)}
          </div>
          {hasCalc && (
            <button onClick={() => setShowCalc((v) => !v)}
              style={{
                background: showCalc ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.12)",
                border: "1px solid rgba(255,255,255,0.3)", color: "#fff",
              }}
              className="h-8 px-2 md:px-3 rounded text-xs font-semibold hover:opacity-90 flex items-center gap-1 hidden sm:flex">
              🧮 <span className="hidden md:inline">Calculator</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Row 2: Section tabs ── */}
      <div style={{ background: "#fff", borderBottom: `1.5px solid ${NTA.border}` }}
        className="flex items-center justify-between px-3 md:px-4 shrink-0 min-h-9.5 overflow-x-auto">
        <div className="flex items-center gap-1 text-xs font-semibold">
          {sectionMeta.map((s, i) => {
            const isActive = i === currentSectionIdx;
            const isLocked = lockedSectionIds.has(s.id);
            return (
              <button key={s.id}
                onClick={() => !isLocked && goTo(s.startIdx)}
                disabled={isLocked}
                style={{
                  background: isActive ? NTA.header : isLocked ? "#e9ecef" : "#f0f0f0",
                  color: isActive ? "#fff" : isLocked ? "#6c757d" : "#555",
                  border: isActive ? `1px solid ${NTA.header}` : "1px solid transparent",
                }}
                className={`px-2 md:px-3 py-1 rounded-sm flex items-center gap-1 text-xs font-semibold whitespace-nowrap ${isLocked ? "cursor-not-allowed" : "hover:opacity-90"}`}>
                {isLocked && <Lock className="w-3 h-3" />}
                <span>{s.name}</span>
                <span className="text-[10px] opacity-70 hidden sm:inline">({s.endIdx - s.startIdx + 1})</span>
              </button>
            );
          })}
        </div>
        {/* Sectional timer */}
        {sectionalMode && currentSection?.timeLimitMinutes !== null && !lockedSectionIds.has(currentSection!.id) && (
          <div style={{
            background: sectionTimeLeft < 60 ? "#fff3cd" : "#e8f5e9",
            border: `1px solid ${sectionTimeLeft < 60 ? "#ffc107" : "#a5d6a7"}`,
            color: sectionTimeLeft < 60 ? "#856404" : "#1b5e20",
          }} className="flex items-center gap-1 px-2 md:px-3 py-1 rounded font-mono text-xs font-bold ml-2 shrink-0">
            ⏱ {fmt(sectionTimeLeft)}
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div className="flex-1 flex min-h-0 overflow-hidden">

        {/* ── Question panel ── */}
        <div className="flex-1 flex flex-col min-w-0 bg-white border-r" style={{ borderColor: NTA.border }}>

          {/* Question info bar */}
          <div style={{ background: "#e9ecef", borderBottom: `1px solid ${NTA.border}` }}
            className="h-9 md:h-10 flex items-center justify-between px-3 md:px-5 shrink-0 text-sm">
            <span className="font-semibold text-gray-700 text-xs md:text-sm">
              Q <span style={{ color: NTA.header }}>{currentIndex + 1}</span>
              <span className="text-gray-400 font-normal"> / {orderedQuestions.length}</span>
            </span>
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <span style={{ color: "#155724", background: "#d4edda", border: "1px solid #c3e6cb" }}
                className="px-1.5 py-0.5 rounded">+{q.marks}</span>
              <span style={{ color: "#721c24", background: "#f8d7da", border: "1px solid #f5c6cb" }}
                className="px-1.5 py-0.5 rounded">−{q.negativeMarks}</span>
              <span style={{ color: "#383d41", background: "#e2e3e5", border: "1px solid #d6d8db" }}
                className="px-1.5 py-0.5 rounded uppercase hidden sm:inline">{q.kind}</span>
            </div>
          </div>

          {/* Scrollable question body */}
          <div className="flex-1 overflow-y-auto px-4 py-4 md:px-8 md:py-5">
            <div className="max-w-3xl space-y-4 md:space-y-5">

              <p className="text-sm md:text-[15px] font-medium text-gray-900 leading-relaxed">
                <MathText text={q.body} />
              </p>

              {(q as any).imageUrl && (
                <img src={(q as any).imageUrl} alt="Diagram"
                  className="max-w-full max-h-48 md:max-h-64 border rounded object-contain" style={{ borderColor: NTA.border }} />
              )}

              {/* MCQ */}
              {q.kind === "mcq" && (
                <div className="space-y-2 md:space-y-2.5 pt-1">
                  {q.options.map((opt, i) => {
                    const sel = localA.selectedIds[0] === opt.id;
                    return (
                      <label key={opt.id} className="flex items-start gap-2 md:gap-3 cursor-pointer"
                        style={{
                          background: sel ? "#e8f4fd" : "#fff",
                          border: `1px solid ${sel ? "#007bff" : NTA.border}`,
                          borderRadius: 4, padding: "10px 12px",
                        }}>
                        <input type="radio" name={`q-${q.id}`} value={opt.id}
                          checked={sel} onChange={() => handleOptionChange(opt.id, true, false)}
                          className="mt-0.5 shrink-0 accent-blue-600" />
                        <span style={{
                          minWidth: 22, height: 22, borderRadius: "50%", fontSize: 11, fontWeight: 700,
                          background: sel ? NTA.btnPrimary : "#fff", color: sel ? "#fff" : "#666",
                          border: `2px solid ${sel ? NTA.btnPrimary : "#999"}`,
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0, marginRight: 2,
                        }}>{LABELS[i]}</span>
                        <span className="text-sm text-gray-800 leading-relaxed"><MathText text={opt.body} /></span>
                      </label>
                    );
                  })}
                </div>
              )}

              {/* MSQ */}
              {q.kind === "msq" && (
                <div className="space-y-2 md:space-y-2.5 pt-1">
                  <p className="text-xs text-gray-500 italic">Select all that apply.</p>
                  {q.options.map((opt, i) => {
                    const sel = localA.selectedIds.includes(opt.id);
                    return (
                      <label key={opt.id} className="flex items-start gap-2 md:gap-3 cursor-pointer"
                        style={{
                          background: sel ? "#e8f4fd" : "#fff",
                          border: `1px solid ${sel ? "#007bff" : NTA.border}`,
                          borderRadius: 4, padding: "10px 12px",
                        }}>
                        <input type="checkbox" value={opt.id} checked={sel}
                          onChange={(e) => handleOptionChange(opt.id, e.target.checked, true)}
                          className="mt-0.5 shrink-0 accent-blue-600" />
                        <span style={{
                          minWidth: 22, height: 22, borderRadius: 4, fontSize: 11, fontWeight: 700,
                          background: sel ? NTA.btnPrimary : "#fff", color: sel ? "#fff" : "#666",
                          border: `2px solid ${sel ? NTA.btnPrimary : "#999"}`,
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0, marginRight: 2,
                        }}>{sel ? "✓" : LABELS[i]}</span>
                        <span className="text-sm text-gray-800 leading-relaxed"><MathText text={opt.body} /></span>
                      </label>
                    );
                  })}
                </div>
              )}

              {/* NAT */}
              {q.kind === "nat" && (
                <div className="space-y-2 max-w-xs pt-1">
                  <p className="text-xs text-gray-500 italic">Enter a numerical value.</p>
                  <Input type="number" step="any" placeholder="Type your answer"
                    className="h-11 text-base border-2 bg-white text-gray-900"
                    style={{ borderColor: NTA.border }}
                    value={localA.natValue === null ? "" : localA.natValue}
                    onChange={(e) => handleNatChange(e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>

          {/* ── Desktop action bar ── */}
          <div style={{ background: "#fff", borderTop: `1px solid ${NTA.border}` }}
            className="h-14 md:h-16 flex items-center justify-between px-3 md:px-5 shrink-0 gap-2">
            <div className="flex items-center gap-1.5 md:gap-2">
              <button onClick={() => goTo(Math.max(0, currentIndex - 1))} disabled={currentIndex === 0}
                style={{ border: `1px solid ${NTA.border}`, color: "#495057", background: "#fff" }}
                className="h-9 px-2 md:px-3 rounded text-xs md:text-sm font-medium disabled:opacity-40 hover:bg-gray-50">
                ‹ Back
              </button>
              <button onClick={() => handleNext(true)}
                style={{ background: NTA.marked, color: "#fff", border: `1px solid ${NTA.marked}` }}
                className="h-9 px-2 md:px-3 rounded text-xs md:text-sm font-semibold hover:opacity-90">
                <span className="hidden sm:inline">🔖 Mark for Review &amp; Next</span>
                <span className="sm:hidden">🔖 Mark</span>
              </button>
              <button onClick={handleClear}
                style={{ border: `1px solid ${NTA.border}`, color: "#6c757d", background: "#fff" }}
                className="h-9 px-2 md:px-3 rounded text-xs md:text-sm font-medium hidden md:block hover:bg-gray-50">
                Clear
              </button>
            </div>
            <div className="flex gap-1.5 md:gap-2">
              {showNextSectionBtn && (
                <button onClick={manualAdvanceSection}
                  style={{ background: "#fd7e14", color: "#fff", border: "none" }}
                  className="h-9 px-3 md:px-4 rounded text-xs md:text-sm font-bold hover:opacity-90 shrink-0">
                  Next §→
                </button>
              )}
              <button onClick={() => handleNext(false)}
                style={{ background: NTA.btnPrimary, color: "#fff", border: "none" }}
                className="h-9 px-4 md:px-5 rounded text-xs md:text-sm font-bold hover:opacity-90 shrink-0">
                <span className="hidden sm:inline">Save &amp; Next ›</span>
                <span className="sm:hidden">Save ›</span>
              </button>
            </div>
          </div>

          {/* ── Mobile: bottom palette trigger bar ── */}
          <Sheet>
            <div style={{ background: "#f0f2f5", borderTop: `1px solid ${NTA.border}` }}
              className="flex items-center justify-between px-3 py-2 shrink-0 md:hidden">
              <div className="flex items-center gap-3 text-xs text-gray-600">
                <span className="font-bold text-gray-800">Q {currentIndex + 1}/{orderedQuestions.length}</span>
                <span className="flex items-center gap-1">
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: NTA.answered, display: "inline-block" }} />
                  {stats.answered + stats.answeredMarked}
                </span>
                <span className="flex items-center gap-1">
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: NTA.notAnswered, display: "inline-block" }} />
                  {stats.notAnswered}
                </span>
                <span className="flex items-center gap-1">
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: NTA.notVisited, border: `1px solid ${NTA.border}`, display: "inline-block" }} />
                  {stats.notVisited}
                </span>
              </div>
              <SheetTrigger asChild>
                <button
                  style={{ background: NTA.header, color: "#fff", border: "none" }}
                  className="flex items-center gap-1.5 h-8 px-3 rounded text-xs font-bold hover:opacity-90">
                  <Grid2x2 className="w-3.5 h-3.5" /> Palette
                </button>
              </SheetTrigger>
            </div>
            <SheetContent
              side="bottom"
              className="p-0 max-h-[80vh] flex flex-col"
              style={{ colorScheme: "light", background: "#f0f2f5" }}>
              {/* Candidate row */}
              <div style={{ background: NTA.header }} className="flex items-center gap-2.5 px-3 py-3 shrink-0">
                <img src={candidateImg} alt="candidate"
                  className="w-8 h-8 rounded-full object-cover border-2 border-white/30 shrink-0" />
                <div className="min-w-0">
                  <p className="text-white text-xs font-bold truncate">{candidateName}</p>
                  <p className="text-white/60 text-[10px]">{examName || attempt.examTitle}</p>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                <PaletteGrid onSelect={() => {
                  // Sheet closes automatically when clicking a question
                  const triggerClose = document.querySelector('[data-radix-dialog-close]') as HTMLButtonElement | null;
                  triggerClose?.click();
                }} />
                <LegendBlock />
              </div>
              <SubmitBlock />
            </SheetContent>
          </Sheet>
        </div>

        {/* ── Desktop right sidebar (hidden on mobile) ── */}
        <div style={{ background: "#f0f2f5", borderLeft: `1px solid ${NTA.border}` }}
          className="max-md:hidden flex w-64 xl:w-72 flex-col shrink-0 overflow-hidden">

          {/* Candidate info */}
          <div style={{ background: NTA.header, borderBottom: `1px solid rgba(255,255,255,0.15)` }}
            className="flex items-center gap-2.5 px-3 py-3 shrink-0">
            <img src={candidateImg} alt="candidate"
              className="w-10 h-10 rounded-full object-cover border-2 border-white/30 shrink-0" />
            <div className="min-w-0">
              <p className="text-white text-xs font-bold truncate">{candidateName}</p>
              <p className="text-white/60 text-[10px] truncate">{examName || attempt.examTitle}</p>
            </div>
          </div>

          <PaletteGrid />
          <LegendBlock />
          <SubmitBlock />
        </div>
      </div>

      {/* ── Scientific Calculator popup ── */}
      {hasCalc && showCalc && <ScientificCalculator onClose={() => setShowCalc(false)} />}
    </div>
  );

  function handleNatChange(val: string) {
    if (!q) return;
    setLocalAnswers((p) => ({ ...p, [q.id]: { ...p[q.id], natValue: val === "" ? null : Number(val) } }));
  }
}
