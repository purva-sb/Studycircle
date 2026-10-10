import { QueryClient } from "@tanstack/react-query";

/** Default cache policy — reduces repeat API/DB round-trips (Supabase egress). */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 1,
    },
  },
});

/** Slow-changing aggregates: dashboard, analytics, leaderboard. */
export const slowDataQueryOptions = {
  staleTime: 15 * 60 * 1000,
  gcTime: 60 * 60 * 1000,
  refetchOnWindowFocus: false,
} as const;

/** Live chat: short stale window; socket updates cache directly. */
export const liveChatQueryOptions = {
  staleTime: 30 * 1000,
  gcTime: 10 * 60 * 1000,
  refetchOnWindowFocus: false,
} as const;

/** User profile in shell — moderate freshness. */
export const profileQueryOptions = {
  staleTime: 10 * 60 * 1000,
  gcTime: 30 * 60 * 1000,
  refetchOnWindowFocus: false,
} as const;

/** Dashboard summary — refreshes every 2 min so today's minutes stay accurate. */
export const dashboardQueryOptions = {
  staleTime: 2 * 60 * 1000,
  gcTime: 10 * 60 * 1000,
  refetchOnWindowFocus: true,
} as const;
