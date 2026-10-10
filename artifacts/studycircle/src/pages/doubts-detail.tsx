import { useState, useEffect, useRef } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useUser } from "@clerk/clerk-react";
import { customFetch } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MessageSquare, Coins, CheckCircle2, Clock, ChevronUp, AlertCircle, LogIn, ImagePlus, X, MessageCircle, Send, Trash2 } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

type Comment = {
  id: string; body: string; createdAt: string;
  authorId: string | null; authorName: string; authorAvatar: string;
};

type AnswerData = {
  id: string; body: string; imageUrls: string[];
  upvotes: number; accepted: boolean; isAccepted: boolean;
  createdAt: string;
  authorId: string | null; authorName: string; authorAvatar: string;
  mineUpvoted: boolean;
  comments: Comment[];
};

type DoubtData = {
  id: string; title: string; body: string;
  topic: string; subject: string | null; exam: string;
  imageUrls: string[];
  upvotes: number; mineUpvoted: boolean;
  canAccept: boolean;
  bountyXp: number; createdAt: string; resolved: boolean;
  askedBy: string; askedByAvatar: string; askedById: string | null;
  answers: AnswerData[];
};

export default function DoubtDetail() {
  const [, params] = useRoute("/doubts/:id");
  const id = params?.id || "";
  const { user, isLoaded } = useUser();
  const isSignedIn = isLoaded && !!user;
  const queryClient = useQueryClient();
  const [answerBody, setAnswerBody] = useState("");
  const [answerImages, setAnswerImages] = useState<string[]>([]);
  const [uploadingAnswer, setUploadingAnswer] = useState(false);
  const answerImgRef = useRef<HTMLInputElement>(null);

  // Comment composer state — keyed by answerId so each answer has its own
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});

  // Use public endpoint — no auth required, works for SEO + guests
  const { data: doubt, isLoading } = useQuery<DoubtData>({
    queryKey: ["doubt-public", id],
    queryFn: () => customFetch(`/api/doubts-public/${id}`),
    enabled: !!id,
    staleTime: 60_000,
  });

  const uploadAnswerImage = async (file: File) => {
    setUploadingAnswer(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await customFetch<{ secure_url: string }>("/api/upload", { method: "POST", body: fd });
      setAnswerImages(prev => [...prev, res.secure_url]);
    } catch {
      toast.error("Image upload failed");
    } finally {
      setUploadingAnswer(false);
    }
  };

  const questionUpvoteMutation = useMutation({
    mutationFn: () => customFetch(`/api/doubts/${id}/upvote`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["doubt-public", id] }),
    onError: () => toast.error("Sign in to upvote"),
  });

  const acceptMutation = useMutation({
    mutationFn: (answerId: string) =>
      customFetch(`/api/doubts/${id}/answers/${answerId}/accept`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Answer marked as accepted");
      queryClient.invalidateQueries({ queryKey: ["doubt-public", id] });
    },
    onError: () => toast.error("Failed to accept answer"),
  });

  const addCommentMutation = useMutation({
    mutationFn: ({ answerId, body }: { answerId: string; body: string }) =>
      customFetch(`/api/answers/${answerId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      }),
    onSuccess: (_data, { answerId }) => {
      setCommentInputs(prev => ({ ...prev, [answerId]: "" }));
      queryClient.invalidateQueries({ queryKey: ["doubt-public", id] });
    },
    onError: () => toast.error("Failed to post comment"),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) =>
      customFetch(`/api/answer-comments/${commentId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["doubt-public", id] }),
    onError: () => toast.error("Failed to delete comment"),
  });

  // Set page title + OG meta for SEO
  useEffect(() => {
    if (!doubt) return;
    const title = `${doubt.title} — StudyCircle`;
    document.title = title;
    const setMeta = (property: string, content: string) => {
      let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
      if (!el) { el = document.createElement("meta"); el.setAttribute("property", property); document.head.appendChild(el); }
      el.setAttribute("content", content);
    };
    setMeta("og:title", title);
    setMeta("og:description", doubt.body.slice(0, 200));
    setMeta("og:type", "article");
    return () => { document.title = "StudyCircle"; };
  }, [doubt]);

  const answerMutation = useMutation({
    mutationFn: (body: string) =>
      customFetch(`/api/doubts/${id}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, imageUrls: answerImages }),
      }),
    onSuccess: () => {
      toast.success("Answer posted!");
      setAnswerBody("");
      setAnswerImages([]);
      queryClient.invalidateQueries({ queryKey: ["doubt-public", id] });
    },
    onError: () => toast.error("Failed to post answer"),
  });

  const upvoteMutation = useMutation({
    mutationFn: (answerId: string) =>
      customFetch(`/api/answers/${answerId}/upvote`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["doubt-public", id] }),
  });

  if (isLoading || !doubt) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 p-6">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-4 md:p-6">
      {/* Guest banner */}
      {!isSignedIn && isLoaded && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl bg-violet-500/10 border border-violet-500/20 text-sm">
          <span className="text-muted-foreground">Join StudyCircle to answer doubts, earn XP, and take mock tests.</span>
          <Link href="/sign-in">
            <Button size="sm" className="gap-1.5 shrink-0">
              <LogIn className="w-3.5 h-3.5" /> Sign In
            </Button>
          </Link>
        </div>
      )}

      {/* Question Card */}
      <Card className="border-t-4 border-t-primary shadow-md overflow-hidden relative">
        {doubt.resolved && (
          <div className="absolute top-0 right-0 bg-emerald-500 text-white px-4 py-1 rounded-bl-lg font-medium text-sm flex items-center gap-1 shadow-sm">
            <CheckCircle2 className="w-4 h-4" /> Resolved
          </div>
        )}
        <CardHeader className="pb-4 pt-8">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 font-medium">{doubt.exam}</Badge>
            {doubt.subject && (
              <Badge variant="outline" className="bg-sky-500/10 text-sky-600 border-sky-500/20">🎓 {doubt.subject}</Badge>
            )}
            <Badge variant="outline">{doubt.topic}</Badge>
          </div>
          <CardTitle className="text-2xl md:text-3xl leading-tight">{doubt.title}</CardTitle>
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 ring-2 ring-background">
                <AvatarImage src={doubt.askedByAvatar} />
                <AvatarFallback>{doubt.askedBy.substring(0, 2)}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                {doubt.askedById ? (
                  <Link href={`/users/${doubt.askedById}`}>
                    <a className="text-sm font-semibold hover:underline">{doubt.askedBy}</a>
                  </Link>
                ) : (
                  <span className="text-sm font-semibold">{doubt.askedBy}</span>
                )}
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {format(new Date(doubt.createdAt), "MMM d, h:mm a")}
                </span>
              </div>
            </div>
            <div className="bg-amber-500/10 text-amber-600 dark:text-amber-500 px-4 py-1.5 rounded-full font-bold flex items-center gap-1.5 border border-amber-500/20">
              <Coins className="w-4 h-4" /> {doubt.bountyXp} XP Bounty
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex gap-4">
          {/* Question upvote column */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className={`h-9 w-9 rounded-full ${doubt.mineUpvoted ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary"}`}
              onClick={() => isSignedIn ? questionUpvoteMutation.mutate() : toast.error("Sign in to upvote")}
              disabled={questionUpvoteMutation.isPending}
              title="Upvote this question"
            >
              <ChevronUp className="w-7 h-7" strokeWidth={doubt.mineUpvoted ? 3 : 2} />
            </Button>
            <span className={`font-bold text-xl ${doubt.mineUpvoted ? "text-primary" : ""}`}>{doubt.upvotes}</span>
            <span className="text-[10px] text-muted-foreground -mt-1">votes</span>
          </div>

          {/* Question body + images */}
          <div className="flex-1 min-w-0 space-y-4">
            <div className="prose dark:prose-invert max-w-none text-foreground leading-relaxed whitespace-pre-wrap">{doubt.body}</div>
            {doubt.imageUrls.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {doubt.imageUrls.map((url, i) => (
                  <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden border bg-muted/30 hover:border-primary/40 transition-colors">
                    <img src={url} alt={`question ${i + 1}`} className="w-full h-40 object-cover" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Answers */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          {doubt.answers.length} {doubt.answers.length === 1 ? "Answer" : "Answers"}
        </h3>

        {doubt.answers.length === 0 ? (
          <Card className="bg-muted/30 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
              <p className="text-lg font-medium">No answers yet</p>
              <p className="text-muted-foreground mt-1">Be the first to answer and claim the {doubt.bountyXp} XP bounty!</p>
            </CardContent>
          </Card>
        ) : (
          <AnimatePresence>
            {doubt.answers.map((answer) => {
              const isAccepted = answer.accepted || answer.isAccepted;
              const commentsOpen = openComments[answer.id] ?? answer.comments.length > 0;
              const myId = user?.id;
              return (
                <motion.div key={answer.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-4 bg-card p-5 rounded-xl border shadow-sm ${isAccepted ? "ring-2 ring-emerald-500 bg-emerald-500/5" : ""}`}>
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon"
                      className={`h-8 w-8 rounded-full ${answer.mineUpvoted ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary"}`}
                      onClick={() => isSignedIn ? upvoteMutation.mutate(answer.id) : toast.error("Sign in to upvote")}
                      disabled={upvoteMutation.isPending}>
                      <ChevronUp className="w-6 h-6" strokeWidth={answer.mineUpvoted ? 3 : 2} />
                    </Button>
                    <span className={`font-bold text-lg ${answer.mineUpvoted ? "text-primary" : ""}`}>{answer.upvotes}</span>

                    {/* Accept button — only the asker sees it; renders as filled check when accepted */}
                    {doubt.canAccept && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`mt-2 h-8 w-8 rounded-full ${isAccepted ? "text-emerald-500 bg-emerald-500/10" : "text-muted-foreground hover:text-emerald-500"}`}
                        onClick={() => acceptMutation.mutate(answer.id)}
                        disabled={acceptMutation.isPending}
                        title={isAccepted ? "Unaccept this answer" : "Accept this answer as best"}
                      >
                        <CheckCircle2 className="w-6 h-6" fill={isAccepted ? "currentColor" : "none"} />
                      </Button>
                    )}
                    {isAccepted && !doubt.canAccept && (
                      <div className="mt-2 flex flex-col items-center text-emerald-500" title="Accepted Answer">
                        <CheckCircle2 className="w-6 h-6 text-emerald-500/20" fill="currentColor" />
                        <span className="text-[10px] font-bold uppercase mt-1">Accepted</span>
                      </div>
                    )}
                    {isAccepted && doubt.canAccept && (
                      <span className="text-[10px] font-bold uppercase text-emerald-500 mt-1">Accepted</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-3">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={answer.authorAvatar} />
                        <AvatarFallback>{answer.authorName.substring(0, 2)}</AvatarFallback>
                      </Avatar>
                      {answer.authorId ? (
                        <Link href={`/users/${answer.authorId}`}>
                          <a className="text-sm font-semibold hover:underline">{answer.authorName}</a>
                        </Link>
                      ) : (
                        <span className="text-sm font-semibold">{answer.authorName}</span>
                      )}
                      <span className="text-xs text-muted-foreground">· {formatDistanceToNow(new Date(answer.createdAt), { addSuffix: true })}</span>
                    </div>
                    <div className="prose dark:prose-invert max-w-none text-sm md:text-base whitespace-pre-wrap">{answer.body}</div>

                    {/* Answer images */}
                    {answer.imageUrls.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
                        {answer.imageUrls.map((url, i) => (
                          <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden border bg-muted/30 hover:border-primary/40 transition-colors">
                            <img src={url} alt={`answer ${i + 1}`} className="w-full h-32 object-cover" />
                          </a>
                        ))}
                      </div>
                    )}

                    {/* Comments toggle */}
                    <button
                      type="button"
                      onClick={() => setOpenComments(prev => ({ ...prev, [answer.id]: !commentsOpen }))}
                      className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      {answer.comments.length === 0
                        ? "Add a comment"
                        : `${answer.comments.length} ${answer.comments.length === 1 ? "comment" : "comments"}`}
                    </button>

                    {/* Comments section */}
                    {commentsOpen && (
                      <div className="mt-3 pl-3 border-l-2 border-border space-y-2">
                        {answer.comments.map(c => (
                          <div key={c.id} className="flex items-start gap-2 text-sm group">
                            <Avatar className="h-5 w-5 mt-0.5 shrink-0">
                              <AvatarImage src={c.authorAvatar} />
                              <AvatarFallback className="text-[9px]">{c.authorName.substring(0, 2)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <span className="font-semibold text-foreground/80">{c.authorName}</span>
                              <span className="text-muted-foreground/60 text-xs ml-2">{formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}</span>
                              <p className="text-foreground/90 leading-snug whitespace-pre-wrap break-words">{c.body}</p>
                            </div>
                            {myId && c.authorId === myId && (
                              <button
                                type="button"
                                onClick={() => deleteCommentMutation.mutate(c.id)}
                                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                                title="Delete comment"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                        {isSignedIn && (
                          <div className="flex items-center gap-2 pt-1">
                            <Input
                              value={commentInputs[answer.id] ?? ""}
                              onChange={e => setCommentInputs(prev => ({ ...prev, [answer.id]: e.target.value }))}
                              onKeyDown={e => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  const body = (commentInputs[answer.id] ?? "").trim();
                                  if (body) addCommentMutation.mutate({ answerId: answer.id, body });
                                }
                              }}
                              placeholder="Add a comment…"
                              className="h-8 text-sm bg-background"
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 shrink-0"
                              disabled={addCommentMutation.isPending || !(commentInputs[answer.id] ?? "").trim()}
                              onClick={() => {
                                const body = (commentInputs[answer.id] ?? "").trim();
                                if (body) addCommentMutation.mutate({ answerId: answer.id, body });
                              }}
                            >
                              <Send className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      <Separator />

      {/* Answer composer — only for signed-in users */}
      {isSignedIn && !doubt.resolved && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Your Answer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea placeholder="Write a detailed explanation to help solve this doubt..."
              className="min-h-[150px] bg-background"
              value={answerBody} onChange={e => setAnswerBody(e.target.value)} />

            {/* Image upload — thumbnails of attached images + Add button */}
            {answerImages.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {answerImages.map((url, i) => (
                  <div key={url} className="relative aspect-square rounded-lg overflow-hidden border">
                    <img src={url} alt={`upload ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setAnswerImages(prev => prev.filter(u => u !== url))}
                      className="absolute top-1 right-1 w-5 h-5 bg-destructive rounded-full flex items-center justify-center"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {answerImages.length < 8 && (
              <button
                type="button"
                onClick={() => answerImgRef.current?.click()}
                disabled={uploadingAnswer}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed text-sm text-muted-foreground hover:border-foreground/40 hover:text-foreground transition-colors"
              >
                <ImagePlus className="w-4 h-4" />
                {uploadingAnswer ? "Uploading…" : "Add image"}
              </button>
            )}
            <input
              ref={answerImgRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadAnswerImage(f); e.target.value = ""; }}
            />
          </CardContent>
          <CardFooter className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Up to 8 images · Markdown supported</span>
            <Button onClick={() => answerMutation.mutate(answerBody)}
              disabled={answerMutation.isPending || answerBody.length < 5} className="px-8">
              {answerMutation.isPending ? "Posting…" : "Post Answer"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {!isSignedIn && isLoaded && !doubt.resolved && (
        <div className="text-center py-6 space-y-3">
          <p className="text-muted-foreground text-sm">Sign in to post an answer and earn {doubt.bountyXp} XP</p>
          <Link href="/sign-in">
            <Button className="gap-2"><LogIn className="w-4 h-4" /> Sign In to Answer</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
