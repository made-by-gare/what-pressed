import type { InputId } from "./input";

export interface AtlasEntry {
  id: string;
  input_id: InputId;
  label: string;
  pressed_image: string;
  unpressed_image: string;
  width: number;
  height: number;
}

export interface Atlas {
  name: string;
  version: number;
  entries: AtlasEntry[];
  source_images?: string[];
  semver?: string;
  description?: string;
  author?: string;
  origin?: string;
}
