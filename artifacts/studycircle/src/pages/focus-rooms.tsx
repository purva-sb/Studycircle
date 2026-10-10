import { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/clerk-react";
import { useAuth } from "@clerk/clerk-react";
import { useGetMe } from "@workspace/api-client-react";
import { profileQueryOptions } from "@/lib/query-client";
import {
  useListFocusRooms,
  useCreateFocusRoom,
  useJoinFocusRoom,
  getListFocusRoomsQueryKey,
  useListStudySessions,
  useListCircles,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MonitorPlay, Search, Plus, MicOff, Mic, Video, Users, Clock, Lock, Globe, ChevronRight, ChevronLeft, Music, Play, Flame, Zap, Radio } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FocusRoomMode, CreateFocusRoomInput } from "@workspace/api-client-react";
import { io } from "socket.io-client";

const createRoomSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").max(50),
  description: z.string().max(100),
  exam: z.string().min(2, "Exam tag is required"),
  mode: z.enum(['silent', 'voice', 'video'] as const),
  maxParticipants: z.coerce.number().min(2).max(50),
  isPrivate: z.boolean(),
  linkedCircleId: z.string().optional(),
});

interface LiveRoomParticipant {
  userId: string;
  displayName: string;
  avatarUrl: string;
  status: string;
  totalStudySeconds: number;
}
interface LiveRoom {
  roomId: string;
  roomName: string;
  accentColor: string;
  exam: string;
  participants: LiveRoomParticipant[];
}

