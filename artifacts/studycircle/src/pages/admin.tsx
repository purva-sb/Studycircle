import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useUser } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Plus, Trash2, ChevronLeft, BookOpen, Clock, FileQuestion,
  CheckCircle2, AlertCircle, Calendar, Eye, ImagePlus, X,
  Layers, Upload, FileSpreadsheet, AlertTriangle, Sparkles, Loader2,
  Pencil, Copy, BarChart2, Download, ChevronUp, ChevronDown,
  Shuffle, Settings, ToggleLeft, ToggleRight, Share2, Link2, GraduationCap,
} from "lucide-react";
import { MathText, MathPreview } from "@/components/math-text";
import { toast } from "@/hooks/use-toast";
import { Link } from "wouter";

// ─── Types ────────────────────────────────────────────────────────────────────

type Exam = {
  id: string; title: string; exam: string; kind: string;
  durationMinutes: number; totalQuestions: number; totalMarks: number;
  difficulty: string; isLive: boolean; scheduledAt: string | null;
  attemptCount: number; negativeMarking: number; marksPerQuestion: number;
  description: string; instructionsJson: string[]; topicsJson: string[];
  hasCalculator: boolean; shuffleQuestions: boolean;
};

type Option = { id: string; body: string };

type Question = {
  id: string; examId: string; kind: string; body: string;
  topic: string; marks: number; negativeMarks: number;
  optionsJson: Option[]; correctOptionIdsJson: string[]; natAnswer: number | null;
  sectionId: string | null;
  subject: string | null;
  subtopic: string | null;
  source: string | null;
  explanation: string | null;
  solutionVideoUrl: string | null;
  solutionArticleUrl: string | null;
  imageUrl: string | null;
  displayOrder: number;
};

type QuestionStat = {
  id: string; body: string; kind: string; topic: string; subject: string | null;
  marks: number; displayOrder: number;
  totalAnswers: number; attempted: number; correct: number; wrong: number; skipped: number;
  correctRate: number | null;
};

type TagSuggestion = {
  subject?: string;
  topic?: string;
  subtopic?: string;
  difficulty?: "easy" | "medium" | "hard";
};

