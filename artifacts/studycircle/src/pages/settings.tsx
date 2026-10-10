import { useGetMe } from "@workspace/api-client-react";
import { customFetch } from "@workspace/api-client-react";
import { useUser } from "@clerk/clerk-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Moon, Sun, CheckCircle2, Crown, Sparkles, HelpCircle } from "lucide-react";
import { useTour } from "@/hooks/use-tour";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { AVATARS } from "@/lib/avatars";

const AURA_OPTIONS = [
  {
    id: null,
    name: "Dynamic Heat",
    desc: "Aura changes based on daily study hours automatically",
    preview: "",
    gradient: "from-violet-500/20 to-fuchsia-500/20",
    border: "border-violet-500/30",
  },
  {
    id: "aura-tier-1",
    name: "Cyan Pulse",
    desc: "Calm cyan glow — for consistent studiers",
    preview: "aura-tier-1",
    gradient: "from-cyan-500/20 to-teal-500/20",
    border: "border-cyan-500/50",
  },
  {
    id: "aura-tier-2",
    name: "Purple Surge",
    desc: "Intense purple throb — power study mode",
    preview: "aura-tier-2",
    gradient: "from-purple-500/20 to-violet-500/20",
    border: "border-purple-500/50",
  },
  {
    id: "aura-tier-3",
    name: "Blaze Orange",
    desc: "Flickering fire — you're on a hot streak",
    preview: "aura-tier-3",
    gradient: "from-orange-500/20 to-red-500/20",
    border: "border-orange-500/50",
  },
  {
    id: "aura-tier-4",
    name: "Neon Pink",
    desc: "Electric pink neon — elite level grind",
    preview: "aura-tier-4",
    gradient: "from-pink-500/20 to-rose-500/20",
    border: "border-pink-500/50",
  },
  {
    id: "aura-legend",
    name: "Legendary Gold",
    desc: "Reserved for the absolute legends only",
    preview: "aura-legend",
    gradient: "from-yellow-500/20 to-amber-500/20",
    border: "border-yellow-500/50",
  },
];

