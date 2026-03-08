import { invoke, Channel } from "@tauri-apps/api/core";
import type { InputState } from "../types/input";
import type { Atlas } from "../types/atlas";
import type { Layout } from "../types/layout";

// Input
export function subscribeInput(
  onEvent: (state: InputState) => void,
): Promise<void> {
  const channel = new Channel<InputState>();
  channel.onmessage = onEvent;
  return invoke("subscribe_input", { channel });
}

export function getInputState(): Promise<InputState> {
  return invoke("get_input_state");
}

export function injectKeyEvent(key: string, pressed: boolean): Promise<void> {
  return invoke("inject_key_event", { key, pressed });
}

// Atlas
export interface AtlasInfo {
  name: string;
  source: "local" | "community";
}

export function listAtlases(): Promise<AtlasInfo[]> {
  return invoke("list_atlases");
}

export function loadAtlas(name: string): Promise<Atlas> {
  return invoke("load_atlas", { name });
}

export function saveAtlas(atlas: Atlas): Promise<void> {
  return invoke("save_atlas", { atlas });
}

export function deleteAtlas(name: string): Promise<void> {
  return invoke("delete_atlas", { name });
}

export function importAtlasImage(
  atlasName: string,
  sourcePath: string,
): Promise<string> {
  return invoke("import_atlas_image", { atlasName, sourcePath });
}

export function exportAtlasZip(name: string, destPath: string): Promise<void> {
  return invoke("export_atlas_zip", { name, destPath });
}

export function importAtlasZip(zipPath: string): Promise<string> {
  return invoke("import_atlas_zip", { zipPath });
}

export function cropAtlasImage(
  atlasName: string,
  sourceImage: string,
  x: number,
  y: number,
  w: number,
  h: number,
): Promise<string> {
  return invoke("crop_atlas_image", { atlasName, sourceImage, x, y, w, h });
}

export function createDefaultAtlas(): Promise<void> {
  return invoke("create_default_atlas");
}

// Layout
export function listLayouts(): Promise<string[]> {
  return invoke("list_layouts");
}

export function loadLayout(name: string): Promise<Layout> {
  return invoke("load_layout", { name });
}

export function saveLayout(layout: Layout): Promise<void> {
  return invoke("save_layout", { layout });
}

export function deleteLayout(name: string): Promise<void> {
  return invoke("delete_layout", { name });
}

export function exportLayoutZip(name: string, destPath: string): Promise<void> {
  return invoke("export_layout_zip", { name, destPath });
}

export function importLayoutZip(zipPath: string): Promise<string> {
  return invoke("import_layout_zip", { zipPath });
}

// Server
export function startServer(port: number): Promise<void> {
  return invoke("start_server", { port });
}

export function stopServer(): Promise<void> {
  return invoke("stop_server");
}

export function getServerPort(): Promise<number | null> {
  return invoke("get_server_port");
}

// Active layout for display
export function setActiveLayout(name: string): Promise<void> {
  return invoke("set_active_layout", { name });
}

export function getActiveLayout(): Promise<string | null> {
  return invoke("get_active_layout");
}
