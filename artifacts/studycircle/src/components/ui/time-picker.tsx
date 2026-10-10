import * as React from "react";
import { Clock, ChevronUp, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface TimePickerProps {
  value: string; // HH:MM 24-hour format
  onChange: (value: string) => void;
}

// Step increments for minute stepper
const MINUTE_STEP = 5;

function mod(n: number, m: number) {
  return ((n % m) + m) % m;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function TimePicker({ value, onChange }: TimePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const [hours24Str, minutesStr] = value.split(":");
  const h24 = parseInt(hours24Str, 10) || 0;
  const m   = parseInt(minutesStr,  10) || 0;

  const isPM = h24 >= 12;
  const h12  = h24 % 12 || 12;

  const emit = (newH24: number, newM: number) => {
    onChange(`${String(newH24).padStart(2, "0")}:${String(newM).padStart(2, "0")}`);
  };

  // 12-hour value (1–12) → 24-hour, preserving current AM/PM
  const h12to24 = (newH12: number) => {
    let newH24 = newH12;
    if (isPM && newH12 !== 12) newH24 += 12;
    if (!isPM && newH12 === 12) newH24 = 0;
    return newH24;
  };

  const stepHour = (dir: 1 | -1) => {
    emit(h12to24(mod(h12 - 1 + dir, 12) + 1), m);
  };

  const stepMinute = (dir: 1 | -1) => {
    const newM = mod(m + dir * MINUTE_STEP, 60);
    let newH24 = h24;
    if (dir === 1 && m + MINUTE_STEP >= 60) newH24 = mod(h24 + 1, 24);
    if (dir === -1 && m - MINUTE_STEP < 0)  newH24 = mod(h24 - 1, 24);
    emit(newH24, newM);
  };

  // Absolute setters used when the user types a value
  const setHour = (n: number) => emit(h12to24(clamp(n, 1, 12)), m);
  const setMinute = (n: number) => emit(h24, clamp(n, 0, 59));

  const toggleAmPm = () => emit(mod(h24 + 12, 24), m);

  const displayTime = `${h12}:${String(m).padStart(2, "0")} ${isPM ? "PM" : "AM"}`;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          type="button"
          className={cn(
            "w-full justify-start text-left font-normal bg-[#0e0e15] border-white/10 hover:bg-white/5",
            !value && "text-muted-foreground",
          )}
        >
          <Clock className="mr-2 w-4 h-4 text-indigo-400" />
          {displayTime}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-auto p-4 bg-[#0e0e15] border-white/10 shadow-2xl rounded-xl"
        align="start"
      >
        <div className="flex items-center justify-center gap-2">

          {/* ── Hour stepper ── */}
          <Stepper
            display={String(h12).padStart(2, "0")}
            ariaLabel="Hour"
            onUp={() => stepHour(1)}
            onDown={() => stepHour(-1)}
            onSet={setHour}
          />

          <span className="text-2xl font-black text-zinc-500 select-none">:</span>

          {/* ── Minute stepper ── */}
          <Stepper
            display={String(m).padStart(2, "0")}
            ariaLabel="Minute"
            onUp={() => stepMinute(1)}
            onDown={() => stepMinute(-1)}
            onSet={setMinute}
          />

          {/* ── AM / PM toggle ── */}
          <div className="flex flex-col gap-1.5 ml-1">
            <button
              type="button"
              onClick={() => { if (isPM) toggleAmPm(); }}
              className={cn(
                "w-12 py-2 rounded-lg text-xs font-black tracking-wider transition-all",
                !isPM
                  ? "bg-indigo-600 text-white shadow-[0_0_12px_rgba(99,102,241,0.4)]"
                  : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300",
              )}
            >
              AM
            </button>
            <button
              type="button"
              onClick={() => { if (!isPM) toggleAmPm(); }}
              className={cn(
                "w-12 py-2 rounded-lg text-xs font-black tracking-wider transition-all",
                isPM
                  ? "bg-indigo-600 text-white shadow-[0_0_12px_rgba(99,102,241,0.4)]"
                  : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300",
              )}
            >
              PM
            </button>
          </div>
        </div>

        <p className="text-[10px] text-zinc-500 text-center mt-2.5">
          Type a number or use the arrows · minutes step ±{MINUTE_STEP}
        </p>

        {/* Done */}
        <Button
          type="button"
          size="sm"
          className="w-full mt-2 h-8 text-xs"
          onClick={() => setIsOpen(false)}
        >
          Done
        </Button>
      </PopoverContent>
    </Popover>
  );
}

// ─── Stepper ─────────────────────────────────────────────────────────────────

function Stepper({
  display, ariaLabel, onUp, onDown, onSet,
}: {
  display: string;
  ariaLabel: string;
  onUp: () => void;
  onDown: () => void;
  onSet: (n: number) => void;
}) {
  // While focused/typing we hold a free-text draft; commit (clamp + emit) on blur/Enter.
  const [draft, setDraft] = React.useState<string | null>(null);

  const commit = () => {
    if (draft !== null && draft !== "") {
      const n = parseInt(draft, 10);
      if (!Number.isNaN(n)) onSet(n);
    }
    setDraft(null);
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={onUp}
        className="w-12 h-8 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-all active:scale-95"
      >
        <ChevronUp className="w-4 h-4" />
      </button>

      <input
        type="text"
        inputMode="numeric"
        aria-label={ariaLabel}
        value={draft ?? display}
        onFocus={(e) => { setDraft(display); e.currentTarget.select(); }}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, "").slice(0, 2))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { commit(); e.currentTarget.blur(); }
          else if (e.key === "ArrowUp") { e.preventDefault(); onUp(); }
          else if (e.key === "ArrowDown") { e.preventDefault(); onDown(); }
        }}
        className="w-12 h-11 text-center rounded-lg bg-zinc-900 border border-zinc-700 text-xl font-black font-mono text-zinc-100 tabular-nums outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50"
      />

      <button
        type="button"
        onClick={onDown}
        className="w-12 h-8 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-all active:scale-95"
      >
        <ChevronDown className="w-4 h-4" />
      </button>
    </div>
  );
}
