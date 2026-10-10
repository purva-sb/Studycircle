import { useState, useEffect, useRef, useCallback } from "react";
import { customFetch } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { Search, Hash, X, Loader2, MessageSquare } from "lucide-react";

interface SearchResult {
  id: string;
  body: string;
  createdAt: string;
  channelId: string;
  channelName?: string;
  author: { displayName: string; avatarUrl?: string };
}

interface MessageSearchProps {
  circleId: string;
  channels: Array<{ id: string; name: string; type?: string }>;
  onJumpToMessage?: (channelId: string, messageId: string) => void;
  open: boolean;
  onClose: () => void;
}

export function MessageSearch({ circleId, channels, onJumpToMessage, open, onClose }: MessageSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setResults([]);
    }
  }, [open]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") setSelectedIdx((i) => Math.min(i + 1, results.length - 1));
      if (e.key === "ArrowUp") setSelectedIdx((i) => Math.max(i - 1, 0));
      if (e.key === "Enter" && results[selectedIdx]) {
        handleJump(results[selectedIdx]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, results, selectedIdx, onClose]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim() || q.trim().length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      // Search across all text channels
      const textChannels = channels.filter((c) => c.type !== "voice");
      const searchPromises = textChannels.map(async (ch) => {
        try {
          const res: any = await customFetch(
            `/api/channels/${ch.id}/messages/search?q=${encodeURIComponent(q)}`
          );
          return (res.messages || []).map((m: any) => ({
            ...m,
            channelId: ch.id,
            channelName: ch.name,
          }));
        } catch {
          return [];
        }
      });
      const allResults = (await Promise.all(searchPromises)).flat();
      // Sort by relevance (createdAt desc)
      allResults.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setResults(allResults.slice(0, 20));
      setSelectedIdx(0);
    } finally {
      setLoading(false);
    }
  }, [channels]);

  const handleQueryChange = (q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(q), 350);
  };

  const handleJump = (result: SearchResult) => {
    onJumpToMessage?.(result.channelId, result.id);
    onClose();
  };

  // Highlight matching text
  const highlight = (text: string, q: string) => {
    if (!q.trim()) return text;
    const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part)
        ? <mark key={i} className="bg-violet-500/30 text-violet-200 rounded px-0.5">{part}</mark>
        : part
    );
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[150] flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl mx-4 bg-[#111122] border border-white/10 rounded-2xl shadow-2xl shadow-violet-500/10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8">
          {loading ? (
            <Loader2 className="w-5 h-5 text-violet-400 animate-spin shrink-0" />
          ) : (
            <Search className="w-5 h-5 text-muted-foreground shrink-0" />
          )}
          <input
            ref={inputRef}
            type="text"
            placeholder="Search messages in this circle…"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            className="flex-1 bg-transparent border-0 outline-none text-white placeholder:text-muted-foreground text-[15px]"
          />
          {query && (
            <button onClick={() => { setQuery(""); setResults([]); }} className="text-muted-foreground hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground bg-white/5 border border-white/10 rounded px-1.5 py-0.5">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[420px] overflow-y-auto">
          {!query.trim() && (
            <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
              <Search className="w-10 h-10 opacity-20" />
              <p className="text-sm">Type to search messages across all channels</p>
              <div className="flex gap-2 text-xs opacity-50">
                <kbd className="bg-white/5 border border-white/10 rounded px-1.5 py-0.5">↑↓</kbd>
                <span>navigate</span>
                <kbd className="bg-white/5 border border-white/10 rounded px-1.5 py-0.5">Enter</kbd>
                <span>jump</span>
              </div>
            </div>
          )}

          {query.trim().length >= 2 && !loading && results.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <MessageSquare className="w-8 h-8 opacity-20" />
              <p className="text-sm">No messages found for "{query}"</p>
            </div>
          )}

          {results.map((result, idx) => {
            const isSelected = idx === selectedIdx;
            const bodyPreview = result.body?.replace(/https?:\/\/res\.cloudinary\.com\S+/g, "📷 Photo");
            return (
              <button
                key={result.id}
                className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-all border-b border-white/4 last:border-0 ${
                  isSelected ? "bg-violet-500/15" : "hover:bg-white/5"
                }`}
                onClick={() => handleJump(result)}
                onMouseEnter={() => setSelectedIdx(idx)}
              >
                {/* Author avatar */}
                <Avatar className="h-8 w-8 mt-0.5 shrink-0">
                  <AvatarImage src={result.author.avatarUrl} />
                  <AvatarFallback className="text-xs bg-violet-900/50">
                    {result.author.displayName.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-foreground">{result.author.displayName}</span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Hash className="w-3 h-3" />{result.channelName}
                    </span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {format(new Date(result.createdAt), "MMM d, HH:mm")}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {highlight(bodyPreview || "", query)}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer hint */}
        {results.length > 0 && (
          <div className="px-4 py-2 border-t border-white/8 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{results.length} result{results.length !== 1 ? "s" : ""}</span>
            <span className="text-xs text-muted-foreground">Click or ↵ to jump to message</span>
          </div>
        )}
      </div>
    </div>
  );
}
