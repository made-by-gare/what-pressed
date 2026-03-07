import { useState, useEffect, useCallback } from "react";
import type { Atlas } from "../types/atlas";
import {
  listAtlases,
  loadAtlas,
  saveAtlas,
  deleteAtlas,
} from "../lib/commands";

export function useAtlas() {
  const [atlasNames, setAtlasNames] = useState<string[]>([]);
  const [currentAtlas, setCurrentAtlas] = useState<Atlas | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const names = await listAtlases();
      setAtlasNames(names);
    } catch (err) {
      console.error("Failed to list atlases:", err);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const load = useCallback(async (name: string) => {
    setLoading(true);
    try {
      const atlas = await loadAtlas(name);
      setCurrentAtlas(atlas);
    } catch (err) {
      console.error("Failed to load atlas:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const save = useCallback(
    async (atlas: Atlas) => {
      try {
        await saveAtlas(atlas);
        setCurrentAtlas(atlas);
        await refresh();
      } catch (err) {
        console.error("Failed to save atlas:", err);
      }
    },
    [refresh],
  );

  const remove = useCallback(
    async (name: string) => {
      try {
        await deleteAtlas(name);
        if (currentAtlas?.name === name) {
          setCurrentAtlas(null);
        }
        await refresh();
      } catch (err) {
        console.error("Failed to delete atlas:", err);
      }
    },
    [currentAtlas, refresh],
  );

  return { atlasNames, currentAtlas, loading, load, save, remove, refresh };
}
