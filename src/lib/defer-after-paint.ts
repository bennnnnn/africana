/**
 * Schedule work after the next paint. Replaces deprecated InteractionManager.runAfterInteractions
 * for deferring non-urgent work until the current frame's layout/paint completes.
 */
export function deferAfterPaint(callback: () => void): () => void {
  let cancelled = false;
  const outer = requestAnimationFrame(() => {
    if (cancelled) return;
    requestAnimationFrame(() => {
      if (!cancelled) callback();
    });
  });
  return () => {
    cancelled = true;
    cancelAnimationFrame(outer);
  };
}
