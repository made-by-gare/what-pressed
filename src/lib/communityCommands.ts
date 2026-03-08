import { invoke, Channel } from "@tauri-apps/api/core";
import type { CommunityIndex, CommunityManifest } from "../types/community";

export interface InstallProgress {
  step: string;
  current: number;
  total: number;
}

export function fetchCommunityIndex(): Promise<CommunityIndex> {
  return invoke("fetch_community_index");
}

export function installCommunityAtlas(
  name: string,
  onProgress?: (progress: InstallProgress) => void,
): Promise<void> {
  const channel = new Channel<InstallProgress>();
  if (onProgress) {
    channel.onmessage = onProgress;
  }
  return invoke("install_community_atlas", { name, onProgress: channel });
}

export function uninstallCommunityAtlas(name: string): Promise<void> {
  return invoke("uninstall_community_atlas", { name });
}

export function getCommunityManifest(): Promise<CommunityManifest> {
  return invoke("get_community_manifest");
}

export function forkCommunityAtlas(name: string, newName: string): Promise<string> {
  return invoke("fork_community_atlas", { name, newName });
}

export function openCommunityBrowser(): Promise<void> {
  return invoke("open_community_browser");
}
