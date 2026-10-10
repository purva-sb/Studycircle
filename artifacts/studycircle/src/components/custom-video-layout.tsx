import {
  ControlBar,
  useTracks,
  RoomAudioRenderer,
  DisconnectButton,
  useLocalParticipant,
  VideoTrack,
  useRemoteParticipants,
  useIsSpeaking,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { PhoneOff, Repeat2, MicOff, Monitor } from "lucide-react";
import { useState, useEffect } from "react";
import { UserProfilePopover } from "@/components/user-profile-popover";
import { useUser } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { resolveAvatarUrl } from "@/lib/avatars";

function ParticipantView({
  trackRef,
  name,
  avatarUrl,
  isSelf = false,
  compact = false,
}: {
  trackRef: any;
  name: string;
  avatarUrl?: string;
  isSelf?: boolean;
  compact?: boolean;
}) {
  const isSpeaking = useIsSpeaking(trackRef?.participant);
  const isCameraEnabled = trackRef?.participant?.isCameraEnabled ?? false;
  const isMicEnabled = trackRef?.participant?.isMicrophoneEnabled ?? true;
  const initials = name?.slice(0, 2).toUpperCase() || "??";

  return (
    <div className={`relative w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-700 to-slate-800 dark:from-[#0d0d1a] dark:to-[#1a1040] overflow-hidden ${isSpeaking ? "ring-2 ring-violet-400" : ""} rounded-inherit`}>
      {isCameraEnabled ? (
        <VideoTrack trackRef={trackRef} className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="flex flex-col items-center gap-3 select-none">
          {avatarUrl ? (
            <UserProfilePopover userId={trackRef?.participant?.identity}>
              <img
                src={avatarUrl}
                alt={name}
                className={`rounded-full object-cover ring-4 ${isSpeaking ? "ring-violet-400" : "ring-white/30"} ${compact ? "w-12 h-12" : "w-20 h-20 sm:w-24 sm:h-24"} shadow-2xl transition-all cursor-pointer hover:opacity-90`}
              />
            </UserProfilePopover>
          ) : (
            <UserProfilePopover userId={trackRef?.participant?.identity}>
              <div className={`rounded-full flex items-center justify-center font-bold ring-4 ${isSpeaking ? "ring-violet-400 bg-violet-600" : "ring-white/20 bg-violet-700 dark:bg-violet-800"} ${compact ? "w-12 h-12 text-sm" : "w-20 h-20 sm:w-24 sm:h-24 text-2xl"} shadow-2xl transition-all cursor-pointer hover:opacity-90 text-white`}>
                {initials}
              </div>
            </UserProfilePopover>
          )}
          {!compact && (
            <span className="text-white text-sm font-semibold tracking-wide drop-shadow">
              {isSelf ? "You" : name}
            </span>
          )}
          {isSpeaking && !compact && (
            <span className="flex gap-1 items-end h-4">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1 bg-violet-400 rounded-full animate-bounce"
                  style={{ height: `${8 + i * 4}px`, animationDelay: `${i * 0.15}s`, animationDuration: "0.7s" }}
                />
              ))}
            </span>
          )}
        </div>
      )}

      {!isMicEnabled && (
        <div className={`absolute ${compact ? "top-1 left-1" : "top-3 left-3"} bg-red-500/90 text-white rounded-full p-1 shadow-lg`}>
          <MicOff className={compact ? "w-2.5 h-2.5" : "w-3 h-3"} />
        </div>
      )}

      {isSpeaking && !isCameraEnabled && (
        <div className="absolute inset-0 rounded-inherit ring-2 ring-violet-400/50 pointer-events-none animate-pulse" />
      )}
    </div>
  );
}

