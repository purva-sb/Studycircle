import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ChevronLeft, Trophy, Clock, FileText } from "lucide-react";
import { format } from "date-fns";

type Student = {
  id: string; displayName: string; avatarUrl: string;
  xp: number; createdAt: string;
};

type Attempt = {
  id: string; examId: string; status: string;
  score: number | null; startedAt: string;
  title: string; totalMarks: number;
};

function StudentAttempts({ student, onBack }: { student: Student; onBack: () => void }) {
  const { data: attempts = [], isLoading } = useQuery<Attempt[]>({
    queryKey: ["admin-student-attempts", student.id],
    queryFn: () => customFetch(`/api/admin/students/${student.id}/attempts`),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Avatar className="h-10 w-10">
          <AvatarImage src={student.avatarUrl} />
          <AvatarFallback>{student.displayName?.substring(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-bold">{student.displayName}</p>
          <p className="text-xs text-muted-foreground">{student.xp} XP · Joined {format(new Date(student.createdAt), "MMM d, yyyy")}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <FileText className="w-4 h-4 text-muted-foreground" />
          Attempt History ({attempts.length})
        </h2>
        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {attempts.length === 0 && !isLoading && (
          <p className="text-sm text-muted-foreground">No attempts yet.</p>
        )}
        {attempts.map(a => (
          <div key={a.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{a.title}</p>
              <p className="text-xs text-muted-foreground">{format(new Date(a.startedAt), "MMM d, yyyy · h:mm a")}</p>
            </div>
            <Badge variant={a.status === "submitted" ? "default" : "outline"} className="text-xs shrink-0">
              {a.status}
            </Badge>
            {a.score !== null && (
              <span className="text-sm font-bold shrink-0">
                {a.score}/{a.totalMarks}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminStudents() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Student | null>(null);

  const { data: students = [], isLoading } = useQuery<Student[]>({
    queryKey: ["admin-students"],
    queryFn: () => customFetch("/api/admin/students"),
  });

  if (selected) return <StudentAttempts student={selected} onBack={() => setSelected(null)} />;

  const filtered = students.filter(s =>
    s.displayName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Students</h1>
        <p className="text-muted-foreground text-sm mt-1">{students.length} total registered</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search by name..." className="pl-9"
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {isLoading && (
          <div className="p-4 space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />)}
          </div>
        )}
        {filtered.map((s, i) => (
          <button key={s.id} onClick={() => setSelected(s)}
            className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-muted/50 transition-colors text-left">
            <span className="text-sm text-muted-foreground w-6 shrink-0">{i + 1}</span>
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarImage src={s.avatarUrl} />
              <AvatarFallback className="text-xs">{s.displayName?.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{s.displayName}</p>
              <p className="text-xs text-muted-foreground">Joined {format(new Date(s.createdAt), "MMM d, yyyy")}</p>
            </div>
            <div className="flex items-center gap-1 text-xs text-yellow-500 shrink-0">
              <Trophy className="w-3 h-3" />{s.xp} XP
            </div>
          </button>
        ))}
        {!isLoading && filtered.length === 0 && (
          <div className="py-12 text-center text-muted-foreground text-sm">No students found.</div>
        )}
      </div>
    </div>
  );
}
