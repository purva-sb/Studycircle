import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

type ID = string;

type Me = {
  id: ID;
  displayName: string;
  handle: string;
  avatarUrl: string;
  level: number;
  xp: number;
  xpForNextLevel: number;
  streakDays: number;
  examFocus: string;
  plan: "free" | "pro";
  dailyTargetMinutes: number;
};

type Goal = { id: ID; title: string; completed: boolean; xp: number; createdAt: Date };

type Subject = { id: ID; name: string; color: string };

type StudySession = {
  id: ID;
  subjectId: ID;
  mode: "pomodoro" | "stopwatch";
  durationMinutes: number;
  note: string;
  startedAt: Date;
};

type Activity = {
  id: ID;
  kind: "study_session" | "exam_completed" | "badge_earned" | "circle_joined" | "doubt_answered" | "pod_goal";
  title: string;
  subtitle: string;
  createdAt: Date;
};

type Circle = {
  id: ID;
  name: string;
  slug: string;
  description: string;
  exam: string;
  memberCount: number;
  isPrivate: boolean;
  coverColor: string;
  joined: boolean;
  onlineCount: number;
  members: CircleMember[];
};

type CircleMember = {
  userId: ID;
  displayName: string;
  handle: string;
  avatarUrl: string;
  role: "owner" | "mod" | "member";
  online: boolean;
  level: number;
};

type Channel = {
  id: ID;
  circleId: ID;
  name: string;
  kind: "general" | "doubts" | "resources" | "announcements" | "mock-tests" | "off-topic";
  description: string;
  unread: number;
};

type Reaction = { emoji: string; count: number; mine: boolean };

type Message = {
  id: ID;
  channelId: ID;
  authorId: ID;
  authorName: string;
  authorAvatar: string;
  body: string;
  createdAt: Date;
  pinned: boolean;
  reactions: Reaction[];
};

type FocusRoom = {
  id: ID;
  name: string;
  description: string;
  hostId?: string;
  hostName: string;
  hostAvatar: string;
  mode: "silent" | "voice" | "video";
  participantCount: number;
  maxParticipants: number;
  isLive: boolean;
  isPrivate: boolean;
  silentMode: boolean;
  isChatEnabled?: boolean;
  exam: string;
  focusMinutesElapsed: number;
  totalParticipantMinutes: number;
  accentColor: string;
  participants: {
    userId: ID;
    displayName: string;
    avatarUrl: string;
    micOn: boolean;
    cameraOn: boolean;
    status: "focusing" | "break" | "idle" | "studying" | "offline";
    focusMinutes: number;
    totalStudySeconds?: number;
    lastStatusChangeAt?: number;
    currentTask?: string;
    isTaskPrivate?: boolean;
  }[];
  sharedTimer: {
    mode: "pomodoro" | "break" | "stopwatch";
    totalSeconds: number;
    remainingSeconds: number;
    label: string;
    isRunning?: boolean;
    pomodoroInterval?: ReturnType<typeof setInterval>;
  };
};

type QuestionOption = { id: ID; body: string };
type Question = {
  id: ID;
  examId: ID;
  kind: "mcq" | "msq" | "nat";
  body: string;
  options: QuestionOption[];
  correctOptionIds: ID[];
  natAnswer?: number;
  marks: number;
  negativeMarks: number;
  topic: string;
};

type Exam = {
  id: ID;
  title: string;
  exam: string;
  kind: "practice" | "timed" | "full-mock" | "scheduled" | "contest" | "pyq";
  durationMinutes: number;
  totalQuestions: number;
  totalMarks: number;
  attemptCount: number;
  difficulty: "easy" | "medium" | "hard";
  isLive: boolean;
  scheduledAt: Date | null;
  description: string;
  instructions: string[];
  topics: string[];
  negativeMarking: number;
  marksPerQuestion: number;
};

type UserAnswer = {
  questionId: ID;
  selectedOptionIds: ID[];
  natValue: number | null;
  status: "unanswered" | "answered" | "marked" | "answered-marked";
};

type ExamAttempt = {
  id: ID;
  examId: ID;
  status: "in-progress" | "submitted";
  startedAt: Date;
  durationMinutes: number;
  answers: UserAnswer[];
};

type Doubt = {
  id: ID;
  title: string;
  body: string;
  askedBy: string;
  askedByAvatar: string;
  topic: string;
  exam: string;
  bountyXp: number;
  createdAt: Date;
  resolved: boolean;
  answers: DoubtAnswer[];
};

type DoubtAnswer = {
  id: ID;
  doubtId: ID;
  body: string;
  authorName: string;
  authorAvatar: string;
  upvotes: number;
  accepted: boolean;
  createdAt: Date;
  mineUpvoted: boolean;
};

type Pod = {
  id: ID;
  name: string;
  exam: string;
  sharedStreak: number;
  weeklyXp: number;
  dailyGoalMinutes: number;
  members: {
    userId: ID;
    displayName: string;
    avatarUrl: string;
    todayMinutes: number;
    weeklyMinutes: number;
    streakDays: number;
    dailyGoalMet: boolean;
  }[];
  weeklyReview: {
    totalMinutes: number;
    totalXp: number;
    mvpUserId: ID;
    theme: string;
  };
};

type Resource = {
  id: ID;
  title: string;
  kind: "pdf" | "notes" | "link" | "video" | "pyq";
  circleName: string;
  addedBy: string;
  sizeKb: number;
  downloads: number;
  createdAt: Date;
  tag: string;
};

type RevisionItem = {
  id: ID;
  topic: string;
  subject: string;
  front: string;
  back: string;
  lastReviewedAt: Date;
  dueAt: Date;
  intervalDays: number;
  easeFactor: number;
  masteryPct: number;
};

type CalendarEvent = {
  id: ID;
  title: string;
  kind: "mock-test" | "group-study" | "mentor-class" | "revision" | "deadline";
  startsAt: Date;
  endsAt: Date;
  circleName: string;
  color: string;
};

type Achievement = {
  id: ID;
  name: string;
  description: string;
  icon: string;
  earnedAt: Date | null;
  locked: boolean;
  progress: number;
  target: number;
};

type LeaderboardEntry = {
  rank: number;
  userId: ID;
  displayName: string;
  handle: string;
  avatarUrl: string;
  xp: number;
  studyMinutes: number;
  streakDays: number;
  badge: string;
  isYou: boolean;
};

const DEMO_USER_ID = "u_me";

const me: Me = {
  id: DEMO_USER_ID,
  displayName: "Aarav Sharma",
  handle: "@aarav",
  avatarUrl: "https://api.dicebear.com/7.x/initials/svg?fontFamily=Inter,sans-serif&fontSize=36&seed=Aarav",
  level: 18,
  xp: 4280,
  xpForNextLevel: 5000,
  streakDays: 23,
  examFocus: "GATE CSE",
  plan: "free",
  dailyTargetMinutes: 240,
};

const subjects: Subject[] = [
  { id: "s_dsa", name: "Data Structures", color: "#7C3AED" },
  { id: "s_algo", name: "Algorithms", color: "#06B6D4" },
  { id: "s_os", name: "Operating Systems", color: "#F59E0B" },
  { id: "s_dbms", name: "DBMS", color: "#10B981" },
  { id: "s_cn", name: "Computer Networks", color: "#EF4444" },
  { id: "s_toc", name: "Theory of Computation", color: "#EC4899" },
  { id: "s_math", name: "Engineering Maths", color: "#3B82F6" },
  { id: "s_apt", name: "Aptitude", color: "#8B5CF6" },
];

const now = () => new Date();
const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000);
const hoursAgo = (n: number) => new Date(Date.now() - n * 3_600_000);
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
const daysAhead = (n: number) => new Date(Date.now() + n * 86_400_000);

const goals: Goal[] = [
  { id: "g1", title: "Solve 10 graph problems", completed: true, xp: 50, createdAt: hoursAgo(8) },
  { id: "g2", title: "Watch OS process scheduling lecture", completed: true, xp: 30, createdAt: hoursAgo(7) },
  { id: "g3", title: "Revise SQL joins and normalization", completed: false, xp: 40, createdAt: hoursAgo(6) },
  { id: "g4", title: "Take a 30Q practice test on TOC", completed: false, xp: 60, createdAt: hoursAgo(5) },
  { id: "g5", title: "Read 3 PYQ explanations from CN", completed: false, xp: 25, createdAt: hoursAgo(4) },
];

let studySessions: StudySession[] = [
  { id: "ss1", subjectId: "s_dsa", mode: "pomodoro", durationMinutes: 50, note: "Trees + recursion patterns", startedAt: hoursAgo(2) },
  { id: "ss2", subjectId: "s_dbms", mode: "pomodoro", durationMinutes: 25, note: "Indexing & B+ trees", startedAt: hoursAgo(4) },
  { id: "ss3", subjectId: "s_algo", mode: "stopwatch", durationMinutes: 75, note: "Dijkstra and Floyd-Warshall", startedAt: hoursAgo(7) },
  { id: "ss4", subjectId: "s_cn", mode: "pomodoro", durationMinutes: 50, note: "TCP congestion control", startedAt: hoursAgo(22) },
  { id: "ss5", subjectId: "s_os", mode: "pomodoro", durationMinutes: 100, note: "Deadlock detection lab", startedAt: daysAgo(1) },
  { id: "ss6", subjectId: "s_math", mode: "stopwatch", durationMinutes: 60, note: "Probability — Bayes problems", startedAt: daysAgo(2) },
  { id: "ss7", subjectId: "s_toc", mode: "pomodoro", durationMinutes: 75, note: "PDA constructions", startedAt: daysAgo(3) },
  { id: "ss8", subjectId: "s_dsa", mode: "stopwatch", durationMinutes: 90, note: "Heap problems", startedAt: daysAgo(4) },
  { id: "ss9", subjectId: "s_apt", mode: "pomodoro", durationMinutes: 45, note: "Time-speed-distance", startedAt: daysAgo(5) },
  { id: "ss10", subjectId: "s_dbms", mode: "pomodoro", durationMinutes: 50, note: "Transactions & ACID", startedAt: daysAgo(6) },
];

const STUDY_SESSIONS_FILE = path.join(process.cwd(), "studySessions.json");
try {
  if (fs.existsSync(STUDY_SESSIONS_FILE)) {
    const saved = JSON.parse(fs.readFileSync(STUDY_SESSIONS_FILE, "utf-8"));
    if (Array.isArray(saved) && saved.length > 0) {
      studySessions = saved.map((s: any) => ({
        ...s,
        startedAt: new Date(s.startedAt)
      }));
    }
  }
} catch (e) {
  console.error("Failed to load study sessions from disk", e);
}

const saveStudySessions = () => {
  try {
    fs.writeFileSync(STUDY_SESSIONS_FILE, JSON.stringify(studySessions, null, 2));
  } catch (e) {
    console.error("Failed to save study sessions to disk", e);
  }
};

