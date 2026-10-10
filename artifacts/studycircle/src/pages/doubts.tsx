import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/clerk-react";
import { Link } from "wouter";
import { customFetch } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Coins, Search, CheckCircle2, Clock, LogIn, PenSquare, Flame, TrendingUp, ChevronDown, ImagePlus, X, ChevronUp, ImageIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useExamPreference, EXAMS, type ExamPref } from "@/hooks/use-exam-preference";

type FeedDoubt = {
  id: string;
  title: string;
  body: string;
  topic: string;
  subject: string | null;
  exam: string;
  imageUrls: string[];
  upvotes: number;
  bountyXp: number;
  createdAt: string;
  resolved: boolean;
  askedBy: string;
  askedByAvatar: string;
  askedById: string | null;
  answerCount: number;
};

type FeedResponse = {
  doubts: FeedDoubt[];
  total: number;
  page: number;
  hasMore: boolean;
};

const doubtSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(120),
  body:  z.string().min(20, "Please provide more details (min 20 chars)"),
  topic: z.string().min(2, "Topic is required"),
  subject: z.string().max(100).optional(),
  exam:  z.string().min(2, "Exam is required"),
  bountyXp: z.coerce.number().min(5).max(500),
  imageUrls: z.array(z.string()).max(8).optional(),
});

const EXAM_CHIPS: ExamPref[] = ["ALL", ...EXAMS];
const chipLabel = (e: ExamPref) => (e === "ALL" ? "All" : e);

