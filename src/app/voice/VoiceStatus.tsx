import { Mic } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * What the voice is doing: waiting for the person to speak, hearing them, working out what was
 * said, or talking back.
 */
export type Activity = "waiting" | "hearing" | "processing" | "speaking";

/** Shows the voice's state, so it's always clear whose turn it is. */
export function VoiceStatus({ activity, level }: { activity: Activity; level: number }) {
  const { t } = useTranslation();
  const listening = activity === "waiting" || activity === "hearing";
  return (
    <div
      role="status"
      data-testid="voice-status"
      data-activity={activity}
      className="flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2"
    >
      <span aria-hidden className="relative flex size-10 shrink-0 items-center justify-center">
        {activity === "processing" && (
          <span className="size-8 animate-spin rounded-full border-4 border-line border-t-accent" />
        )}
        {activity === "speaking" && (
          <span className="flex h-6 items-end gap-1">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className="voice-bar w-1 rounded-full bg-accent"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </span>
        )}
        {listening && (
          <>
            {/* Grows with the voice, so the person sees they are heard. */}
            <span
              className="absolute inset-0 rounded-full bg-accent/30 transition-transform duration-100"
              style={{ transform: `scale(${0.55 + (activity === "hearing" ? level : 0) * 0.6})` }}
            />
            {activity === "waiting" && (
              <span className="absolute inset-1 animate-ping rounded-full border-2 border-accent/60" />
            )}
            <Mic size={20} strokeWidth={1.75} className="relative text-accent" />
          </>
        )}
      </span>
      <span className="text-sm">{t(`voice.status.${activity}`)}</span>
    </div>
  );
}