const activity: Activity[] = [
  { id: "a1", kind: "study_session", title: "Logged 50 min on Data Structures", subtitle: "Pomodoro · Trees + recursion", createdAt: hoursAgo(2) },
  { id: "a2", kind: "doubt_answered", title: "Your answer was upvoted 4 times", subtitle: "Doubt: Why is BFS O(V+E)?", createdAt: hoursAgo(3) },
  { id: "a3", kind: "exam_completed", title: "Scored 78/100 on GATE Daily Mock", subtitle: "Percentile 92.4 · Rank 312 / 4,103", createdAt: hoursAgo(20) },
  { id: "a4", kind: "badge_earned", title: "Earned the Marathoner badge", subtitle: "Studied for 4 hours straight", createdAt: daysAgo(1) },
  { id: "a5", kind: "pod_goal", title: "All 5 pod members hit their daily goal", subtitle: "DeepWork Squad · Day 12 streak", createdAt: daysAgo(2) },
  { id: "a6", kind: "circle_joined", title: "Joined GATE CSE 2026 — Toppers Track", subtitle: "Now in 6 active circles", createdAt: daysAgo(3) },
];

const circleMembers = (seed: string): CircleMember[] => {
  const names: { name: string; handle: string; role: CircleMember["role"]; level: number; online: boolean }[] = [
    { name: "Priya Iyer", handle: "@priya", role: "owner", level: 32, online: true },
    { name: "Rohan Mehta", handle: "@rohan", role: "mod", level: 27, online: true },
    { name: "Ananya Roy", handle: "@ananya", role: "mod", level: 25, online: false },
    { name: "Karan Singh", handle: "@karan", role: "member", level: 19, online: true },
    { name: "Sneha Patel", handle: "@sneha", role: "member", level: 22, online: true },
    { name: "Vikram Joshi", handle: "@vikram", role: "member", level: 16, online: false },
    { name: "Riya Kapoor", handle: "@riya", role: "member", level: 14, online: true },
    { name: "Aditya Nair", handle: "@aditya", role: "member", level: 21, online: false },
    { name: "Zara Khan", handle: "@zara", role: "member", level: 18, online: true },
    { name: "Aarav Sharma", handle: "@aarav", role: "member", level: 18, online: true },
  ];
  return names.map((n, i) => ({
    userId: i === names.length - 1 ? DEMO_USER_ID : `u_${seed}_${i}`,
    displayName: n.name,
    handle: n.handle,
    avatarUrl: `https://api.dicebear.com/7.x/initials/svg?fontFamily=Inter,sans-serif&fontSize=36&seed=${encodeURIComponent(n.name + seed)}`,
    role: n.role,
    online: n.online,
    level: n.level,
  }));
};

const channelKinds: Channel["kind"][] = ["general", "announcements", "doubts", "resources", "mock-tests", "off-topic"];

const buildChannels = (circleId: ID): Channel[] =>
  channelKinds.map((kind, i) => ({
    id: `${circleId}_ch_${kind}`,
    circleId,
    name: kind,
    kind,
    description:
      kind === "general"
        ? "Hang out, share progress, and stay in sync."
        : kind === "announcements"
        ? "Important updates from circle leads."
        : kind === "doubts"
        ? "Drop your stuck-on questions here."
        : kind === "resources"
        ? "Curated PDFs, notes, and reference links."
        : kind === "mock-tests"
        ? "Schedule and discuss mock tests together."
        : "Anything off topic — memes, music, life.",
    unread: i === 0 ? 4 : i === 2 ? 2 : 0,
  }));

const circles: Circle[] = [
  {
    id: "c1",
    name: "GATE CSE 2026 — Toppers Track",
    slug: "gate-cse-2026",
    description: "Disciplined GATE prep with weekly mocks, PYQ marathons, and topper AMAs.",
    exam: "GATE",
    memberCount: 4128,
    isPrivate: false,
    coverColor: "#7C3AED",
    joined: true,
    onlineCount: 312,
    members: circleMembers("c1"),
  },
  {
    id: "c2",
    name: "JEE Advanced — Physics Lab",
    slug: "jee-physics-lab",
    description: "Crack mechanics, electrodynamics, and modern physics with daily problem sets.",
    exam: "JEE",
    memberCount: 2740,
    isPrivate: false,
    coverColor: "#06B6D4",
    joined: true,
    onlineCount: 188,
    members: circleMembers("c2"),
  },
  {
    id: "c3",
    name: "NEET 2026 Biology Beasts",
    slug: "neet-biology",
    description: "NCERT first. Diagrams, mnemonics, and PYQ deep dives every weekend.",
    exam: "NEET",
    memberCount: 5102,
    isPrivate: false,
    coverColor: "#10B981",
    joined: true,
    onlineCount: 421,
    members: circleMembers("c3"),
  },
  {
    id: "c4",
    name: "CAT VARC Verbal Lounge",
    slug: "cat-varc",
    description: "Reading comprehension drills, parajumbles, and vocab building, every evening.",
    exam: "CAT",
    memberCount: 1923,
    isPrivate: false,
    coverColor: "#F59E0B",
    joined: false,
    onlineCount: 142,
    members: circleMembers("c4"),
  },
  {
    id: "c5",
    name: "UPSC Prelims Pathshala",
    slug: "upsc-prelims",
    description: "Daily current affairs, history mind-maps, polity revisions and prelim mock tests.",
    exam: "UPSC",
    memberCount: 3551,
    isPrivate: false,
    coverColor: "#EF4444",
    joined: false,
    onlineCount: 267,
    members: circleMembers("c5"),
  },
  {
    id: "c6",
    name: "Placements 2026 — DSA Daily",
    slug: "placements-dsa",
    description: "One curated DSA problem a day. Mock interviews on weekends.",
    exam: "Placements",
    memberCount: 6340,
    isPrivate: false,
    coverColor: "#EC4899",
    joined: true,
    onlineCount: 538,
    members: circleMembers("c6"),
  },
  {
    id: "c7",
    name: "GATE EE Power Systems Den",
    slug: "gate-ee-power",
    description: "Targeted prep for GATE Electrical Engineering — power systems, machines, control.",
    exam: "GATE",
    memberCount: 1487,
    isPrivate: true,
    coverColor: "#3B82F6",
    joined: false,
    onlineCount: 84,
    members: circleMembers("c7"),
  },
  {
    id: "c8",
    name: "Internship Interview Prep",
    slug: "internship-prep",
    description: "Resume reviews, system design 101, and behavioral mock interviews.",
    exam: "Placements",
    memberCount: 2210,
    isPrivate: false,
    coverColor: "#8B5CF6",
    joined: false,
    onlineCount: 198,
    members: circleMembers("c8"),
  },
];

const channels: Channel[] = circles.flatMap((c) => buildChannels(c.id));

const buildSeedMessages = (channel: Channel): Message[] => {
  const seed = (i: number) => circles.find((c) => c.id === channel.circleId)!.members[i % 9];
  const samples: { body: string; offsetMin: number; reactions?: Reaction[]; pinned?: boolean }[] =
    channel.kind === "general"
      ? [
          { body: "Morning all — anyone up for a 50/10 pomodoro session in 5 mins?", offsetMin: 35, reactions: [{ emoji: "🔥", count: 6, mine: true }] },
          { body: "Crushed 3 hours of DBMS. Brain is mush. Joining the focus room now.", offsetMin: 28 },
          { body: "Reminder: weekly review every Sunday at 8 PM IST in the announcements channel.", offsetMin: 22, pinned: true, reactions: [{ emoji: "📌", count: 3, mine: false }] },
          { body: "Solving last year GATE PYQ — Q47 is genuinely cursed", offsetMin: 18, reactions: [{ emoji: "😂", count: 8, mine: false }] },
          { body: "Anyone has clean handwritten notes for normalization till BCNF?", offsetMin: 14 },
          { body: "Dropped some in #resources just now", offsetMin: 12, reactions: [{ emoji: "🙏", count: 4, mine: true }] },
          { body: "Pod check-in: hit my 4hr target today, streak day 23", offsetMin: 7, reactions: [{ emoji: "🎯", count: 11, mine: false }, { emoji: "🚀", count: 5, mine: true }] },
          { body: "Going for a walk and listening to OS lectures. 1.5x speed gang", offsetMin: 3 },
        ]
      : channel.kind === "doubts"
      ? [
          { body: "Why does TCP slow start use exponential growth instead of linear?", offsetMin: 40 },
          { body: "Because we want to find the network capacity quickly. Once we hit ssthresh we switch to additive (linear) increase.", offsetMin: 32, reactions: [{ emoji: "💡", count: 5, mine: true }] },
          { body: "For GATE 2024 Q31 — is the answer 12 or 14? Solution book says 14, video says 12.", offsetMin: 17 },
          { body: "It's 14. The book is right — they include the boundary case for the BFS traversal.", offsetMin: 9, reactions: [{ emoji: "✅", count: 3, mine: false }] },
        ]
      : channel.kind === "resources"
      ? [
          { body: "Posted: Operating Systems — full handwritten revision notes (PDF, 28 pages)", offsetMin: 50, pinned: true, reactions: [{ emoji: "🔥", count: 14, mine: true }] },
          { body: "Posted: GATE 2015–2024 PYQ pack with detailed video solutions", offsetMin: 30, reactions: [{ emoji: "🏆", count: 9, mine: false }] },
          { body: "Link: Stanford CS161 Algorithms lectures — entire playlist", offsetMin: 12 },
        ]
      : channel.kind === "announcements"
      ? [
          { body: "Mock Test #14 goes live tomorrow at 7 PM IST. Be there.", offsetMin: 120, pinned: true, reactions: [{ emoji: "📣", count: 22, mine: true }] },
          { body: "We hit 4,000 members. Thank you for being part of this circle. Toppers AMA next Sunday.", offsetMin: 60, reactions: [{ emoji: "🎉", count: 41, mine: true }] },
        ]
      : channel.kind === "mock-tests"
      ? [
          { body: "Scoreboard for Mock #13: avg 62/100, top scorer @priya at 91", offsetMin: 70 },
          { body: "Discussion thread for Q12 — half the circle got it wrong, let's break it down", offsetMin: 30, reactions: [{ emoji: "🧠", count: 7, mine: false }] },
        ]
      : [
          { body: "What's your study playlist? I rotate between lo-fi and Studio Ghibli OSTs", offsetMin: 90 },
          { body: "Brown noise + occasional Hans Zimmer for me. Concentration goes through the roof", offsetMin: 60, reactions: [{ emoji: "🎧", count: 6, mine: true }] },
          { body: "Reading Atomic Habits this week. Genuinely changed how I plan my day.", offsetMin: 25 },
        ];
  return samples.map((s, i) => {
    const member = seed(i);
    return {
      id: `${channel.id}_m_${i}`,
      channelId: channel.id,
      authorId: member.userId,
      authorName: member.displayName,
      authorAvatar: member.avatarUrl,
      body: s.body,
      createdAt: minutesAgo(s.offsetMin),
      pinned: s.pinned ?? false,
      reactions: s.reactions ?? [],
    };
  });
};

const messages: Message[] = channels.flatMap(buildSeedMessages);

const buildParticipants = (n: number, seed: string): FocusRoom["participants"] => {
  const pool = circleMembers(seed).slice(0, n);
  return pool.map((p, i) => {
    const isStudying = i % 5 !== 0;
    return {
      userId: p.userId,
      displayName: p.displayName,
      avatarUrl: p.avatarUrl,
      micOn: i % 3 === 0,
      cameraOn: i % 4 === 0,
      status: isStudying ? "focusing" : "break",
      focusMinutes: 30 + (i * 17) % 90,
      totalStudySeconds: (30 + (i * 17) % 90) * 60,
      role: p.role,
      currentTask: isStudying ? "Reviewing Chapter " + (i + 1) : undefined,
      isTaskPrivate: false,
    };
  });
};

