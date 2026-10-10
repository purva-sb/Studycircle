import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, FileText, Calendar, Users,
  BarChart2, Settings, GraduationCap, LogOut,
} from "lucide-react";
import { useClerk, useUser } from "@clerk/clerk-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin",          icon: LayoutDashboard, label: "Overview"  },
  { href: "/admin/exams",    icon: FileText,         label: "Exams"     },
  { href: "/admin/schedule", icon: Calendar,         label: "Schedule"  },
  { href: "/admin/students", icon: Users,            label: "Students"  },
  { href: "/admin/results",  icon: BarChart2,        label: "Results"   },
  { href: "/admin/settings", icon: Settings,         label: "Settings"  },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();

  return (
    <div className="min-h-dvh flex bg-background">

      {/* ── Sidebar ── */}
      <aside className="w-60 shrink-0 border-r border-border bg-background flex flex-col h-screen sticky top-0">

        {/* Logo */}
        <div className="h-14 px-4 border-b border-border flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-violet-600 flex items-center justify-center shrink-0">
            <GraduationCap className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight">StudyCircle</p>
            <p className="text-[10px] text-violet-400 font-semibold uppercase tracking-widest">Admin</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-0.5">
          {NAV.map(item => {
            const isActive = item.href === "/admin"
              ? location === "/admin"
              : location.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href}>
                <a className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-violet-600/15 text-violet-400"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}>
                  <item.icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </a>
              </Link>
            );
          })}
        </nav>

        {/* Profile + signout */}
        <div className="p-3 border-t border-border space-y-1">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={user?.imageUrl} />
              <AvatarFallback className="text-xs bg-violet-600/20 text-violet-400">
                {user?.fullName?.substring(0, 2).toUpperCase() ?? "AD"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold truncate">{user?.fullName ?? "Admin"}</p>
              <p className="text-[10px] text-muted-foreground truncate">
                {user?.primaryEmailAddress?.emailAddress}
              </p>
            </div>
          </div>
          <button
            onClick={() => signOut({ redirectUrl: "/" })}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 min-w-0 overflow-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
