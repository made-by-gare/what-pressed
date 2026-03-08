import type { InputId } from "./input";

/** Either a plain filename or a rect reference into a source image. */
export type ImageRef =
  | string
  | { source: string; x: number; y: number; w: number; h: number };

/** Either a plain filename or an object with grid/label metadata. */
export type SourceImage =
  | string
  | { filename: string; grid_width?: number; grid_height?: number };

export function imageRefIsEmpty(ref_: ImageRef): boolean {
  return typeof ref_ === "string" ? ref_ === "" : false;
}

export function imageRefFilename(ref_: ImageRef): string {
  return typeof ref_ === "string" ? ref_ : ref_.source;
}

export function sourceImageFilename(si: SourceImage): string {
  return typeof si === "string" ? si : si.filename;
}

export interface AtlasEntry {
  id: string;
  input_id: InputId;
  label: string;
  pressed_image: ImageRef;
  unpressed_image: ImageRef;
  width: number;
  height: number;
}

export interface Atlas {
  name: string;
  version: number;
  entries: AtlasEntry[];
  source_images?: SourceImage[];
  semver?: string;
  description?: string;
  author?: string;
  origin?: string;
}