let focusRooms: FocusRoom[] = [
  {
    id: "fr1",
    name: "Silent Deep Work — GATE CSE",
    description: "Cameras off, mics off. Just pure focus.",
    hostName: "Priya Iyer",
    hostAvatar: "https://api.dicebear.com/7.x/initials/svg?fontFamily=Inter,sans-serif&fontSize=36&seed=Priya",
    mode: "silent",
    participantCount: 0,
    maxParticipants: 20,
    isLive: true,
    isPrivate: false,
    silentMode: true,
    isChatEnabled: true,
    exam: "GATE",
    focusMinutesElapsed: 142,
    totalParticipantMinutes: 1680,
    accentColor: "#7C3AED",
    participants: [],
    sharedTimer: { mode: "pomodoro", totalSeconds: 3000, remainingSeconds: 1840, label: "Deep Focus 50/10" },
  },
  {
    id: "fr2",
    name: "JEE Physics Sprint",
    description: "Mechanics problem-solving with voice check-ins every break.",
    hostName: "Rohan Mehta",
    hostAvatar: "https://api.dicebear.com/7.x/initials/svg?fontFamily=Inter,sans-serif&fontSize=36&seed=Rohan",
    mode: "voice",
    participantCount: 0,
    maxParticipants: 12,
    isLive: true,
    isPrivate: true,
    silentMode: false,
    exam: "JEE",
    focusMinutesElapsed: 88,
    totalParticipantMinutes: 612,
    accentColor: "#06B6D4",
    participants: [],
    sharedTimer: { mode: "pomodoro", totalSeconds: 3000, remainingSeconds: 940, label: "Sprint #4" },
  },
  {
    id: "fr3",
    name: "NEET Biology — NCERT Revision",
    description: "Reading NCERT line-by-line. Camera on, mic off.",
    hostName: "Ananya Roy",
    hostAvatar: "https://api.dicebear.com/7.x/initials/svg?fontFamily=Inter,sans-serif&fontSize=36&seed=Ananya",
    mode: "video",
    participantCount: 0,
    maxParticipants: 15,
    isLive: true,
    isPrivate: false,
    silentMode: false,
    exam: "NEET",
    focusMinutesElapsed: 64,
    totalParticipantMinutes: 740,
    accentColor: "#10B981",
    participants: [],
    sharedTimer: { mode: "pomodoro", totalSeconds: 3000, remainingSeconds: 2160, label: "NCERT Pass #3" },
  },
  {
    id: "fr4",
    name: "Late Night Coders' Lounge",
    description: "Solving DSA problems till 2 AM. Bring your A game.",
    hostName: "Karan Singh",
    hostAvatar: "https://api.dicebear.com/7.x/initials/svg?fontFamily=Inter,sans-serif&fontSize=36&seed=Karan",
    mode: "voice",
    participantCount: 0,
    maxParticipants: 10,
    isLive: true,
    isPrivate: true,
    silentMode: false,
    exam: "Placements",
    focusMinutesElapsed: 32,
    totalParticipantMinutes: 184,
    accentColor: "#EC4899",
    participants: [],
    sharedTimer: { mode: "stopwatch", totalSeconds: 0, remainingSeconds: 1920, label: "Open ended" },
  },
  {
    id: "fr5",
    name: "UPSC Polity — Mind Map Builder",
    description: "Building chapter-wise mind maps together.",
    hostName: "Sneha Patel",
    hostAvatar: "https://api.dicebear.com/7.x/initials/svg?fontFamily=Inter,sans-serif&fontSize=36&seed=Sneha",
    mode: "video",
    participantCount: 0,
    maxParticipants: 8,
    isLive: true,
    isPrivate: false,
    silentMode: false,
    exam: "UPSC",
    focusMinutesElapsed: 22,
    totalParticipantMinutes: 84,
    accentColor: "#EF4444",
    participants: [],
    sharedTimer: { mode: "pomodoro", totalSeconds: 1500, remainingSeconds: 720, label: "Pomodoro" },
  },
  {
    id: "fr6",
    name: "Quiet Cafe — General Study",
    description: "Cafe ambience for cozy independent study sessions.",
    hostName: "Riya Kapoor",
    hostAvatar: "https://api.dicebear.com/7.x/initials/svg?fontFamily=Inter,sans-serif&fontSize=36&seed=Riya",
    mode: "silent",
    participantCount: 0,
    maxParticipants: 30,
    isLive: true,
    isPrivate: false,
    silentMode: true,
    exam: "Open",
    focusMinutesElapsed: 110,
    totalParticipantMinutes: 1980,
    accentColor: "#F59E0B",
    participants: [],
    sharedTimer: { mode: "stopwatch", totalSeconds: 0, remainingSeconds: 6600, label: "Open session" },
  },
];

const FOCUS_ROOMS_FILE = path.join(process.cwd(), "focusRooms.json");

try {
  if (fs.existsSync(FOCUS_ROOMS_FILE)) {
    const saved = JSON.parse(fs.readFileSync(FOCUS_ROOMS_FILE, "utf-8"));
    if (Array.isArray(saved) && saved.length > 0) {
      focusRooms = saved;
    }
  }
} catch (e) {
  console.error("Failed to load focus rooms from disk", e);
}

const saveFocusRooms = () => {
  try {
    fs.writeFileSync(FOCUS_ROOMS_FILE, JSON.stringify(focusRooms, null, 2));
  } catch (e) {
    console.error("Failed to save focus rooms to disk", e);
  }
};

// EXAMS
const buildQuestions = (examId: ID, topics: string[], n: number): Question[] => {
  const bank: { kind: Question["kind"]; body: string; options: string[]; correctIndices: number[]; nat?: number }[] = [
    {
      kind: "mcq",
      body: "What is the time complexity of inserting an element into a balanced binary search tree?",
      options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
      correctIndices: [1],
    },
    {
      kind: "mcq",
      body: "Which page replacement algorithm is provably optimal but cannot be implemented in practice?",
      options: ["FIFO", "LRU", "Belady's optimal", "Clock"],
      correctIndices: [2],
    },
    {
      kind: "msq",
      body: "Which of the following are NP-complete problems? (Select all that apply)",
      options: ["3-SAT", "Reachability in DAG", "Hamiltonian Cycle", "2-SAT"],
      correctIndices: [0, 2],
    },
    {
      kind: "mcq",
      body: "In TCP, what is the purpose of the three-way handshake?",
      options: ["Encryption", "Connection establishment with sequence number sync", "Loss recovery", "Flow control"],
      correctIndices: [1],
    },
    {
      kind: "nat",
      body: "If a B+ tree has order 4 and contains 100 keys, what is the minimum height of the tree (root at height 0)?",
      options: [],
      correctIndices: [],
      nat: 3,
    },
    {
      kind: "mcq",
      body: "Which normalization form removes transitive functional dependencies?",
      options: ["1NF", "2NF", "3NF", "BCNF"],
      correctIndices: [2],
    },
    {
      kind: "mcq",
      body: "For a connected undirected graph with V vertices and E edges, what is the time complexity of BFS?",
      options: ["O(V)", "O(E)", "O(V + E)", "O(V * E)"],
      correctIndices: [2],
    },
    {
      kind: "msq",
      body: "Which of these are properties of ACID transactions?",
      options: ["Atomicity", "Concurrency", "Isolation", "Durability"],
      correctIndices: [0, 2, 3],
    },
    {
      kind: "mcq",
      body: "What is the regular expression for strings over {a,b} containing at least one 'a'?",
      options: ["a*b*", "(a|b)*a(a|b)*", "b*a", "a(a|b)*"],
      correctIndices: [1],
    },
    {
      kind: "nat",
      body: "How many distinct minimum spanning trees does the complete graph K4 with all equal edge weights have?",
      options: [],
      correctIndices: [],
      nat: 16,
    },
    {
      kind: "mcq",
      body: "The maximum number of edges in a simple bipartite graph with n vertices is:",
      options: ["n^2", "n(n-1)/2", "⌊n^2/4⌋", "n log n"],
      correctIndices: [2],
    },
    {
      kind: "mcq",
      body: "Which scheduling algorithm can lead to convoy effect?",
      options: ["Round Robin", "FCFS", "SRTF", "MLFQ"],
      correctIndices: [1],
    },
  ];
  const out: Question[] = [];
  for (let i = 0; i < n; i++) {
    const tmpl = bank[i % bank.length];
    const opts: QuestionOption[] = tmpl.options.map((o, j) => ({ id: `${examId}_q${i}_opt${j}`, body: o }));
    out.push({
      id: `${examId}_q${i}`,
      examId,
      kind: tmpl.kind,
      body: tmpl.body,
      options: opts,
      correctOptionIds: tmpl.correctIndices.map((idx) => opts[idx]!.id),
      natAnswer: tmpl.nat,
      marks: tmpl.kind === "msq" ? 2 : 1,
      negativeMarks: tmpl.kind === "msq" ? 0 : 1 / 3,
      topic: topics[i % topics.length]!,
    });
  }
  return out;
};

