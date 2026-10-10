import { useState } from "react";
import { useListCircles, useCreateCircle, useDiscoverCircles, useJoinCircle, getListCirclesQueryKey, getDiscoverCirclesQueryKey, customFetch } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Users, Lock, Unlock, Plus, Hash, MessageSquare, Wifi, Compass, LogIn, Link2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { slowDataQueryOptions } from "@/lib/query-client";

export default function Circles() {
  const queryClient = useQueryClient();
  const { data: myCircles, isLoading } = useListCircles({ query: slowDataQueryOptions });
  const { data: discoverCircles, isLoading: loadingDiscover } = useDiscoverCircles({ query: slowDataQueryOptions });
  const createCircle = useCreateCircle();
  const joinCircle = useJoinCircle();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [exam, setExam] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [activeTab, setActiveTab] = useState<"my" | "discover">("my");

  const onSubmit = () => {
    if (!name || !description || !exam) return;
    createCircle.mutate({ data: { name, description, exam, isPrivate } }, {
      onSuccess: () => {
        toast.success("Circle created!");
        setIsDialogOpen(false);
        setName(""); setDescription(""); setExam("");
        queryClient.invalidateQueries({ queryKey: getListCirclesQueryKey() });
      }
    });
  };

  const handleJoin = (circleId: string, circleName: string) => {
    joinCircle.mutate({ id: circleId }, {
      onSuccess: () => {
        toast.success(`Joined ${circleName}!`);
        queryClient.invalidateQueries({ queryKey: getListCirclesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getDiscoverCirclesQueryKey() });
      },
      onError: () => {
        toast.error("Failed to join circle");
      }
    });
  };

  const handleInvite = async (circleId: string, e: React.MouseEvent) => {
    e.preventDefault();
    try {
      const data: any = await customFetch(`/api/circles/${circleId}/invites`, { method: "POST" });
      const fullUrl = `${window.location.origin}/invite/${data.code}`;
      
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(fullUrl);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = fullUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        textArea.remove();
      }
      
      toast.success("Invite link copied! Share it with friends 🔗", { duration: 4000 });
    } catch (err: any) {
      toast.error(err?.message || "Failed to create invite link");
    }
  };

  const CircleCard = ({ circle, showJoin = false }: { circle: any; showJoin?: boolean }) =>
    <div>
      <Card className="overflow-hidden border-white/10 hover:border-violet-500/40 transition-all group h-full">
        <div className="h-20 w-full relative" style={{ background: `linear-gradient(135deg, ${circle.coverColor}88, ${circle.coverColor}33)` }}>
          <div className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-sm px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1">
            <Users className="w-3 h-3 text-violet-400" />
            {circle.memberCount} members
          </div>
          {circle.isPrivate && (
            <div className="absolute top-2 left-2 bg-background/80 backdrop-blur-sm p-1.5 rounded-md">
              <Lock className="w-3 h-3 text-amber-500" />
            </div>
          )}
        </div>
        <CardContent className="p-5">
          <div className="flex justify-between items-start mb-2">
            <h3 className="font-bold text-lg group-hover:text-violet-400 transition-colors">{circle.name}</h3>
          </div>
          <Badge variant="secondary" className="mb-3">{circle.exam}</Badge>
          <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{circle.description}</p>
          
          {showJoin && !circle.joined ? (
            <Button 
              onClick={() => handleJoin(circle.id, circle.name)} 
              disabled={joinCircle.isPending}
              className="w-full gap-2 bg-gradient-to-r from-violet-600 to-blue-600 border-0 hover:from-violet-500 hover:to-blue-500"
            >
              <LogIn className="w-4 h-4" />
              {joinCircle.isPending ? "Joining..." : "Join Circle"}
            </Button>
          ) : circle.joined ? (
            <div className="flex gap-2">
              <Link href={`/circles/${circle.id}`} className="flex-1">
                <Button variant="outline" className="w-full gap-2 border-violet-500/30 hover:bg-violet-500/10 hover:text-violet-400">
                  <MessageSquare className="w-4 h-4" />
                  Open Circle
                </Button>
              </Link>
              <Button variant="outline" className="w-10 px-0 shrink-0 border-violet-500/30 hover:bg-violet-500/10 hover:text-violet-400" onClick={(e) => handleInvite(circle.id, e)} title="Copy invite link">
                <Link2 className="w-4 h-4" />
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Study Circles</h2>
          <p className="text-muted-foreground text-sm mt-1">Your Discord-style study communities</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-gradient-to-r from-violet-600 to-blue-600 border-0"><Plus className="h-4 w-4" /> Create Circle</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create a Study Circle</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <Input placeholder="Circle name (e.g. GATE 2025 Warriors)" value={name} onChange={e => setName(e.target.value)} />
              <Textarea placeholder="What is this circle about?" value={description} onChange={e => setDescription(e.target.value)} />
              <Input placeholder="Target Exam (e.g. GATE)" value={exam} onChange={e => setExam(e.target.value)} />
              <label className="flex items-center justify-between border rounded-lg p-3 cursor-pointer">
                <div>
                  <span className="text-sm font-medium">Private Circle</span>
                  <p className="text-xs text-muted-foreground">Only visible to members with invite link</p>
                </div>
                <input type="checkbox" checked={isPrivate} onChange={e => setIsPrivate(e.target.checked)} className="accent-violet-600 w-4 h-4" />
              </label>
            </div>
            <DialogFooter>
              <Button onClick={onSubmit} disabled={createCircle.isPending}>{createCircle.isPending ? "Creating..." : "Create Circle"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs: My Circles / Discover */}
      <div className="flex gap-1 bg-muted/30 p-1 rounded-lg w-fit">
        <button 
          onClick={() => setActiveTab("my")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === "my" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Hash className="w-4 h-4 inline mr-1.5" />
          My Circles ({myCircles?.length || 0})
        </button>
        <button 
          onClick={() => setActiveTab("discover")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === "discover" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Compass className="w-4 h-4 inline mr-1.5" />
          Discover
        </button>
      </div>

      {activeTab === "my" ? (
        <>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1,2,3].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
            </div>
          ) : myCircles && myCircles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myCircles.map((circle) => (
                <CircleCard key={circle.id} circle={{ ...circle, joined: true }} />
              ))}
            </div>
          ) : (
            <Card className="flex flex-col items-center justify-center p-16 border-dashed border-white/10">
              <div className="w-16 h-16 rounded-2xl bg-violet-600/20 flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-violet-400" />
              </div>
              <h3 className="text-lg font-bold mb-1">No circles yet</h3>
              <p className="text-muted-foreground mb-4 text-center">Create your first study circle or discover existing ones!</p>
              <div className="flex gap-3">
                <Button onClick={() => setIsDialogOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> Create Circle</Button>
                <Button variant="outline" onClick={() => setActiveTab("discover")} className="gap-2"><Compass className="h-4 w-4" /> Discover</Button>
              </div>
            </Card>
          )}
        </>
      ) : (
        <>
          {loadingDiscover ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1,2,3].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
            </div>
          ) : discoverCircles && discoverCircles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {discoverCircles.map((circle) => (
                <CircleCard key={circle.id} circle={circle} showJoin={true} />
              ))}
            </div>
          ) : (
            <Card className="flex flex-col items-center justify-center p-16 border-dashed border-white/10">
              <div className="w-16 h-16 rounded-2xl bg-blue-600/20 flex items-center justify-center mb-4">
                <Compass className="w-8 h-8 text-blue-400" />
              </div>
              <h3 className="text-lg font-bold mb-1">No circles to discover</h3>
              <p className="text-muted-foreground mb-4 text-center">Be the first to create a study circle for your exam!</p>
              <Button onClick={() => { setIsDialogOpen(true); setActiveTab("my"); }} className="gap-2"><Plus className="h-4 w-4" /> Create Circle</Button>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
