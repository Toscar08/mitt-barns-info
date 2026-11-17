import { ArrowUp, LoaderCircle } from "lucide-react";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const text = "min-w-0 flex-1 bg-transparent pr-2 pl-4 text-base outline-none placeholder:text-muted-foreground/80";

/**
 * The chat-style field: one glass pill with the send button inside it.
 * `multiline` lets it grow with a longer note; Enter still sends and Shift+Enter breaks the line.
 */
export function AskBar({
  value,
  onChange,
  onSubmit,
  placeholder,
  label,
  loading,
  autoFocus,
  multiline = false,
  maxLength = 500,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
  label: string;
  loading: boolean;
  autoFocus?: boolean;
  multiline?: boolean;
  maxLength?: number;
}) {
  const area = useRef<HTMLTextAreaElement>(null);

  // Grow to fit what has been written, up to the height cap in the class list.
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const fit = () => {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    };
    fit();
    // A narrower window wraps the text onto more lines, so fit again when the width changes.
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [value]);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className={cn(
        "surface-strong flex gap-2 p-1.5 transition-shadow duration-200 ease-out focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--ring)_30%,transparent),var(--glass-shadow)]",
        multiline ? "items-end rounded-[1.75rem]" : "items-center rounded-full",
      )}
    >
      {multiline ? (
        <textarea
          ref={area}
          rows={1}
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              onSubmit();
            }
          }}
          placeholder={placeholder}
          aria-label={label}
          enterKeyHint="send"
          maxLength={maxLength}
          className={cn(text, "max-h-40 resize-none py-2.5 leading-6")}
        />
      ) : (
        <input
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={label}
          enterKeyHint="send"
          maxLength={maxLength}
          className={cn(text, "h-11")}
        />
      )}
      {/* Stays quiet until there is something to send, then lights up in the accent colour. */}
      <Button
        type="submit"
        size="icon"
        variant="pop"
        className="size-11 shrink-0 hover:[&_svg]:translate-x-0! hover:[&_svg]:-translate-y-0.5 disabled:bg-foreground/8 disabled:text-muted-foreground disabled:opacity-100 disabled:shadow-none"
        disabled={loading || value.trim().length < 2}
        aria-label={label}
      >
        {loading ? (
          <LoaderCircle className="size-5! animate-spin" aria-hidden />
        ) : (
          <ArrowUp className="size-5!" strokeWidth={2.5} aria-hidden />
        )}
      </Button>
    </form>
  );
}
