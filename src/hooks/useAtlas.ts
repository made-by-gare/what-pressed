import { useState, useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import type { Atlas } from "../types/atlas";
import type { AtlasInfo } from "../lib/commands";
import {
  listAtlases,
  loadAtlas,
  saveAtlas,
  deleteAtlas,
} from "../lib/commands";

export function useAtlas() {
  const [atlasList, setAtlasList] = useState<AtlasInfo[]>([]);
  const [currentAtlas, setCurrentAtlas] = useState<Atlas | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const list = await listAtlases();
      setAtlasList(list);
    } catch (err) {
      console.error("Failed to list atlases:", err);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Listen for cross-window atlas changes (install/uninstall/fork from community browser)
  useEffect(() => {
    const unlisten = listen("atlases-changed", () => {
      refresh();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
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

  const atlasNames = atlasList.map((a) => a.name);

  const clear = useCallback(() => {
    setCurrentAtlas(null);
  }, []);

  return { atlasList, atlasNames, currentAtlas, loading, load, save, remove, refresh, clear };
}
