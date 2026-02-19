"use client";

import { useCallback, useEffect, useRef } from "react";

interface AutoSaveOptions {
  /** Called when it's time to save. Should persist the current project state. */
  onSave: () => Promise<void>;
  /** Debounce delay in ms (default: 5000). */
  debounceMs?: number;
}

export function useAutoSave({ onSave, debounceMs = 5000 }: AutoSaveOptions) {
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);

  /** Mark the project as dirty. A save will fire after the debounce window. */
  const markDirty = useCallback(() => {
    dirtyRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      timerRef.current = null;
      if (dirtyRef.current) {
        dirtyRef.current = false;
        await onSaveRef.current();
      }
    }, debounceMs);
  }, [debounceMs]);

  /** Immediately flush any pending save. */
  const flushNow = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (dirtyRef.current) {
      dirtyRef.current = false;
      await onSaveRef.current();
    }
  }, []);

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (dirtyRef.current) {
        dirtyRef.current = false;
        onSaveRef.current();
      }
    };
  }, []);

  return { markDirty, flushNow };
}