const exams: Exam[] = [
  {
    id: "e1",
    title: "GATE CSE Daily Mock — Apr 28",
    exam: "GATE",
    kind: "timed",
    durationMinutes: 60,
    totalQuestions: 30,
    totalMarks: 50,
    attemptCount: 4103,
    difficulty: "medium",
    isLive: true,
    scheduledAt: null,
    description: "A fast 60-minute mock spanning DBMS, OS, CN, Algorithms and Aptitude. Auto-evaluated with negative marking.",
    instructions: [
      "Total duration is 60 minutes. The test will auto-submit on timeout.",
      "Each MCQ carries 1 mark with 1/3 negative for incorrect attempts.",
      "MSQ questions carry 2 marks and have NO negative marking.",
      "NAT questions accept numeric answers — round to two decimal places when needed.",
      "Use Mark for Review to come back to a question later.",
    ],
    topics: ["Algorithms", "Operating Systems", "DBMS", "Networks", "Aptitude"],
    negativeMarking: 1 / 3,
    marksPerQuestion: 1,
  },
  {
    id: "e2",
    title: "JEE Advanced — Mechanics Full Mock",
    exam: "JEE",
    kind: "full-mock",
    durationMinutes: 180,
    totalQuestions: 60,
    totalMarks: 240,
    attemptCount: 2871,
    difficulty: "hard",
    isLive: false,
    scheduledAt: null,
    description: "A full-length 3-hour mock focused on JEE Advanced Mechanics — kinematics through rigid body dynamics.",
    instructions: [
      "Total duration: 180 minutes. The test will auto-submit on timeout.",
      "Mixed MCQ, MSQ and NAT questions.",
      "Use the question palette to jump between questions.",
    ],
    topics: ["Kinematics", "Newton's Laws", "Work & Energy", "Rotational Motion", "Rigid Bodies"],
    negativeMarking: 1,
    marksPerQuestion: 4,
  },
  {
    id: "e3",
    title: "NEET Biology — Chapter 4 Practice",
    exam: "NEET",
    kind: "practice",
    durationMinutes: 30,
    totalQuestions: 20,
    totalMarks: 80,
    attemptCount: 5612,
    difficulty: "easy",
    isLive: false,
    scheduledAt: null,
    description: "Untimed-feel practice on Cell Biology. Detailed solutions after each attempt.",
    instructions: ["No negative marking on practice tests.", "Hint button reveals one elimination per question."],
    topics: ["Cell Structure", "Membrane Transport", "Mitochondria", "Cell Cycle"],
    negativeMarking: 0,
    marksPerQuestion: 4,
  },
  {
    id: "e4",
    title: "GATE PYQ — 2023 Algorithms",
    exam: "GATE",
    kind: "pyq",
    durationMinutes: 45,
    totalQuestions: 25,
    totalMarks: 35,
    attemptCount: 1840,
    difficulty: "hard",
    isLive: false,
    scheduledAt: null,
    description: "All Algorithms questions from GATE CSE 2023 with official answer keys and solutions.",
    instructions: ["Mimics the official paper exactly.", "Negative marking matches the original GATE policy."],
    topics: ["Greedy", "Dynamic Programming", "Graphs", "Sorting", "Complexity"],
    negativeMarking: 1 / 3,
    marksPerQuestion: 1,
  },
  {
    id: "e5",
    title: "Friday Night Live Contest — DSA",
    exam: "Placements",
    kind: "contest",
    durationMinutes: 90,
    totalQuestions: 40,
    totalMarks: 100,
    attemptCount: 6219,
    difficulty: "hard",
    isLive: true,
    scheduledAt: daysAhead(1),
    description: "Compete with 6000+ students in real time. Top 100 win Pro plan badges.",
    instructions: ["Real-time leaderboard.", "Anti-cheat in fullscreen mode."],
    topics: ["Arrays", "Strings", "Trees", "Graphs", "DP"],
    negativeMarking: 0,
    marksPerQuestion: 2.5,
  },
  {
    id: "e6",
    title: "CAT VARC — Daily Drill",
    exam: "CAT",
    kind: "practice",
    durationMinutes: 25,
    totalQuestions: 15,
    totalMarks: 45,
    attemptCount: 3120,
    difficulty: "medium",
    isLive: false,
    scheduledAt: null,
    description: "Reading comprehension and parajumbles in CAT difficulty.",
    instructions: ["Untimed-feel pacing.", "Detailed text-walkthrough explanations."],
    topics: ["Reading Comprehension", "Parajumbles", "Vocabulary"],
    negativeMarking: 1,
    marksPerQuestion: 3,
  },
  {
    id: "e7",
    title: "UPSC Prelims — Mini Mock #21",
    exam: "UPSC",
    kind: "scheduled",
    durationMinutes: 60,
    totalQuestions: 50,
    totalMarks: 100,
    attemptCount: 4488,
    difficulty: "medium",
    isLive: false,
    scheduledAt: daysAhead(2),
    description: "Polity, history, geography and current affairs in a single 60-minute scheduled mock.",
    instructions: ["Will go live as scheduled.", "Auto-submit at the end."],
    topics: ["Polity", "Modern History", "Geography", "Current Affairs"],
    negativeMarking: 1 / 3,
    marksPerQuestion: 2,
  },
  {
    id: "e8",
    title: "GATE TOC — Practice Set",
    exam: "GATE",
    kind: "practice",
    durationMinutes: 40,
    totalQuestions: 18,
    totalMarks: 30,
    attemptCount: 940,
    difficulty: "hard",
    isLive: false,
    scheduledAt: null,
    description: "Targeted practice on regular languages, PDAs, and decidability.",
    instructions: ["Mixed MCQ and MSQ.", "Solutions revealed after submission."],
    topics: ["Regular Languages", "Pushdown Automata", "Turing Machines", "Decidability"],
    negativeMarking: 1 / 3,
    marksPerQuestion: 1,
  },
];

const examQuestions = new Map<ID, Question[]>();
for (const e of exams) {
  examQuestions.set(e.id, buildQuestions(e.id, e.topics, e.totalQuestions));
}

const examAttempts = new Map<ID, ExamAttempt>();

// DOUBTS
const doubts: Doubt[] = [
  {
    id: "d1",
    title: "Why does Dijkstra fail on negative-weight edges?",
    body: "Trying to wrap my head around this. Is it because the greedy choice no longer holds when negative edges can reduce a previously finalized distance?",
    askedBy: "Karan Singh",
    askedByAvatar: "https://api.dicebear.com/7.x/initials/svg?fontFamily=Inter,sans-serif&fontSize=36&seed=Karan",
    topic: "Algorithms",
    exam: "GATE",
    bountyXp: 80,
    createdAt: hoursAgo(3),
    resolved: false,
    answers: [
      {
        id: "da1",
        doubtId: "d1",
        body: "Yes — Dijkstra finalizes a node's shortest distance when it's popped from the priority queue, assuming no future edge can shorten it. Negative weights break that invariant. Use Bellman-Ford for graphs with negative edges (no negative cycles) or Johnson's algorithm for all-pairs.",
        authorName: "Priya Iyer",
        authorAvatar: "https://api.dicebear.com/7.x/initials/svg?fontFamily=Inter,sans-serif&fontSize=36&seed=Priya",
        upvotes: 18,
        accepted: true,
        createdAt: hoursAgo(2),
        mineUpvoted: true,
      },
      {
        id: "da2",
        doubtId: "d1",
        body: "Quick intuition: the moment you pop a node, you commit. Negative edges break commitment.",
        authorName: "Rohan Mehta",
        authorAvatar: "https://api.dicebear.com/7.x/initials/svg?fontFamily=Inter,sans-serif&fontSize=36&seed=Rohan",
        upvotes: 6,
        accepted: false,
        createdAt: hoursAgo(1),
        mineUpvoted: false,
      },
    ],
  },
  {
    id: "d2",
    title: "Difference between strict 2PL and conservative 2PL?",
    body: "Both prevent cascading rollbacks, right? When would I use one over the other?",
    askedBy: "Sneha Patel",
    askedByAvatar: "https://api.dicebear.com/7.x/initials/svg?fontFamily=Inter,sans-serif&fontSize=36&seed=Sneha",
    topic: "DBMS",
    exam: "GATE",
    bountyXp: 60,
    createdAt: hoursAgo(8),
    resolved: false,
    answers: [
      {
        id: "da3",
        doubtId: "d2",
        body: "Strict 2PL holds exclusive locks until commit/abort — prevents cascading rollback. Conservative 2PL acquires ALL locks upfront — prevents deadlocks but is hard in practice because you need to know your read/write set in advance. Most real systems use Strict 2PL.",
        authorName: "Ananya Roy",
        authorAvatar: "https://api.dicebear.com/7.x/initials/svg?fontFamily=Inter,sans-serif&fontSize=36&seed=Ananya",
        upvotes: 22,
        accepted: false,
        createdAt: hoursAgo(6),
        mineUpvoted: false,
      },
    ],
  },
  {
    id: "d3",
    title: "Best way to memorize amino acid codons for NEET?",
    body: "I keep mixing up the start and stop codons. Any mnemonic that actually stuck for you?",
    askedBy: "Riya Kapoor",
    askedByAvatar: "https://api.dicebear.com/7.x/initials/svg?fontFamily=Inter,sans-serif&fontSize=36&seed=Riya",
    topic: "Biology",
    exam: "NEET",
    bountyXp: 40,
    createdAt: hoursAgo(14),
    resolved: true,
    answers: [
      {
        id: "da4",
        doubtId: "d3",
        body: "Start = AUG (Methionine — 'A U G start with Met'). Stop codons = UAA, UAG, UGA. Mnemonic: 'U Are Annoying, U Are Gone, U Go Away'. Worked for my whole batch.",
        authorName: "Zara Khan",
        authorAvatar: "https://api.dicebear.com/7.x/initials/svg?fontFamily=Inter,sans-serif&fontSize=36&seed=Zara",
        upvotes: 47,
        accepted: true,
        createdAt: hoursAgo(13),
        mineUpvoted: true,
      },
    ],
  },
  {
    id: "d4",
    title: "TCP vs UDP — when is UDP actually preferred?",
    body: "I get the textbook answers (low latency, real-time) but want concrete production examples.",
    askedBy: "Aditya Nair",
    askedByAvatar: "https://api.dicebear.com/7.x/initials/svg?fontFamily=Inter,sans-serif&fontSize=36&seed=Aditya",
    topic: "Networks",
    exam: "GATE",
    bountyXp: 50,
    createdAt: hoursAgo(20),
    resolved: false,
    answers: [],
  },
  {
    id: "d5",
    title: "Stuck on 2024 GATE Q47 — Petersen graph chromatic number",
    body: "I keep getting 4, but the answer key says 3. What am I missing?",
    askedBy: "Vikram Joshi",
    askedByAvatar: "https://api.dicebear.com/7.x/initials/svg?fontFamily=Inter,sans-serif&fontSize=36&seed=Vikram",
    topic: "Graphs",
    exam: "GATE",
    bountyXp: 100,
    createdAt: daysAgo(1),
    resolved: false,
    answers: [
      {
        id: "da5",
        doubtId: "d5",
        body: "The Petersen graph has chromatic number 3 — you can color its 5-cycle outer pentagon with 2 colors plus a third for inner vertices. Try drawing it and color the outer ring alternately first.",
        authorName: "Priya Iyer",
        authorAvatar: "https://api.dicebear.com/7.x/initials/svg?fontFamily=Inter,sans-serif&fontSize=36&seed=Priya",
        upvotes: 11,
        accepted: false,
        createdAt: daysAgo(1),
        mineUpvoted: false,
      },
    ],
  },
  {
    id: "d6",
    title: "How do you maintain a 4hr+ deep work streak without burning out?",
    body: "I can do 2hrs and then my brain refuses. Looking for practical day-structure tips.",
    askedBy: "Aarav Sharma",
    askedByAvatar: "https://api.dicebear.com/7.x/initials/svg?fontFamily=Inter,sans-serif&fontSize=36&seed=Aarav",
    topic: "Productivity",
    exam: "Open",
    bountyXp: 30,
    createdAt: daysAgo(2),
    resolved: false,
    answers: [
      {
        id: "da6",
        doubtId: "d6",
        body: "50/10 pomodoros, walk during breaks, eat after the second block, never stack hard subjects back to back. Switching DSA -> Bio -> DSA is way easier than 4hr DSA.",
        authorName: "Ananya Roy",
        authorAvatar: "https://api.dicebear.com/7.x/initials/svg?fontFamily=Inter,sans-serif&fontSize=36&seed=Ananya",
        upvotes: 9,
        accepted: false,
        createdAt: daysAgo(2),
        mineUpvoted: true,
      },
    ],
  },
];

// PODS
const buildPodMembers = (seed: string, n: number): Pod["members"] =>
  circleMembers(seed)
    .slice(0, n)
    .map((m, i) => ({
      userId: m.userId,
      displayName: m.displayName,
      avatarUrl: m.avatarUrl,
      todayMinutes: 80 + ((i * 41) % 220),
      weeklyMinutes: 720 + ((i * 137) % 600),
      streakDays: 8 + ((i * 5) % 18),
      dailyGoalMet: i % 3 !== 2,
    }));

