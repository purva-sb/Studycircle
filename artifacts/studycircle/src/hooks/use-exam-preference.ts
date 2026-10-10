import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "studycircle.exam";

export const EXAMS = ["GATE", "JEE", "NEET", "CAT", "UPSC", "SSC", "Banking"] as const;
export type Exam = (typeof EXAMS)[number];
export type ExamPref = Exam | "ALL";

const VALID = new Set<string>([...EXAMS, "ALL"]);

function readStored(): ExamPref {
  if (typeof window === "undefined") return "ALL";
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved && VALID.has(saved) ? (saved as ExamPref) : "ALL";
}

export function useExamPreference() {
  const [exam, setExamState] = useState<ExamPref>(readStored);

  const setExam = useCallback((next: ExamPref) => {
    setExamState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      setExamState(readStored());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return [exam, setExam] as const;
}