// Fetches avatar for a participant and renders ParticipantView
function ParticipantTile({
  trackRef,
  name,
  isSelf = false,
  compact = false,
  selfAvatarUrl,
}: {
  trackRef: any;
  name: string;
  isSelf?: boolean;
  compact?: boolean;
  selfAvatarUrl?: string;
}) {
  const userId = trackRef?.participant?.identity as string | undefined;

  const { data: profile } = useQuery({
    queryKey: ["voice-participant-profile", userId],
    queryFn: () => customFetch<any>(`/api/users/${userId}/profile`),
    enabled: !!userId && !isSelf,
    staleTime: 5 * 60 * 1000,
  });

  const avatarUrl = isSelf
    ? selfAvatarUrl
    : profile
    ? resolveAvatarUrl(profile.activeAvatarId, profile.avatarUrl)
    : undefined;

  return (
    <ParticipantView
      trackRef={trackRef}
      name={name}
      isSelf={isSelf}
      compact={compact}
      avatarUrl={avatarUrl}
    />
  );
}

function CallTimer() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return <span className="text-white/60 text-xs font-mono tabular-nums">{m}:{s}</span>;
}

export function CustomVideoLayout() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.Microphone, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  const { user } = useUser();
  const [swapped, setSwapped] = useState(false);

  const selfAvatarUrl = user?.imageUrl || undefined;

  // One tile per participant (camera/mic/unknown sources only)
  const peopleTracks: typeof tracks = [];
  const seen = new Set<string>();
  tracks.forEach((t) => {
    if (
      !seen.has(t.participant.identity) &&
      (t.source === Track.Source.Camera ||
        t.source === Track.Source.Microphone ||
        t.source === Track.Source.Unknown)
    ) {
      seen.add(t.participant.identity);
      peopleTracks.push(t);
    }
  });

  // Active screen share (first publisher wins)
  const screenShareTracks = tracks.filter((t) => t.source === Track.Source.ScreenShare);
  const activeScreenShare = screenShareTracks.length > 0 ? screenShareTracks[0] : null;

  const isOneOnOne = peopleTracks.length === 2 && !activeScreenShare;

  const localTrack = peopleTracks.find((t) => t.participant.identity === localParticipant.identity);
  const remoteTrack = peopleTracks.find((t) => t.participant.identity !== localParticipant.identity);

  const bigTrack = swapped ? localTrack : remoteTrack;
  const bigName = swapped ? (localParticipant?.name || "You") : (remoteParticipants[0]?.name || "Other");
  const smallTrack = swapped ? remoteTrack : localTrack;
  const smallName = swapped ? (remoteParticipants[0]?.name || "Other") : "You";

  const gridAutoRows =
    peopleTracks.length > 6
      ? "200px"
      : peopleTracks.length > 1
      ? "minmax(180px, 1fr)"
      : "minmax(0, 1fr)";

  return (
    <div className="flex flex-col h-full w-full bg-transparent">
      {/* pt-20 offsets the absolute header in VoiceChannelRoom */}
      <div className="flex-1 pt-20 px-4 pb-2 min-h-0">
        {activeScreenShare ? (
          // Screen share: full view + participant strip at bottom
          <div className="flex flex-col h-full gap-3">
            <div className="flex-1 relative rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-2xl min-h-0 bg-black">
              <VideoTrack trackRef={activeScreenShare} className="w-full h-full object-contain" />
              <div className="absolute bottom-2 left-3 z-10 bg-black/60 backdrop-blur-sm text-white text-xs font-semibold px-2 py-0.5 rounded-full border border-white/10 flex items-center gap-1.5">
                <Monitor className="w-3 h-3 text-violet-400" />
                {(activeScreenShare.participant.name || activeScreenShare.participant.identity)}'s screen
              </div>
            </div>
            <div className="flex gap-3 h-28 overflow-x-auto pb-1 flex-shrink-0">
              {peopleTracks.map((track) => {
                const isLocal = track.participant.identity === localParticipant.identity;
                const name = isLocal
                  ? (localParticipant.name || "You")
                  : (track.participant.name || track.participant.identity);
                return (
                  <div
                    key={track.participant.identity}
                    className="relative flex-shrink-0 w-20 h-full rounded-2xl overflow-hidden ring-1 ring-white/10"
                  >
                    <ParticipantTile
                      trackRef={track}
                      name={name}
                      isSelf={isLocal}
                      compact={true}
                      selfAvatarUrl={selfAvatarUrl}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ) : isOneOnOne && localTrack && remoteTrack ? (
          // PiP Layout for 1-on-1
          <div className="relative w-full h-full rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/10">
            {bigTrack && (
              <ParticipantTile
                trackRef={bigTrack}
                name={bigName}
                isSelf={swapped}
                selfAvatarUrl={selfAvatarUrl}
              />
            )}

            {smallTrack && (
              <div className="absolute bottom-4 right-4 w-28 h-40 sm:w-32 sm:h-44 rounded-2xl overflow-hidden ring-2 ring-white/20 shadow-2xl z-20">
                <ParticipantTile
                  trackRef={smallTrack}
                  name={smallName}
                  isSelf={!swapped}
                  compact={true}
                  selfAvatarUrl={selfAvatarUrl}
                />
              </div>
            )}

            <button
              onClick={() => setSwapped((s) => !s)}
              title="Swap feeds"
              className="absolute top-4 right-4 z-30 bg-black/50 hover:bg-black/70 backdrop-blur-md text-white rounded-full p-2.5 border border-white/20 transition-all hover:scale-110 shadow-lg"
            >
              <Repeat2 className="w-4 h-4" />
            </button>

            <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2">
              <div className="bg-black/50 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1 rounded-full border border-white/10">
                {swapped ? "You" : (remoteParticipants[0]?.name || "Other")}
              </div>
              <div className="bg-black/50 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/10">
                <CallTimer />
              </div>
            </div>
          </div>
        ) : (
          // Grid: 1 person or 3+ people
          <div
            className={`grid gap-4 w-full h-full ${peopleTracks.length > 6 ? "overflow-y-auto content-start" : ""} ${
              peopleTracks.length <= 1
                ? "grid-cols-1"
                : peopleTracks.length <= 4
                ? "grid-cols-2"
                : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
            }`}
            style={{ gridAutoRows }}
          >
            {peopleTracks.map((track) => {
              const isLocal = track.participant.identity === localParticipant.identity;
              const name = isLocal
                ? (localParticipant.name || "You")
                : (track.participant.name || track.participant.identity);
              return (
                <div
                  key={track.participant.identity}
                  className="relative rounded-3xl overflow-hidden ring-1 ring-white/10 shadow-xl"
                >
                  <ParticipantTile
                    trackRef={track}
                    name={name}
                    isSelf={isLocal}
                    selfAvatarUrl={selfAvatarUrl}
                  />
                  <div className="absolute bottom-2 left-3 z-10 bg-black/50 backdrop-blur-sm text-white text-xs font-semibold px-2 py-0.5 rounded-full border border-white/10">
                    {isLocal ? "You" : name}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Control Bar */}
      <div className="p-4 flex justify-center items-center">
        <div className="bg-black/40 dark:bg-black/50 backdrop-blur-xl border border-white/10 dark:border-white/10 rounded-full px-4 py-2 shadow-2xl flex items-center gap-3">
          <ControlBar
            variation="minimal"
            controls={{
              microphone: true,
              camera: true,
              screenShare: true,
              chat: false,
              leave: false,
            }}
            className="!bg-transparent !border-none !shadow-none !p-0 !m-0 !gap-3 [&_.lk-button]:bg-white/10 [&_.lk-button]:hover:bg-white/20 [&_.lk-button]:text-white [&_.lk-button]:w-12 [&_.lk-button]:h-12 [&_.lk-button]:rounded-full [&_.lk-button]:flex [&_.lk-button]:items-center [&_.lk-button]:justify-center [&_.lk-button]:transition-all"
          />
          <DisconnectButton className="!bg-red-500 hover:!bg-red-600 w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg shadow-red-500/20 border-0">
            <PhoneOff className="w-5 h-5 text-white" />
          </DisconnectButton>
        </div>
      </div>

      <RoomAudioRenderer />
    </div>
  );
}