const pods: Pod[] = [
  {
    id: "p1",
    name: "DeepWork Squad",
    exam: "GATE",
    sharedStreak: 12,
    weeklyXp: 4820,
    dailyGoalMinutes: 240,
    members: buildPodMembers("p1", 5),
    weeklyReview: { totalMinutes: 4200, totalXp: 4820, mvpUserId: "u_p1_1", theme: "Discipline week — everyone hit their goal 5/7 days." },
  },
  {
    id: "p2",
    name: "Night Owls",
    exam: "JEE",
    sharedStreak: 7,
    weeklyXp: 3140,
    dailyGoalMinutes: 180,
    members: buildPodMembers("p2", 4),
    weeklyReview: { totalMinutes: 2820, totalXp: 3140, mvpUserId: "u_p2_0", theme: "All-nighter pact paid off — 14 hour group session on Friday." },
  },
  {
    id: "p3",
    name: "NCERT Trio",
    exam: "NEET",
    sharedStreak: 21,
    weeklyXp: 5280,
    dailyGoalMinutes: 300,
    members: buildPodMembers("p3", 3),
    weeklyReview: { totalMinutes: 5840, totalXp: 5280, mvpUserId: "u_p3_2", theme: "Three weeks straight — pure NCERT, zero misses." },
  },
  {
    id: "p4",
    name: "Codeforces Crew",
    exam: "Placements",
    sharedStreak: 4,
    weeklyXp: 2210,
    dailyGoalMinutes: 120,
    members: buildPodMembers("p4", 6),
    weeklyReview: { totalMinutes: 1980, totalXp: 2210, mvpUserId: "u_p4_3", theme: "Started new — first week, foundations laid." },
  },
];

// RESOURCES
const resources: Resource[] = [
  { id: "r1", title: "Operating Systems — Handwritten Revision Notes", kind: "pdf", circleName: "GATE CSE 2026", addedBy: "Priya Iyer", sizeKb: 4280, downloads: 1432, createdAt: daysAgo(3), tag: "OS" },
  { id: "r2", title: "GATE 2015–2024 PYQ Pack with Video Solutions", kind: "pyq", circleName: "GATE CSE 2026", addedBy: "Rohan Mehta", sizeKb: 18620, downloads: 2810, createdAt: daysAgo(7), tag: "PYQ" },
  { id: "r3", title: "Stanford CS161 — Algorithms Lectures", kind: "link", circleName: "Placements 2026", addedBy: "Karan Singh", sizeKb: 0, downloads: 690, createdAt: daysAgo(2), tag: "Algorithms" },
  { id: "r4", title: "NCERT Biology Class 11 — Cell Biology Mind Maps", kind: "notes", circleName: "NEET Biology Beasts", addedBy: "Ananya Roy", sizeKb: 1240, downloads: 940, createdAt: daysAgo(5), tag: "Biology" },
  { id: "r5", title: "JEE Mechanics — 200 Solved Problems", kind: "pdf", circleName: "JEE Physics Lab", addedBy: "Sneha Patel", sizeKb: 6420, downloads: 1810, createdAt: daysAgo(10), tag: "Physics" },
  { id: "r6", title: "DBMS — Normalization Walkthrough Video", kind: "video", circleName: "GATE CSE 2026", addedBy: "Aditya Nair", sizeKb: 24800, downloads: 510, createdAt: daysAgo(1), tag: "DBMS" },
  { id: "r7", title: "UPSC Polity — Mind Maps Compilation", kind: "pdf", circleName: "UPSC Pathshala", addedBy: "Vikram Joshi", sizeKb: 8240, downloads: 1230, createdAt: daysAgo(4), tag: "Polity" },
  { id: "r8", title: "CAT VARC — Reading Comp Strategy Doc", kind: "notes", circleName: "CAT VARC Lounge", addedBy: "Riya Kapoor", sizeKb: 980, downloads: 320, createdAt: daysAgo(6), tag: "VARC" },
  { id: "r9", title: "TOC — Pumping Lemma Worked Examples", kind: "pdf", circleName: "GATE CSE 2026", addedBy: "Zara Khan", sizeKb: 1620, downloads: 410, createdAt: daysAgo(8), tag: "TOC" },
  { id: "r10", title: "System Design 101 — Free Course Link", kind: "link", circleName: "Internship Interview Prep", addedBy: "Aarav Sharma", sizeKb: 0, downloads: 280, createdAt: daysAgo(2), tag: "System Design" },
];

// REVISION
const revisionItems: RevisionItem[] = [
  { id: "rv1", topic: "Trees & Recursion", subject: "Data Structures", front: "What is the time complexity of searching in a perfectly balanced Binary Search Tree?", back: "O(log n) because the height of the tree is log n.", lastReviewedAt: daysAgo(3), dueAt: hoursAgo(2), intervalDays: 3, easeFactor: 2.4, masteryPct: 78 },
  { id: "rv2", topic: "Process Scheduling", subject: "Operating Systems", front: "What is the Convoy Effect in FCFS scheduling?", back: "When short processes get stuck waiting for a long process to finish, leading to high average waiting time.", lastReviewedAt: daysAgo(2), dueAt: hoursAgo(1), intervalDays: 2, easeFactor: 2.2, masteryPct: 64 },
  { id: "rv3", topic: "TCP Congestion Control", subject: "Networks", front: "Describe the TCP Slow Start phase.", back: "The congestion window (cwnd) starts at 1 MSS and doubles every RTT until it hits the slow start threshold (ssthresh).", lastReviewedAt: daysAgo(1), dueAt: daysAhead(0), intervalDays: 1, easeFactor: 2.0, masteryPct: 52 },
  { id: "rv4", topic: "Normalization (1NF–BCNF)", subject: "DBMS", front: "What is the requirement for a relation to be in BCNF?", back: "For every non-trivial functional dependency X → Y, X must be a superkey.", lastReviewedAt: daysAgo(5), dueAt: daysAhead(1), intervalDays: 6, easeFactor: 2.6, masteryPct: 86 },
  { id: "rv5", topic: "Pushdown Automata", subject: "TOC", front: "What language class is accepted by a Pushdown Automaton?", back: "Context-Free Languages (CFLs).", lastReviewedAt: daysAgo(7), dueAt: daysAhead(2), intervalDays: 9, easeFactor: 2.5, masteryPct: 72 },
  { id: "rv6", topic: "Probability — Bayes Theorem", subject: "Maths", front: "State Bayes' Theorem.", back: "P(A|B) = [P(B|A) * P(A)] / P(B)", lastReviewedAt: daysAgo(10), dueAt: daysAhead(4), intervalDays: 14, easeFactor: 2.8, masteryPct: 91 },
  { id: "rv7", topic: "Heaps & Heapify", subject: "Data Structures", front: "What is the time complexity to build a heap from an unsorted array of size n?", back: "O(n)", lastReviewedAt: daysAgo(2), dueAt: daysAhead(3), intervalDays: 5, easeFactor: 2.5, masteryPct: 80 },
  { id: "rv8", topic: "Greedy vs DP — When to use which", subject: "Algorithms", front: "What two properties must a problem have to be solvable by Dynamic Programming?", back: "Optimal Substructure and Overlapping Subproblems.", lastReviewedAt: daysAgo(4), dueAt: daysAhead(5), intervalDays: 9, easeFactor: 2.7, masteryPct: 88 },
  { id: "rv9", topic: "Page Replacement Algorithms", subject: "Operating Systems", front: "What is Belady's Anomaly?", back: "A phenomenon where increasing the number of page frames results in an INCREASE in the number of page faults (typically seen in FIFO).", lastReviewedAt: daysAgo(6), dueAt: daysAhead(7), intervalDays: 13, easeFactor: 2.6, masteryPct: 82 },
  { id: "rv10", topic: "Time-Speed-Distance", subject: "Aptitude", front: "If a train of length L passes a pole in T seconds, what is its speed?", back: "Speed = L / T", lastReviewedAt: daysAgo(8), dueAt: daysAhead(10), intervalDays: 18, easeFactor: 2.9, masteryPct: 95 },
];

// CALENDAR
const calendarEvents: CalendarEvent[] = [
  { id: "ev1", title: "GATE CSE Daily Mock — Apr 28", kind: "mock-test", startsAt: hoursAgo(-2), endsAt: hoursAgo(-1), circleName: "GATE CSE 2026", color: "#7C3AED" },
  { id: "ev2", title: "Group Study — Algorithms Week", kind: "group-study", startsAt: hoursAgo(-6), endsAt: hoursAgo(-4), circleName: "Placements 2026", color: "#06B6D4" },
  { id: "ev3", title: "Mentor Class with Topper Priya I.", kind: "mentor-class", startsAt: daysAhead(1), endsAt: daysAhead(1.05), circleName: "GATE CSE 2026", color: "#F59E0B" },
  { id: "ev4", title: "Friday Night Live Contest — DSA", kind: "mock-test", startsAt: daysAhead(2), endsAt: daysAhead(2.1), circleName: "Placements 2026", color: "#EC4899" },
  { id: "ev5", title: "Pod Weekly Review — DeepWork Squad", kind: "group-study", startsAt: daysAhead(3), endsAt: daysAhead(3.1), circleName: "DeepWork Squad", color: "#10B981" },
  { id: "ev6", title: "Revision Marathon — DBMS + OS", kind: "revision", startsAt: daysAhead(4), endsAt: daysAhead(4.2), circleName: "GATE CSE 2026", color: "#3B82F6" },
  { id: "ev7", title: "Form deadline — JEE Advanced 2026", kind: "deadline", startsAt: daysAhead(7), endsAt: daysAhead(7.05), circleName: "JEE Physics Lab", color: "#EF4444" },
];

// LEADERBOARD
const leaderboard: LeaderboardEntry[] = [
  { rank: 0, userId: "lb1", displayName: "Priya Iyer", handle: "@priya", avatarUrl: "https://api.dicebear.com/7.x/initials/svg?fontFamily=Inter,sans-serif&fontSize=36&seed=Priya", xp: 8420, studyMinutes: 2680, streakDays: 41, badge: "Topper", isYou: false },
  { rank: 0, userId: "lb2", displayName: "Rohan Mehta", handle: "@rohan", avatarUrl: "https://api.dicebear.com/7.x/initials/svg?fontFamily=Inter,sans-serif&fontSize=36&seed=Rohan", xp: 7280, studyMinutes: 2310, streakDays: 36, badge: "Marathoner", isYou: false },
  { rank: 0, userId: "lb3", displayName: "Ananya Roy", handle: "@ananya", avatarUrl: "https://api.dicebear.com/7.x/initials/svg?fontFamily=Inter,sans-serif&fontSize=36&seed=Ananya", xp: 6940, studyMinutes: 2210, streakDays: 28, badge: "Mentor", isYou: false },
  { rank: 0, userId: "lb4", displayName: "Sneha Patel", handle: "@sneha", avatarUrl: "https://api.dicebear.com/7.x/initials/svg?fontFamily=Inter,sans-serif&fontSize=36&seed=Sneha", xp: 5920, studyMinutes: 1980, streakDays: 24, badge: "Night Owl", isYou: false },
  { rank: 0, userId: DEMO_USER_ID, displayName: "Aarav Sharma", handle: "@aarav", avatarUrl: "https://api.dicebear.com/7.x/initials/svg?fontFamily=Inter,sans-serif&fontSize=36&seed=Aarav", xp: 4280, studyMinutes: 1620, streakDays: 23, badge: "Rising Star", isYou: true },
  { rank: 0, userId: "lb6", displayName: "Karan Singh", handle: "@karan", avatarUrl: "https://api.dicebear.com/7.x/initials/svg?fontFamily=Inter,sans-serif&fontSize=36&seed=Karan", xp: 3940, studyMinutes: 1480, streakDays: 19, badge: "Coder", isYou: false },
  { rank: 0, userId: "lb7", displayName: "Riya Kapoor", handle: "@riya", avatarUrl: "https://api.dicebear.com/7.x/initials/svg?fontFamily=Inter,sans-serif&fontSize=36&seed=Riya", xp: 3640, studyMinutes: 1320, streakDays: 14, badge: "Newcomer", isYou: false },
  { rank: 0, userId: "lb8", displayName: "Zara Khan", handle: "@zara", avatarUrl: "https://api.dicebear.com/7.x/initials/svg?fontFamily=Inter,sans-serif&fontSize=36&seed=Zara", xp: 3210, studyMinutes: 1180, streakDays: 12, badge: "Pacer", isYou: false },
  { rank: 0, userId: "lb9", displayName: "Aditya Nair", handle: "@aditya", avatarUrl: "https://api.dicebear.com/7.x/initials/svg?fontFamily=Inter,sans-serif&fontSize=36&seed=Aditya", xp: 2980, studyMinutes: 1080, streakDays: 9, badge: "Explorer", isYou: false },
  { rank: 0, userId: "lb10", displayName: "Vikram Joshi", handle: "@vikram", avatarUrl: "https://api.dicebear.com/7.x/initials/svg?fontFamily=Inter,sans-serif&fontSize=36&seed=Vikram", xp: 2710, studyMinutes: 970, streakDays: 7, badge: "Builder", isYou: false },
];
leaderboard.forEach((e, i) => (e.rank = i + 1));

