import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { ClerkProvider, SignedIn, SignedOut, SignIn, SignUp, useAuth, useUser } from "@clerk/clerk-react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import NotFound from "@/pages/not-found";
import { setAuthTokenGetter, customFetch } from "@workspace/api-client-react";
import { useEffect } from "react";

import { AppLayout } from "@/components/layout/app-layout";
import { AdminLayout } from "@/components/layout/admin-layout";
import Dashboard from "@/pages/dashboard";
import Marketing from "@/pages/marketing";
import Timer from "@/pages/timer";
import Analytics from "@/pages/analytics";
import Leaderboard from "@/pages/leaderboard";
import DoubtsFeed from "@/pages/doubts";
import DoubtDetail from "@/pages/doubts-detail";
import Achievements from "@/pages/achievements";
import Settings from "@/pages/settings";
import DirectMessages from "@/pages/dms";
import Circles from "@/pages/circles";
import CircleWorkspace from "@/pages/circle-workspace";
import FocusRooms from "@/pages/focus-rooms";
import FocusRoomDetail from "@/pages/focus-room-detail";
import ExamsCatalog from "@/pages/exams";
import ExamDetail from "@/pages/exam-detail";
import ExamAttempt from "@/pages/exam-attempt";
import ExamResult from "@/pages/exam-result";
import ExamLeaderboard from "@/pages/exam-leaderboard";
import UserProfile from "@/pages/user-profile";
import AdminPanel from "@/pages/admin";
import AdminOverview from "@/pages/admin-overview";
import AdminSchedule from "@/pages/admin-schedule";
import AdminStudents from "@/pages/admin-students";
import AdminResults from "@/pages/admin-results";
import Resources from "@/pages/resources";
import Revision from "@/pages/revision";
import PYQBank from "@/pages/pyqs";
import MistakeNotebook from "@/pages/mistakes";
import SavedQuestions from "@/pages/saved";
import ExamCalendar from "@/pages/exam-calendar";
import FlashcardsPage from "@/pages/flashcards";
import StudyPage from "@/pages/study";
import PracticePage from "@/pages/practice";
import SchedulePage from "@/pages/schedule";
import CalendarView from "@/pages/calendar";
import InvitePage from "@/pages/invite";
import PreviewPage from "@/pages/preview";
import ExamJoinPage from "@/pages/exam-join";
import FocusRoomInvitePage from "@/pages/focus-rooms-invite";
import TimerPage from "@/pages/timer";

function AuthConfigurator({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  const { user } = useUser();
  
  useEffect(() => {
    setAuthTokenGetter(async () => {
      try {
        return await getToken();
      } catch {
        return null;
      }
    });
  }, [getToken]);

  // Sync once per Clerk user id — avoids repeated Postgres writes on profile re-renders.
  useEffect(() => {
    if (!user?.id) return;
    customFetch("/api/me/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress,
        displayName: user.fullName || user.primaryEmailAddress?.emailAddress?.split("@")[0] || "User",
        avatarUrl: user.imageUrl
      })
    }).catch(console.error);
  }, [user?.id]);

  return <>{children}</>;
}

function AdminRoutes() {
  return (
    <AdminLayout>
      <Switch>
        <Route path="/admin" component={AdminOverview} />
        <Route path="/admin/exams" component={AdminPanel} />
        <Route path="/admin/schedule" component={AdminSchedule} />
        <Route path="/admin/students" component={AdminStudents} />
        <Route path="/admin/results" component={AdminResults} />
        <Route><Redirect to="/admin" /></Route>
      </Switch>
    </AdminLayout>
  );
}

