import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BrainCircuit, Plus, Trash2, ChevronLeft, RotateCcw,
  Sparkles, Crown, Lock, CheckCircle2, Layers, BookOpen
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

type Deck = {
  id: string; name: string; subject?: string | null; color: string;
  createdAt: string; cardCount: number; dueCount: number;
};
type Flashcard = {
  id: string; deckId: string; front: string; back: string;
  easeFactor: number; interval: number; repetitions: number;
  dueDate: string; lastReviewedAt?: string | null;
};

const RATINGS = [
  { label: "Again", value: 0, color: "bg-rose-600 hover:bg-rose-500 text-white",   desc: "< 1 day" },
  { label: "Hard",  value: 1, color: "bg-orange-600 hover:bg-orange-500 text-white", desc: "1 day" },
  { label: "Good",  value: 2, color: "bg-emerald-600 hover:bg-emerald-500 text-white", desc: "few days" },
  { label: "Easy",  value: 3, color: "bg-blue-600 hover:bg-blue-500 text-white",    desc: "1 week+" },
];

// ─── Review Mode ─────────────────────────────────────────────────────────────

function ReviewMode({
  deckId, onExit
}: { deckId: string | null; onExit: () => void }) {
  const qc = useQueryClient();
  const [index, setIndex]   = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone]     = useState(false);
  const [reviewed, setReviewed] = useState(0);

  const { data: cards, isLoading } = useQuery<Flashcard[]>({
    queryKey: ["flashcards-due", deckId],
    queryFn:  () => customFetch(`/api/flashcards/due${deckId ? `?deckId=${deckId}` : ""}`),
    staleTime: 0,
  });

  const reviewMutation = useMutation({
    mutationFn: ({ cardId, rating }: { cardId: string; rating: number }) =>
      customFetch(`/api/flashcards/${cardId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flashcard-decks"] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96 gap-4">
        <Skeleton className="h-64 w-full max-w-lg rounded-2xl" />
        <Skeleton className="h-12 w-80 rounded-xl" />
      </div>
    );
  }

  if (!cards || cards.length === 0 || done) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96 gap-5 text-center px-4">
        <div className="w-20 h-20 rounded-full bg-emerald-500/15 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-2xl font-bold">
            {cards?.length === 0 ? "All caught up!" : `Session complete! 🎉`}
          </h3>
          <p className="text-muted-foreground mt-1">
            {cards?.length === 0
              ? "No cards are due for review right now. Come back later."
              : `You reviewed ${reviewed} card${reviewed !== 1 ? "s" : ""} in this session.`}
          </p>
        </div>
        <Button onClick={onExit} variant="outline" className="gap-2">
          <ChevronLeft className="w-4 h-4" /> Back to Decks
        </Button>
      </div>
    );
  }

  const card = cards[index];
  const progress = index / cards.length;

  const handleRating = async (rating: number) => {
    await reviewMutation.mutateAsync({ cardId: card.id, rating });
    setReviewed(r => r + 1);
    setFlipped(false);
    if (index + 1 >= cards.length) {
      setDone(true);
    } else {
      setIndex(i => i + 1);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Top bar */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onExit} className="gap-1 text-muted-foreground">
          <ChevronLeft className="w-4 h-4" /> Decks
        </Button>
        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <span className="text-sm text-muted-foreground shrink-0">{index + 1} / {cards.length}</span>
      </div>

      {/* Flashcard */}
      <div
        className="cursor-pointer select-none"
        style={{ perspective: "1200px" }}
        onClick={() => !flipped && setFlipped(true)}
      >
        <motion.div
          className="relative"
          style={{ transformStyle: "preserve-3d" }}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
        >
          {/* Front */}
          <div
            className="min-h-64 rounded-2xl border border-border bg-card shadow-xl flex flex-col items-center justify-center p-8 text-center"
            style={{ backfaceVisibility: "hidden" }}
          >
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-4 font-semibold">Question</span>
            <p className="text-lg font-medium text-foreground leading-relaxed">{card.front}</p>
            {!flipped && (
              <p className="text-xs text-muted-foreground/50 mt-6 flex items-center gap-1">
                <RotateCcw className="w-3 h-3" /> Tap to reveal answer
              </p>
            )}
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 min-h-64 rounded-2xl border border-primary/40 bg-card shadow-xl flex flex-col items-center justify-center p-8 text-center"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            <span className="text-[10px] uppercase tracking-widest text-primary/60 mb-4 font-semibold">Answer</span>
            <p className="text-lg font-medium text-foreground leading-relaxed">{card.back}</p>
          </div>
        </motion.div>
      </div>

      {/* Rating buttons */}
      <AnimatePresence>
        {flipped && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            <p className="text-center text-xs text-muted-foreground">How well did you know this?</p>
            <div className="grid grid-cols-4 gap-2">
              {RATINGS.map(r => (
                <button
                  key={r.value}
                  onClick={() => handleRating(r.value)}
                  disabled={reviewMutation.isPending}
                  className={cn(
                    "rounded-xl py-3 text-sm font-bold transition-all active:scale-95",
                    r.color
                  )}
                >
                  <div>{r.label}</div>
                  <div className="text-[10px] opacity-70 font-normal mt-0.5">{r.desc}</div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!flipped && (
        <Button onClick={() => setFlipped(true)} className="w-full" size="lg">
          Show Answer
        </Button>
      )}
    </div>
  );
}

// ─── Deck Editor ─────────────────────────────────────────────────────────────

function DeckEditor({ deck, onBack }: { deck: Deck; onBack: () => void }) {
  const qc = useQueryClient();
  const [front, setFront] = useState("");
  const [back, setBack]   = useState("");
  const [error, setError] = useState("");

  const { data: cards, isLoading } = useQuery<Flashcard[]>({
    queryKey: ["deck-cards", deck.id],
    queryFn:  () => customFetch(`/api/flashcard-decks/${deck.id}/cards`),
    staleTime: 30_000,
  });

  const addCard = async () => {
    if (!front.trim() || !back.trim()) { setError("Both front and back are required."); return; }
    setError("");
    try {
      await customFetch(`/api/flashcard-decks/${deck.id}/cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ front: front.trim(), back: back.trim() }),
      });
      setFront(""); setBack("");
      qc.invalidateQueries({ queryKey: ["deck-cards", deck.id] });
      qc.invalidateQueries({ queryKey: ["flashcard-decks"] });
    } catch (e: any) {
      setError(e?.message ?? "Failed to add card");
    }
  };

  const deleteCard = async (id: string) => {
    await customFetch(`/api/flashcards/${id}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["deck-cards", deck.id] });
    qc.invalidateQueries({ queryKey: ["flashcard-decks"] });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h3 className="font-bold text-lg">{deck.name}</h3>
          <p className="text-xs text-muted-foreground">{deck.cardCount} cards · {deck.dueCount} due</p>
        </div>
      </div>

      {/* Add card form */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-semibold text-primary flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Add a card
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Front (question / term)</label>
              <textarea
                value={front} onChange={e => setFront(e.target.value)}
                placeholder="What is the time complexity of binary search?"
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Back (answer / definition)</label>
              <textarea
                value={back} onChange={e => setBack(e.target.value)}
                placeholder="O(log n)"
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          {error && <p className="text-xs text-rose-500">{error}</p>}
          <Button size="sm" onClick={addCard} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Card
          </Button>
        </CardContent>
      </Card>

      {/* Card list */}
      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : !cards || cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Layers className="w-8 h-8 opacity-40 mb-2" />
          <p className="text-sm">No cards yet — add your first one above.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {cards.map(card => {
            const due = new Date(card.dueDate) <= new Date();
            return (
              <div key={card.id} className="flex items-start gap-4 p-4 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors group">
                <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <p className="text-sm font-medium truncate">{card.front}</p>
                  <p className="text-sm text-muted-foreground truncate">{card.back}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {due && <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-400/30 bg-amber-400/10">Due</Badge>}
                  <span className="text-[10px] text-muted-foreground/60">{card.interval}d</span>
                  <button
                    onClick={() => deleteCard(card.id)}
                    className="p-1 rounded hover:bg-rose-500/10 text-muted-foreground/50 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type View = { mode: "decks" } | { mode: "review"; deckId: string | null } | { mode: "edit"; deck: Deck };

const DECK_COLORS = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#8b5cf6", "#ef4444", "#f97316"];

export default function FlashcardsPage() {
  const qc = useQueryClient();
  const [view, setView] = useState<View>({ mode: "decks" });
  const [newName, setNewName]     = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newColor, setNewColor]   = useState(DECK_COLORS[0]);
  const [showCreate, setShowCreate] = useState(false);
  const [createError, setCreateError] = useState("");

  const { data: decks, isLoading } = useQuery<Deck[]>({
    queryKey: ["flashcard-decks"],
    queryFn:  () => customFetch("/api/flashcard-decks"),
    staleTime: 30_000,
  });

  const totalDue = decks?.reduce((s, d) => s + d.dueCount, 0) ?? 0;

  const createDeck = async () => {
    if (!newName.trim()) { setCreateError("Deck name is required."); return; }
    setCreateError("");
    try {
      await customFetch("/api/flashcard-decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), subject: newSubject.trim() || undefined, color: newColor }),
      });
      setNewName(""); setNewSubject(""); setNewColor(DECK_COLORS[0]);
      setShowCreate(false);
      qc.invalidateQueries({ queryKey: ["flashcard-decks"] });
    } catch (e: any) {
      setCreateError(e?.message ?? "Failed to create deck");
    }
  };

  const deleteDeck = async (id: string) => {
    await customFetch(`/api/flashcard-decks/${id}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["flashcard-decks"] });
  };

  if (view.mode === "review") {
    return (
      <div className="max-w-lg mx-auto pt-4">
        <ReviewMode deckId={view.deckId} onExit={() => setView({ mode: "decks" })} />
      </div>
    );
  }

  if (view.mode === "edit") {
    return (
      <div className="pt-4">
        <DeckEditor deck={view.deck} onBack={() => setView({ mode: "decks" })} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BrainCircuit className="w-6 h-6 text-primary" /> Flashcards
          </h2>
          <p className="text-muted-foreground text-sm mt-0.5">Spaced repetition for long-term retention</p>
        </div>
        <div className="flex items-center gap-2">
          {totalDue > 0 && (
            <Button
              onClick={() => setView({ mode: "review", deckId: null })}
              className="gap-2 bg-amber-500 hover:bg-amber-400 text-white border-0"
            >
              <Sparkles className="w-4 h-4" /> Review all ({totalDue} due)
            </Button>
          )}
          <Button variant="outline" onClick={() => setShowCreate(v => !v)} className="gap-1.5">
            <Plus className="w-4 h-4" /> New Deck
          </Button>
        </div>
      </div>

      {/* Free tier notice */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-muted/50 border border-border text-sm">
        <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="text-muted-foreground">Free plan: 1 deck · 50 cards.  </span>
        <Link href="/settings" className="text-primary font-semibold hover:underline ml-auto shrink-0 flex items-center gap-1">
          <Crown className="w-3.5 h-3.5" /> Upgrade to Pro
        </Link>
      </div>

      {/* Create deck form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4 space-y-3">
                <p className="text-sm font-semibold text-primary">Create new deck</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Deck name *</label>
                    <input value={newName} onChange={e => setNewName(e.target.value)}
                      placeholder="e.g. GATE Algorithms"
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Subject (optional)</label>
                    <input value={newSubject} onChange={e => setNewSubject(e.target.value)}
                      placeholder="e.g. Data Structures"
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-2 block">Color</label>
                  <div className="flex gap-2">
                    {DECK_COLORS.map(c => (
                      <button key={c} onClick={() => setNewColor(c)}
                        className={cn("w-7 h-7 rounded-full border-2 transition-all", newColor === c ? "border-foreground scale-110" : "border-transparent")}
                        style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
                {createError && <p className="text-xs text-rose-500">{createError}</p>}
                <div className="flex gap-2">
                  <Button size="sm" onClick={createDeck} className="gap-1">
                    <Plus className="w-3.5 h-3.5" /> Create
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setShowCreate(false); setCreateError(""); }}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Decks grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-44 rounded-2xl" />)}
        </div>
      ) : !decks || decks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <BookOpen className="w-8 h-8 text-muted-foreground/50" />
          </div>
          <p className="font-semibold text-muted-foreground">No decks yet</p>
          <p className="text-sm text-muted-foreground/70 mt-1 max-w-xs">
            Create your first deck and start adding cards. Review them daily using the SM-2 spaced repetition algorithm.
          </p>
          <Button variant="outline" onClick={() => setShowCreate(true)} className="gap-1.5 mt-4">
            <Plus className="w-4 h-4" /> Create first deck
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {decks.map(deck => (
            <motion.div key={deck.id} whileHover={{ y: -2 }} transition={{ duration: 0.15 }}>
              <Card className="border border-border hover:border-primary/30 transition-colors overflow-hidden group cursor-pointer"
                onClick={() => setView({ mode: "edit", deck })}>
                {/* Color bar */}
                <div className="h-1.5 w-full" style={{ backgroundColor: deck.color }} />
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <h3 className="font-bold text-base truncate">{deck.name}</h3>
                      {deck.subject && <p className="text-xs text-muted-foreground mt-0.5">{deck.subject}</p>}
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); deleteDeck(deck.id); }}
                      className="p-1.5 rounded-lg text-muted-foreground/30 hover:text-rose-500 hover:bg-rose-500/10 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-4 text-sm mb-4">
                    <div className="text-center">
                      <div className="text-xl font-extrabold">{deck.cardCount}</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">cards</div>
                    </div>
                    <div className="text-center">
                      <div className={cn("text-xl font-extrabold", deck.dueCount > 0 ? "text-amber-400" : "text-emerald-400")}>
                        {deck.dueCount}
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">due</div>
                    </div>
                  </div>

                  <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                    {deck.dueCount > 0 ? (
                      <Button
                        size="sm" className="flex-1 gap-1 bg-amber-500 hover:bg-amber-400 text-white border-0"
                        onClick={() => setView({ mode: "review", deckId: deck.id })}
                      >
                        <Sparkles className="w-3.5 h-3.5" /> Review ({deck.dueCount})
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="flex-1 gap-1 text-emerald-500 border-emerald-500/30"
                        disabled>
                        <CheckCircle2 className="w-3.5 h-3.5" /> All caught up
                      </Button>
                    )}
                    <Button size="sm" variant="outline"
                      onClick={() => setView({ mode: "edit", deck })}>
                      Edit
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