// ACHIEVEMENTS
const achievements: Achievement[] = [
  { id: "ach1", name: "First Session", description: "Complete your first study session", icon: "play", earnedAt: daysAgo(40), locked: false, progress: 1, target: 1 },
  { id: "ach2", name: "Marathoner", description: "Study for 4 hours straight", icon: "timer", earnedAt: daysAgo(1), locked: false, progress: 1, target: 1 },
  { id: "ach3", name: "Streak Starter", description: "Maintain a 7-day study streak", icon: "flame", earnedAt: daysAgo(16), locked: false, progress: 7, target: 7 },
  { id: "ach4", name: "Doubt Slayer", description: "Answer 10 doubts in your circles", icon: "help-circle", earnedAt: daysAgo(8), locked: false, progress: 14, target: 10 },
  { id: "ach5", name: "Pod Star", description: "Hit your daily goal 30 days in a row inside a pod", icon: "users", earnedAt: null, locked: true, progress: 21, target: 30 },
  { id: "ach6", name: "Topper Track", description: "Score above 90 percentile in any GATE mock", icon: "trophy", earnedAt: daysAgo(5), locked: false, progress: 1, target: 1 },
  { id: "ach7", name: "Full Mock Finisher", description: "Complete a 3-hour full-length mock exam", icon: "graduation-cap", earnedAt: null, locked: true, progress: 0, target: 1 },
  { id: "ach8", name: "Night Owl", description: "Study past midnight 5 nights in a row", icon: "moon", earnedAt: daysAgo(11), locked: false, progress: 5, target: 5 },
  { id: "ach9", name: "Quiz Master", description: "Get 100% accuracy on a 30-question test", icon: "target", earnedAt: null, locked: true, progress: 87, target: 100 },
  { id: "ach10", name: "Resource Curator", description: "Upload 5 resources used by 100+ students", icon: "folder-open", earnedAt: null, locked: true, progress: 2, target: 5 },
  { id: "ach11", name: "Mentor", description: "Have 50 of your answers marked accepted", icon: "award", earnedAt: null, locked: true, progress: 18, target: 50 },
  { id: "ach12", name: "Centurion", description: "Reach a 100-day study streak", icon: "crown", earnedAt: null, locked: true, progress: 23, target: 100 },
];

