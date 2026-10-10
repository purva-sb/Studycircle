export interface AvatarOption {
  id: string;
  url: string;
}

export const AVATARS: AvatarOption[] = [
  { id: "av_1",  url: "/avatars/av_1.png" },
  { id: "av_2",  url: "/avatars/av_2.png" },
  { id: "av_3",  url: "/avatars/av_3.png" },
  { id: "av_4",  url: "/avatars/av_4.png" },
  { id: "av_5",  url: "/avatars/av_5.png" },
  { id: "av_6",  url: "/avatars/av_6.png" },
  { id: "av_7",  url: "/avatars/av_7.png" },
  { id: "av_8",  url: "/avatars/av_8.png" },
  { id: "av_9",  url: "/avatars/av_9.png" },
  { id: "av_10", url: "/avatars/av_10.png" },
];

export const AVATAR_MAP: Record<string, string> = Object.fromEntries(
  AVATARS.map((a) => [a.id, a.url]),
);

export function resolveAvatarUrl(activeAvatarId?: string | null, fallbackUrl?: string | null): string {
  if (activeAvatarId && AVATAR_MAP[activeAvatarId]) return AVATAR_MAP[activeAvatarId];
  return fallbackUrl || "";
}
