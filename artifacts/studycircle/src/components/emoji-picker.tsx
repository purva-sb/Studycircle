import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { useTheme } from "next-themes";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SmilePlus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  /** Optional: control open state from parent */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** The trigger element — defaults to a SmilePlus button */
  trigger?: React.ReactNode;
  /** Alignment of the popover relative to trigger */
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  isActive?: boolean;
}

export function EmojiPicker({
  onEmojiSelect,
  open,
  onOpenChange,
  trigger,
  side = "top",
  align = "end",
  isActive = false,
}: EmojiPickerProps) {
  const { resolvedTheme } = useTheme();

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 rounded-full hover:bg-muted ${isActive ? "text-violet-500 bg-violet-500/10" : "text-muted-foreground hover:text-foreground"}`}
            title="More reactions"
          >
            <SmilePlus className="w-4 h-4" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        sideOffset={8}
        className="p-0 border-0 bg-transparent shadow-none w-auto"
        avoidCollisions
        collisionPadding={16}
      >
        <div className="rounded-2xl overflow-hidden border border-border/50 shadow-2xl">
          <Picker
            data={data}
            theme={resolvedTheme === "dark" ? "dark" : "light"}
            onEmojiSelect={(e: any) => {
              onEmojiSelect(e.native);
              onOpenChange?.(false);
            }}
            previewPosition="none"
            skinTonePosition="none"
            maxFrequentRows={2}
            perLine={8}
            set="native"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

