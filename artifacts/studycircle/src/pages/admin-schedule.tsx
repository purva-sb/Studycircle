import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Clock, Radio, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";

type Exam = {
  id: string; title: string; exam: string; kind: string;
  durationMinutes: number; isLive: boolean; scheduledAt: string | null;
  totalQuestions: number; totalMarks: number;
};

export default function AdminSchedule() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  const { data: exams = [], isLoading } = useQuery<Exam[]>({
    queryKey: ["admin-exams"],
    queryFn: () => customFetch("/api/admin/exams"),
  });

  const schedule = useMutation({
    mutationFn: ({ id, scheduledAt, isLive }: { id: string; scheduledAt: string; isLive: boolean }) =>
      customFetch(`/api/admin/exams/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isLive, kind: "scheduled", scheduledAt }),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-exams"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      toast({ title: "Live test scheduled!" });
      setSelectedId(""); setScheduledAt("");
    },
    onError: () => toast({ title: "Failed to schedule", variant: "destructive" }),
  });

  const unschedule = useMutation({
    mutationFn: (id: string) =>
      customFetch(`/api/admin/exams/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isLive: false, scheduledAt: null }),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-exams"] });
      toast({ title: "Test unscheduled" });
    },
  });

  const liveExams = exams.filter(e => e.isLive);
  const unscheduled = exams.filter(e => !e.isLive);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Schedule</h1>
        <p className="text-muted-foreground text-sm mt-1">Schedule live tests for students</p>
      </div>

      {/* Schedule new live test */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          <Radio className="w-4 h-4 text-violet-400" />
          Schedule a Live Test
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Select Test</Label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a test series..." />
              </SelectTrigger>
              <SelectContent>
                {unscheduled.map(e => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.title} ({e.exam})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Start Date & Time</Label>
            <Input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
          </div>
        </div>
        <Button
          onClick={() => schedule.mutate({ id: selectedId, scheduledAt, isLive: true })}
          disabled={!selectedId || !scheduledAt || schedule.isPending}
        >
          {schedule.isPending ? "Scheduling..." : "Schedule Live Test"}
        </Button>
      </div>

      {/* Currently scheduled */}
      <div className="space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-400" />
          Scheduled Live Tests ({liveExams.length})
        </h2>
        {isLoading && <div className="h-20 bg-muted animate-pulse rounded-xl" />}
        {liveExams.length === 0 && !isLoading && (
          <p className="text-sm text-muted-foreground">No live tests scheduled yet.</p>
        )}
        {liveExams.map(exam => (
          <div key={exam.id} className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-sm">{exam.title}</p>
                <Badge variant="outline" className="text-xs">{exam.exam}</Badge>
                <Badge className="text-xs bg-green-500/15 text-green-400 border-green-500/25">LIVE</Badge>
              </div>
              <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {exam.scheduledAt
                    ? format(new Date(exam.scheduledAt), "MMM d, yyyy · h:mm a")
                    : "No time set"}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />{exam.durationMinutes} min
                </span>
              </div>
            </div>
            <Button variant="outline" size="sm" className="shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={() => unschedule.mutate(exam.id)}>
              Unschedule
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
