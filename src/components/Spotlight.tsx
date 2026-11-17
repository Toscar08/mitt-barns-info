import { useEffect } from "react";

/**
 * Feeds the cursor position to the frosted panel under it (as --mx/--my),
 * which is what makes the glass light up where you point. One listener for the whole app.
 */
export function Spotlight() {
  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    let frame = 0;
    function onMove(event: PointerEvent) {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const panel = (event.target as Element | null)?.closest?.<HTMLElement>(".surface");
        if (!panel) return;
        const box = panel.getBoundingClientRect();
        panel.style.setProperty("--mx", `${event.clientX - box.left}px`);
        panel.style.setProperty("--my", `${event.clientY - box.top}px`);
      });
    }
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
