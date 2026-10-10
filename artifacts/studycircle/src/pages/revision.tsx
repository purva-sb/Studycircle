import { useState } from "react";
import { useListRevisionItems, useCreateRevisionItem, useReviewRevisionItem, getListRevisionItemsQueryKey, customFetch } from "@workspace/api-client-react";
import { slowDataQueryOptions } from "@/lib/query-client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Brain, Plus, RefreshCw, CheckCircle2, History, RotateCcw, Zap, Target, BookOpen, ChevronLeft, Flame, Trophy, Download, TrendingUp, Calendar } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export default function Revision() {
  const queryClient = useQueryClient();
  const { data: items, isLoading } = useListRevisionItems({ 
    query: { ...slowDataQueryOptions, queryKey: getListRevisionItemsQueryKey() } 
  });
  const createItem = useCreateRevisionItem();
  const reviewItem = useReviewRevisionItem();

  // Form state
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("");
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [open, setOpen] = useState(false);

  // Study session state
  const [isStudying, setIsStudying] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const dueItems = items?.filter(i => i.dueLabel === 'Due Today' || i.dueLabel === 'Overdue') || [];
  const upcomingItems = items?.filter(i => !dueItems.includes(i)) || [];

  // Fetch gamification UI data
  const { data: stats } = useQuery({
    queryKey: ["revision-stats"],
    queryFn: () => customFetch<any>("/api/revision/stats")
  });
  
  const { data: communityDecks } = useQuery({
    queryKey: ["revision-community-decks"],
    queryFn: () => customFetch<any[]>("/api/revision/community-decks")
  });
  
  const { data: leaderboard } = useQuery({
    queryKey: ["revision-leaderboard"],
    queryFn: () => customFetch<any[]>("/api/revision/leaderboard")
  });

  const heatmapData = stats?.heatmap || [];
  const currentStreak = stats?.currentStreak || 0;
  const overallRetention = stats?.overallRetention || 0;
  const decksData = communityDecks || [];
  const leaderboardData = leaderboard || [];

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic || !subject || !front || !back) return;
    createItem.mutate({ data: { topic, subject, front, back } }, {
      onSuccess: () => {
        toast.success("Flashcard added!");
        setOpen(false);
        setTopic("");
        setSubject("");
        setFront("");
        setBack("");
        queryClient.invalidateQueries({ queryKey: getListRevisionItemsQueryKey() });
      }
    });
  };

  const handleStartSession = () => {
    if (dueItems.length === 0) {
      toast.info("No cards due for review!");
      return;
    }
    setIsStudying(true);
    setCurrentCardIndex(0);
    setIsFlipped(false);
  };

  const handleReview = (id: string, quality: "again" | "hard" | "good" | "easy") => {
    reviewItem.mutate({ id, data: { quality } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListRevisionItemsQueryKey() });
        
        // Move to next card or finish
        if (currentCardIndex < dueItems.length - 1) {
          setIsFlipped(false);
          setCurrentCardIndex(prev => prev + 1);
        } else {
          setIsStudying(false);
          toast.success("Session complete! Great job 🎉");
        }
      }
    });
  };

  if (isLoading || !items) {
    return <div className="max-w-4xl mx-auto space-y-6"><Skeleton className="h-64 rounded-xl" /></div>;
  }

  // === STUDY MODE ===
  if (isStudying && dueItems.length > 0 && currentCardIndex < dueItems.length) {
    const currentCard = dueItems[currentCardIndex];
    const progressPct = ((currentCardIndex) / dueItems.length) * 100;

    return (
      <div className="max-w-3xl mx-auto h-[calc(100vh-8rem)] flex flex-col pt-4 pb-8 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Button variant="ghost" size="sm" onClick={() => setIsStudying(false)} className="gap-2 text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-4 h-4" /> End Session
          </Button>
          <div className="flex flex-col items-end gap-1">
            <span className="text-sm font-bold text-primary">Card {currentCardIndex + 1} of {dueItems.length}</span>
            <Progress value={progressPct} className="h-1.5 w-32" />
          </div>
        </div>

        {/* Flashcard Area */}
        <div className="flex-1 flex flex-col items-center justify-center relative perspective-[1000px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentCard.id}
              initial={{ opacity: 0, x: 50, rotateY: -15 }}
              animate={{ opacity: 1, x: 0, rotateY: 0 }}
              exit={{ opacity: 0, x: -50, rotateY: 15 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              className="w-full max-w-xl aspect-[4/3] relative cursor-pointer"
              onClick={() => setIsFlipped(!isFlipped)}
            >
              <motion.div
                className="w-full h-full absolute inset-0 preserve-3d"
                initial={false}
                animate={{ rotateX: isFlipped ? 180 : 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
              >
                {/* FRONT */}
                <Card className="absolute inset-0 backface-hidden bg-card border-2 shadow-xl hover:border-primary/50 transition-colors flex flex-col p-8">
                  <div className="flex justify-between items-center mb-auto">
                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">{currentCard.subject}</Badge>
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{currentCard.topic}</span>
                  </div>
                  
                  <div className="flex-1 flex items-center justify-center text-center">
                    <h3 className="text-2xl sm:text-3xl font-bold leading-tight tracking-tight">
                      {currentCard.front || currentCard.topic}
                    </h3>
                  </div>

                  <div className="mt-auto flex justify-center items-center text-sm text-muted-foreground gap-2 pt-4 border-t">
                    <RotateCcw className="w-4 h-4" /> Tap to reveal answer
                  </div>
                </Card>

                {/* BACK */}
                <Card className="absolute inset-0 backface-hidden bg-muted/30 border-2 border-primary/30 shadow-2xl flex flex-col p-8"
                  style={{ transform: "rotateX(180deg)" }}>
                  <div className="flex justify-between items-center mb-6">
                    <Badge variant="default" className="bg-primary">Answer</Badge>
                  </div>
                  
                  <div className="flex-1 flex items-center justify-center text-center overflow-y-auto">
                    <div className="text-xl sm:text-2xl font-medium leading-relaxed">
                      {currentCard.back || "No answer provided. (Mock data fallback)"}
                    </div>
                  </div>
                </Card>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Rating Controls */}
        <div className="mt-12 h-24 flex items-center justify-center">
          <AnimatePresence>
            {isFlipped ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="w-full max-w-xl grid grid-cols-4 gap-3"
              >
                <Button variant="outline" className="h-16 flex flex-col gap-1 border-red-200 hover:bg-red-50 hover:text-red-600 hover:border-red-300" onClick={() => handleReview(currentCard.id, "again")}>
                  <RotateCcw className="w-5 h-5 text-red-500" />
                  <span className="text-xs font-bold">Again</span>
                </Button>
                <Button variant="outline" className="h-16 flex flex-col gap-1 border-orange-200 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-300" onClick={() => handleReview(currentCard.id, "hard")}>
                  <Target className="w-5 h-5 text-orange-500" />
                  <span className="text-xs font-bold">Hard</span>
                </Button>
                <Button variant="outline" className="h-16 flex flex-col gap-1 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-300" onClick={() => handleReview(currentCard.id, "good")}>
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <span className="text-xs font-bold">Good</span>
                </Button>
                <Button variant="outline" className="h-16 flex flex-col gap-1 border-blue-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300" onClick={() => handleReview(currentCard.id, "easy")}>
                  <Zap className="w-5 h-5 text-blue-500" />
                  <span className="text-xs font-bold">Easy</span>
                </Button>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-muted-foreground text-sm flex items-center gap-2"
              >
                <Brain className="w-4 h-4" /> Think of the answer before revealing
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // === DASHBOARD MODE ===
  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-6 md:p-8 rounded-2xl border shadow-sm relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg text-primary"><Brain className="w-6 h-6" /></div>
            <h2 className="text-3xl font-extrabold tracking-tight">Flashcards</h2>
          </div>
          <p className="text-muted-foreground text-sm max-w-xl">Master any topic with Gamified Spaced Repetition. Our algorithm schedules reviews exactly when you're about to forget them.</p>
        </div>
        
        <div className="flex gap-3 relative z-10 w-full md:w-auto">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex-1 md:flex-none gap-2 hover-elevate bg-background">
                <Plus className="h-4 w-4" /> Create Card
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader><DialogTitle>Create Flashcard</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><label className="text-sm font-medium">Subject</label><Input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="e.g. Operating Systems" required /></div>
                  <div className="space-y-2"><label className="text-sm font-medium">Topic / Chapter</label><Input value={topic} onChange={e=>setTopic(e.target.value)} placeholder="e.g. Process Scheduling" required /></div>
                </div>
                <div className="space-y-2"><label className="text-sm font-medium">Front (Question)</label><Textarea value={front} onChange={e=>setFront(e.target.value)} placeholder="What is the Convoy Effect?" className="resize-none" required /></div>
                <div className="space-y-2"><label className="text-sm font-medium">Back (Answer)</label><Textarea value={back} onChange={e=>setBack(e.target.value)} placeholder="When short processes get stuck waiting for a long process..." className="h-24 resize-none" required /></div>
                <DialogFooter className="pt-4"><Button type="submit" disabled={createItem.isPending} className="w-full">Save Flashcard</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Button 
            onClick={handleStartSession}
            disabled={dueItems.length === 0}
            className={`flex-1 md:flex-none gap-2 hover-elevate shadow-lg ${dueItems.length > 0 ? "bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90" : ""}`}
          >
            <Zap className="h-4 w-4" /> Start Session ({dueItems.length})
          </Button>
        </div>
      </div>

      {/* Activity Heatmap & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 bg-card border shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold flex items-center gap-2 text-foreground/80"><Calendar className="w-5 h-5 text-muted-foreground" /> Study Activity</h3>
              <div className="flex items-center gap-2 text-sm">
                <span className="flex items-center gap-1 font-bold text-orange-500 bg-orange-500/10 px-2 py-1 rounded-md"><Flame className="w-4 h-4" /> {currentStreak}-Day Streak</span>
              </div>
            </div>
            <div className="flex gap-1.5 h-16 items-end justify-between px-2">
              {heatmapData.map((count: number, i: number) => (
                <div key={i} className="flex flex-col items-center gap-1 flex-1">
                  <div 
                    className={`w-full rounded-sm transition-all duration-300 hover:scale-110 ${
                      count === 0 ? 'bg-muted h-3 opacity-50' : 
                      count < 3 ? 'bg-emerald-500/40 h-6' : 
                      count < 5 ? 'bg-emerald-500/70 h-10' : 'bg-emerald-500 h-16'
                    }`} 
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-3 font-medium px-2">
              <span>2 weeks ago</span>
              <span>Today</span>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card border shadow-sm flex flex-col justify-center">
          <CardContent className="p-6 text-center space-y-2">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-2">
              <Brain className="w-6 h-6" />
            </div>
            <h3 className="text-4xl font-black">{overallRetention}%</h3>
            <p className="text-sm text-muted-foreground font-medium">Overall Retention</p>
            <Progress value={overallRetention} className="h-2 mt-4 mx-auto w-4/5" />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Due items & Stats */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <RefreshCw className={`w-5 h-5 ${dueItems.length > 0 ? 'text-destructive' : 'text-emerald-500'}`} /> 
              {dueItems.length > 0 ? 'Due for Review' : 'All Caught Up!'}
            </h3>
            {dueItems.length > 0 && (
              <Badge variant="destructive" className="bg-destructive/15 text-destructive border-none">{dueItems.length} Cards</Badge>
            )}
          </div>

          {dueItems.length > 0 ? (
            <div className="grid gap-4">
              {dueItems.map(item => (
                <Card key={item.id} className="border-l-4 border-l-destructive hover:border-l-destructive/80 transition-colors bg-card hover:bg-muted/20">
                  <CardContent className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-3 mb-2">
                        <Badge variant="outline" className="text-xs shrink-0 mt-0.5 bg-background">{item.subject}</Badge>
                        <h4 className="font-bold text-base leading-snug break-words">{item.front || item.topic}</h4>
                      </div>
                      <div className="w-full max-w-xs space-y-1.5 mt-3">
                        <div className="flex justify-between text-xs text-muted-foreground font-medium"><span>Memory Retention</span><span>{item.masteryPct}%</span></div>
                        <Progress value={item.masteryPct} className="h-1.5 bg-muted" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-dashed border-2 bg-transparent shadow-none">
              <CardContent className="p-12 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
                <h3 className="text-xl font-bold mb-2">Zero cards due</h3>
                <p className="text-muted-foreground max-w-md">You've completed all your reviews for today. Take a break, or add some new flashcards to study!</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Upcoming & Mastery */}
        <div className="space-y-6">
          <h3 className="text-xl font-bold flex items-center gap-2 text-foreground/80">
            <History className="w-5 h-5" /> Upcoming
          </h3>
          
          <div className="space-y-3">
            {upcomingItems.length > 0 ? (
              upcomingItems.slice(0, 8).map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors shadow-sm">
                  <div className="min-w-0 flex-1 pr-4">
                    <p className="text-sm font-semibold truncate">{item.front || item.topic}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.subject}</p>
                  </div>
                  <div className="shrink-0 flex flex-col items-end">
                    <span className="text-xs font-bold text-primary">{item.dueLabel}</span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Lvl {item.intervalDays}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No upcoming reviews.</p>
            )}
            
            {upcomingItems.length > 8 && (
              <Button variant="ghost" className="w-full text-xs text-muted-foreground">View all {upcomingItems.length} upcoming</Button>
            )}
          </div>

          {/* Trending Community Decks */}
          <div className="pt-4 space-y-4">
            <h3 className="text-xl font-bold flex items-center gap-2 text-foreground/80">
              <TrendingUp className="w-5 h-5 text-blue-500" /> Trending in Circle
            </h3>
            <div className="space-y-3">
              {decksData.map((deck: any) => (
                <div key={deck.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors shadow-sm">
                  <div className="min-w-0 flex-1 pr-3">
                    <p className="text-sm font-semibold truncate">{deck.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{deck.author} • {deck.saves} saves</p>
                  </div>
                  <Button size="icon" variant="ghost" className="shrink-0 h-8 w-8 hover:bg-background border shadow-sm">
                    <Download className="w-4 h-4 text-primary" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Mini Leaderboard */}
          <div className="pt-4 space-y-4">
            <h3 className="text-xl font-bold flex items-center gap-2 text-foreground/80">
              <Trophy className="w-5 h-5 text-amber-500" /> Today's Top Reviewers
            </h3>
            <Card className="shadow-sm">
              <CardContent className="p-0 divide-y">
                {leaderboardData.map((user: any, idx: number) => (
                  <div key={user.id} className={`flex items-center p-3 gap-3 hover:bg-muted/30 transition-colors ${user.name === 'You' ? 'bg-primary/5' : ''}`}>
                    <div className={`w-6 text-center font-bold text-sm ${idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-slate-400' : 'text-amber-700'}`}>
                      #{idx + 1}
                    </div>
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                      {user.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${user.name === 'You' ? 'text-primary' : ''}`}>{user.name}</p>
                    </div>
                    <div className="text-sm font-bold text-muted-foreground shrink-0">
                      {user.cards} <span className="text-[10px] font-normal text-muted-foreground/70">cards</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
