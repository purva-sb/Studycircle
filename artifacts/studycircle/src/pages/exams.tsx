import { useState } from "react";
import { useListExams } from "@workspace/api-client-react";
import { slowDataQueryOptions } from "@/lib/query-client";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Clock, FileQuestion, BarChart3, ChevronRight, PlayCircle, CalendarClock } from "lucide-react";
import { format } from "date-fns";

export default function ExamsCatalog() {
  const { data: exams, isLoading } = useListExams({ query: slowDataQueryOptions });
  const [search, setSearch] = useState("");
  const [filterExam, setFilterExam] = useState<string | null>(null);
  const [filterKind, setFilterKind] = useState<string | null>(null);

  const filteredExams = exams?.filter(e => {
    const matchesSearch = e.title.toLowerCase().includes(search.toLowerCase());
    const matchesExam = filterExam ? e.exam === filterExam : true;
    const matchesKind = filterKind ? e.kind === filterKind : true;
    return matchesSearch && matchesExam && matchesKind;
  });

  const uniqueExams = Array.from(new Set(exams?.map(e => e.exam) || []));
  const uniqueKinds = Array.from(new Set(exams?.map(e => e.kind) || []));

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Mock Exams & Practice</h2>
        <p className="text-muted-foreground mt-2 text-lg">Test your knowledge under real exam conditions.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search exams, subjects..." 
            className="pl-10 h-12 bg-card shadow-sm border-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide shrink-0">
          <Badge 
            variant={filterExam === null ? "default" : "outline"} 
            className="cursor-pointer whitespace-nowrap text-sm px-4 py-1.5 h-10"
            onClick={() => setFilterExam(null)}
          >
            All Exams
          </Badge>
          {uniqueExams.map(ex => (
            <Badge 
              key={ex}
              variant={filterExam === ex ? "default" : "outline"} 
              className="cursor-pointer whitespace-nowrap text-sm px-4 py-1.5 h-10"
              onClick={() => setFilterExam(filterExam === ex ? null : ex)}
            >
              {ex}
            </Badge>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      ) : filteredExams && filteredExams.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredExams.map(exam => (
            <Card key={exam.id} className="flex flex-col hover-elevate transition-all border-transparent hover:border-primary/30 shadow-sm overflow-hidden group">
              <div className={`h-2 w-full ${exam.isLive ? 'bg-red-500' : 'bg-primary'}`} />
              <CardHeader className="pb-3 flex-1">
                <div className="flex justify-between items-start mb-2">
                  <Badge variant="secondary" className="font-semibold bg-muted hover:bg-muted">{exam.exam}</Badge>
                  {exam.isLive && <Badge variant="destructive" className="animate-pulse">LIVE NOW</Badge>}
                  {exam.scheduledAt && !exam.isLive && (
                    <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-500/10 flex items-center gap-1">
                      <CalendarClock className="w-3 h-3" /> {format(new Date(exam.scheduledAt), 'MMM d, h:mm a')}
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-xl leading-tight group-hover:text-primary transition-colors line-clamp-2">{exam.title}</CardTitle>
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mt-2">{exam.kind.replace('-', ' ')}</div>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm text-muted-foreground bg-muted/30 p-4 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    <span className="font-medium text-foreground">{exam.durationMinutes} mins</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileQuestion className="w-4 h-4 text-blue-500" />
                    <span className="font-medium text-foreground">{exam.totalQuestions} Qs</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-emerald-500" />
                    <span className="font-medium text-foreground">{exam.totalMarks} Marks</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${
                      exam.difficulty === 'easy' ? 'bg-emerald-500' : 
                      exam.difficulty === 'medium' ? 'bg-amber-500' : 'bg-red-500'
                    }`} />
                    <span className="font-medium capitalize text-foreground">{exam.difficulty}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Link href={`/exams/${exam.id}`} className="w-full">
                  <Button className="w-full group-hover:bg-primary/90 transition-colors shadow-sm gap-2">
                    {exam.isLive ? 'Join Live Contest' : 'View Details'} <ChevronRight className="w-4 h-4" />
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="flex flex-col items-center justify-center p-16 border-dashed">
          <FileQuestion className="w-16 h-16 text-muted-foreground mb-4 opacity-30" />
          <h3 className="text-xl font-bold mb-2">No exams found</h3>
          <p className="text-muted-foreground">Try adjusting your filters or search term.</p>
        </Card>
      )}
    </div>
  );
}