export default function DoubtsFeed() {
  const { user, isLoaded } = useUser();
  const isSignedIn = isLoaded && !!user;
  const queryClient = useQueryClient();

  const [selectedExam, setSelectedExam] = useExamPreference();
  const [sort, setSort] = useState("new");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [allDoubts, setAllDoubts] = useState<FeedDoubt[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
      setAllDoubts([]);
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchInput]);

  // Reset accumulated list when filters change
  useEffect(() => {
    setPage(1);
    setAllDoubts([]);
  }, [selectedExam, sort]);

  const queryParams = new URLSearchParams();
  if (selectedExam !== "ALL") queryParams.set("exam", selectedExam);
  if (debouncedSearch)        queryParams.set("q", debouncedSearch);
  queryParams.set("sort", sort);
  queryParams.set("page", String(page));

  const { data: feed, isLoading, isFetching } = useQuery<FeedResponse>({
    queryKey: ["doubts-feed", selectedExam, sort, debouncedSearch, page],
    queryFn:  () => customFetch(`/api/doubts-feed?${queryParams.toString()}`),
    staleTime: 30_000,
  });

  // Accumulate pages
  useEffect(() => {
    if (!feed) return;
    if (page === 1) {
      setAllDoubts(feed.doubts);
    } else {
      setAllDoubts(prev => {
        const ids = new Set(prev.map(d => d.id));
        return [...prev, ...feed.doubts.filter(d => !ids.has(d.id))];
      });
    }
  }, [feed, page]);

  const form = useForm<z.infer<typeof doubtSchema>>({
    resolver: zodResolver(doubtSchema),
    defaultValues: { title: "", body: "", topic: "", subject: "", exam: selectedExam !== "ALL" ? selectedExam : "", bountyXp: 50, imageUrls: [] },
  });

  const [dialogImages, setDialogImages] = useState<string[]>([]);
  const [uploadingImg, setUploadingImg] = useState(false);
  const imgInputRef = useRef<HTMLInputElement>(null);

  const uploadImage = async (file: File) => {
    setUploadingImg(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await customFetch<{ secure_url: string }>("/api/upload", { method: "POST", body: fd });
      setDialogImages(prev => [...prev, res.secure_url]);
    } catch {
      toast.error("Image upload failed");
    } finally {
      setUploadingImg(false);
    }
  };

  const createDoubt = useMutation({
    mutationFn: (data: z.infer<typeof doubtSchema>) =>
      customFetch("/api/doubts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, imageUrls: dialogImages, subject: data.subject || undefined }),
      }),
    onSuccess: () => {
      toast.success("Doubt posted!");
      setIsDialogOpen(false);
      form.reset();
      setDialogImages([]);
      setPage(1);
      setAllDoubts([]);
      queryClient.invalidateQueries({ queryKey: ["doubts-feed"] });
    },
    onError: () => toast.error("Failed to post doubt"),
  });

  const showLoading = isLoading && page === 1;

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-5 rounded-xl border shadow-sm">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Community Q&amp;A</h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            {feed?.total ? `${feed.total.toLocaleString()} questions` : "Ask doubts, share knowledge, earn XP"} · All competitive exams
          </p>
        </div>
        {isSignedIn ? (
          <Button size="lg" className="gap-2 shrink-0" onClick={() => setIsDialogOpen(true)}>
            <PenSquare className="w-4 h-4" /> Ask a Doubt
          </Button>
        ) : isLoaded ? (
          <Link href="/sign-in">
            <Button size="lg" variant="outline" className="gap-2 shrink-0">
              <LogIn className="w-4 h-4" /> Sign in to ask
            </Button>
          </Link>
        ) : null}
      </div>

      {/* Filters row */}
      <div className="flex flex-col gap-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search questions by keyword, topic, or exam…"
            className="pl-10 bg-card border-none shadow-sm h-11"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
          />
        </div>

        {/* Exam chips + Sort tabs */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Exam chips */}
          <div className="flex flex-wrap gap-2 flex-1">
            {EXAM_CHIPS.map(exam => (
              <button
                key={exam}
                onClick={() => setSelectedExam(exam)}
                className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                  selectedExam === exam
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                }`}
              >
                {chipLabel(exam)}
              </button>
            ))}
          </div>

          {/* Sort tabs */}
          <Tabs value={sort} onValueChange={v => { setSort(v); }} className="shrink-0">
            <TabsList className="h-8">
              <TabsTrigger value="new"  className="text-xs gap-1 px-3"><Clock  className="w-3 h-3" />New</TabsTrigger>
              <TabsTrigger value="hot"  className="text-xs gap-1 px-3"><Flame  className="w-3 h-3" />Hot</TabsTrigger>
              <TabsTrigger value="top"  className="text-xs gap-1 px-3"><TrendingUp className="w-3 h-3" />Top</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Feed */}
      {showLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
        </div>
      ) : allDoubts.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 border-dashed">
          <div className="w-14 h-14 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
            <Search className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold mb-1">No questions found</h3>
          <p className="text-muted-foreground text-sm">
            {debouncedSearch ? "Try a different search term." : "Be the first to ask in this category!"}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {allDoubts.map(doubt => (
            <Link key={doubt.id} href={`/doubts/${doubt.id}`}>
              <div className="flex gap-0 bg-card border rounded-xl overflow-hidden hover:border-primary/40 transition-colors cursor-pointer group">
                {/* Stats sidebar */}
                <div className="flex flex-col items-center justify-start gap-3 px-3 sm:px-4 py-4 shrink-0 border-r bg-muted/20 w-16 sm:w-18">
                  <div className="flex flex-col items-center">
                    <span className={`text-xl font-bold leading-none ${doubt.upvotes > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                      {doubt.upvotes}
                    </span>
                    <span className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-0.5">
                      <ChevronUp className="w-2.5 h-2.5" />votes
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className={`text-xl font-bold leading-none ${doubt.answerCount > 0 ? (doubt.resolved ? "text-emerald-500" : "text-primary") : "text-muted-foreground"}`}>
                      {doubt.answerCount}
                    </span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">
                      {doubt.answerCount === 1 ? "answer" : "answers"}
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-sm font-semibold text-amber-500 leading-none flex items-center gap-0.5">
                      <Coins className="w-3 h-3" />{doubt.bountyXp}
                    </span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">XP</span>
                  </div>
                </div>

                {/* Main content */}
                <div className="flex-1 p-4 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 mb-2">
                    <Badge className="text-[11px] px-2 py-0 h-5 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
                      {doubt.exam}
                    </Badge>
                    {doubt.subject && (
                      <Badge variant="outline" className="text-[11px] px-2 py-0 h-5 bg-sky-500/10 text-sky-600 border-sky-500/20">
                        🎓 {doubt.subject}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[11px] px-2 py-0 h-5 text-muted-foreground">
                      {doubt.topic}
                    </Badge>
                    {doubt.imageUrls.length > 0 && (
                      <Badge variant="outline" className="text-[11px] px-2 py-0 h-5 gap-1 text-muted-foreground">
                        <ImageIcon className="w-2.5 h-2.5" />{doubt.imageUrls.length}
                      </Badge>
                    )}
                    {doubt.resolved && (
                      <Badge variant="outline" className="text-[11px] px-2 py-0 h-5 bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" /> Solved
                      </Badge>
                    )}
                  </div>

                  <h3 className="font-semibold text-base leading-snug group-hover:text-primary transition-colors line-clamp-2 mb-1.5">
                    {doubt.title}
                  </h3>

                  <p className="text-muted-foreground text-sm line-clamp-1 mb-3">{doubt.body}</p>

                  {/* Image thumbnails — first 3, indicator if more */}
                  {doubt.imageUrls.length > 0 && (
                    <div className="flex gap-1.5 mb-3">
                      {doubt.imageUrls.slice(0, 3).map((url, i) => (
                        <div key={url} className="w-14 h-14 rounded-md overflow-hidden border bg-muted/30 shrink-0">
                          <img src={url} alt={`thumb ${i + 1}`} className="w-full h-full object-cover" />
                        </div>
                      ))}
                      {doubt.imageUrls.length > 3 && (
                        <div className="w-14 h-14 rounded-md border bg-muted/30 shrink-0 flex items-center justify-center text-xs font-semibold text-muted-foreground">
                          +{doubt.imageUrls.length - 3}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={doubt.askedByAvatar} />
                      <AvatarFallback className="text-[10px]">{doubt.askedBy.substring(0, 2)}</AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground">
                      {doubt.askedById ? (
                        <Link href={`/users/${doubt.askedById}`}>
                          <a className="font-medium text-foreground/70 hover:text-primary" onClick={e => e.stopPropagation()}>
                            {doubt.askedBy}
                          </a>
                        </Link>
                      ) : (
                        <span className="font-medium text-foreground/70">{doubt.askedBy}</span>
                      )}
                      {" · "}
                      <span className="flex-inline items-center gap-1">
                        <Clock className="w-3 h-3 inline -mt-0.5" /> {formatDistanceToNow(new Date(doubt.createdAt), { addSuffix: true })}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}

          {/* Load more */}
          {feed?.hasMore && (
            <div className="pt-2 flex justify-center">
              <Button
                variant="outline"
                className="gap-2"
                disabled={isFetching}
                onClick={() => setPage(p => p + 1)}
              >
                {isFetching ? "Loading…" : <><ChevronDown className="w-4 h-4" /> Load more</>}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Guest CTA at bottom */}
      {!isSignedIn && isLoaded && allDoubts.length > 0 && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl bg-primary/5 border border-primary/20 text-sm">
          <span className="text-muted-foreground">Sign in to ask questions, post answers, and earn XP bounties.</span>
          <Link href="/sign-in">
            <Button size="sm" className="gap-1.5 shrink-0">
              <LogIn className="w-3.5 h-3.5" /> Sign In
            </Button>
          </Link>
        </div>
      )}

      {/* Ask a Doubt Dialog (signed-in only) */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ask a Doubt</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(d => createDoubt.mutate(d))} className="space-y-4">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl><Input placeholder="E.g. How to solve this integration problem?" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="body" render={({ field }) => (
                <FormItem>
                  <FormLabel>Details</FormLabel>
                  <FormControl><Textarea placeholder="Explain your doubt clearly…" className="min-h-30" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="exam" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Exam</FormLabel>
                    <FormControl><Input placeholder="E.g. GATE, JEE, NEET…" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="subject" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject <span className="text-xs text-muted-foreground font-normal">(optional)</span></FormLabel>
                    <FormControl><Input placeholder="E.g. Mathematics, Physics…" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="topic" render={({ field }) => (
                <FormItem>
                  <FormLabel>Topic</FormLabel>
                  <FormControl><Input placeholder="E.g. Calculus, Organic Chemistry…" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Image uploads */}
              <div className="space-y-2">
                <FormLabel className="flex items-center gap-2">
                  Images <span className="text-xs text-muted-foreground font-normal">(diagrams, screenshots — up to 8)</span>
                </FormLabel>
                {dialogImages.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {dialogImages.map((url, i) => (
                      <div key={url} className="relative aspect-square rounded-lg overflow-hidden border">
                        <img src={url} alt={`upload ${i + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setDialogImages(prev => prev.filter(u => u !== url))}
                          className="absolute top-1 right-1 w-5 h-5 bg-destructive rounded-full flex items-center justify-center"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {dialogImages.length < 8 && (
                  <button
                    type="button"
                    onClick={() => imgInputRef.current?.click()}
                    disabled={uploadingImg}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed text-sm text-muted-foreground hover:border-foreground/40 hover:text-foreground transition-colors"
                  >
                    <ImagePlus className="w-4 h-4" />
                    {uploadingImg ? "Uploading…" : "Add image"}
                  </button>
                )}
                <input
                  ref={imgInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ""; }}
                />
              </div>

              <FormField control={form.control} name="bountyXp" render={({ field }) => (
                <FormItem>
                  <FormLabel>XP Bounty</FormLabel>
                  <FormControl><Input type="number" min={5} max={500} {...field} /></FormControl>
                  <p className="text-xs text-muted-foreground">Offer XP to attract faster answers.</p>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter className="pt-2">
                <Button type="submit" disabled={createDoubt.isPending}>
                  {createDoubt.isPending ? "Posting…" : "Post Doubt"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
