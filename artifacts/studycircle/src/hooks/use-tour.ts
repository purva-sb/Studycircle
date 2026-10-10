import { useCallback, useEffect, useState } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

const TOUR_KEY = "sc_tour_v1_done";

const STEPS = [
  {
    element: "#tour-brand",
    popover: {
      title: "Welcome to StudyCircle 🎓",
      description: "Your all-in-one platform for exam prep — mock tests, study tools, doubt Q&A, and a community of serious learners.",
      side: "right" as const,
      align: "start" as const,
    },
  },
  {
    element: "#tour-dashboard",
    popover: {
      title: "Dashboard",
      description: "Your home base. Today's goals, XP earned, streak, and upcoming exams — all at a glance.",
      side: "right" as const,
      align: "center" as const,
    },
  },
  {
    element: "#tour-exams",
    popover: {
      title: "Mock Exams",
      description: "Full-length tests with per-question timing, real-time leaderboards, and detailed topic-level analysis.",
      side: "right" as const,
      align: "center" as const,
    },
  },
  {
    element: "#tour-study",
    popover: {
      title: "Study Hub",
      description: "PYQs, flashcards, your mistake notebook, saved questions, and revision playlists — all in one place.",
      side: "right" as const,
      align: "center" as const,
    },
  },
  {
    element: "#tour-doubts",
    popover: {
      title: "Doubts & Q&A",
      description: "Post questions to the community, get answers, and link doubts directly to exam questions.",
      side: "right" as const,
      align: "center" as const,
    },
  },
  {
    element: "#tour-analytics",
    popover: {
      title: "Analytics",
      description: "Track accuracy by topic, spot which subjects need more time, and watch your XP and streak grow.",
      side: "right" as const,
      align: "center" as const,
    },
  },
  {
    element: "#tour-focus-rooms",
    popover: {
      title: "Focus Rooms",
      description: "Study alongside others in real-time voice rooms. Accountability partners measurably improve output.",
      side: "right" as const,
      align: "center" as const,
    },
  },
  {
    element: "#tour-profile",
    popover: {
      title: "Your Progress",
      description: "Every exam and answer earns XP. Level up, unlock avatar cosmetics, and climb the leaderboard.",
      side: "right" as const,
      align: "start" as const,
    },
  },
];

export function useTour({ autoStart = true }: { autoStart?: boolean } = {}) {
  const [tourDone, setTourDone] = useState(() => {
    try { return localStorage.getItem(TOUR_KEY) === "1"; } catch { return false; }
  });

  const startTour = useCallback(() => {
    const availableSteps = STEPS.filter(s => !!document.querySelector(s.element));
    if (availableSteps.length === 0) return;

    const driverObj = driver({
      showProgress: true,
      progressText: "{{current}} / {{total}}",
      nextBtnText: "Next",
      prevBtnText: "Back",
      doneBtnText: "Done",
      overlayOpacity: 0.65,
      smoothScroll: true,
      popoverClass: "sc-tour-popover",
      onDestroyStarted: () => {
        try { localStorage.setItem(TOUR_KEY, "1"); } catch {}
        setTourDone(true);
        driverObj.destroy();
      },
      steps: availableSteps,
    });

    driverObj.drive();
  }, [setTourDone]);

  // Auto-start once for new users (1.5 s delay to let initial modals settle).
  // Opt out via { autoStart: false } when only the trigger function is needed.
  useEffect(() => {
    if (!autoStart) return;
    let done = false;
    try { done = localStorage.getItem(TOUR_KEY) === "1"; } catch {}
    if (done) return;

    const t = setTimeout(startTour, 1500);
    return () => clearTimeout(t);
  }, [autoStart]); // eslint-disable-line react-hooks/exhaustive-deps — startTour is stable

  return { startTour, isTourDone: tourDone };
}