type Section = {
  id: string;
  examId: string;
  name: string;
  displayOrder: number;
  timeLimitMinutes: number | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function adminFetch<T>(path: string, options?: RequestInit) {
  return customFetch<T>(`/api${path}`, options);
}

const EXAM_TYPES = ["GATE", "JEE", "NEET", "CAT", "UPSC", "Placement", "Other"];
const EXAM_KINDS = ["practice", "timed", "full-mock", "scheduled", "contest", "pyq"];
const DIFFICULTIES = ["easy", "medium", "hard"];

// ─── Create Exam Form ─────────────────────────────────────────────────────────

function CreateExamForm({ onCreated }: { onCreated: (exam: Exam) => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: "", exam: "GATE", kind: "full-mock", durationMinutes: 180,
    difficulty: "medium", description: "", negativeMarking: 0.33,
    marksPerQuestion: 1, isLive: false, scheduledAt: "",
    instructions: "", topics: "", hasCalculator: false,
  });

  const create = useMutation({
    mutationFn: () => adminFetch<Exam>("/admin/exams", {
      method: "POST",
      body: JSON.stringify({
        ...form,
        durationMinutes: Number(form.durationMinutes),
        negativeMarking: Number(form.negativeMarking),
        marksPerQuestion: Number(form.marksPerQuestion),
        instructions: form.instructions ? form.instructions.split("\n").filter(Boolean) : [],
        topics: form.topics ? form.topics.split(",").map(t => t.trim()).filter(Boolean) : [],
        scheduledAt: form.scheduledAt || null,
      }),
      headers: { "Content-Type": "application/json" },
    }),
    onSuccess: (exam) => {
      qc.invalidateQueries({ queryKey: ["admin-exams"] });
      toast({ title: "Test series created!" });
      onCreated(exam);
    },
    onError: () => toast({ title: "Failed to create", variant: "destructive" }),
  });

  const set = (k: string, v: string | number | boolean) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="max-w-2xl space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1">
          <Label>Title</Label>
          <Input placeholder="GATE CS 2026 Full Mock #1" value={form.title} onChange={e => set("title", e.target.value)} />
        </div>

        <div className="space-y-1">
          <Label>Exam Type</Label>
          <Select value={form.exam} onValueChange={v => set("exam", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{EXAM_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>Test Kind</Label>
          <Select value={form.kind} onValueChange={v => set("kind", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{EXAM_KINDS.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>Duration (minutes)</Label>
          <Input type="number" value={form.durationMinutes} onChange={e => set("durationMinutes", e.target.value)} />
        </div>

        <div className="space-y-1">
          <Label>Difficulty</Label>
          <Select value={form.difficulty} onValueChange={v => set("difficulty", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{DIFFICULTIES.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>Marks per Question</Label>
          <Input type="number" step="0.5" value={form.marksPerQuestion} onChange={e => set("marksPerQuestion", e.target.value)} />
        </div>

        <div className="space-y-1">
          <Label>Negative Marking (per wrong)</Label>
          <Input type="number" step="0.01" value={form.negativeMarking} onChange={e => set("negativeMarking", e.target.value)} />
        </div>

        <div className="col-span-2 space-y-1">
          <Label>Description</Label>
          <Textarea placeholder="Brief description of this test..." value={form.description} onChange={e => set("description", e.target.value)} />
        </div>

        <div className="col-span-2 space-y-1">
          <Label>Topics (comma-separated)</Label>
          <Input placeholder="Data Structures, Algorithms, OS" value={form.topics} onChange={e => set("topics", e.target.value)} />
        </div>

        <div className="col-span-2 space-y-1">
          <Label>Instructions (one per line)</Label>
          <Textarea placeholder="Read all questions carefully.&#10;Use of calculators is not permitted." value={form.instructions} onChange={e => set("instructions", e.target.value)} rows={3} />
        </div>

        <div className="col-span-2 space-y-1">
          <Label>Schedule Live Test (optional)</Label>
          <Input type="datetime-local" value={form.scheduledAt} onChange={e => set("scheduledAt", e.target.value)} />
          <p className="text-xs text-muted-foreground">Leave blank for practice/offline test</p>
        </div>

        <div className="col-span-2 flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
          <input
            type="checkbox"
            id="hasCalculator"
            checked={form.hasCalculator}
            onChange={e => set("hasCalculator", e.target.checked)}
            className="w-4 h-4 accent-primary"
          />
          <div>
            <Label htmlFor="hasCalculator" className="cursor-pointer font-semibold">Enable Scientific Calculator</Label>
            <p className="text-xs text-muted-foreground">Students will see a calculator button during the exam (useful for GATE, engineering tests)</p>
          </div>
        </div>
      </div>

      <Button onClick={() => create.mutate()} disabled={!form.title || create.isPending} className="w-full">
        {create.isPending ? "Creating..." : "Create Test Series"}
      </Button>
    </div>
  );
}

// ─── Edit Exam Section ────────────────────────────────────────────────────────

function EditExamSection({ exam, onSaved, onCancel }: { exam: Exam; onSaved: (e: Exam) => void; onCancel: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: exam.title,
    exam: exam.exam,
    kind: exam.kind,
    durationMinutes: exam.durationMinutes,
    difficulty: exam.difficulty,
    description: exam.description ?? "",
    negativeMarking: exam.negativeMarking,
    marksPerQuestion: exam.marksPerQuestion,
    isLive: exam.isLive,
    scheduledAt: exam.scheduledAt ? exam.scheduledAt.slice(0, 16) : "",
    instructions: (exam.instructionsJson ?? []).join("\n"),
    topics: (exam.topicsJson ?? []).join(", "),
    hasCalculator: exam.hasCalculator,
    shuffleQuestions: exam.shuffleQuestions,
  });
  const set = (k: string, v: string | number | boolean) => setForm(p => ({ ...p, [k]: v }));

  const save = useMutation({
    mutationFn: () => adminFetch<Exam>(`/admin/exams/${exam.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        title: form.title,
        exam: form.exam,
        kind: form.kind,
        durationMinutes: Number(form.durationMinutes),
        difficulty: form.difficulty,
        description: form.description,
        negativeMarking: Number(form.negativeMarking),
        marksPerQuestion: Number(form.marksPerQuestion),
        isLive: form.isLive,
        scheduledAt: form.scheduledAt || null,
        instructions: form.instructions ? form.instructions.split("\n").filter(Boolean) : [],
        topics: form.topics ? form.topics.split(",").map(t => t.trim()).filter(Boolean) : [],
        hasCalculator: form.hasCalculator,
        shuffleQuestions: form.shuffleQuestions,
      }),
      headers: { "Content-Type": "application/json" },
    }),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["admin-exams"] });
      toast({ title: "Exam updated!" });
      onSaved(updated);
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  return (
    <div className="space-y-4 p-4 rounded-lg border border-primary/30 bg-primary/5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2"><Settings className="h-4 w-4" /> Edit Exam Details</h3>
        <Button variant="ghost" size="icon" onClick={onCancel}><X className="h-4 w-4" /></Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1">
          <Label>Title</Label>
          <Input value={form.title} onChange={e => set("title", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Exam Type</Label>
          <Select value={form.exam} onValueChange={v => set("exam", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{EXAM_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Test Kind</Label>
          <Select value={form.kind} onValueChange={v => set("kind", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{EXAM_KINDS.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Duration (minutes)</Label>
          <Input type="number" value={form.durationMinutes} onChange={e => set("durationMinutes", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Difficulty</Label>
          <Select value={form.difficulty} onValueChange={v => set("difficulty", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{DIFFICULTIES.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Marks per Question</Label>
          <Input type="number" step="0.5" value={form.marksPerQuestion} onChange={e => set("marksPerQuestion", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Negative Marking</Label>
          <Input type="number" step="0.01" value={form.negativeMarking} onChange={e => set("negativeMarking", e.target.value)} />
        </div>
        <div className="col-span-2 space-y-1">
          <Label>Description</Label>
          <Textarea value={form.description} onChange={e => set("description", e.target.value)} rows={2} />
        </div>
        <div className="col-span-2 space-y-1">
          <Label>Topics (comma-separated)</Label>
          <Input value={form.topics} onChange={e => set("topics", e.target.value)} />
        </div>
        <div className="col-span-2 space-y-1">
          <Label>Instructions (one per line)</Label>
          <Textarea value={form.instructions} onChange={e => set("instructions", e.target.value)} rows={2} />
        </div>
        <div className="col-span-2 space-y-1">
          <Label>Schedule (optional)</Label>
          <Input type="datetime-local" value={form.scheduledAt} onChange={e => set("scheduledAt", e.target.value)} />
        </div>
        <div className="col-span-2 flex flex-wrap gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isLive} onChange={e => set("isLive", e.target.checked)} className="w-4 h-4 accent-primary" />
            <span className="text-sm font-medium">Live (visible to students)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.hasCalculator} onChange={e => set("hasCalculator", e.target.checked)} className="w-4 h-4 accent-primary" />
            <span className="text-sm font-medium">Scientific Calculator</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.shuffleQuestions} onChange={e => set("shuffleQuestions", e.target.checked)} className="w-4 h-4 accent-primary" />
            <span className="text-sm font-medium flex items-center gap-1"><Shuffle className="h-3.5 w-3.5" /> Shuffle questions per attempt</span>
          </label>
        </div>
      </div>
      <div className="flex gap-2">
        <Button onClick={() => save.mutate()} disabled={!form.title || save.isPending}>
          {save.isPending ? "Saving..." : "Save Changes"}
        </Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

// ─── Edit Question Inline ─────────────────────────────────────────────────────

function EditQuestionInline({ question, sections, existingQuestions, onSaved, onCancel }:
  { question: Question; sections: Section[]; existingQuestions: Question[]; onSaved: () => void; onCancel: () => void }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<"mcq" | "msq" | "nat">(question.kind as any);
  const [body, setBody] = useState(question.body);
  const [imageUrl, setImageUrl] = useState(question.imageUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [explanation, setExplanation] = useState(question.explanation ?? "");
  const [topic, setTopic] = useState(question.topic);
  const [subject, setSubject] = useState(question.subject ?? "");
  const [subtopic, setSubtopic] = useState(question.subtopic ?? "");
  const [source, setSource] = useState(question.source ?? "");
  const [marks, setMarks] = useState(String(question.marks));
  const [negativeMarks, setNegativeMarks] = useState(String(question.negativeMarks));
  const [natAnswer, setNatAnswer] = useState(question.natAnswer != null ? String(question.natAnswer) : "");
  const [sectionId, setSectionId] = useState(question.sectionId ?? "");
  const [solutionVideoUrl, setSolutionVideoUrl] = useState(question.solutionVideoUrl ?? "");
  const [solutionArticleUrl, setSolutionArticleUrl] = useState(question.solutionArticleUrl ?? "");
  const [options, setOptions] = useState<Option[]>(
    question.optionsJson.length > 0
      ? question.optionsJson
      : [{ id: crypto.randomUUID(), body: "" }, { id: crypto.randomUUID(), body: "" },
         { id: crypto.randomUUID(), body: "" }, { id: crypto.randomUUID(), body: "" }]
  );
  const [correctIds, setCorrectIds] = useState<string[]>(question.correctOptionIdsJson ?? []);
  const [suggesting, setSuggesting] = useState(false);

  const uniq = (vals: (string | null | undefined)[]) =>
    Array.from(new Set(vals.filter((v): v is string => !!v && v.trim().length > 0))).sort();
  const subjectOptions  = uniq(existingQuestions.map(q => q.subject));
  const topicOptions    = uniq(existingQuestions.map(q => q.topic));
  const subtopicOptions = uniq(existingQuestions.map(q => q.subtopic));
  const sourceOptions   = uniq(existingQuestions.map(q => q.source));

  const uploadImage = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await customFetch<{ secure_url: string }>("/api/upload", { method: "POST", body: fd });
      setImageUrl(res.secure_url);
    } catch {
      toast({ title: "Image upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const suggestTags = async () => {
    if (!body.trim()) return;
    setSuggesting(true);
    try {
      const result = await adminFetch<TagSuggestion>("/admin/ai/suggest-tags", {
        method: "POST",
        body: JSON.stringify({ body: body.trim(), existingSubjects: subjectOptions, existingTopics: topicOptions }),
        headers: { "Content-Type": "application/json" },
      });
      if (result.subject) setSubject(result.subject);
      if (result.topic) setTopic(result.topic);
      if (result.subtopic) setSubtopic(result.subtopic);
      toast({ title: "✨ Tags suggested" });
    } catch {
      toast({ title: "AI suggest failed", variant: "destructive" });
    } finally {
      setSuggesting(false);
    }
  };

  const toggleCorrect = (id: string) => {
    if (kind === "mcq") setCorrectIds([id]);
    else setCorrectIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const save = useMutation({
    mutationFn: () => adminFetch<Question>(`/admin/questions/${question.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        kind, body, topic,
        imageUrl: imageUrl || null,
        explanation: explanation || null,
        subject: subject.trim() || null,
        subtopic: subtopic.trim() || null,
        source: source.trim() || null,
        solutionVideoUrl: solutionVideoUrl.trim() || null,
        solutionArticleUrl: solutionArticleUrl.trim() || null,
        marks: Number(marks),
        negativeMarks: Number(negativeMarks),
        sectionId: sectionId || null,
        options: kind !== "nat" ? options.filter(o => o.body.trim()) : undefined,
        correctOptionIds: kind !== "nat" ? correctIds : undefined,
        natAnswer: kind === "nat" ? Number(natAnswer) : null,
      }),
      headers: { "Content-Type": "application/json" },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-questions", question.examId] });
      qc.invalidateQueries({ queryKey: ["admin-exams"] });
      toast({ title: "Question saved!" });
      onSaved();
    },
    onError: () => toast({ title: "Failed to save question", variant: "destructive" }),
  });

  return (
    <div className="space-y-4 p-4 rounded-lg border border-primary/30 bg-primary/5 mt-1">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-primary">Editing Question</span>
        <Button variant="ghost" size="icon" onClick={onCancel}><X className="h-4 w-4" /></Button>
      </div>

      <div className="flex gap-3">
        {(["mcq", "msq", "nat"] as const).map(k => (
          <button key={k} onClick={() => setKind(k)}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${kind === k ? "bg-primary text-white" : "bg-white/5 text-muted-foreground hover:bg-white/10"}`}>
            {k.toUpperCase()}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-muted-foreground self-center">$...$ inline math · $$...$$ display</span>
      </div>

      <div className="space-y-2">
        <Label>Question Body</Label>
        <Textarea value={body} onChange={e => setBody(e.target.value)} rows={3} />
        <MathPreview text={body} label="Preview" />
      </div>

      <div className="space-y-2">
        <Label>Diagram (optional)</Label>
        {imageUrl ? (
          <div className="relative inline-block">
            <img src={imageUrl} alt="" className="max-h-48 rounded-lg border border-white/10 object-contain" />
            <button onClick={() => setImageUrl("")} className="absolute -top-2 -right-2 w-5 h-5 bg-destructive rounded-full flex items-center justify-center">
              <X className="w-3 h-3 text-white" />
            </button>
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-white/20 text-sm text-muted-foreground hover:border-white/40 transition-colors">
            <ImagePlus className="w-4 h-4" />{uploading ? "Uploading..." : "Upload diagram"}
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0])} />
      </div>

      {sections.length > 0 && (
        <div className="space-y-1">
          <Label>Section</Label>
          <Select value={sectionId || "none"} onValueChange={v => setSectionId(v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="No section" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No section</SelectItem>
              {sections.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Tags</Label>
          <Button type="button" variant="outline" size="sm" onClick={suggestTags} disabled={!body.trim() || suggesting}>
            {suggesting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
            {suggesting ? "Thinking..." : "Suggest (AI)"}
          </Button>
        </div>
        <datalist id="editSubjectOpts">{subjectOptions.map(s => <option key={s} value={s} />)}</datalist>
        <datalist id="editTopicOpts">{topicOptions.map(s => <option key={s} value={s} />)}</datalist>
        <datalist id="editSubtopicOpts">{subtopicOptions.map(s => <option key={s} value={s} />)}</datalist>
        <datalist id="editSourceOpts">{sourceOptions.map(s => <option key={s} value={s} />)}</datalist>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label className="text-xs">Subject</Label>
            <Input list="editSubjectOpts" value={subject} onChange={e => setSubject(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Topic *</Label>
            <Input list="editTopicOpts" value={topic} onChange={e => setTopic(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Subtopic</Label>
            <Input list="editSubtopicOpts" value={subtopic} onChange={e => setSubtopic(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Source</Label>
            <Input list="editSourceOpts" value={source} onChange={e => setSource(e.target.value)} /></div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label>Marks</Label>
          <Input type="number" step="0.5" value={marks} onChange={e => setMarks(e.target.value)} /></div>
        <div className="space-y-1"><Label>Negative Marks</Label>
          <Input type="number" step="0.01" value={negativeMarks} onChange={e => setNegativeMarks(e.target.value)} /></div>
      </div>

      {kind === "nat" ? (
        <div className="space-y-1">
          <Label>Correct Answer (numerical)</Label>
          <Input type="number" step="any" value={natAnswer} onChange={e => setNatAnswer(e.target.value)} />
        </div>
      ) : (
        <div className="space-y-2">
          <Label>Options {kind === "mcq" ? "(one correct)" : "(all correct)"}</Label>
          {options.map((opt, i) => (
            <div key={opt.id} className="space-y-1">
              <div className="flex gap-2 items-center">
                <button onClick={() => toggleCorrect(opt.id)}
                  className={`w-6 h-6 shrink-0 rounded-full border-2 transition-colors ${correctIds.includes(opt.id) ? "border-green-500 bg-green-500" : "border-white/20"}`} />
                <Input value={opt.body}
                  onChange={e => setOptions(prev => prev.map(o => o.id === opt.id ? { ...o, body: e.target.value } : o))} />
              </div>
              {opt.body && <div className="ml-8"><MathText text={opt.body} className="text-xs text-muted-foreground" /></div>}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <Label>Explanation</Label>
        <Textarea value={explanation} onChange={e => setExplanation(e.target.value)} rows={2} />
        <MathPreview text={explanation} label="Explanation Preview" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">📹 Video Solution URL (YouTube)</Label>
          <Input type="url" placeholder="https://youtu.be/..." value={solutionVideoUrl} onChange={e => setSolutionVideoUrl(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">📄 Article Solution URL</Label>
          <Input type="url" placeholder="https://..." value={solutionArticleUrl} onChange={e => setSolutionArticleUrl(e.target.value)} />
        </div>
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={() => save.mutate()} disabled={!body || !topic || save.isPending}>
          {save.isPending ? "Saving..." : "Save Question"}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

// ─── Question Stats Tab ───────────────────────────────────────────────────────

function QuestionStats({ examId, examTitle }: { examId: string; examTitle: string }) {
  const { data: stats, isLoading } = useQuery<QuestionStat[]>({
    queryKey: ["admin-question-stats", examId],
    queryFn: () => adminFetch(`/admin/exams/${examId}/question-stats`),
    staleTime: 30_000,
  });

  const exportCsv = async () => {
    try {
      const blob = await customFetch<Blob>(`/api/admin/exams/${examId}/results/export`, { responseType: "blob" } as any);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${examTitle.replace(/[^a-z0-9]/gi, "_")}_results.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    }
  };

  if (isLoading) return <p className="text-sm text-muted-foreground py-8 text-center">Loading stats...</p>;
  if (!stats || stats.length === 0) return (
    <div className="text-center py-12 text-muted-foreground">
      <BarChart2 className="h-12 w-12 mx-auto mb-3 opacity-20" />
      <p>No attempt data yet. Stats appear once students submit this exam.</p>
    </div>
  );

  const sorted = [...stats].sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing per-question stats across all submitted attempts.
        </p>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="h-4 w-4 mr-1.5" /> Export Results CSV
        </Button>
      </div>

      <div className="space-y-2">
        {sorted.map((s, i) => {
          const rate = s.correctRate;
          const barColor = rate === null ? "bg-muted" : rate >= 70 ? "bg-emerald-500" : rate >= 40 ? "bg-amber-500" : "bg-rose-500";
          const rateText = rate === null ? "—" : `${rate}%`;
          const rateClass = rate === null ? "text-muted-foreground" : rate >= 70 ? "text-emerald-400" : rate >= 40 ? "text-amber-400" : "text-rose-400";

          return (
            <div key={s.id} className="p-3 rounded-lg border border-white/10 bg-white/5 space-y-2">
              <div className="flex items-start gap-3">
                <span className="text-xs text-muted-foreground w-5 shrink-0 pt-0.5">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{s.body}</p>
                  <div className="flex gap-2 mt-0.5 flex-wrap text-[10px] text-muted-foreground">
                    <span>{s.kind.toUpperCase()}</span>
                    {s.subject && <span>🎓 {s.subject}</span>}
                    <span>📌 {s.topic}</span>
                    <span>{s.marks}M</span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <span className={`text-lg font-bold ${rateClass}`}>{rateText}</span>
                  <p className="text-[10px] text-muted-foreground">correct</p>
                </div>
              </div>
              {s.totalAnswers > 0 && (
                <div className="space-y-1">
                  <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-white/10">
                    {s.attempted > 0 && <div className={`${barColor} transition-all`} style={{ width: `${(s.correct / s.totalAnswers) * 100}%` }} />}
                    {s.wrong > 0 && <div className="bg-rose-500/60 transition-all" style={{ width: `${(s.wrong / s.totalAnswers) * 100}%` }} />}
                  </div>
                  <div className="flex gap-4 text-[10px] text-muted-foreground">
                    <span className="text-emerald-400">✓ {s.correct} correct</span>
                    <span className="text-rose-400">✗ {s.wrong} wrong</span>
                    <span>— {s.skipped} skipped</span>
                    <span className="ml-auto">{s.totalAnswers} total</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Solutions / Explanation Editor ──────────────────────────────────────────

type SolutionEdit = {
  explanation: string;
  solutionVideoUrl: string;
  solutionArticleUrl: string;
  saved: boolean;
  saving: boolean;
};

function SolutionsEditor({ examId, questions }: { examId: string; questions: Question[] }) {
  const qc = useQueryClient();
  const [edits, setEdits] = useState<Record<string, SolutionEdit>>({});
  const [filter, setFilter] = useState<"all" | "missing">("all");
  const [savingAll, setSavingAll] = useState(false);

  // Merge in any question not yet tracked (handles async load + new questions added)
  useEffect(() => {
    setEdits(prev => {
      let changed = false;
      const next = { ...prev };
      for (const q of questions) {
        if (!prev[q.id]) {
          next[q.id] = {
            explanation: q.explanation ?? "",
            solutionVideoUrl: q.solutionVideoUrl ?? "",
            solutionArticleUrl: q.solutionArticleUrl ?? "",
            saved: true,
            saving: false,
          };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [questions]);

  const orderedQuestions = [...questions].sort((a, b) => a.displayOrder - b.displayOrder);
  const qNumberMap = new Map(orderedQuestions.map((q, i) => [q.id, i + 1]));

  const explained = orderedQuestions.filter(q => edits[q.id]?.explanation.trim()).length;
  const total = orderedQuestions.length;
  const pct = total > 0 ? Math.round((explained / total) * 100) : 0;
  const dirtyCount = orderedQuestions.filter(q => edits[q.id] && !edits[q.id].saved).length;

  const setField = (qId: string, field: "explanation" | "solutionVideoUrl" | "solutionArticleUrl", value: string) => {
    setEdits(prev => ({ ...prev, [qId]: { ...prev[qId], [field]: value, saved: false } }));
  };

  const saveSingle = async (qId: string) => {
    const e = edits[qId];
    if (!e) return;
    setEdits(prev => ({ ...prev, [qId]: { ...prev[qId], saving: true } }));
    try {
      await adminFetch<{ updated: number }>(`/admin/exams/${examId}/solutions`, {
        method: "PATCH",
        body: JSON.stringify({
          updates: [{
            questionId: qId,
            explanation: e.explanation || null,
            solutionVideoUrl: e.solutionVideoUrl || null,
            solutionArticleUrl: e.solutionArticleUrl || null,
          }],
        }),
        headers: { "Content-Type": "application/json" },
      });
      setEdits(prev => ({ ...prev, [qId]: { ...prev[qId], saving: false, saved: true } }));
    } catch {
      setEdits(prev => ({ ...prev, [qId]: { ...prev[qId], saving: false } }));
      toast({ title: "Save failed", variant: "destructive" });
    }
  };

  const saveAll = async () => {
    const dirty = orderedQuestions.filter(q => edits[q.id] && !edits[q.id].saved);
    if (dirty.length === 0) { toast({ title: "All solutions are already saved" }); return; }
    setSavingAll(true);
    try {
      const updates = dirty.map(q => ({
        questionId: q.id,
        explanation: edits[q.id].explanation || null,
        solutionVideoUrl: edits[q.id].solutionVideoUrl || null,
        solutionArticleUrl: edits[q.id].solutionArticleUrl || null,
      }));
      await adminFetch<{ updated: number }>(`/admin/exams/${examId}/solutions`, {
        method: "PATCH",
        body: JSON.stringify({ updates }),
        headers: { "Content-Type": "application/json" },
      });
      setEdits(prev => {
        const next = { ...prev };
        for (const q of dirty) next[q.id] = { ...next[q.id], saved: true };
        return next;
      });
      qc.invalidateQueries({ queryKey: ["admin-questions", examId] });
      toast({ title: `Saved ${dirty.length} solution${dirty.length === 1 ? "" : "s"}!` });
    } catch {
      toast({ title: "Save all failed", variant: "destructive" });
    } finally {
      setSavingAll(false);
    }
  };

  const visibleQuestions = filter === "missing"
    ? orderedQuestions.filter(q => !edits[q.id]?.explanation.trim())
    : orderedQuestions;

  if (total === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-20" />
        <p>No questions yet. Add questions first, then come back to add explanations.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Coverage bar + actions */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold">{explained}/{total} with explanations</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
              pct === 100
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                : pct >= 50
                ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                : "bg-rose-500/15 text-rose-400 border-rose-500/30"
            }`}>{pct}%</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? "bg-emerald-500" : "bg-violet-500"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilter(f => f === "all" ? "missing" : "all")}
            className="gap-1.5 text-xs"
          >
            {filter === "missing"
              ? <><CheckCircle2 className="h-3.5 w-3.5" /> Show All</>
              : <><AlertCircle className="h-3.5 w-3.5" /> Missing Only ({total - explained})</>}
          </Button>
          <Button
            size="sm"
            onClick={saveAll}
            disabled={savingAll || dirtyCount === 0}
            className="gap-1.5"
          >
            {savingAll
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <CheckCircle2 className="h-3.5 w-3.5" />}
            {savingAll ? "Saving…" : dirtyCount > 0 ? `Save (${dirtyCount})` : "Saved"}
          </Button>
        </div>
      </div>

      {visibleQuestions.length === 0 && filter === "missing" && (
        <div className="text-center py-10 text-muted-foreground">
          <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-emerald-500/50" />
          <p className="font-semibold text-emerald-400">All {total} questions have explanations!</p>
        </div>
      )}

      <div className="space-y-3">
        {visibleQuestions.map(q => {
          const e = edits[q.id] ?? { explanation: "", solutionVideoUrl: "", solutionArticleUrl: "", saved: true, saving: false };
          const hasExplanation = e.explanation.trim().length > 0;
          const isDirty = !e.saved;

          return (
            <div
              key={q.id}
              className={`rounded-xl border transition-colors ${
                isDirty
                  ? "border-violet-500/40 bg-violet-500/4"
                  : hasExplanation
                  ? "border-emerald-500/20 bg-emerald-500/2"
                  : "border-white/10 bg-white/2"
              }`}
            >
              <div className="flex items-start gap-3 px-3 pt-3 pb-2">
                <span className="text-xs font-mono text-muted-foreground w-6 shrink-0 mt-0.5 text-right">
                  {qNumberMap.get(q.id)}.
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-relaxed line-clamp-2">{q.body}</p>
                  <div className="flex gap-2 mt-1 flex-wrap text-[10px] text-muted-foreground">
                    <span className="font-bold uppercase">{q.kind}</span>
                    {q.subject && <span>🎓 {q.subject}</span>}
                    <span>📌 {q.topic}</span>
                    <span>{q.marks}M</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {hasExplanation && !isDirty && (
                    <span className="hidden sm:flex items-center gap-0.5 text-[10px] text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" /> solved
                    </span>
                  )}
                  {isDirty && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[11px] px-2 gap-1 border-violet-500/40 text-violet-400 hover:bg-violet-500/10"
                      onClick={() => saveSingle(q.id)}
                      disabled={e.saving}
                    >
                      {e.saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                      {e.saving ? "Saving…" : "Save"}
                    </Button>
                  )}
                </div>
              </div>

              <div className="px-3 pb-3 pl-9 space-y-2">
                <Textarea
                  rows={2}
                  placeholder="Explanation… supports LaTeX: $...$ inline, $$...$$ display"
                  value={e.explanation}
                  onChange={ev => setField(q.id, "explanation", ev.target.value)}
                  className="text-sm resize-y"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input
                    type="url"
                    placeholder="📹 YouTube solution URL"
                    value={e.solutionVideoUrl}
                    onChange={ev => setField(q.id, "solutionVideoUrl", ev.target.value)}
                    className="h-8 text-sm"
                  />
                  <Input
                    type="url"
                    placeholder="📄 Article URL (https://…)"
                    value={e.solutionArticleUrl}
                    onChange={ev => setField(q.id, "solutionArticleUrl", ev.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Add Question Form ────────────────────────────────────────────────────────

function AddQuestionForm({ examId, examContext, sections, existingQuestions, onAdded }:
  { examId: string; examContext: string; sections: Section[]; existingQuestions: Question[]; onAdded: () => void }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<"mcq" | "msq" | "nat">("mcq");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [explanation, setExplanation] = useState("");
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("");
  const [subtopic, setSubtopic] = useState("");
  const [source, setSource] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [marks, setMarks] = useState("1");
  const [negativeMarks, setNegativeMarks] = useState("0.33");
  const [natAnswer, setNatAnswer] = useState("");
  const [sectionId, setSectionId] = useState<string>("");
  const [solutionVideoUrl, setSolutionVideoUrl] = useState("");
  const [solutionArticleUrl, setSolutionArticleUrl] = useState("");

  // Autocomplete sources — unique non-empty values from existing questions
  const uniq = (vals: (string | null | undefined)[]) =>
    Array.from(new Set(vals.filter((v): v is string => !!v && v.trim().length > 0))).sort();
  const subjectOptions  = uniq(existingQuestions.map(q => q.subject));
  const topicOptions    = uniq(existingQuestions.map(q => q.topic));
  const subtopicOptions = uniq(existingQuestions.map(q => q.subtopic));
  const sourceOptions   = uniq(existingQuestions.map(q => q.source));

  const suggestTags = async () => {
    if (!body.trim()) {
      toast({ title: "Type the question first", variant: "destructive" });
      return;
    }
    setSuggesting(true);
    try {
      const result = await adminFetch<TagSuggestion>("/admin/ai/suggest-tags", {
        method: "POST",
        body: JSON.stringify({
          body: body.trim(),
          examContext,
          existingSubjects: subjectOptions,
          existingTopics: topicOptions,
        }),
        headers: { "Content-Type": "application/json" },
      });
      if (result.subject)  setSubject(result.subject);
      if (result.topic)    setTopic(result.topic);
      if (result.subtopic) setSubtopic(result.subtopic);
      toast({ title: "✨ Tags suggested — review & edit before saving" });
    } catch (err: any) {
      const msg = err?.message || "Failed";
      const lower = msg.toLowerCase();
      let title = "AI suggest failed";
      let description = msg.slice(0, 200);
      if (lower.includes("not configured")) {
        title = "AI not configured";
        description = "Set ANTHROPIC_API_KEY on the server to enable.";
      } else if (lower.includes("daily limit") || lower.includes("rate limit") || lower.includes("limit reached") || lower.includes("paused")) {
        title = "AI quota limit hit";
      }
      toast({ title, description, variant: "destructive" });
    } finally {
      setSuggesting(false);
    }
  };
  const [options, setOptions] = useState([
    { id: crypto.randomUUID(), body: "" },
    { id: crypto.randomUUID(), body: "" },
    { id: crypto.randomUUID(), body: "" },
    { id: crypto.randomUUID(), body: "" },
  ]);
  const [correctIds, setCorrectIds] = useState<string[]>([]);

  const uploadImage = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await customFetch<{ secure_url: string }>("/api/upload", { method: "POST", body: fd });
      setImageUrl(res.secure_url);
    } catch {
      toast({ title: "Image upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const addQ = useMutation({
    mutationFn: () => adminFetch<Question>(`/admin/exams/${examId}/questions`, {
      method: "POST",
      body: JSON.stringify({
        kind, body, topic, imageUrl: imageUrl || null, explanation: explanation || null,
        subject: subject.trim() || null,
        subtopic: subtopic.trim() || null,
        source: source.trim() || null,
        solutionVideoUrl: solutionVideoUrl.trim() || null,
        solutionArticleUrl: solutionArticleUrl.trim() || null,
        marks: Number(marks),
        negativeMarks: Number(negativeMarks),
        sectionId: sectionId || null,
        options: kind !== "nat" ? options.filter(o => o.body.trim()) : undefined,
        correctOptionIds: kind !== "nat" ? correctIds : undefined,
        natAnswer: kind === "nat" ? Number(natAnswer) : null,
      }),
      headers: { "Content-Type": "application/json" },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-questions", examId] });
      qc.invalidateQueries({ queryKey: ["admin-exams"] });
      setBody(""); setTopic(""); setCorrectIds([]);
      setImageUrl(""); setExplanation("");
      setSubject(""); setSubtopic(""); setSource("");
      setSolutionVideoUrl(""); setSolutionArticleUrl("");
      setOptions([
        { id: crypto.randomUUID(), body: "" },
        { id: crypto.randomUUID(), body: "" },
        { id: crypto.randomUUID(), body: "" },
        { id: crypto.randomUUID(), body: "" },
      ]);
      toast({ title: "Question added!" });
      onAdded();
    },
    onError: (err: any) => toast({
      title: "Failed to add question",
      description: (err?.message || "").slice(0, 300) || undefined,
      variant: "destructive",
    }),
  });

  const toggleCorrect = (id: string) => {
    if (kind === "mcq") {
      setCorrectIds([id]);
    } else {
      setCorrectIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    }
  };

  return (
    <div className="space-y-4 p-4 rounded-lg border border-white/10 bg-white/5">
      {/* Question type selector */}
      <div className="flex gap-3">
        {(["mcq", "msq", "nat"] as const).map(k => (
          <button key={k} onClick={() => setKind(k)}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${kind === k ? "bg-primary text-white" : "bg-white/5 text-muted-foreground hover:bg-white/10"}`}>
            {k.toUpperCase()}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-muted-foreground self-center">
          Use $...$ for inline math, $$...$$ for display math
        </span>
      </div>

      {/* Question body + preview */}
      <div className="space-y-2">
        <Label>Question Body (supports LaTeX)</Label>
        <Textarea
          placeholder={"If $f(x) = \\int_0^x t\\sin(t)\\,dt$, then $f'(x)$ = ?"}
          value={body} onChange={e => setBody(e.target.value)} rows={3}
        />
        <MathPreview text={body} label="Question Preview" />
      </div>

      {/* Image upload */}
      <div className="space-y-2">
        <Label>Diagram / Figure (optional)</Label>
        {imageUrl ? (
          <div className="relative inline-block">
            <img src={imageUrl} alt="question diagram" className="max-h-48 rounded-lg border border-white/10 object-contain" />
            <button onClick={() => setImageUrl("")}
              className="absolute -top-2 -right-2 w-5 h-5 bg-destructive rounded-full flex items-center justify-center">
              <X className="w-3 h-3 text-white" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-white/20 text-sm text-muted-foreground hover:border-white/40 hover:text-foreground transition-colors"
          >
            <ImagePlus className="w-4 h-4" />
            {uploading ? "Uploading..." : "Upload diagram or figure"}
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0])} />
      </div>

      {sections.length > 0 && (
        <div className="space-y-1">
          <Label>Section (optional)</Label>
          <Select value={sectionId || "none"} onValueChange={v => setSectionId(v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="No section" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No section</SelectItem>
              {sections.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Tagging block — Subject / Topic / Subtopic / Source with AI suggest */}
      <div className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Tags</Label>
          <Button type="button" variant="outline" size="sm" onClick={suggestTags} disabled={!body.trim() || suggesting}>
            {suggesting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
            {suggesting ? "Thinking..." : "Suggest Tags (AI)"}
          </Button>
        </div>
        <datalist id="subjectOptions">{subjectOptions.map(s => <option key={s} value={s} />)}</datalist>
        <datalist id="topicOptions">{topicOptions.map(s => <option key={s} value={s} />)}</datalist>
        <datalist id="subtopicOptions">{subtopicOptions.map(s => <option key={s} value={s} />)}</datalist>
        <datalist id="sourceOptions">{sourceOptions.map(s => <option key={s} value={s} />)}</datalist>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Subject</Label>
            <Input list="subjectOptions" placeholder="e.g. Mathematics" value={subject} onChange={e => setSubject(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Topic <span className="text-destructive">*</span></Label>
            <Input list="topicOptions" placeholder="e.g. Calculus" value={topic} onChange={e => setTopic(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Subtopic</Label>
            <Input list="subtopicOptions" placeholder="e.g. Integration by parts" value={subtopic} onChange={e => setSubtopic(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Source</Label>
            <Input list="sourceOptions" placeholder="e.g. GATE 2024 / NCERT Ch 5" value={source} onChange={e => setSource(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Marks</Label>
          <Input type="number" step="0.5" value={marks} onChange={e => setMarks(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Negative Marks</Label>
          <Input type="number" step="0.01" value={negativeMarks} onChange={e => setNegativeMarks(e.target.value)} />
        </div>
      </div>

      {kind === "nat" ? (
        <div className="space-y-1">
          <Label>Correct Answer (numerical)</Label>
          <Input type="number" step="any" placeholder="e.g. 42 or 3.14" value={natAnswer} onChange={e => setNatAnswer(e.target.value)} />
        </div>
      ) : (
        <div className="space-y-2">
          <Label>Options {kind === "mcq" ? "(select one correct)" : "(select all correct)"} — supports LaTeX</Label>
          {options.map((opt, i) => (
            <div key={opt.id} className="space-y-1">
              <div className="flex gap-2 items-center">
                <button onClick={() => toggleCorrect(opt.id)}
                  className={`w-6 h-6 shrink-0 rounded-full border-2 transition-colors ${correctIds.includes(opt.id) ? "border-green-500 bg-green-500" : "border-white/20"}`} />
                <Input placeholder={`Option ${i + 1} — e.g. $2x+1$`} value={opt.body}
                  onChange={e => setOptions(prev => prev.map(o => o.id === opt.id ? { ...o, body: e.target.value } : o))} />
              </div>
              {opt.body && <div className="ml-8"><MathText text={opt.body} className="text-xs text-muted-foreground" /></div>}
            </div>
          ))}
        </div>
      )}

      {/* Explanation (shown to students after submit) */}
      <div className="space-y-2">
        <Label>Explanation (shown after submit — supports LaTeX)</Label>
        <Textarea placeholder="Explain the correct answer..." value={explanation}
          onChange={e => setExplanation(e.target.value)} rows={2} />
        <MathPreview text={explanation} label="Explanation Preview" />
      </div>

      {/* Solution Video + Article URLs (shown to students after submit) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="flex items-center gap-1.5 text-xs">📹 Video Solution URL <span className="text-muted-foreground font-normal">(YouTube)</span></Label>
          <Input type="url" placeholder="https://youtu.be/..." value={solutionVideoUrl}
            onChange={e => setSolutionVideoUrl(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="flex items-center gap-1.5 text-xs">📄 Article Solution URL</Label>
          <Input type="url" placeholder="https://blog.example.com/sol-12" value={solutionArticleUrl}
            onChange={e => setSolutionArticleUrl(e.target.value)} />
        </div>
      </div>

      <Button size="sm" onClick={() => addQ.mutate()} disabled={!body || !topic || addQ.isPending}>
        {addQ.isPending ? "Adding..." : "Add Question"}
      </Button>
    </div>
  );
}

// ─── Sections Manager ─────────────────────────────────────────────────────────

function SectionsManager({ examId }: { examId: string }) {
  const qc = useQueryClient();
  const { data: sections = [] } = useQuery<Section[]>({
    queryKey: ["admin-sections", examId],
    queryFn: () => adminFetch(`/admin/exams/${examId}/sections`),
  });
  const [name, setName] = useState("");
  const [timeLimit, setTimeLimit] = useState("");

  const create = useMutation({
    mutationFn: () => adminFetch<Section>(`/admin/exams/${examId}/sections`, {
      method: "POST",
      body: JSON.stringify({
        name,
        displayOrder: sections.length,
        timeLimitMinutes: timeLimit ? Number(timeLimit) : null,
      }),
      headers: { "Content-Type": "application/json" },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-sections", examId] });
      setName(""); setTimeLimit("");
      toast({ title: "Section added" });
    },
    onError: () => toast({ title: "Failed to add section", variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => adminFetch(`/admin/sections/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-sections", examId] });
      qc.invalidateQueries({ queryKey: ["admin-questions", examId] });
      toast({ title: "Section deleted" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3">
        <h3 className="font-semibold text-sm">Add Section</h3>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px_auto] gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Section Name</Label>
            <Input placeholder="e.g. Quantitative Aptitude" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Time Limit (min, optional)</Label>
            <Input type="number" placeholder="e.g. 20" value={timeLimit} onChange={e => setTimeLimit(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button onClick={() => create.mutate()} disabled={!name || create.isPending}>
              <Plus className="h-4 w-4 mr-1" />Add
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground flex items-start gap-1.5">
          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
          Leave time limit empty for GATE/JEE-style (free navigation). Set a value for SSC/Banking-style sectional timers.
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
          Sections ({sections.length})
        </h3>
        {sections.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground border border-dashed border-white/10 rounded-lg">
            <Layers className="h-8 w-8 mx-auto mb-2 opacity-30" />
            No sections yet. Add one above to organize your questions.
          </div>
        ) : (
          sections.map((s, i) => (
            <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg border border-white/10 bg-white/5">
              <span className="text-xs text-muted-foreground w-6">{i + 1}.</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{s.name}</p>
                <p className="text-xs text-muted-foreground">
                  {s.timeLimitMinutes ? `${s.timeLimitMinutes} min sectional timer` : "No sectional timer"}
                </p>
              </div>
              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"
                onClick={() => { if (confirm(`Delete "${s.name}"? Questions in this section will be unassigned.`)) remove.mutate(s.id); }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── CSV Import ───────────────────────────────────────────────────────────────

type ParsedRow = {
  kind: "mcq" | "msq" | "nat";
  body: string;
  options?: { id: string; body: string }[];
  correctOptionIds?: string[];
  natAnswer?: number | null;
  marks: number;
  negativeMarks: number;
  sectionName: string;
  topic: string;
  subject: string | null;
  subtopic: string | null;
  source: string | null;
  explanation: string | null;
  solutionVideoUrl: string | null;
  solutionArticleUrl: string | null;
  error?: string;
};

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else cur += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { out.push(cur); cur = ""; }
      else cur += c;
    }
  }
  out.push(cur);
  return out.map(s => s.trim());
}

function parseCsv(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];
  // Skip header row if present
  const startIdx = lines[0].toLowerCase().includes("kind") && lines[0].toLowerCase().includes("body") ? 1 : 0;
  const rows: ParsedRow[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const [kind, body, optA, optB, optC, optD, correct, marks, negMarks, sectionName, topic, explanation, videoUrl, articleUrl, subject, subtopic, source] = cols;
    const k = (kind || "").toLowerCase();
    const baseEmpty = {
      marks: 0, negativeMarks: 0, sectionName: "", topic: "",
      subject: null, subtopic: null, source: null,
      explanation: null, solutionVideoUrl: null, solutionArticleUrl: null,
    };
    if (!["mcq", "msq", "nat"].includes(k)) {
      rows.push({ kind: "mcq", body: body || "", ...baseEmpty, error: `Invalid kind "${kind}"` });
      continue;
    }
    let opts: { id: string; body: string }[] | undefined;
    let correctIds: string[] | undefined;
    let natAnswer: number | null | undefined;

    const baseFields = {
      marks: Number(marks) || 0,
      negativeMarks: Number(negMarks) || 0,
      sectionName: sectionName || "",
      topic: topic || "",
      subject: (subject || "").trim() || null,
      subtopic: (subtopic || "").trim() || null,
      source: (source || "").trim() || null,
      explanation: explanation || null,
      solutionVideoUrl: null,
      solutionArticleUrl: null,
    };

    if (k === "nat") {
      const n = Number(correct);
      if (isNaN(n)) {
        rows.push({ kind: k as any, body, ...baseFields, error: "NAT correct answer must be a number" });
        continue;
      }
      natAnswer = n;
    } else {
      const optInputs = [optA, optB, optC, optD].filter(o => o && o.length > 0);
      if (optInputs.length < 2) {
        rows.push({ kind: k as any, body, ...baseFields, error: "MCQ/MSQ needs at least 2 options" });
        continue;
      }
      opts = optInputs.map(b => ({ id: crypto.randomUUID(), body: b }));
      const letters = (correct || "").toUpperCase().replace(/[^A-D]/g, "").split("");
      const validLetters = letters.filter(l => "ABCD".indexOf(l) < optInputs.length);
      if (validLetters.length === 0) {
        rows.push({ kind: k as any, body, options: opts, ...baseFields, error: `Invalid correct "${correct}". Use A/B/C/D` });
        continue;
      }
      correctIds = validLetters.map(l => opts![("ABCD".indexOf(l))].id);
      if (k === "mcq" && correctIds.length > 1) correctIds = [correctIds[0]];
    }

    // Validate URL formats (best-effort client-side; backend re-validates)
    const v = (videoUrl || "").trim();
    const a = (articleUrl || "").trim();
    let urlError: string | undefined;
    if (v && !/^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(v)) urlError = "Video URL must be a YouTube link";
    if (!urlError && a && !/^https:\/\//i.test(a)) urlError = "Article URL must start with https://";

    rows.push({
      kind: k as "mcq" | "msq" | "nat",
      body: body || "",
      options: opts,
      correctOptionIds: correctIds,
      natAnswer,
      marks: Number(marks) || 1,
      negativeMarks: Number(negMarks) || 0,
      sectionName: (sectionName || "").trim(),
      topic: (topic || "").trim() || "General",
      subject: (subject || "").trim() || null,
      subtopic: (subtopic || "").trim() || null,
      source: (source || "").trim() || null,
      explanation: explanation && explanation.length > 0 ? explanation : null,
      solutionVideoUrl: v || null,
      solutionArticleUrl: a || null,
      error: urlError,
    });
  }
  return rows;
}

const CSV_TEMPLATE_HEADER = "kind,body,optA,optB,optC,optD,correct,marks,negMarks,section,topic,explanation,videoUrl,articleUrl,subject,subtopic,source";

function CsvImport({ examId, sections, examContext }: { examId: string; sections: Section[]; examContext: string }) {
  const qc = useQueryClient();
  const [csv, setCsv] = useState("");
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null);
  const [dragging, setDragging] = useState(false);
  const [aiTagging, setAiTagging] = useState(false);
  const [aiProgress, setAiProgress] = useState({ done: 0, total: 0 });
  const [pdfExtracting, setPdfExtracting] = useState(false);
  const [pdfProgress, setPdfProgress] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const sample = `${CSV_TEMPLATE_HEADER}
mcq,"What is 2+2?","2","3","4","5",C,1,0.33,"Quantitative","Arithmetic","Basic addition","https://youtu.be/abc123","","Mathematics","Addition","NCERT Ch 1"
nat,"Solve x+1=5",,,,,4,2,0,"Mathematics","Algebra","","","","Mathematics","Linear equations",""
msq,"Which are even?","1","2","3","4","BD",1,0,"Reasoning","Numbers","2 and 4 are even","","https://blog.example.com/even-numbers","Mathematics","Even / Odd","GATE 2024"`;

  const importMut = useMutation({
    mutationFn: (questions: any[]) => adminFetch(`/admin/exams/${examId}/questions/bulk`, {
      method: "POST",
      body: JSON.stringify({ questions }),
      headers: { "Content-Type": "application/json" },
    }),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["admin-questions", examId] });
      qc.invalidateQueries({ queryKey: ["admin-exams"] });
      toast({ title: `✓ Imported ${data.added} questions successfully!` });
      setCsv(""); setParsed(null);
    },
    onError: () => toast({ title: "Import failed", variant: "destructive" }),
  });

  const loadFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv") && !file.type.includes("csv") && !file.type.includes("text")) {
      toast({ title: "Upload a .csv file", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) ?? "";
      setCsv(text);
      setParsed(parseCsv(text));
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      extractPdf(file);
    } else {
      loadFile(file);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE_HEADER + "\n"], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "questions_template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const extractPdf = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      toast({ title: "Upload a .pdf file", variant: "destructive" });
      return;
    }
    setPdfExtracting(true);
    setPdfProgress("Uploading PDF…");
    try {
      const formData = new FormData();
      formData.append("pdf", file);
      setPdfProgress("AI reading pages…");
      const data = await adminFetch<{
        questions: any[];
        extracted: number;
        valid: number;
      }>("/admin/pdf-import", { method: "POST", body: formData });

      // Convert AI-extracted questions into ParsedRow format
      const rows: ParsedRow[] = data.questions.map((q: any) => ({
        kind: q.kind,
        body: q.body,
        options: q.options,
        correctOptionIds: q.correctOptionIds,
        natAnswer: q.natAnswer,
        marks: q.marks,
        negativeMarks: q.negativeMarks,
        topic: q.topic ?? "General",
        subject: q.subject ?? null,
        subtopic: q.subtopic ?? null,
        source: q.source ?? null,
        explanation: q.explanation ?? null,
        solutionVideoUrl: q.solutionVideoUrl ?? null,
        solutionArticleUrl: q.solutionArticleUrl ?? null,
        sectionName: "",
        error: q.body ? undefined : "Empty question body",
      }));

      setParsed(rows);
      toast({ title: `PDF extracted: ${data.valid} question${data.valid === 1 ? "" : "s"} ready to review` });
    } catch (err: any) {
      toast({ title: err?.message ?? "PDF extraction failed", variant: "destructive" });
    } finally {
      setPdfExtracting(false);
      setPdfProgress("");
    }
  };

  const doImport = () => {
    if (!parsed) return;
    const valid = parsed.filter(p => !p.error);
    const sectionByName = new Map(sections.map(s => [s.name.toLowerCase(), s.id]));
    const payload = valid.map(p => ({
      kind: p.kind,
      body: p.body,
      options: p.options,
      correctOptionIds: p.correctOptionIds,
      natAnswer: p.natAnswer ?? null,
      marks: p.marks,
      negativeMarks: p.negativeMarks,
      topic: p.topic,
      subject: p.subject,
      subtopic: p.subtopic,
      source: p.source,
      explanation: p.explanation,
      solutionVideoUrl: p.solutionVideoUrl,
      solutionArticleUrl: p.solutionArticleUrl,
      sectionId: p.sectionName ? (sectionByName.get(p.sectionName.toLowerCase()) ?? null) : null,
    }));
    importMut.mutate(payload);
  };

  const handleAiTag = async () => {
    if (!parsed) return;
    const toTag = parsed
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => !p.error && (!p.subject || !p.topic || p.topic === "General"));
    if (toTag.length === 0) {
      toast({ title: "All rows already have subject/topic tags." });
      return;
    }
    const cap = Math.min(toTag.length, 20); // respect daily AI limit
    setAiTagging(true);
    setAiProgress({ done: 0, total: cap });
    const updated = [...parsed];

    for (let i = 0; i < cap; i++) {
      const { p, i: rowIdx } = toTag[i];
      try {
        const suggestion = await adminFetch<TagSuggestion>("/admin/ai/suggest-tags", {
          method: "POST",
          body: JSON.stringify({ body: p.body.slice(0, 800), examContext }),
          headers: { "Content-Type": "application/json" },
        });
        updated[rowIdx] = {
          ...updated[rowIdx],
          subject:  updated[rowIdx].subject  || suggestion.subject  || null,
          topic:    (updated[rowIdx].topic === "General" || !updated[rowIdx].topic)
                      ? (suggestion.topic || updated[rowIdx].topic)
                      : updated[rowIdx].topic,
          subtopic: updated[rowIdx].subtopic || suggestion.subtopic || null,
        };
      } catch {
        // silently skip failed rows — don't block the batch
      }
      setAiProgress({ done: i + 1, total: cap });
      // stay well under the 5/min burst limit
      if (i < cap - 1) await new Promise(r => setTimeout(r, 300));
    }

    setParsed(updated);
    setAiTagging(false);
    toast({ title: `AI tagged ${cap} question${cap === 1 ? "" : "s"}${cap < toTag.length ? ` (${toTag.length - cap} skipped — daily limit)` : ""}!` });
  };

  const errorCount = parsed?.filter(p => p.error).length ?? 0;
  const validCount = parsed ? parsed.length - errorCount : 0;
  const untaggedCount = parsed?.filter(p => !p.error && (!p.subject || !p.topic || p.topic === "General")).length ?? 0;

  return (
    <div className="space-y-5">

      {/* ── Drop Zone ── */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`rounded-xl border-2 border-dashed transition-colors cursor-pointer flex flex-col items-center justify-center gap-3 py-10 px-6 select-none ${
          dragging
            ? "border-primary bg-primary/10"
            : "border-white/15 bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.04]"
        }`}
      >
        <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">
          <FileSpreadsheet className={`h-6 w-6 ${dragging ? "text-primary" : "text-muted-foreground"}`} />
        </div>
        <div className="text-center">
          <p className="font-semibold text-sm">{dragging ? "Drop to load" : "Drop a CSV or PDF here"}</p>
          <p className="text-xs text-muted-foreground mt-1">CSV → paste import · PDF → AI vision extract (max 10 pages)</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv,.pdf,application/pdf"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (!f) return;
            if (f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")) extractPdf(f);
            else loadFile(f);
            e.target.value = "";
          }}
        />
      </div>

      {/* ── PDF extraction progress ── */}
      {pdfExtracting && (
        <div className="flex items-center gap-3 rounded-lg border border-violet-500/30 bg-violet-500/5 px-4 py-3 text-sm">
          <Loader2 className="h-4 w-4 animate-spin text-violet-400 shrink-0" />
          <span className="text-violet-300">{pdfProgress}</span>
        </div>
      )}

      {/* ── Header buttons ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="font-semibold text-sm flex items-center gap-2 mr-auto">
          <FileSpreadsheet className="h-4 w-4" /> Or Paste CSV
        </h3>
        <Button
          variant="outline"
          size="sm"
          disabled={pdfExtracting}
          onClick={() => pdfInputRef.current?.click()}
          className="gap-1.5 border-violet-500/40 text-violet-300 hover:bg-violet-500/10"
        >
          {pdfExtracting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Import from PDF
        </Button>
        <input
          ref={pdfInputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) extractPdf(f); e.target.value = ""; }}
        />
        <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-1.5">
          <Download className="h-3.5 w-3.5" /> Download Template
        </Button>
        <Button variant="outline" size="sm" onClick={() => { setCsv(sample); setParsed(parseCsv(sample)); }} className="gap-1.5">
          <Eye className="h-3.5 w-3.5" /> Load Sample
        </Button>
      </div>

      {/* ── Paste textarea ── */}
      <Textarea
        rows={8}
        className="font-mono text-xs"
        placeholder={`${CSV_TEMPLATE_HEADER}\nmcq,"Question body…","Opt A","Opt B","Opt C","Opt D",A,1,0.33,,Topic,,,,Subject,Subtopic,Source`}
        value={csv}
        onChange={e => { setCsv(e.target.value); setParsed(null); }}
      />

      {/* ── Format hints ── */}
      <div className="text-xs text-muted-foreground space-y-0.5 border border-white/10 rounded-lg p-3 bg-white/[0.02]">
        <p className="font-semibold text-foreground/80 mb-1.5">Format reference</p>
        <p>• <code className="bg-white/10 px-1 rounded">correct</code> column: A/B/C/D for MCQ · AB/ACD for MSQ · number for NAT</p>
        <p>• Leave optA–optD blank for NAT questions</p>
        <p>• <code className="bg-white/10 px-1 rounded">section</code> must match a section name exactly (case-insensitive). Leave blank for no section.</p>
        <p>• <code className="bg-white/10 px-1 rounded">videoUrl</code> must be a YouTube link · <code className="bg-white/10 px-1 rounded">articleUrl</code> must be https://</p>
        <p>• subject / subtopic / source are optional but power analytics and practice drills</p>
      </div>

      {/* ── Action bar ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button onClick={() => setParsed(parseCsv(csv))} disabled={!csv.trim()} variant="outline" className="gap-1.5">
          <Eye className="h-4 w-4" /> Preview
        </Button>

        {parsed && untaggedCount > 0 && (
          <Button
            variant="outline"
            className="gap-1.5"
            disabled={aiTagging}
            onClick={handleAiTag}
          >
            {aiTagging ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Tagging {aiProgress.done}/{aiProgress.total}…
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                AI Tag {untaggedCount} Row{untaggedCount === 1 ? "" : "s"}
              </>
            )}
          </Button>
        )}

        {parsed && validCount > 0 && (
          <Button onClick={doImport} disabled={importMut.isPending} className="gap-1.5">
            <Upload className="h-4 w-4" />
            {importMut.isPending ? "Importing…" : `Import ${validCount} Question${validCount === 1 ? "" : "s"}`}
          </Button>
        )}
      </div>

      {/* ── AI tagging progress bar ── */}
      {aiTagging && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>AI tagging in progress…</span>
            <span>{aiProgress.done} / {aiProgress.total}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-violet-500 transition-all duration-300"
              style={{ width: `${aiProgress.total > 0 ? (aiProgress.done / aiProgress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Preview table ── */}
      {parsed && (
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-sm">
            <Badge variant="outline" className="text-green-400 gap-1">
              <CheckCircle2 className="h-3 w-3" /> {validCount} valid
            </Badge>
            {errorCount > 0 && (
              <Badge variant="outline" className="text-destructive gap-1">
                <AlertTriangle className="h-3 w-3" /> {errorCount} error{errorCount > 1 ? "s" : ""}
              </Badge>
            )}
            {untaggedCount > 0 && !aiTagging && (
              <span className="text-xs text-amber-400 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {untaggedCount} missing tags — use AI Tag to fill them
              </span>
            )}
          </div>
          <div className="max-h-[480px] overflow-y-auto space-y-1.5 border border-white/10 rounded-lg p-2">
            {parsed.map((p, i) => (
              <div key={i} className={`text-xs p-2.5 rounded-lg ${p.error ? "bg-destructive/10 border border-destructive/30" : "bg-white/[0.03] border border-white/[0.06]"}`}>
                <div className="flex gap-2 items-start">
                  <span className="text-muted-foreground/50 shrink-0 font-mono w-6 text-right">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-foreground/90">{p.body || <em className="opacity-60">empty body</em>}</p>
                    <div className="flex gap-2 mt-1 flex-wrap text-[10px] text-muted-foreground">
                      <span className={`font-bold uppercase ${p.kind === "nat" ? "text-orange-400" : p.kind === "msq" ? "text-blue-400" : "text-emerald-400"}`}>{p.kind}</span>
                      <span>+{p.marks}M/-{p.negativeMarks}</span>
                      {p.sectionName && <span className="text-violet-400">📑 {p.sectionName}</span>}
                      {p.subject
                        ? <span className="text-sky-400">🎓 {p.subject}</span>
                        : <span className="text-amber-400/60 italic">no subject</span>}
                      <span className="text-foreground/50">📌 {p.topic || <em>no topic</em>}</span>
                      {p.subtopic && <span>↳ {p.subtopic}</span>}
                      {p.source && <span>📚 {p.source}</span>}
                      {p.solutionVideoUrl && <span className="text-rose-400">▶ video</span>}
                      {p.solutionArticleUrl && <span className="text-blue-400">🔗 article</span>}
                    </div>
                    {p.error && <p className="text-destructive mt-1 font-semibold flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {p.error}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Exam Manager (with tabs) ─────────────────────────────────────────────────

type Tab = "sections" | "questions" | "csv" | "stats" | "solutions";

function ExamManager({ exam: initialExam, onBack }: { exam: Exam; onBack: () => void }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("questions");
  const [exam, setExam] = useState<Exam>(initialExam);
  const [editingExam, setEditingExam] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);

  const { data: questions = [], isLoading } = useQuery<Question[]>({
    queryKey: ["admin-questions", exam.id],
    queryFn: () => adminFetch(`/admin/exams/${exam.id}/questions`),
  });
  const { data: sections = [] } = useQuery<Section[]>({
    queryKey: ["admin-sections", exam.id],
    queryFn: () => adminFetch(`/admin/exams/${exam.id}/sections`),
  });

  const deleteQ = useMutation({
    mutationFn: (id: string) => adminFetch(`/admin/questions/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-questions", exam.id] });
      qc.invalidateQueries({ queryKey: ["admin-exams"] });
      toast({ title: "Question deleted" });
    },
  });

  const reorder = useMutation({
    mutationFn: (order: string[]) => adminFetch(`/admin/exams/${exam.id}/questions/reorder`, {
      method: "PATCH",
      body: JSON.stringify({ order }),
      headers: { "Content-Type": "application/json" },
    }),
  });

  const moveQuestion = (index: number, dir: -1 | 1) => {
    const ordered = [...questions].sort((a, b) => a.displayOrder - b.displayOrder);
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= ordered.length) return;
    [ordered[index], ordered[newIndex]] = [ordered[newIndex], ordered[index]];
    const newOrder = ordered.map(q => q.id);
    // Optimistic local update
    qc.setQueryData<Question[]>(["admin-questions", exam.id], ordered.map((q, i) => ({ ...q, displayOrder: i })));
    reorder.mutate(newOrder);
  };

  const sectionName = (sid: string | null) =>
    sid ? (sections.find(s => s.id === sid)?.name ?? "—") : "No section";

  const tabBtn = (id: Tab, label: string, icon: React.ReactNode, count?: number) => (
    <button
      onClick={() => setTab(id)}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
        tab === id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon} {label} {count !== undefined && <span className="text-xs opacity-60">({count})</span>}
    </button>
  );

  const orderedQuestions = [...questions].sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={onBack}><ChevronLeft className="h-4 w-4" /></Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold">{exam.title}</h2>
            {exam.isLive
              ? <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">Live</span>
              : <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-muted-foreground border border-white/10">Draft</span>}
            {exam.shuffleQuestions && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/30 flex items-center gap-1"><Shuffle className="h-2.5 w-2.5" />Shuffle</span>}
          </div>
          <p className="text-sm text-muted-foreground">{exam.exam} · {exam.kind} · {exam.totalQuestions}q · {exam.totalMarks}M · {exam.durationMinutes}min</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditingExam(v => !v)}>
            <Settings className="h-4 w-4 mr-1.5" />{editingExam ? "Close" : "Edit Details"}
          </Button>
          <Link href={`/exams/${exam.id}`}>
            <Button variant="outline" size="sm"><Eye className="h-4 w-4 mr-2" />Preview</Button>
          </Link>
        </div>
      </div>

      {/* Inline edit exam form */}
      {editingExam && (
        <EditExamSection
          exam={exam}
          onSaved={(updated) => { setExam(updated); setEditingExam(false); }}
          onCancel={() => setEditingExam(false)}
        />
      )}

      {/* Tab bar */}
      <div className="flex border-b border-white/10 overflow-x-auto">
        {tabBtn("sections", "Sections", <Layers className="h-4 w-4" />, sections.length)}
        {tabBtn("questions", "Questions", <FileQuestion className="h-4 w-4" />, questions.length)}
        {tabBtn("csv", "CSV Import", <Upload className="h-4 w-4" />)}
        {tabBtn("solutions", "Solutions", <GraduationCap className="h-4 w-4" />, questions.filter(q => q.explanation).length)}
        {tabBtn("stats", "Stats", <BarChart2 className="h-4 w-4" />)}
      </div>

      {tab === "sections" && <SectionsManager examId={exam.id} />}

      {tab === "questions" && (
        <div className="space-y-6">
          <AddQuestionForm
            examId={exam.id}
            examContext={`${exam.exam} ${exam.kind}`.trim()}
            sections={sections}
            existingQuestions={questions}
            onAdded={() => {}}
          />

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Questions ({questions.length})
              </h3>
              {questions.length > 1 && (
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <ChevronUp className="h-3 w-3" /><ChevronDown className="h-3 w-3" /> drag to reorder
                </span>
              )}
            </div>
            {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
            {orderedQuestions.map((q, i) => (
              <div key={q.id}>
                <div className={`flex gap-3 p-3 rounded-lg border transition-colors ${editingQuestionId === q.id ? "border-primary/30 bg-primary/5" : "border-white/10 bg-white/5"}`}>
                  {/* Reorder buttons */}
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button onClick={() => moveQuestion(i, -1)} disabled={i === 0}
                      className="p-0.5 rounded hover:bg-white/10 disabled:opacity-20 text-muted-foreground transition-colors">
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <span className="text-muted-foreground text-xs text-center">{i + 1}</span>
                    <button onClick={() => moveQuestion(i, 1)} disabled={i === orderedQuestions.length - 1}
                      className="p-0.5 rounded hover:bg-white/10 disabled:opacity-20 text-muted-foreground transition-colors">
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-relaxed line-clamp-2">{q.body}</p>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-xs">{q.kind.toUpperCase()}</Badge>
                      {q.subject && <Badge variant="outline" className="text-xs">🎓 {q.subject}</Badge>}
                      <Badge variant="outline" className="text-xs">{q.topic}</Badge>
                      {q.subtopic && <Badge variant="outline" className="text-xs opacity-80">↳ {q.subtopic}</Badge>}
                      {q.source && <Badge variant="outline" className="text-xs">📚 {q.source}</Badge>}
                      {q.sectionId && <Badge variant="outline" className="text-xs">📑 {sectionName(q.sectionId)}</Badge>}
                      <span className="text-xs text-muted-foreground">{q.marks}M / -{q.negativeMarks}M</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => setEditingQuestionId(prev => prev === q.id ? null : q.id)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => deleteQ.mutate(q.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {editingQuestionId === q.id && (
                  <EditQuestionInline
                    question={q}
                    sections={sections}
                    existingQuestions={questions}
                    onSaved={() => setEditingQuestionId(null)}
                    onCancel={() => setEditingQuestionId(null)}
                  />
                )}
              </div>
            ))}
            {!isLoading && questions.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No questions yet. Add one above or import from CSV.</p>
            )}
          </div>
        </div>
      )}

      {tab === "csv" && (
        <div className="space-y-4">
          {/* Export existing questions for editing */}
          {questions.length > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-lg border border-white/10 bg-white/[0.02]">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">Export existing questions</p>
                <p className="text-xs text-muted-foreground mt-0.5">Download {questions.length} question{questions.length === 1 ? "" : "s"} as CSV — edit offline, then re-import</p>
              </div>
              <a href={`/api/admin/exams/${exam.id}/questions/export`} download>
                <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
                  <Download className="h-3.5 w-3.5" /> Export CSV
                </Button>
              </a>
            </div>
          )}
          <CsvImport examId={exam.id} sections={sections} examContext={`${exam.exam} ${exam.kind}`} />
        </div>
      )}
      {tab === "stats" && <QuestionStats examId={exam.id} examTitle={exam.title} />}
      {tab === "solutions" && <SolutionsEditor examId={exam.id} questions={questions} />}
    </div>
  );
}

// ─── Exams List ───────────────────────────────────────────────────────────────

function ExamsList({ onSelect, onCreate }: { onSelect: (e: Exam) => void; onCreate: () => void }) {
  const qc = useQueryClient();
  const { data: exams = [], isLoading } = useQuery<Exam[]>({
    queryKey: ["admin-exams"],
    queryFn: () => adminFetch("/admin/exams"),
  });

  const deleteExam = useMutation({
    mutationFn: (id: string) => adminFetch<{
      questionsDeleted: number; sectionsDeleted: number;
      attemptsDeleted: number; answersDeleted: number; bookmarksDeleted: number;
    }>(`/admin/exams/${id}`, { method: "DELETE" }),
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ["admin-exams"] });
      const bits = [
        s.questionsDeleted && `${s.questionsDeleted} question${s.questionsDeleted === 1 ? "" : "s"}`,
        s.attemptsDeleted  && `${s.attemptsDeleted} student attempt${s.attemptsDeleted === 1 ? "" : "s"}`,
        s.sectionsDeleted  && `${s.sectionsDeleted} section${s.sectionsDeleted === 1 ? "" : "s"}`,
      ].filter(Boolean).join(", ");
      toast({ title: "Test deleted", description: bits || undefined });
    },
    onError: (err: any) => toast({
      title: "Delete failed",
      description: (err?.message || "").slice(0, 300) || undefined,
      variant: "destructive",
    }),
  });

  const duplicateExam = useMutation({
    mutationFn: (id: string) => adminFetch<Exam>(`/admin/exams/${id}/duplicate`, { method: "POST" }),
    onSuccess: (newExam) => {
      qc.invalidateQueries({ queryKey: ["admin-exams"] });
      toast({ title: `Duplicated as "${newExam.title}"` });
    },
    onError: () => toast({ title: "Duplicate failed", variant: "destructive" }),
  });

  const getShareLink = useMutation({
    mutationFn: (id: string) => adminFetch<{ inviteCode: string }>(`/admin/exams/${id}/invite`, { method: "POST" }),
    onSuccess: ({ inviteCode }) => {
      const url = `${window.location.origin}/e/${inviteCode}`;
      navigator.clipboard.writeText(url).catch(() => {});
      toast({ title: "Share link copied!", description: url });
    },
    onError: () => toast({ title: "Failed to generate link", variant: "destructive" }),
  });

  const toggleLive = useMutation({
    mutationFn: ({ id, isLive }: { id: string; isLive: boolean }) =>
      adminFetch<Exam>(`/admin/exams/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isLive }),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-exams"] }); },
    onError: () => toast({ title: "Toggle failed", variant: "destructive" }),
  });

  const diffColor = { easy: "text-green-400", medium: "text-yellow-400", hard: "text-red-400" };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Test Series ({exams.length})</h2>
        <Button size="sm" onClick={onCreate}><Plus className="h-4 w-4 mr-2" />New Test</Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}

      {exams.map(exam => (
        <div key={exam.id} className="flex items-center gap-3 p-4 rounded-lg border border-white/10 bg-white/5 hover:bg-white/[0.07] transition-colors">
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onSelect(exam)}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold">{exam.title}</span>
              <Badge variant="outline" className="text-xs">{exam.exam}</Badge>
              <Badge variant="outline" className="text-xs">{exam.kind}</Badge>
              <span className={`text-xs font-medium ${diffColor[exam.difficulty as keyof typeof diffColor]}`}>{exam.difficulty}</span>
              {exam.shuffleQuestions && <span className="text-[10px] text-violet-400 flex items-center gap-0.5"><Shuffle className="h-2.5 w-2.5" />shuffle</span>}
            </div>
            <div className="flex gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1"><FileQuestion className="h-3 w-3" />{exam.totalQuestions} questions</span>
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{exam.durationMinutes} min</span>
              <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" />{exam.totalMarks} marks</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />{exam.attemptCount} attempts</span>
              {exam.scheduledAt && (
                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(exam.scheduledAt).toLocaleString()}</span>
              )}
            </div>
          </div>

          {/* Live toggle */}
          <button
            onClick={() => toggleLive.mutate({ id: exam.id, isLive: !exam.isLive })}
            title={exam.isLive ? "Click to unpublish" : "Click to publish"}
            className={`shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
              exam.isLive
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                : "bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10"
            }`}
          >
            {exam.isLive ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
            {exam.isLive ? "Live" : "Draft"}
          </button>

          <Button variant="ghost" size="icon" className="shrink-0 text-violet-400 hover:text-violet-300"
            title="Copy share link"
            onClick={() => getShareLink.mutate(exam.id)} disabled={getShareLink.isPending}>
            {getShareLink.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-foreground"
            title="Duplicate exam"
            onClick={() => duplicateExam.mutate(exam.id)} disabled={duplicateExam.isPending}>
            <Copy className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="shrink-0 text-destructive hover:text-destructive"
            onClick={() => { if (confirm(`Delete "${exam.title}"? This permanently removes all questions, sections, and every student's attempts + scores for this test. This cannot be undone.`)) deleteExam.mutate(exam.id); }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}

      {!isLoading && exams.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <FileQuestion className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>No test series yet. Create one to get started.</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────

type View = "list" | "create" | "questions";

export default function AdminPanel() {
  const { user } = useUser();
  const isAdmin = user?.publicMetadata?.role === "admin";
  const [view, setView] = useState<View>("list");
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] flex-col gap-3 text-center">
        <AlertCircle className="h-12 w-12 text-destructive opacity-60" />
        <h2 className="text-xl font-bold">Access Denied</h2>
        <p className="text-muted-foreground">You don't have permission to view this page.</p>
        <Link href="/dashboard"><Button variant="outline">Go to Dashboard</Button></Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Panel</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage test series and questions</p>
        </div>
        {view !== "list" && (
          <Button variant="outline" onClick={() => { setView("list"); setSelectedExam(null); }}>
            <ChevronLeft className="h-4 w-4 mr-2" />Back to List
          </Button>
        )}
      </div>

      <Separator />

      {view === "list" && (
        <ExamsList
          onSelect={(exam) => { setSelectedExam(exam); setView("questions"); }}
          onCreate={() => setView("create")}
        />
      )}

      {view === "create" && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Create New Test Series</h2>
          <CreateExamForm onCreated={(exam) => { setSelectedExam(exam); setView("questions"); }} />
        </div>
      )}

      {view === "questions" && selectedExam && (
        <ExamManager exam={selectedExam} onBack={() => { setView("list"); setSelectedExam(null); }} />
      )}
    </div>
  );
}
