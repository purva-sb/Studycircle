import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Shield, MessageSquare, Loader2, UserPlus, Check, Clock, UserMinus, Activity } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { resolveAvatarUrl } from "@/lib/avatars";

interface UserProfilePopoverProps {
  userId: string;
  trigger: React.ReactNode;
  onMessage?: (conversationId: string) => void;
}

export function UserProfilePopover({ userId, trigger, onMessage }: UserProfilePopoverProps) {
  const [isOpen, setIsOpen] = useState(false);

  // We only fetch when the popover is opened
  const { data: profile, isLoading } = useQuery({
    queryKey: ["userProfile", userId],
    queryFn: async () => {
      const data: any = await customFetch(`/api/users/${userId}/profile`);
      return data;
    },
    enabled: isOpen,
    staleTime: 60000,
  });

  const queryClient = useQueryClient();
  const connectMutation = useMutation({
    mutationFn: async () => customFetch(`/api/connections/${userId}`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Connection request sent!");
      queryClient.invalidateQueries({ queryKey: ["userProfile", userId] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to connect"),
  });

  const startDmMutation = useMutation({
    mutationFn: async () => {
      const res: any = await customFetch(`/api/dms/user/${userId}`, { method: "POST" });
      return res.conversation;
    },
    onSuccess: (conv) => {
      setIsOpen(false);
      if (onMessage) onMessage(conv.id);
    },
    onError: (err: any) => toast.error(err.message || "Failed to start conversation"),
  });

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {trigger}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 border-border/50 shadow-2xl rounded-xl overflow-hidden" align="start" sideOffset={8}>
        {/* Banner Area */}
        <div className="h-20 bg-gradient-to-r from-violet-600/80 to-fuchsia-600/80 relative">
          <div className="absolute -bottom-10 left-4 rounded-full border-4 border-background bg-background">
            {(() => {
              // Calculate Aura
              let auraClass = "";
              if (profile?.activeAuraId) {
                auraClass = profile.activeAuraId;
              } else if (profile?.dailyStudyMinutes !== undefined) {
                const hours = profile.dailyStudyMinutes / 60;
                if (hours >= 10) auraClass = "aura-legend";
                else if (hours >= 9) auraClass = "aura-tier-4";
                else if (hours >= 5) auraClass = "aura-tier-3";
                else if (hours >= 3) auraClass = "aura-tier-2";
                else if (hours > 0) auraClass = "aura-tier-1";
              }

              return (
                <Avatar className={`w-20 h-20 ${auraClass ? `border-2 ${auraClass}` : ''}`}>
                  <AvatarImage src={resolveAvatarUrl(profile?.activeAvatarId, profile?.avatarUrl)} />
                  <AvatarFallback className="text-2xl">{profile?.displayName?.substring(0, 2) || "U"}</AvatarFallback>
                </Avatar>
              );
            })()}
            <div className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-500 border-2 border-background rounded-full" />
          </div>
        </div>

        <div className="pt-12 px-4 pb-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mb-2" />
              <p className="text-xs">Loading profile...</p>
            </div>
          ) : !profile ? (
            <div className="text-center py-4 text-sm text-muted-foreground">Profile not found</div>
          ) : (
            <>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-xl">{profile.displayName}</h3>
                  <p className="text-sm text-muted-foreground">{profile.username || `@${profile.handle}`}</p>
                </div>
                {/* Badges */}
                <div className="flex gap-1">
                  {profile.plan === "pro" && (
                    <div className="w-6 h-6 rounded-md bg-violet-500/10 flex items-center justify-center text-violet-500" title="Pro Member">
                      <Shield className="w-3.5 h-3.5" />
                    </div>
                  )}
                  {profile.monthlyRankTitle && (
                    <div className="px-2 h-6 rounded-md bg-amber-500/10 flex items-center justify-center text-amber-500 text-xs font-bold" title="Monthly Legend">
                      {profile.monthlyRankTitle}
                    </div>
                  )}
                  {profile.weeklyRankTitle && (
                    <div className="px-2 h-6 rounded-md bg-fuchsia-500/10 flex items-center justify-center text-fuchsia-500 text-xs font-bold" title="Weekly Champion">
                      {profile.weeklyRankTitle}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="h-px bg-border/50 w-full" />

                <div>
                  <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Member Since</h4>
                  <p className="text-sm">{profile.createdAt ? format(new Date(profile.createdAt), "MMM d, yyyy") : "Unknown"}</p>
                </div>

                {profile.about && (
                  <div>
                    <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">About Me</h4>
                    <p className="text-sm text-foreground/90 whitespace-pre-wrap">{profile.about}</p>
                  </div>
                )}
                
                <div className="flex gap-4">
                  <div>
                    <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Followers</h4>
                    <p className="text-lg font-bold">{profile._count?.followers || 0}</p>
                  </div>
                  <div>
                    <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Following</h4>
                    <p className="text-lg font-bold">{profile._count?.following || 0}</p>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  {!profile.connectionStatus && (
                    <Button 
                      className="flex-1 bg-violet-600 hover:bg-violet-500 text-white" 
                      onClick={() => connectMutation.mutate()} 
                      disabled={connectMutation.isPending}
                    >
                      <UserPlus className="w-4 h-4 mr-2" />
                      Connect
                    </Button>
                  )}
                  {profile.connectionStatus === "pending" && (
                    <Button className="flex-1 bg-muted text-muted-foreground" disabled>
                      <Clock className="w-4 h-4 mr-2" />
                      Pending
                    </Button>
                  )}
                  {profile.connectionStatus === "accepted" && onMessage && (
                    <Button 
                      className="flex-1 bg-violet-600 hover:bg-violet-500 text-white" 
                      onClick={() => startDmMutation.mutate()}
                      disabled={startDmMutation.isPending}
                    >
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Message
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
