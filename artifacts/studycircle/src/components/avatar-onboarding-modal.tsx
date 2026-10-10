import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { AVATARS } from "@/lib/avatars";
import { Sparkles } from "lucide-react";

interface Props {
  onComplete: () => void;
}

export function AvatarOnboardingModal({ onComplete }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: (activeAvatarId: string) =>
      customFetch("/api/users/profile/customize", {
        method: "POST",
        body: JSON.stringify({ activeAvatarId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      onComplete();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-[#0e0e15] border border-white/10 rounded-3xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
      >
        <div className="px-8 pt-8 pb-4 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-500/10 mb-4">
            <Sparkles className="w-6 h-6 text-indigo-400" />
          </div>
          <h2 className="text-2xl font-black text-white">Choose Your Avatar</h2>
          <p className="text-zinc-400 text-sm mt-1">Pick a character that represents you. You can change it anytime in Settings.</p>
        </div>

        <div className="px-6 pb-4">
          <div className="grid grid-cols-5 gap-3">
            {AVATARS.map((av) => (
              <button
                key={av.id}
                onClick={() => setSelectedId(av.id)}
                className={`relative aspect-square rounded-2xl overflow-hidden border-2 transition-all ${
                  selectedId === av.id
                    ? "border-indigo-500 ring-2 ring-indigo-500/30 scale-105"
                    : "border-white/10 hover:border-white/30"
                }`}
              >
                <img src={av.url} alt="" loading="lazy" className="w-full h-full object-cover bg-zinc-800" />
                {selectedId === av.id && (
                  <div className="absolute inset-0 bg-indigo-500/20 flex items-center justify-center">
                    <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="px-8 pb-8 flex items-center justify-between border-t border-white/5 pt-4">
          <p className="text-xs text-zinc-500">More avatars coming soon</p>
          <button
            disabled={!selectedId || save.isPending}
            onClick={() => selectedId && save.mutate(selectedId)}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-500 transition-colors"
          >
            {save.isPending ? "Saving..." : "Let's Go →"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