export function CustomizationStoreModal({ profile }: { profile: any }) {
  const [open, setOpen] = useState(false);
  const [activeAura, setActiveAura] = useState<string | null>(profile?.activeAuraId ?? null);
  const [activeAvatar, setActiveAvatar] = useState<string | null>(profile?.activeAvatarId ?? null);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener("open-customization-store", handleOpen);
    return () => window.removeEventListener("open-customization-store", handleOpen);
  }, []);

  // Sync selection when profile loads
  useEffect(() => {
    setActiveAura(profile?.activeAuraId ?? null);
    setActiveAvatar(profile?.activeAvatarId ?? null);
  }, [profile?.activeAuraId, profile?.activeAvatarId]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await customFetch("/api/users/profile/customize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeAuraId: activeAura, activeAvatarId: activeAvatar }),
      });
      toast.success("Profile updated! Your new look is live. ✨");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["me"] });
    } catch {
      toast.error("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[640px] border-primary/20 bg-card/98 backdrop-blur-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-violet-500 to-fuchsia-500 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-fuchsia-500" />
            Pro Cosmetics Store
          </DialogTitle>
          <DialogDescription>
            Choose a permanent aura and avatar. As a PRO member, these override your default look everywhere.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 max-h-[60vh] overflow-y-auto pr-2 space-y-6">
          <div>
            <h3 className="font-bold text-sm text-zinc-400 uppercase tracking-widest mb-3">Premium Auras</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {AURA_OPTIONS.map((aura) => {
            const isSelected = activeAura === aura.id;
            return (
              <button
                key={aura.id ?? "none"}
                onClick={() => setActiveAura(aura.id)}
                className={cn(
                  "relative flex flex-col items-center gap-2.5 p-4 rounded-xl border-2 cursor-pointer transition-all text-left",
                  "bg-gradient-to-b",
                  aura.gradient,
                  isSelected
                    ? `${aura.border} shadow-lg ring-2 ring-primary/40`
                    : "border-border hover:border-primary/40 hover:scale-[1.02]"
                )}
              >
                {/* Avatar preview */}
                <div className={cn("rounded-full", aura.preview ? `p-[2px] border-2 ${aura.preview}` : "")}>
                  <Avatar className="w-14 h-14 border-2 border-background">
                    <AvatarImage src={profile?.avatarUrl} />
                    <AvatarFallback className="font-bold text-base">
                      {profile?.displayName?.substring(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                </div>

                <div className="text-center w-full">
                  <p className="font-bold text-sm leading-tight">{aura.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-1 leading-tight">{aura.desc}</p>
                </div>

                {isSelected && (
                  <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full p-0.5 shadow-md">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                )}
              </button>
            );
          })}
            </div>
          </div>

          <div>
            <h3 className="font-bold text-sm text-zinc-400 uppercase tracking-widest mb-3">Avatars</h3>

            <div className="grid grid-cols-5 gap-2">
              {AVATARS.map((avatar) => {
                const isSelected = activeAvatar === avatar.id;
                return (
                  <button
                    key={avatar.id}
                    onClick={() => setActiveAvatar(avatar.id)}
                    className={cn(
                      "relative aspect-square rounded-xl border-2 overflow-hidden transition-all",
                      isSelected
                        ? "border-indigo-500 ring-2 ring-indigo-500/30 scale-105"
                        : "border-white/10 hover:border-white/30"
                    )}
                  >
                    <img
                      src={avatar.url}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-cover bg-zinc-800"
                    />
                    {isSelected && (
                      <div className="absolute inset-0 bg-indigo-500/20 flex items-center justify-center">
                        <div className="w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center">
                          <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-zinc-500 mt-2">More avatars coming soon.</p>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white border-none shadow-lg shadow-violet-500/25"
          >
            {saving ? "Saving…" : "Equip Items"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Settings() {
  const { data: me, isLoading } = useGetMe();
  const { user } = useUser();
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const { startTour } = useTour({ autoStart: false });

  const displayName = user?.fullName || user?.primaryEmailAddress?.emailAddress?.split("@")[0] || me?.displayName;
  const googlePhotoUrl = user?.imageUrl || me?.avatarUrl;

  const [formName, setFormName] = useState(displayName || "");
  const [formUsername, setFormUsername] = useState(user?.username || displayName?.replace(/\s+/g, '').toLowerCase() || "");
  const [formExam, setFormExam] = useState((user?.unsafeMetadata?.examFocus as string) || me?.examFocus || "GATE CSE");
  const [dailyTarget, setDailyTarget] = useState(me?.dailyTargetMinutes ?? 120);
  const [savingTarget, setSavingTarget] = useState(false);
  const [disableDmCalls, setDisableDmCalls] = useState(localStorage.getItem("sc_disable_dm_calls") === "true");
  const [saving, setSaving] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(me?.activeAvatarId ?? null);
  const [savingAvatar, setSavingAvatar] = useState(false);

  useEffect(() => {
    if (me?.activeAvatarId !== undefined) setSelectedAvatarId(me.activeAvatarId ?? null);
  }, [me?.activeAvatarId]);

  // Sync form values when data loads
  useEffect(() => {
    if (displayName) setFormName(displayName);
  }, [displayName]);

  useEffect(() => {
    if (me?.dailyTargetMinutes) setDailyTarget(me.dailyTargetMinutes);
  }, [me?.dailyTargetMinutes]);

  const handleSaveDailyTarget = async (override?: number) => {
    const mins = override ?? Number(dailyTarget);
    if (!mins || mins < 15 || mins > 720) {
      toast.error("Daily target must be between 15 and 720 minutes.");
      return;
    }
    setDailyTarget(mins);
    setSavingTarget(true);
    try {
      await customFetch("/api/users/profile/customize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyTargetMinutes: mins }),
      });
      toast.success(`Daily target set to ${mins >= 60 ? `${mins / 60}h` : `${mins}m`}!`);
    } catch {
      toast.error("Failed to save. Please try again.");
    } finally {
      setSavingTarget(false);
    }
  };

  if (isLoading || !me) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-[200px] w-full rounded-xl" />
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
    );
  }

  const handleSaveAvatar = async (avatarId: string | null) => {
    setSelectedAvatarId(avatarId);
    setSavingAvatar(true);
    try {
      await customFetch("/api/users/profile/customize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeAvatarId: avatarId }),
      });
      queryClient.invalidateQueries({ queryKey: ["me"] });
      toast.success(avatarId ? "Cartoon avatar selected!" : "Using your Google photo.");
    } catch {
      toast.error("Failed to save avatar.");
    } finally {
      setSavingAvatar(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const updateData: any = {
        firstName: formName.split(" ")[0] || "",
        lastName: formName.split(" ").slice(1).join(" ") || "",
        unsafeMetadata: { ...user.unsafeMetadata, examFocus: formExam }
      };
      if (formUsername && formUsername !== user.username) {
        updateData.username = formUsername.replace("@", "");
      }
      await user.update(updateData);
      toast.success("Profile updated successfully!");
    } catch (err: any) {
      toast.error(err.errors?.[0]?.longMessage || err.errors?.[0]?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      await customFetch("/api/users/mock-upgrade", { method: "POST" });
      toast.success("🎉 Welcome to Pro! Unlocking your cosmetics…");
      setTimeout(() => window.location.reload(), 1200);
    } catch {
      toast.error("Failed to upgrade. Please try again.");
      setUpgrading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground mt-1">Manage your profile, preferences, and subscription.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Profile Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your personal details and public profile.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-6">
                {/* Avatar picker */}
                <div className="space-y-3 mb-6">
                  <Label>Profile Picture</Label>
                  <div className="flex flex-wrap gap-2">
                    {/* Google photo option */}
                    <button
                      type="button"
                      disabled={savingAvatar}
                      onClick={() => handleSaveAvatar(null)}
                      className={cn(
                        "relative rounded-full border-2 transition-all",
                        selectedAvatarId === null
                          ? "border-indigo-500 ring-2 ring-indigo-500/40 scale-105"
                          : "border-border hover:border-muted-foreground"
                      )}
                    >
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={googlePhotoUrl} />
                        <AvatarFallback className="text-xs">{displayName?.substring(0, 2)}</AvatarFallback>
                      </Avatar>
                      {selectedAvatarId === null && (
                        <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center">
                          <CheckCircle2 className="w-3 h-3 text-white" />
                        </span>
                      )}
                    </button>
                    {/* Cartoon avatars */}
                    {AVATARS.map((av) => (
                      <button
                        key={av.id}
                        type="button"
                        disabled={savingAvatar}
                        onClick={() => handleSaveAvatar(av.id)}
                        className={cn(
                          "relative rounded-full border-2 transition-all",
                          selectedAvatarId === av.id
                            ? "border-indigo-500 ring-2 ring-indigo-500/40 scale-105"
                            : "border-border hover:border-muted-foreground"
                        )}
                      >
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={av.url} />
                          <AvatarFallback className="text-xs">{av.id}</AvatarFallback>
                        </Avatar>
                        {selectedAvatarId === av.id && (
                          <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center">
                            <CheckCircle2 className="w-3 h-3 text-white" />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">First option is your Google/profile photo. The rest are cartoon avatars.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="space-y-2">
                    <Label>Display Name</Label>
                    <Input value={formName} onChange={e => setFormName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Username Handle</Label>
                    <Input
                      value={`@${formUsername.replace("@", "")}`}
                      onChange={e => setFormUsername(e.target.value.replace("@", ""))}
                    />
                  </div>
                </div>

                <div className="space-y-2 mb-8">
                  <Label>Primary Exam Focus</Label>
                  <Select value={formExam} onValueChange={setFormExam}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an exam" />
                    </SelectTrigger>
                    <SelectContent>
                      {["GATE CSE", "GATE ECE", "JEE Advanced", "NEET", "CAT", "UPSC", "Placements"].map(exam => (
                        <SelectItem key={exam} value={exam}>{exam}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save Changes"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Preferences */}
          <Card>
            <CardHeader>
              <CardTitle>Preferences</CardTitle>
              <CardDescription>Customize your app experience.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Dark Mode</Label>
                  <p className="text-sm text-muted-foreground">Toggle between light and dark base themes.</p>
                </div>
                <div className="flex items-center space-x-2">
                  <Sun className="h-4 w-4 text-muted-foreground" />
                  <Switch
                    checked={theme === "dark" || theme === "theme-midnight" || theme === "theme-cyberpunk" || theme === "theme-zen"}
                    onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                  />
                  <Moon className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base flex items-center gap-2">App Theme {me.plan !== 'pro' && <Crown className="w-4 h-4 text-yellow-500" />}</Label>
                  <p className="text-sm text-muted-foreground">Pro users can customize the app's accent colors.</p>
                </div>
                <div className="w-40">
                  <Select 
                    value={theme === 'light' ? 'dark' : theme} 
                    onValueChange={(v) => {
                      if (me.plan !== 'pro' && v !== 'dark') {
                        toast.error("Custom themes are a Pro feature!");
                        return;
                      }
                      setTheme(v);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dark">Default Dark</SelectItem>
                      <SelectItem value="theme-midnight">Midnight Purple</SelectItem>
                      <SelectItem value="theme-cyberpunk">Cyberpunk</SelectItem>
                      <SelectItem value="theme-zen">Zen Green</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Separator />
              <div className="flex flex-col gap-3">
                <div className="space-y-0.5">
                  <Label className="text-base">Daily Target</Label>
                  <p className="text-sm text-muted-foreground">How many minutes do you want to study today?</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { mins: 30,  label: "30m",  desc: "Light"    },
                    { mins: 60,  label: "1h",   desc: "Focused"  },
                    { mins: 120, label: "2h",   desc: "Solid"    },
                    { mins: 180, label: "3h",   desc: "Serious"  },
                    { mins: 240, label: "4h",   desc: "Dedicated"},
                    { mins: 360, label: "6h",   desc: "Intense"  },
                    { mins: 480, label: "8h",   desc: "Full Day" },
                  ].map(({ mins, label, desc }) => (
                    <button
                      key={mins}
                      type="button"
                      disabled={savingTarget}
                      onClick={() => handleSaveDailyTarget(mins)}
                      className={cn(
                        "flex flex-col items-center px-4 py-2 rounded-xl border text-sm font-bold transition-all",
                        dailyTarget === mins
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-muted/50 border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {label}
                      <span className="text-[10px] font-normal opacity-70 mt-0.5">{desc}</span>
                    </button>
                  ))}
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive weekly reports and updates.</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Allow Global DM Calls</Label>
                  <p className="text-sm text-muted-foreground">Receive incoming call rings anywhere in the app.</p>
                </div>
                <Switch
                  checked={!disableDmCalls}
                  onCheckedChange={(checked) => {
                    setDisableDmCalls(!checked);
                    if (!checked) {
                      localStorage.setItem("sc_disable_dm_calls", "true");
                    } else {
                      localStorage.removeItem("sc_disable_dm_calls");
                    }
                  }}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Replay Onboarding Tour</Label>
                  <p className="text-sm text-muted-foreground">Walk through the main features again.</p>
                </div>
                <Button variant="outline" size="sm" onClick={startTour} className="gap-1.5">
                  <HelpCircle className="w-4 h-4" /> Start Tour
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Subscription Column */}
        <div className="space-y-6">
          <Card className="border-primary shadow-lg bg-gradient-to-b from-card to-primary/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <Crown className="w-5 h-5" />
                {me.plan === "pro" ? "Pro Plan Active" : "Upgrade to Pro"}
              </CardTitle>
              <CardDescription>
                {me.plan === "pro"
                  ? "You have access to all premium features and exclusive cosmetics."
                  : "Unlock the full potential of StudyCircle."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                "Unlimited mock tests",
                "Private focus rooms",
                "Advanced analytics",
                "Pro-only Custom Auras ✨",
                "Priority support",
              ].map((feature) => (
                <div key={feature} className="flex items-center gap-2 text-sm font-medium">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                  {feature}
                </div>
              ))}
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
              {me.plan === "pro" ? (
                <>
                  <Button
                    variant="outline"
                    className="w-full border-primary/50 text-primary hover:bg-primary/5"
                    onClick={() => window.dispatchEvent(new CustomEvent("open-customization-store"))}
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Customize Aura
                  </Button>
                  <Button variant="ghost" className="w-full text-xs text-muted-foreground">
                    Manage Subscription
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white border-none shadow-lg shadow-violet-500/25"
                    onClick={handleUpgrade}
                    disabled={upgrading}
                  >
                    {upgrading ? "Upgrading…" : "Upgrade Now (Mock)"}
                  </Button>
                  <p className="text-[10px] text-muted-foreground text-center">
                    This is a mock upgrade for testing — no payment needed.
                  </p>
                </>
              )}
            </CardFooter>
          </Card>
        </div>
      </div>

      {/* CustomizationStoreModal is mounted globally in AppLayout */}
    </div>
  );
}