function AppRoutes() {
  const { user, isLoaded } = useUser();
  const isAdmin = isLoaded && user?.publicMetadata?.role === "admin";

  return (
    <Switch>
      <Route path="/" component={Marketing} />
      <Route path="/login"><Redirect to="/sign-in" /></Route>
      <Route path="/sign-in" component={() => (
        <div className="min-h-screen flex items-center justify-center bg-[#060612] relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-violet-900/20 via-[#060612] to-[#060612]" />
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600/20 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px]" />
          <div className="relative z-10">
            <SignIn forceRedirectUrl="https://studycircle-jn9a.onrender.com/dashboard" />
          </div>
        </div>
      )} />
      <Route path="/sign-up" component={() => (
        <div className="min-h-screen flex items-center justify-center bg-[#060612] relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-violet-900/20 via-[#060612] to-[#060612]" />
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600/20 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px]" />
          <div className="relative z-10">
            <SignUp forceRedirectUrl="https://studycircle-jn9a.onrender.com/dashboard" />
          </div>
        </div>
      )} />
      
      {/* Public pages — work before sign-in */}
      <Route path="/e/:code" component={ExamJoinPage} />
      <Route path="/invite/:code" component={InvitePage} />
      <Route path="/preview/:code" component={PreviewPage} />
      <Route path="/focus-rooms/invite/:id" component={FocusRoomInvitePage} />
      {/* Public doubt pages — indexable by Google */}
      <Route path="/doubts" component={DoubtsFeed} />
      <Route path="/doubts/:id" component={DoubtDetail} />

      {/* Protected App Routes */}
      <Route>
        <SignedIn>
          <Switch>
            {/* Admin portal — completely separate layout */}
            {isAdmin && <Route path="/admin/:rest*" component={AdminRoutes} />}
            {isAdmin && <Route path="/admin" component={AdminRoutes} />}

            {/* Immersive Workspace without Global Sidebar */}
            <Route path="/circles/:id" component={CircleWorkspace} />

            {/* Fullscreen exam routes — no sidebar, no nav */}
            <Route path="/attempts/:id/result" component={ExamResult} />
            <Route path="/attempts/:id" component={ExamAttempt} />
            <Route path="/exams/:id/leaderboard" component={ExamLeaderboard} />

            {/* Normal Dashboard Layout */}
            <Route>
              <AppLayout>
                <Switch>
                  <Route path="/dashboard" component={Dashboard} />
                  <Route path="/users/:id" component={UserProfile} />
                  <Route path="/dms" component={DirectMessages} />
                  <Route path="/timer" component={TimerPage} />
                  <Route path="/circles" component={Circles} />
                  <Route path="/focus-rooms" component={FocusRooms} />
                  <Route path="/focus-rooms/:id" component={FocusRoomDetail} />
                  <Route path="/exams" component={ExamsCatalog} />
                  <Route path="/exams/:id" component={ExamDetail} />
                  <Route path="/analytics" component={Analytics} />
                  <Route path="/leaderboard" component={Leaderboard} />
                  <Route path="/doubts" component={DoubtsFeed} />
                  <Route path="/doubts/:id" component={DoubtDetail} />
                  <Route path="/study" component={StudyPage} />
                  <Route path="/pyqs"><Redirect to="/study?tab=pyqs" /></Route>
                  <Route path="/mistakes"><Redirect to="/study?tab=mistakes" /></Route>
                  <Route path="/saved"><Redirect to="/study?tab=saved" /></Route>
                  <Route path="/flashcards"><Redirect to="/study?tab=flashcards" /></Route>
                  <Route path="/revision"><Redirect to="/study?tab=revision" /></Route>
                  <Route path="/exam-calendar" component={ExamCalendar} />
                  <Route path="/practice" component={PracticePage} />
                  <Route path="/resources" component={Resources} />
                  <Route path="/schedule" component={SchedulePage} />
                  <Route path="/calendar" component={CalendarView} />
                  <Route path="/achievements" component={Achievements} />
                  <Route path="/settings" component={Settings} />
                  <Route path="/admin" component={AdminPanel} />
                  <Route component={NotFound} />
                </Switch>
              </AppLayout>
            </Route>
          </Switch>
        </SignedIn>
        <SignedOut>
          <Redirect to="/sign-in" />
        </SignedOut>
      </Route>
    </Switch>
  );
}

function App() {
  const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

  if (!clerkPubKey) {
    throw new Error("Missing Publishable Key");
  }

  return (
    <ClerkProvider 
      publishableKey={clerkPubKey}
      appearance={{
        layout: {
          socialButtonsPlacement: "bottom",
          socialButtonsVariant: "iconButton",
        },
        variables: {
          colorPrimary: "#7c3aed",
          colorBackground: "#0b0b1a",
          colorText: "#ffffff",
          colorInputBackground: "#131326",
          colorInputText: "#ffffff",
          colorTextOnPrimaryBackground: "#ffffff",
          colorDanger: "#ef4444",
        },
        elements: {
          card: "border border-white/10 shadow-2xl shadow-violet-500/10 backdrop-blur-xl",
          headerTitle: "text-2xl font-extrabold tracking-tight",
          headerSubtitle: "text-white/60",
          formButtonPrimary: "bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 border-0 shadow-lg shadow-violet-500/25",
          socialButtonsBlockButton: "border-white/10 bg-white/5 hover:bg-white/10 text-white",
          socialButtonsBlockButtonText: "font-semibold",
          dividerLine: "bg-white/10",
          dividerText: "text-white/40",
          formFieldLabel: "text-white/80",
          formFieldInput: "border-white/10 focus:border-violet-500 focus:ring-violet-500/20",
          footerActionText: "text-white/60",
          footerActionLink: "text-violet-400 hover:text-violet-300",
        }
      }}
    >
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AuthConfigurator>
              <AppRoutes />
            </AuthConfigurator>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ClerkProvider>
  );
}

export default App;
