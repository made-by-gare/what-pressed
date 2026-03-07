export interface LayoutEntry {
  id: string;
  atlas_entry_id: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  z_index: number;
}

export interface Layout {
  name: string;
  version: number;
  atlas_name: string;
  canvas_width: number;
  canvas_height: number;
  entries: LayoutEntry[];
}
