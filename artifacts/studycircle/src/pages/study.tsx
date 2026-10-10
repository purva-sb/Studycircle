import { useSearch, useLocation } from "wouter";
import { BrainCircuit, Bookmark, BookMarked, Library, BookOpen } from "lucide-react";
import FlashcardsPage from "@/pages/flashcards";
import Revision from "@/pages/revision";
import SavedQuestions from "@/pages/saved";
import MistakeNotebook from "@/pages/mistakes";
import PYQBank from "@/pages/pyqs";

// Order optimized for exam-prep: highest-value tools first.
// PYQ Bank is the single most important study tool — promote it from last to first.
const TABS = [
  { id: "pyqs",       label: "PYQ Bank",   icon: Library,      component: PYQBank        },
  { id: "mistakes",   label: "Mistakes",   icon: BookMarked,   component: MistakeNotebook },
  { id: "saved",      label: "Saved",      icon: Bookmark,     component: SavedQuestions },
  { id: "flashcards", label: "Flashcards", icon: BrainCircuit, component: FlashcardsPage },
  { id: "revision",   label: "Revision",   icon: BookOpen,     component: Revision       },
] as const;

type TabId = typeof TABS[number]["id"];

export default function StudyPage() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const params = new URLSearchParams(search);
  const active = (params.get("tab") ?? "pyqs") as TabId;
  const valid = TABS.some(t => t.id === active);
  const activeTab = valid ? active : "pyqs";

  const setTab = (id: TabId) => navigate(`/study?tab=${id}`);

  const ActiveComponent = TABS.find(t => t.id === activeTab)!.component;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── Tab bar ── */}
      <div className="shrink-0 border-b border-white/10 bg-background px-4 pt-4">
        <div className="flex gap-1 overflow-x-auto pb-0 scrollbar-hide">
          {TABS.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors border-b-2 -mb-px ${
                  isActive
                    ? "border-primary text-primary bg-primary/5"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-white/20"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <ActiveComponent />
      </div>
    </div>
  );
}
