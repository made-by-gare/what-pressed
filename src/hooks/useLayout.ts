import { useState, useEffect, useCallback } from "react";
import type { Layout } from "../types/layout";
import {
  listLayouts,
  loadLayout,
  saveLayout,
  deleteLayout,
} from "../lib/commands";

export function useLayout() {
  const [layoutNames, setLayoutNames] = useState<string[]>([]);
  const [currentLayout, setCurrentLayout] = useState<Layout | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const names = await listLayouts();
      setLayoutNames(names);
    } catch (err) {
      console.error("Failed to list layouts:", err);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const load = useCallback(async (name: string): Promise<Layout | null> => {
    setLoading(true);
    try {
      const layout = await loadLayout(name);
      setCurrentLayout(layout);
      return layout;
    } catch (err) {
      console.error("Failed to load layout:", err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const save = useCallback(
    async (layout: Layout) => {
      try {
        await saveLayout(layout);
        setCurrentLayout(layout);
        await refresh();
      } catch (err) {
        console.error("Failed to save layout:", err);
      }
    },
    [refresh],
  );

  const remove = useCallback(
    async (name: string) => {
      try {
        await deleteLayout(name);
        if (currentLayout?.name === name) {
          setCurrentLayout(null);
        }
        await refresh();
      } catch (err) {
        console.error("Failed to delete layout:", err);
      }
    },
    [currentLayout, refresh],
  );

  const clear = useCallback(() => {
    setCurrentLayout(null);
  }, []);

  return { layoutNames, currentLayout, loading, load, save, remove, refresh, clear };
}