// =================== EXPORTS / API ===================
export const store = {
  getMe: (): Me => ({ ...me }),

  getDashboardSummary: () => {
    const todayMinutes = studySessions
      .filter((s) => s.startedAt.getTime() > Date.now() - 24 * 3_600_000)
      .reduce((a, s) => a + s.durationMinutes, 0);
    const weeklyMinutes = studySessions
      .filter((s) => s.startedAt.getTime() > Date.now() - 7 * 86_400_000)
      .reduce((a, s) => a + s.durationMinutes, 0);
    const upcoming = exams
      .filter((e) => e.scheduledAt && e.scheduledAt.getTime() > Date.now())
      .sort((a, b) => a.scheduledAt!.getTime() - b.scheduledAt!.getTime())[0];
    return {
      todayMinutes,
      weeklyMinutes,
      streakDays: me.streakDays,
      level: me.level,
      xp: me.xp,
      xpForNextLevel: me.xpForNextLevel,
      accuracy: 78.4,
      rankPercentile: 92.4,
      activeCircles: circles.filter((c) => c.joined).length,
      dailyTargetMinutes: me.dailyTargetMinutes,
      upcomingExam: upcoming
        ? {
            id: upcoming.id,
            title: upcoming.title,
            startsAt: upcoming.scheduledAt!,
            daysAway: Math.max(1, Math.round((upcoming.scheduledAt!.getTime() - Date.now()) / 86_400_000)),
          }
        : null,
    };
  },

  getActivity: () => activity,

  // GOALS
  listGoals: () => goals,
  createGoal: (input: { title: string; xp?: number }) => {
    const g: Goal = { id: randomUUID(), title: input.title, completed: false, xp: input.xp ?? 25, createdAt: now() };
    goals.unshift(g);
    return g;
  },
  toggleGoal: (id: ID) => {
    const g = goals.find((x) => x.id === id);
    if (!g) return null;
    g.completed = !g.completed;
    return g;
  },

  // SUBJECTS / SESSIONS
  listSubjects: () =>
    subjects.map((s) => ({
      ...s,
      totalMinutes: studySessions.filter((ss) => ss.subjectId === s.id).reduce((a, b) => a + b.durationMinutes, 0),
    })),
  listStudySessions: () =>
    [...studySessions]
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .map((s) => {
        const subj = subjects.find((x) => x.id === s.subjectId)!;
        return { ...s, subjectName: subj.name, subjectColor: subj.color };
      }),
  createStudySession: (input: { subjectId: string; mode: "pomodoro" | "stopwatch"; durationMinutes: number; note?: string }) => {
    const subj = subjects.find((x) => x.id === input.subjectId);
    if (!subj) throw new Error("subject not found");
    const session: StudySession = {
      id: randomUUID(),
      subjectId: input.subjectId,
      mode: input.mode,
      durationMinutes: input.durationMinutes,
      note: input.note ?? "",
      startedAt: now(),
    };
    studySessions.unshift(session);
    saveStudySessions();
    me.xp = Math.min(me.xpForNextLevel, me.xp + Math.round(input.durationMinutes / 5));
    activity.unshift({
      id: randomUUID(),
      kind: "study_session",
      title: `Logged ${input.durationMinutes} min on ${subj.name}`,
      subtitle: `${input.mode === "pomodoro" ? "Pomodoro" : "Stopwatch"} · ${input.note || "No notes"}`,
      createdAt: now(),
    });
    return { ...session, subjectName: subj.name, subjectColor: subj.color };
  },
  weeklyMinutes: () => {
    const out: { day: string; minutes: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const start = new Date(Date.now() - i * 86_400_000);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start.getTime() + 86_400_000);
      const total = studySessions
        .filter((s) => s.startedAt >= start && s.startedAt < end)
        .reduce((a, b) => a + b.durationMinutes, 0);
      out.push({ day: start.toISOString().slice(0, 10), minutes: total });
    }
    return out;
  },

  // CIRCLES
  listCircles: () => circles.map(({ members: _members, ...rest }) => rest),
  discoverCircles: () =>
    circles
      .filter((c) => !c.joined)
      .map(({ members: _members, ...rest }) => rest),
  getCircle: (id: ID) => {
    const c = circles.find((x) => x.id === id);
    if (!c) return null;
    return {
      ...c,
      channels: channels.filter((ch) => ch.circleId === id),
    };
  },
  joinCircle: (id: ID) => {
    const c = circles.find((x) => x.id === id);
    if (!c) return null;
    c.joined = true;
    c.memberCount += 1;
    activity.unshift({
      id: randomUUID(),
      kind: "circle_joined",
      title: `Joined ${c.name}`,
      subtitle: `Now in ${circles.filter((x) => x.joined).length} active circles`,
      createdAt: now(),
    });
    const { members: _members, ...rest } = c;
    return rest;
  },
  createCircle: (input: { name: string; description: string; exam: string; isPrivate: boolean }) => {
    const colors = ["#7C3AED", "#06B6D4", "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#3B82F6", "#8B5CF6"];
    const c: Circle = {
      id: randomUUID(),
      name: input.name,
      slug: input.name.toLowerCase().replace(/\s+/g, "-").slice(0, 40),
      description: input.description,
      exam: input.exam,
      memberCount: 1,
      isPrivate: input.isPrivate,
      coverColor: colors[circles.length % colors.length]!,
      joined: true,
      onlineCount: 1,
      members: circleMembers(`new_${circles.length}`).slice(0, 1),
    };
    circles.unshift(c);
    const newChannels = buildChannels(c.id);
    channels.push(...newChannels);
    for (const ch of newChannels) messages.push(...buildSeedMessages(ch));
    const { members: _members, ...rest } = c;
    return rest;
  },

  // CHANNELS
  listCircleChannels: (circleId: ID) => channels.filter((c) => c.circleId === circleId),
  listChannelMessages: (channelId: ID) =>
    messages.filter((m) => m.channelId === channelId).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
  sendMessage: (channelId: ID, body: string) => {
    const m: Message = {
      id: randomUUID(),
      channelId,
      authorId: me.id,
      authorName: me.displayName,
      authorAvatar: me.avatarUrl,
      body,
      createdAt: now(),
      pinned: false,
      reactions: [],
    };
    messages.push(m);
    return m;
  },
  reactMessage: (messageId: ID, emoji: string) => {
    const m = messages.find((x) => x.id === messageId);
    if (!m) return null;
    const existing = m.reactions.find((r) => r.emoji === emoji);
    if (existing) {
      if (existing.mine) {
        existing.count -= 1;
        existing.mine = false;
        if (existing.count <= 0) m.reactions = m.reactions.filter((r) => r.emoji !== emoji);
      } else {
        existing.count += 1;
        existing.mine = true;
      }
    } else {
      m.reactions.push({ emoji, count: 1, mine: true });
    }
    return m;
  },

  // FOCUS ROOMS
  listFocusRooms: () =>
    focusRooms.map(({ participants: _p, sharedTimer: _t, ...rest }) => rest),
  getFocusRoom: (id: ID) => focusRooms.find((r) => r.id === id) ?? null,
  getActiveRoomsPayload: () =>
    focusRooms
      .filter((r) => r.participants.some((p) => p.status !== "offline"))
      .map((r) => ({
        roomId: r.id,
        roomName: r.name,
        accentColor: r.accentColor,
        exam: r.exam,
        participants: r.participants
          .filter((p) => p.status !== "offline")
          .slice(0, 6)
          .map((p) => ({
            userId: p.userId,
            displayName: p.displayName,
            avatarUrl: p.avatarUrl,
            status: p.status,
            totalStudySeconds: p.totalStudySeconds ?? 0,
          })),
      })),
  ensureFocusRoom: (meta: {
    id: string;
    name: string;
    description: string;
    hostId: string;
    hostName: string;
    hostAvatar: string;
    mode: "silent" | "voice" | "video";
    maxParticipants: number;
    isPrivate: boolean;
    exam: string;
    accentColor: string;
    isChatEnabled?: boolean;
  }) => {
    let r = focusRooms.find((x) => x.id === meta.id);
    if (!r) {
      r = {
        id: meta.id,
        name: meta.name,
        description: meta.description,
        hostId: meta.hostId,
        hostName: meta.hostName,
        hostAvatar: meta.hostAvatar,
        mode: meta.mode,
        participantCount: 0,
        maxParticipants: meta.maxParticipants,
        isLive: true,
        isPrivate: meta.isPrivate,
        silentMode: meta.mode === "silent",
        isChatEnabled: meta.isChatEnabled ?? true,
        exam: meta.exam,
        focusMinutesElapsed: 0,
        totalParticipantMinutes: 0,
        accentColor: meta.accentColor,
        participants: [],
        sharedTimer: { mode: "stopwatch", totalSeconds: 0, remainingSeconds: 0, label: "Session" },
      };
      focusRooms.unshift(r);
      saveFocusRooms();
    } else {
      r.name = meta.name;
      r.description = meta.description;
      r.hostId = meta.hostId;
      r.hostName = meta.hostName;
      r.hostAvatar = meta.hostAvatar;
      r.mode = meta.mode;
      r.maxParticipants = meta.maxParticipants;
      r.isPrivate = meta.isPrivate;
      r.exam = meta.exam;
      r.accentColor = meta.accentColor;
      if (meta.isChatEnabled !== undefined) r.isChatEnabled = meta.isChatEnabled;
    }
    return r;
  },
  setFocusChatEnabled: (roomId: ID, isEnabled: boolean) => {
    const r = focusRooms.find((x) => x.id === roomId);
    if (!r) return;
    r.isChatEnabled = isEnabled;
    saveFocusRooms();
  },
  joinFocusRoom: (id: ID, user: { userId: string; displayName: string; avatarUrl: string; status?: "studying" | "break" | "idle" | "offline" | "focusing"; totalStudySeconds?: number; lastStatusChangeAt?: number }) => {
    const r = focusRooms.find((x) => x.id === id);
    if (!r) return null;
    const existing = r.participants.find((p) => p.userId === user.userId);
    const status = user.status ?? existing?.status ?? "idle";
    const seconds = Math.max(user.totalStudySeconds ?? 0, existing?.totalStudySeconds ?? 0);
    if (!existing) {
      r.participants.push({
        userId: user.userId,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        micOn: false,
        cameraOn: false,
        status,
        focusMinutes: Math.floor(seconds / 60),
        totalStudySeconds: seconds,
        lastStatusChangeAt: user.lastStatusChangeAt ?? Date.now(),
      });
      r.participantCount = r.participants.length;
    } else {
      existing.displayName = user.displayName;
      existing.avatarUrl = user.avatarUrl;
      if (user.status && user.status !== "idle") existing.status = user.status;
      existing.totalStudySeconds = seconds;
      existing.focusMinutes = Math.floor(seconds / 60);
      if (user.lastStatusChangeAt) existing.lastStatusChangeAt = user.lastStatusChangeAt;
      else if (status === "studying" || status === "focusing") existing.lastStatusChangeAt = Date.now();
    }
    saveFocusRooms();
    const { participants: _p, sharedTimer: _t, ...rest } = r;
    return rest;
  },
  leaveFocusRoom: (id: ID, userId: string) => {
    const r = focusRooms.find((x) => x.id === id);
    if (!r) return null;
    r.participants = r.participants.filter((x) => x.userId !== userId);
    saveFocusRooms();
    const { participants: _p, sharedTimer: _t, ...rest } = r;
    return rest;
  },
  updateFocusRoomParticipantStatus: (roomId: ID, userId: string, data: { status: "studying" | "break" | "idle" | "offline" | "focusing", totalStudySeconds?: number }) => {
    const r = focusRooms.find((x) => x.id === roomId);
    if (!r) return;
    const p = r.participants.find(p => p.userId === userId);
    if (!p) return;
    p.status = data.status;
    if (data.totalStudySeconds !== undefined) {
      p.totalStudySeconds = data.totalStudySeconds;
    }
    p.lastStatusChangeAt = Date.now();
    saveFocusRooms();
  },
  updateFocusRoomParticipantTask: (roomId: ID, userId: string, task: string, isPrivate: boolean) => {
    const r = focusRooms.find((x) => x.id === roomId);
    if (!r) return;
    const p = r.participants.find(p => p.userId === userId);
    if (!p) return;
    p.currentTask = task || undefined;
    p.isTaskPrivate = isPrivate;
    saveFocusRooms();
  },
  startPomodoro: (roomId: ID, durationSeconds: number, io: any, totalSecondsOverride?: number) => {
    const r = focusRooms.find((x) => x.id === roomId);
    if (!r) return;
    if (r.sharedTimer.pomodoroInterval) clearInterval(r.sharedTimer.pomodoroInterval);
    r.sharedTimer.mode = "pomodoro";
    r.sharedTimer.totalSeconds = totalSecondsOverride ?? durationSeconds;
    r.sharedTimer.remainingSeconds = durationSeconds;
    r.sharedTimer.label = "Focus";
    r.sharedTimer.isRunning = true;
    r.sharedTimer.pomodoroInterval = setInterval(() => {
      const room = focusRooms.find((x) => x.id === roomId);
      if (!room) return;
      const hasActive = room.participants.some((p) => p.status !== "offline");
      if (!hasActive) {
        if (room.sharedTimer.pomodoroInterval) clearInterval(room.sharedTimer.pomodoroInterval);
        room.sharedTimer.isRunning = false;
        room.sharedTimer.pomodoroInterval = undefined;
        return;
      }
      if (room.sharedTimer.remainingSeconds > 0) {
        room.sharedTimer.remainingSeconds -= 1;
        io.to(`focus_room_${roomId}`).emit("focus:pomodoro_tick", {
          roomId,
          remainingSeconds: room.sharedTimer.remainingSeconds,
          totalSeconds: room.sharedTimer.totalSeconds,
          mode: room.sharedTimer.mode,
          label: room.sharedTimer.label,
          isRunning: true,
        });
      } else {
        if (room.sharedTimer.pomodoroInterval) clearInterval(room.sharedTimer.pomodoroInterval);
        room.sharedTimer.isRunning = false;
        room.sharedTimer.label = "Done";
        io.to(`focus_room_${roomId}`).emit("focus:pomodoro_tick", {
          roomId,
          remainingSeconds: 0,
          totalSeconds: room.sharedTimer.totalSeconds,
          mode: room.sharedTimer.mode,
          label: "Done",
          isRunning: false,
        });
        saveFocusRooms();
      }
    }, 1000);
    saveFocusRooms();
  },
  pausePomodoro: (roomId: ID) => {
    const r = focusRooms.find((x) => x.id === roomId);
    if (!r) return;
    if (r.sharedTimer.pomodoroInterval) clearInterval(r.sharedTimer.pomodoroInterval);
    r.sharedTimer.pomodoroInterval = undefined;
    r.sharedTimer.isRunning = false;
    saveFocusRooms();
  },
  resetPomodoro: (roomId: ID) => {
    const r = focusRooms.find((x) => x.id === roomId);
    if (!r) return;
    if (r.sharedTimer.pomodoroInterval) clearInterval(r.sharedTimer.pomodoroInterval);
    r.sharedTimer.pomodoroInterval = undefined;
    r.sharedTimer.mode = "stopwatch";
    r.sharedTimer.totalSeconds = 0;
    r.sharedTimer.remainingSeconds = 0;
    r.sharedTimer.label = "Session";
    r.sharedTimer.isRunning = false;
    saveFocusRooms();
  },
  createFocusRoom: (input: { name: string; description: string; mode: FocusRoom["mode"]; maxParticipants: number; exam: string; isPrivate?: boolean; hostId: string; hostName: string; hostAvatar: string }) => {
    const colors = ["#7C3AED", "#06B6D4", "#10B981", "#F59E0B", "#EF4444", "#EC4899"];
    const r: FocusRoom = {
      id: randomUUID(),
      name: input.name,
      description: input.description,
      hostName: input.hostName,
      hostAvatar: input.hostAvatar,
      mode: input.mode,
      participantCount: 1,
      maxParticipants: input.maxParticipants,
      isLive: true,
      isPrivate: input.isPrivate ?? false,
      silentMode: input.mode === "silent",
      exam: input.exam,
      focusMinutesElapsed: 0,
      totalParticipantMinutes: 0,
      accentColor: colors[Math.floor(Math.random() * colors.length)],
      participants: [
        {
          userId: input.hostId,
          displayName: input.hostName,
          avatarUrl: input.hostAvatar,
          micOn: false,
          cameraOn: false,
          status: "focusing",
          focusMinutes: 0,
        },
      ],
      sharedTimer: { mode: "stopwatch", totalSeconds: 0, remainingSeconds: 0, label: "Session Started" },
    };
    focusRooms.unshift(r);
    saveFocusRooms();
    const { participants: _p, sharedTimer: _t, ...rest } = r;
    return rest;
  },

  // EXAMS
  listExams: () =>
    exams.map(({ description: _d, instructions: _i, topics: _t, negativeMarking: _n, marksPerQuestion: _m, ...rest }) => rest),
  getExam: (id: ID) => exams.find((e) => e.id === id) ?? null,
  startAttempt: (examId: ID) => {
    const e = exams.find((x) => x.id === examId);
    if (!e) return null;
    const qs = examQuestions.get(examId)!;
    const attempt: ExamAttempt = {
      id: randomUUID(),
      examId,
      status: "in-progress",
      startedAt: now(),
      durationMinutes: e.durationMinutes,
      answers: qs.map((q) => ({ questionId: q.id, selectedOptionIds: [], natValue: null, status: "unanswered" })),
    };
    examAttempts.set(attempt.id, attempt);
    return store.getAttempt(attempt.id)!;
  },
  getAttempt: (id: ID) => {
    const a = examAttempts.get(id);
    if (!a) return null;
    const e = exams.find((x) => x.id === a.examId)!;
    const qs = examQuestions.get(a.examId)!;
    const elapsedSec = Math.floor((Date.now() - a.startedAt.getTime()) / 1000);
    const remaining = Math.max(0, a.durationMinutes * 60 - elapsedSec);
    return {
      id: a.id,
      examId: a.examId,
      examTitle: e.title,
      status: a.status,
      durationMinutes: a.durationMinutes,
      startedAt: a.startedAt,
      secondsRemaining: a.status === "submitted" ? 0 : remaining,
      totalMarks: e.totalMarks,
      marksPerQuestion: e.marksPerQuestion,
      negativeMarking: e.negativeMarking,
      questions: qs.map((q) => ({
        id: q.id,
        kind: q.kind,
        body: q.body,
        options: q.options,
        marks: q.marks,
        negativeMarks: q.negativeMarks,
        topic: q.topic,
      })),
      answers: a.answers,
    };
  },
  submitAnswer: (attemptId: ID, input: { questionId: string; selectedOptionIds?: string[]; natValue?: number | null; status: UserAnswer["status"] }) => {
    const a = examAttempts.get(attemptId);
    if (!a) return null;
    const ans = a.answers.find((x) => x.questionId === input.questionId);
    if (ans) {
      ans.selectedOptionIds = input.selectedOptionIds ?? [];
      ans.natValue = input.natValue ?? null;
      ans.status = input.status;
    }
    return store.getAttempt(attemptId)!;
  },
  submitAttempt: (attemptId: ID) => {
    const a = examAttempts.get(attemptId);
    if (!a) return null;
    a.status = "submitted";
    const e = exams.find((x) => x.id === a.examId)!;
    const qs = examQuestions.get(a.examId)!;
    let score = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let skippedCount = 0;
    const topicAgg = new Map<string, { correct: number; total: number }>();
    for (const q of qs) {
      const ans = a.answers.find((x) => x.questionId === q.id)!;
      const isAnswered = ans.status === "answered" || ans.status === "answered-marked";
      const topic = topicAgg.get(q.topic) ?? { correct: 0, total: 0 };
      topic.total += 1;
      let correct = false;
      if (isAnswered) {
        if (q.kind === "nat") {
          correct = q.natAnswer != null && ans.natValue != null && Math.abs(q.natAnswer - ans.natValue) < 0.001;
        } else {
          const sel = new Set(ans.selectedOptionIds);
          const right = new Set(q.correctOptionIds);
          correct = sel.size === right.size && [...sel].every((id) => right.has(id));
        }
        if (correct) {
          score += q.marks;
          correctCount += 1;
          topic.correct += 1;
        } else {
          score -= q.negativeMarks;
          wrongCount += 1;
        }
      } else {
        skippedCount += 1;
      }
      topicAgg.set(q.topic, topic);
    }
    score = Math.max(0, parseFloat(score.toFixed(2)));
    const attempted = correctCount + wrongCount;
    const accuracy = attempted === 0 ? 0 : parseFloat(((correctCount / attempted) * 100).toFixed(1));
    const elapsedSec = Math.floor((Date.now() - a.startedAt.getTime()) / 1000);
    const percentile = Math.min(99.9, 50 + accuracy / 2.2);
    const totalParticipants = e.attemptCount + 1;
    const rank = Math.max(1, Math.round(totalParticipants * (1 - percentile / 100)));
    activity.unshift({
      id: randomUUID(),
      kind: "exam_completed",
      title: `Scored ${score}/${e.totalMarks} on ${e.title}`,
      subtitle: `Percentile ${percentile.toFixed(1)} · Rank ${rank} / ${totalParticipants}`,
      createdAt: now(),
    });
    me.xp = Math.min(me.xpForNextLevel, me.xp + Math.round(score * 5));
    return {
      attemptId: a.id,
      examTitle: e.title,
      score,
      totalMarks: e.totalMarks,
      accuracy,
      percentile: parseFloat(percentile.toFixed(1)),
      rank,
      totalParticipants,
      correctCount,
      wrongCount,
      skippedCount,
      timeSpentMinutes: Math.round(elapsedSec / 60),
      topicBreakdown: [...topicAgg.entries()].map(([topic, v]) => ({ topic, correct: v.correct, total: v.total })),
    };
  },

  // ANALYTICS
  analyticsOverview: () => ({
    accuracy: 78.4,
    percentile: 92.4,
    rank: 312,
    totalAttempts: 47,
    averageScore: 64.2,
    totalStudyMinutes: studySessions.reduce((a, b) => a + b.durationMinutes, 0) + 18420,
    strongTopics: ["Algorithms", "Data Structures", "DBMS"],
    weakTopics: ["TOC", "Networks", "Probability"],
  }),
  topicPerformance: () => [
    { topic: "Algorithms", accuracy: 88, attempts: 142, avgTimeSeconds: 92 },
    { topic: "Data Structures", accuracy: 84, attempts: 168, avgTimeSeconds: 81 },
    { topic: "DBMS", accuracy: 82, attempts: 96, avgTimeSeconds: 74 },
    { topic: "Operating Systems", accuracy: 76, attempts: 110, avgTimeSeconds: 88 },
    { topic: "TOC", accuracy: 58, attempts: 64, avgTimeSeconds: 124 },
    { topic: "Networks", accuracy: 62, attempts: 78, avgTimeSeconds: 102 },
    { topic: "Maths", accuracy: 71, attempts: 92, avgTimeSeconds: 96 },
    { topic: "Aptitude", accuracy: 80, attempts: 88, avgTimeSeconds: 64 },
  ],
  scoreTrend: () => {
    const labels = ["Mock 1", "Mock 2", "Mock 3", "Mock 4", "Mock 5", "Mock 6", "Mock 7", "Mock 8", "Mock 9", "Mock 10"];
    const scores = [42, 51, 48, 56, 61, 58, 67, 72, 70, 78];
    const pct = [62, 70, 67, 74, 80, 77, 85, 90, 89, 92.4];
    return labels.map((label, i) => ({ label, score: scores[i]!, percentile: pct[i]! }));
  },
  leaderboard: () => leaderboard,

  // DOUBTS
  listDoubts: () =>
    doubts.map(({ answers, ...rest }) => ({ ...rest, answerCount: answers.length })),
  getDoubt: (id: ID) => {
    const d = doubts.find((x) => x.id === id);
    if (!d) return null;
    return {
      ...d,
      answerCount: d.answers.length,
      answers: [...d.answers].sort((a, b) => b.upvotes - a.upvotes),
    };
  },
  createDoubt: (input: { title: string; body: string; topic: string; exam: string; bountyXp: number }) => {
    const d: Doubt = {
      id: randomUUID(),
      title: input.title,
      body: input.body,
      askedBy: me.displayName,
      askedByAvatar: me.avatarUrl,
      topic: input.topic,
      exam: input.exam,
      bountyXp: input.bountyXp,
      createdAt: now(),
      resolved: false,
      answers: [],
    };
    doubts.unshift(d);
    const { answers, ...rest } = d;
    return { ...rest, answerCount: answers.length };
  },
  answerDoubt: (doubtId: ID, body: string) => {
    const d = doubts.find((x) => x.id === doubtId);
    if (!d) return null;
    const a: DoubtAnswer = {
      id: randomUUID(),
      doubtId,
      body,
      authorName: me.displayName,
      authorAvatar: me.avatarUrl,
      upvotes: 1,
      accepted: false,
      createdAt: now(),
      mineUpvoted: true,
    };
    d.answers.push(a);
    activity.unshift({
      id: randomUUID(),
      kind: "doubt_answered",
      title: `Answered: ${d.title}`,
      subtitle: `Earned ${Math.round(d.bountyXp / 4)} XP for the contribution`,
      createdAt: now(),
    });
    return a;
  },
  upvoteAnswer: (answerId: ID) => {
    for (const d of doubts) {
      const a = d.answers.find((x) => x.id === answerId);
      if (a) {
        if (a.mineUpvoted) {
          a.upvotes -= 1;
          a.mineUpvoted = false;
        } else {
          a.upvotes += 1;
          a.mineUpvoted = true;
        }
        return a;
      }
    }
    return null;
  },

  // PODS
  listPods: () => pods.map(({ members, ...rest }) => ({ ...rest, memberCount: members.length })),
  getPod: (id: ID) => {
    const p = pods.find((x) => x.id === id);
    if (!p) return null;
    return { ...p, memberCount: p.members.length };
  },

  // RESOURCES
  listResources: () => [...resources].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
  createResource: (input: { title: string; kind: Resource["kind"]; tag: string }) => {
    const r: Resource = {
      id: randomUUID(),
      title: input.title,
      kind: input.kind,
      circleName: "GATE CSE 2026",
      addedBy: me.displayName,
      sizeKb: input.kind === "link" ? 0 : 1200 + Math.floor(Math.random() * 4000),
      downloads: 0,
      createdAt: now(),
      tag: input.tag,
    };
    resources.unshift(r);
    return r;
  },

  // REVISION GAMIFICATION
  getRevisionStats: () => {
    return {
      heatmap: [0, 1, 3, 2, 0, 5, 4, 3, 2, 1, 4, 5, 3, 2],
      currentStreak: 12,
      overallRetention: 84
    };
  },
  getCommunityDecks: () => {
    return [
      { id: "1", title: "Data Structures Basics", author: "@Alex", saves: 45 },
      { id: "2", title: "Operating Systems 101", author: "@Sarah", saves: 32 },
      { id: "3", title: "Computer Networks", author: "@David", saves: 28 }
    ];
  },
  getRevisionLeaderboard: () => {
    return [
      { id: "1", name: "Sarah M.", cards: 142, avatar: "SM" },
      { id: "2", name: "You", cards: 85, avatar: "Y" },
      { id: "3", name: "Alex K.", cards: 64, avatar: "AK" }
    ];
  },

  // REVISION
  listRevision: () => {
    const oneDay = 86_400_000;
    const labelFor = (d: Date): string => {
      const diff = d.getTime() - Date.now();
      if (diff < 0) return "Overdue";
      if (diff < oneDay) return "Due today";
      if (diff < 2 * oneDay) return "Due tomorrow";
      return `In ${Math.round(diff / oneDay)} days`;
    };
    return [...revisionItems]
      .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())
      .map((r) => ({ ...r, dueLabel: labelFor(r.dueAt) }));
  },
  createRevision: (input: { topic: string; subject: string; front: string; back: string }) => {
    const r: RevisionItem = {
      id: randomUUID(),
      topic: input.topic,
      subject: input.subject,
      front: input.front,
      back: input.back,
      lastReviewedAt: now(),
      dueAt: daysAhead(1),
      intervalDays: 1,
      easeFactor: 2.5,
      masteryPct: 30,
    };
    revisionItems.unshift(r);
    return { ...r, dueLabel: "Due tomorrow" };
  },
  reviewRevision: (id: ID, quality: "again" | "hard" | "good" | "easy") => {
    const r = revisionItems.find((x) => x.id === id);
    if (!r) return null;
    const adjust = { again: -0.3, hard: -0.1, good: 0.05, easy: 0.15 }[quality];
    r.easeFactor = Math.max(1.3, Math.min(3.0, r.easeFactor + adjust));
    if (quality === "again") {
      r.intervalDays = 1;
      r.masteryPct = Math.max(10, r.masteryPct - 15);
    } else {
      r.intervalDays = Math.round(r.intervalDays * r.easeFactor);
      r.masteryPct = Math.min(100, r.masteryPct + (quality === "easy" ? 12 : quality === "good" ? 7 : 3));
    }
    r.lastReviewedAt = now();
    r.dueAt = daysAhead(r.intervalDays);
    const oneDay = 86_400_000;
    const diff = r.dueAt.getTime() - Date.now();
    const dueLabel = diff < oneDay ? "Due today" : diff < 2 * oneDay ? "Due tomorrow" : `In ${Math.round(diff / oneDay)} days`;
    return { ...r, dueLabel };
  },

  // CALENDAR
  listCalendar: () =>
    [...calendarEvents].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()),
  createCalendar: (input: { title: string; kind: CalendarEvent["kind"]; startsAt: Date; endsAt: Date; circleName?: string }) => {
    const colorMap: Record<CalendarEvent["kind"], string> = {
      "mock-test": "#7C3AED",
      "group-study": "#06B6D4",
      "mentor-class": "#F59E0B",
      revision: "#3B82F6",
      deadline: "#EF4444",
    };
    const e: CalendarEvent = {
      id: randomUUID(),
      title: input.title,
      kind: input.kind,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      circleName: input.circleName ?? "Personal",
      color: colorMap[input.kind],
    };
    calendarEvents.push(e);
    return e;
  },

  // ACHIEVEMENTS
  listAchievements: () => achievements,
};
