import type { InputId } from "./input";
import type { ImageRef, SourceImage } from "./atlas";

export type ShapeType = "rect" | "circle";

export interface ShapeStyle {
  id: string;
  name: string;
  color: string;
  fill?: boolean;
  stroke_color?: string;
  stroke_width?: number;
}

export interface TextStyle {
  id: string;
  name: string;
  color: string;
  bold?: boolean;
  italic?: boolean;
  font_family?: string;
  font_size?: number;
}

export interface LabelConfig {
  text: string;
  text_style_id?: string;
  pressed_text_style_id?: string;
  font_family?: string;
  font_size?: number;
  color: string;
  pressed_color?: string;
  align?: "left" | "center" | "right";
  vertical_align?: "top" | "center" | "bottom";
  bold?: boolean;
  pressed_bold?: boolean;
  italic?: boolean;
  text_direction?: "horizontal" | "vertical";
}

export interface EntryOrigin {
  atlas_name: string;
  entry_id: string;
  atlas_source: "local" | "community";
}

export type EntrySource =
  | { type: "atlas"; atlas_name: string; entry_id: string }
  | {
      type: "inline";
      input_id?: InputId | null;
      label: string;
      pressed_image: ImageRef;
      unpressed_image: ImageRef;
      width: number;
      height: number;
      origin?: EntryOrigin;
    }
  | {
      type: "shape";
      input_id?: InputId | null;
      label: string;
      shape: ShapeType;
      shape_style_id?: string;
      pressed_shape_style_id?: string;
      color: string;
      fill?: boolean;
      stroke_color?: string;
      stroke_width?: number;
      pressed_color: string;
      pressed_fill?: boolean;
      pressed_stroke_color?: string;
      pressed_stroke_width?: number;
      width: number;
      height: number;
    };

export interface LayoutEntry {
  id: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  z_index: number;
  source: EntrySource;
  label?: LabelConfig;
}

export interface Layout {
  name: string;
  version: number;
  canvas_width: number;
  canvas_height: number;
  grid_size?: number;
  entries: LayoutEntry[];
  shape_styles?: ShapeStyle[];
  text_styles?: TextStyle[];
  source_images?: SourceImage[];
}

/** Get the input_id for a layout entry, resolving atlas refs against the provided atlases. */
export function getEntryInputId(
  entry: LayoutEntry,
  atlasLookup?: (atlasName: string, entryId: string) => InputId | null,
): InputId | null {
  if (entry.source.type === "inline" || entry.source.type === "shape") {
    return entry.source.input_id ?? null;
  }
  if (atlasLookup) {
    return atlasLookup(entry.source.atlas_name, entry.source.entry_id);
  }
  return null;
}

/** Get display dimensions for a layout entry. */
export function getEntryDimensions(
  entry: LayoutEntry,
  atlasLookup?: (atlasName: string, entryId: string) => { width: number; height: number } | null,
): { width: number; height: number } {
  if (entry.source.type === "inline" || entry.source.type === "shape") {
    return { width: entry.source.width, height: entry.source.height };
  }
  if (atlasLookup) {
    const dims = atlasLookup(entry.source.atlas_name, entry.source.entry_id);
    if (dims) return dims;
  }
  return { width: 64, height: 64 };
}

export interface ResolvedShapeVisuals {
  color: string;
  fill: boolean;
  stroke_color?: string;
  stroke_width?: number;
}

/** Look up a single shape style by id. Falls back to inline source props. */
export function resolveShapeStyle(
  source: Extract<EntrySource, { type: "shape" }>,
  styles: ShapeStyle[],
  styleId?: string,
): ResolvedShapeVisuals {
  const id = styleId ?? source.shape_style_id;
  if (id) {
    const style = styles.find((s) => s.id === id);
    if (style) {
      return {
        color: style.color,
        fill: style.fill !== false,
        stroke_color: style.stroke_color,
        stroke_width: style.stroke_width,
      };
    }
  }
  return {
    color: source.color,
    fill: source.fill !== false,
    stroke_color: source.stroke_color,
    stroke_width: source.stroke_width,
  };
}

export interface ResolvedTextVisuals {
  color: string;
  bold: boolean;
  italic: boolean;
  font_family: string;
  font_size: number;
}

/** Look up a single text style by id. Falls back to inline label props. */
export function resolveTextStyle(
  label: LabelConfig,
  styles: TextStyle[],
  styleId?: string,
): ResolvedTextVisuals {
  const id = styleId ?? label.text_style_id;
  if (id) {
    const style = styles.find((s) => s.id === id);
    if (style) {
      return {
        color: style.color,
        bold: style.bold ?? false,
        italic: style.italic ?? false,
        font_family: style.font_family ?? "sans-serif",
        font_size: style.font_size ?? 14,
      };
    }
  }
  return {
    color: label.color,
    bold: label.bold ?? false,
    italic: label.italic ?? false,
    font_family: label.font_family ?? "sans-serif",
    font_size: label.font_size ?? 14,
  };
}