export default function FocusRooms() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const { data: me } = useGetMe({ query: profileQueryOptions });
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { data: rooms, isLoading } = useListFocusRooms();
  const createRoom = useCreateFocusRoom();
  const joinRoom = useJoinFocusRoom();
  const { data: myCircles } = useListCircles();
  const joinedCircles = (myCircles ?? []).filter((c: any) => c.joined);
  const liveScrollRef = useRef<HTMLDivElement>(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [liveRooms, setLiveRooms] = useState<LiveRoom[]>([]);

  useEffect(() => {
    let socket: any = null;
    const connect = async () => {
      const token = await getToken();
      if (!token) return;
      socket = io(window.location.origin, { path: "/socket.io", auth: { token }, transports: ["websocket"] });
      socket.on("connect", () => socket.emit("global:subscribe_rooms"));
      socket.on("global:rooms_activity", ({ rooms: active }: { rooms: LiveRoom[] }) => {
        setLiveRooms(active);
      });
    };
    connect();
    return () => { socket?.disconnect(); };
  }, [getToken]);

  const form = useForm<z.infer<typeof createRoomSchema>>({
    resolver: zodResolver(createRoomSchema),
    defaultValues: {
      name: "",
      description: "",
      exam: "",
      mode: "silent",
      maxParticipants: 10,
      isPrivate: false,
      linkedCircleId: undefined,
    }
  });

  const { data: studySessions } = useListStudySessions();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  
  const todayMinutes = studySessions
    ? studySessions.filter((s: any) => new Date(s.createdAt || s.startedAt) >= todayStart)
        .reduce((acc: number, cur: any) => acc + (cur.durationMinutes || 0), 0)
    : 0;

  const todayHoursStr = `${Math.floor(todayMinutes / 60)}h ${todayMinutes % 60}m`;
  const streak = me?.streakDays ?? 0;

  const onSubmit = (data: z.infer<typeof createRoomSchema>) => {
    const body: CreateFocusRoomInput = {
      ...data,
      hostId: user?.id ?? "local-user",
      hostName: user?.fullName ?? user?.username ?? "Anonymous",
      hostAvatar: user?.imageUrl ?? `https://api.dicebear.com/7.x/initials/svg?fontFamily=Inter,sans-serif&fontSize=40&seed=${encodeURIComponent(user?.fullName ?? "A")}`,
    };
    createRoom.mutate({ data: body }, {
      onSuccess: (room) => {
        toast.success("Focus room created!");
        setIsDialogOpen(false);
        queryClient.invalidateQueries({ queryKey: getListFocusRoomsQueryKey() });
        setLocation(`/focus-rooms/${room.id}`);
      }
    });
  };

  const handleJoin = (id: string) => {
    joinRoom.mutate({ 
      id,
      data: {
        displayName: user?.fullName ?? user?.username ?? "Anonymous",
        avatarUrl: user?.imageUrl ?? `https://api.dicebear.com/7.x/initials/svg?fontFamily=Inter,sans-serif&fontSize=40&seed=${encodeURIComponent(user?.fullName ?? "A")}`
      }
    }, {
      onSuccess: () => {
        setLocation(`/focus-rooms/${id}`);
      },
      onError: (err: Error) => {
        toast.error(err?.message ?? "Could not join this focus room");
      },
    });
  };

  const filteredRooms = rooms?.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.exam.toLowerCase().includes(search.toLowerCase())
  );

  const handleStartGroupStudy = () => {
    // Priority 1: room with the most live (socket-connected) participants
    if (liveRooms.length > 0) {
      const best = [...liveRooms].sort((a, b) => b.participants.length - a.participants.length)[0];
      toast.success(`Joining ${best.roomName} — ${best.participants.length} people live 🔥`);
      handleJoin(best.roomId);
      return;
    }
    // Priority 2: room with the most total members
    if (rooms && rooms.length > 0) {
      const best = [...rooms].sort((a, b) => (b.participantCount ?? 0) - (a.participantCount ?? 0))[0];
      toast(`Joining ${best.name} — biggest group 👥`);
      handleJoin(best.id);
      return;
    }
    // No rooms yet — scroll down so user can create one
    document.getElementById("explore-rooms")?.scrollIntoView({ behavior: "smooth" });
  };

  const getModeIcon = (mode: FocusRoomMode) => {
    switch (mode) {
      case 'silent': return <MicOff className="w-3.5 h-3.5" />;
      case 'voice': return <Mic className="w-3.5 h-3.5" />;
      case 'video': return <Video className="w-3.5 h-3.5" />;
      default: return <MicOff className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto min-h-screen pb-12 flex flex-col gap-8 animate-in fade-in duration-500">
      
      {/* ── Top Section: Dashboard Header & Timer ── */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Focus Rooms Dashboard</h1>
          
          <div className="flex items-center gap-3">
            <div className="relative w-64 hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search rooms..."
                className="pl-9 bg-muted/50 border-border text-sm h-10 rounded-xl focus-visible:ring-indigo-500/50"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="h-10 rounded-xl bg-muted hover:bg-muted/80 text-foreground border border-border">
                  <Plus className="h-4 w-4 mr-2" /> New Room
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Create Focus Room</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem><FormLabel>Room Name</FormLabel><FormControl><Input className="bg-muted border-border" placeholder="E.g. Midnight Grinders" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="description" render={({ field }) => (
                      <FormItem><FormLabel>Description (Optional)</FormLabel><FormControl><Input className="bg-muted border-border" placeholder="Topic or goals..." {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="exam" render={({ field }) => (
                        <FormItem><FormLabel>Target Exam</FormLabel><FormControl><Input className="bg-muted border-border" placeholder="E.g. GATE" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="maxParticipants" render={({ field }) => (
                        <FormItem><FormLabel>Max Users</FormLabel><FormControl><Input className="bg-muted border-border" type="number" min={2} max={50} {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>
                    <FormField control={form.control} name="mode" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Room Mode</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-muted border-border"><SelectValue placeholder="Select mode" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="silent"><div className="flex items-center gap-2"><MicOff className="w-4 h-4"/> Silent Study</div></SelectItem>
                            <SelectItem value="voice" disabled><div className="flex items-center gap-2 w-full"><Mic className="w-4 h-4"/> Voice Chat <span className="ml-auto text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-semibold">Soon</span></div></SelectItem>
                            <SelectItem value="video" disabled><div className="flex items-center gap-2 w-full"><Video className="w-4 h-4"/> Video/Cam on <span className="ml-auto text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-semibold">Soon</span></div></SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    {joinedCircles.length > 0 && (
                      <FormField control={form.control} name="linkedCircleId" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Link to a Circle <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                          <Select onValueChange={(v) => field.onChange(v === "none" ? undefined : v)} value={field.value ?? "none"}>
                            <FormControl>
                              <SelectTrigger className="bg-muted border-border"><SelectValue placeholder="None" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {joinedCircles.map((c: any) => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    )}
                    <FormField control={form.control} name="isPrivate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Visibility</FormLabel>
                        <div className="flex gap-2">
                          <Button type="button" variant={!field.value ? "default" : "outline"} size="sm" className="flex-1 gap-1.5 border-border" onClick={() => field.onChange(false)}>
                            <Globe className="w-3.5 h-3.5" /> Public
                          </Button>
                          <Button type="button" variant={field.value ? "default" : "outline"} size="sm" className="flex-1 gap-1.5 border-border" onClick={() => field.onChange(true)}>
                            <Lock className="w-3.5 h-3.5" /> Private
                          </Button>
                        </div>
                      </FormItem>
                    )} />
                    <DialogFooter className="pt-4">
                      <Button type="submit" disabled={createRoom.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white w-full">
                        {createRoom.isPending ? "Creating..." : "Start Room"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Personal Hub */}
        <div className="w-full relative rounded-3xl overflow-hidden p-8 sm:p-12 bg-[#0d0d18] border border-indigo-500/20 shadow-[0_0_80px_rgba(99,102,241,0.1)] flex flex-col md:flex-row items-center justify-between gap-12">
          {/* Subtle background glow */}
          <div className="absolute top-1/2 left-0 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
          
          <div className="relative z-10 flex-1 flex flex-col items-center md:items-start text-center md:text-left">
            <span className="text-zinc-400 font-medium tracking-widest uppercase text-xs mb-3 flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-indigo-400" /> Personal Hub
            </span>
            <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight mb-2">
              Ready to focus, {me?.displayName?.split(" ")[0] || user?.firstName || 'Student'}?
            </h2>
            <p className="text-zinc-400 mb-8 max-w-md">
              Dive into your deep work zone. No distractions, just you and your goals. Time tracked here adds to your global stats.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
              <Link href="/timer?mode=stopwatch" className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto h-14 px-8 rounded-2xl text-base font-bold shadow-xl shadow-indigo-500/25 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white border-0 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2">
                  <Clock className="w-5 h-5" /> Start Solo Study
                </Button>
              </Link>
              <Button
                variant="outline"
                onClick={handleStartGroupStudy}
                disabled={joinRoom.isPending}
                className="w-full sm:w-auto h-14 px-8 rounded-2xl bg-zinc-900/50 border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
              >
                {liveRooms.length > 0
                  ? <><Radio className="w-5 h-5 text-emerald-400" /> Join Most Active</>
                  : <><Users className="w-5 h-5" /> Start Group Study</>
                }
              </Button>
            </div>
          </div>

          {/* Stats Card */}
          <div className="relative z-10 shrink-0 w-full md:w-64 flex flex-col gap-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
              <div className="flex items-center gap-3 text-zinc-400 font-medium text-sm mb-2">
                <Clock className="w-4 h-4 text-purple-400" /> Today's Total
              </div>
              <div className="text-3xl font-black text-white tabular-nums tracking-tighter">
                {todayHoursStr}
              </div>
            </div>
            
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
              <div className="flex items-center gap-3 text-zinc-400 font-medium text-sm mb-2">
                <Flame className="w-4 h-4 text-orange-400" /> Current Streak
              </div>
              <div className="text-3xl font-black text-white tabular-nums tracking-tighter">
                {streak} Days
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Live Now Section ── */}
      {liveRooms.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            <h2 className="text-lg font-bold text-foreground">Live Now</h2>
            <span className="text-xs text-emerald-400 font-semibold bg-emerald-400/10 px-2 py-0.5 rounded-full">
              {liveRooms.reduce((s, r) => s + r.participants.length, 0)} studying
            </span>
          </div>
          <div
            ref={liveScrollRef}
            className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory"
            style={{ scrollbarWidth: "none" }}
          >
            {liveRooms.map((lr) => {
              const topStudier = [...lr.participants].sort((a, b) => b.totalStudySeconds - a.totalStudySeconds)[0];
              const formatHM = (s: number) => {
                const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
                return h > 0 ? `${h}h ${m}m` : `${m}m`;
              };
              return (
                <div
                  key={lr.roomId}
                  onClick={() => handleJoin(lr.roomId)}
                  className="snap-start shrink-0 w-60 cursor-pointer rounded-xl overflow-hidden bg-card border border-border hover:border-indigo-500/40 transition-all hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <div className="h-1 w-full" style={{ background: lr.accentColor || "#6366f1" }} />
                  <div className="p-4 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-foreground truncate">{lr.roomName}</span>
                      <span className="shrink-0 text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        {lr.participants.length} live
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-2.5">
                        {lr.participants.slice(0, 5).map((p, i) => (
                          <Avatar key={i} className="w-7 h-7 border-2 border-card">
                            <AvatarImage src={p.avatarUrl} />
                            <AvatarFallback className="bg-muted text-[10px] text-foreground">{p.displayName.substring(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                        ))}
                        {lr.participants.length > 5 && (
                          <div className="w-7 h-7 rounded-full border-2 border-card bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">+{lr.participants.length - 5}</div>
                        )}
                      </div>
                    </div>
                    {topStudier && (
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <span>🏆</span>
                        <span className="truncate">{topStudier.displayName}</span>
                        <span className="text-primary font-bold ml-auto shrink-0">{formatHM(topStudier.totalStudySeconds)}</span>
                      </div>
                    )}
                    <div className="text-[10px] font-semibold" style={{ color: lr.accentColor || "#6366f1" }}>{lr.exam}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Bottom Section: Explore Rooms ── */}
      <div id="explore-rooms" className="flex flex-col gap-6 mt-4 scroll-mt-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Explore Focus Rooms</h2>
            <p className="text-muted-foreground text-sm mt-1">Dynamic, interactive focus room cards.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="icon" variant="outline" className="w-8 h-8 rounded-full border-border bg-muted text-muted-foreground"><ChevronLeft className="w-4 h-4" /></Button>
            <Button size="icon" variant="outline" className="w-8 h-8 rounded-full border-border bg-muted text-muted-foreground"><ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-64 rounded-3xl" />)}
          </div>
        ) : filteredRooms && filteredRooms.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredRooms.map(room => {
              const hasActiveUsers = room.activeUsers && room.activeUsers.length > 0;
              const accent = room.accentColor || '#6366f1';

              return (
                <Card
                  key={room.id}
                  onClick={() => handleJoin(room.id)}
                  className="group cursor-pointer overflow-hidden relative bg-card border-border hover:border-indigo-500/50 transition-all duration-300 rounded-3xl h-64 flex flex-col hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-500/10"
                >
                  {/* Accent gradient wash — subtle in light, vivid in dark */}
                  <div
                    className="absolute top-0 left-0 w-full h-32 opacity-[0.15] dark:opacity-25 group-hover:opacity-[0.22] dark:group-hover:opacity-30 transition-opacity duration-500 pointer-events-none"
                    style={{ background: `linear-gradient(to bottom, ${accent}, transparent)` }}
                  />

                  <CardContent className="p-6 flex flex-col h-full relative z-10">
                    {/* Header: icon + name */}
                    <div className="flex items-start gap-4 mb-4">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner"
                        style={{ background: `${accent}22`, border: `1px solid ${accent}44` }}
                      >
                        <span className="text-sm font-black leading-none" style={{ color: accent }}>
                          {room.exam?.substring(0, 3).toUpperCase() || "??"}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-lg leading-tight text-foreground line-clamp-1 mb-1">{room.name}</h3>
                        <p className="text-xs font-medium text-muted-foreground line-clamp-1">{room.description || "Deep focus session"}</p>
                      </div>
                    </div>

                    {/* Active Avatars */}
                    <div className="flex -space-x-3 mb-4 mt-1">
                      {hasActiveUsers ? (
                        room.activeUsers!.slice(0, 5).map((u, i) => (
                          <Avatar key={i} className="w-9 h-9 border-2 border-card shadow-sm">
                            <AvatarImage src={u.avatarUrl} />
                            <AvatarFallback className="bg-muted text-xs text-foreground">
                              {u.displayName?.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        ))
                      ) : (
                        <div className="w-9 h-9 rounded-full border-2 border-card bg-muted flex items-center justify-center text-muted-foreground shadow-sm">
                          <Users className="w-4 h-4" />
                        </div>
                      )}
                      {room.participantCount > (room.activeUsers?.length || 0) && (
                        <div className="w-9 h-9 rounded-full border-2 border-card bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shadow-sm z-10">
                          +{room.participantCount - (room.activeUsers?.length || 0)}
                        </div>
                      )}
                    </div>

                    {/* Bottom: member count + tags */}
                    <div className="mt-auto">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium text-muted-foreground">
                          <span className="text-foreground font-semibold">{room.participantCount}</span> member{room.participantCount !== 1 ? "s" : ""}
                        </span>
                        {room.isLive && (
                          <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 bg-emerald-400/10 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {room.exam && (
                          <div className="px-3 py-1.5 rounded-xl bg-muted border border-border text-[11px] font-semibold text-muted-foreground">
                            {room.exam}
                          </div>
                        )}
                        <div className="px-3 py-1.5 rounded-xl bg-muted border border-border text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                          {getModeIcon(room.mode)} {room.mode}
                        </div>
                        {room.isPrivate && (
                          <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] font-semibold text-amber-500 flex items-center gap-1">
                            <Lock className="w-3 h-3" /> Private
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="w-full py-24 flex flex-col items-center justify-center border border-dashed border-border rounded-3xl bg-muted/20">
            <MonitorPlay className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-xl font-bold text-foreground mb-1">No live rooms found</h3>
            <p className="text-muted-foreground">Create the first room and invite others!</p>
          </div>
        )}
      </div>
    </div>
  );
}
