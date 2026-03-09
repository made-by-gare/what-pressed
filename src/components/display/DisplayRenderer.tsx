import React from "react";
import type { Layout, LayoutEntry, LabelConfig, TextStyle } from "../../types/layout";
import { resolveShapeStyle, resolveTextStyle } from "../../types/layout";
import type { Atlas, AtlasEntry, ImageRef } from "../../types/atlas";
import { imageRefIsEmpty } from "../../types/atlas";
import { inputIdToString } from "../../types/input";
import { AtlasImage } from "../atlas/AtlasImage";

interface Props {
  layout: Layout;
  /** Map of atlas_name -> Atlas for resolving atlas refs. */
  atlases: Map<string, Atlas>;
  pressedSet: Set<string>;
  serverBaseUrl?: string;
}

/** Resolve an atlas-type entry source to its AtlasEntry. */
function resolveAtlasEntry(
  atlases: Map<string, Atlas>,
  atlasName: string,
  entryId: string,
): AtlasEntry | null {
  const atlas = atlases.get(atlasName);
  if (!atlas) return null;
  return atlas.entries.find((e) => e.id === entryId) ?? null;
}

/** Get entry input_id, images, dimensions, and label from any source type. */
function resolveEntry(entry: LayoutEntry, atlases: Map<string, Atlas>) {
  const src = entry.source;
  if (src.type === "atlas") {
    const ae = resolveAtlasEntry(atlases, src.atlas_name, src.entry_id);
    if (!ae) return null;
    return {
      inputId: ae.input_id,
      entryLabel: ae.label,
      pressedImage: ae.pressed_image,
      unpressedImage: ae.unpressed_image,
      width: ae.width,
      height: ae.height,
      imageSource: src.atlas_name, // for image URL resolution
    };
  }
  if (src.type === "inline") {
    return {
      inputId: src.input_id ?? null,
      entryLabel: src.label,
      pressedImage: src.pressed_image,
      unpressedImage: src.unpressed_image,
      width: src.width,
      height: src.height,
      imageSource: null, // layout-owned images
    };
  }
  // shape
  return {
    inputId: src.input_id ?? null,
    entryLabel: src.label,
    pressedImage: null as ImageRef | null,
    unpressedImage: null as ImageRef | null,
    width: src.width,
    height: src.height,
    imageSource: null,
    shape: src.shape,
    color: src.color,
    pressedColor: src.pressed_color,
  };
}

function LabelOverlay({ config, textStyles, isPressed }: { config: LabelConfig; textStyles: TextStyle[]; isPressed: boolean }) {
  const unpressedVis = resolveTextStyle(config, textStyles);
  const pressedVis = resolveTextStyle(config, textStyles, config.pressed_text_style_id ?? config.text_style_id);
  const vis = isPressed ? pressedVis : unpressedVis;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: config.vertical_align === "top" ? "flex-start"
          : config.vertical_align === "bottom" ? "flex-end" : "center",
        justifyContent: config.align === "left" ? "flex-start"
          : config.align === "right" ? "flex-end" : "center",
        fontFamily: vis.font_family,
        fontSize: vis.font_size,
        fontWeight: vis.bold ? "bold" : "normal",
        fontStyle: vis.italic ? "italic" : "normal",
        color: vis.color,
        pointerEvents: "none",
        userSelect: "none",
        padding: 4,
        textAlign: (config.align || "center") as React.CSSProperties["textAlign"],
        overflow: "hidden",
        ...(config.text_direction === "vertical" ? { writingMode: "vertical-rl", textOrientation: "upright" } : {}),
      }}
    >
      {config.text}
    </div>
  );
}

export function DisplayRenderer({
  layout,
  atlases,
  pressedSet,
  serverBaseUrl,
}: Props) {
  const sorted = [...layout.entries].sort((a, b) => a.z_index - b.z_index);

  const getServerImageUrl = (atlasName: string | null, layoutName: string, filename: string) => {
    if (!filename) return "";
    const base = serverBaseUrl || "http://localhost:9120";
    if (atlasName) {
      return `${base}/api/atlas/${atlasName}/images/${filename}`;
    }
    return `${base}/api/layout/${layoutName}/images/${filename}`;
  };

  return (
    <div
      className="display-renderer"
      style={{
        position: "relative",
        width: layout.canvas_width,
        height: layout.canvas_height,
        margin: "0 auto",
      }}
    >
      {sorted.map((entry) => {
        const resolved = resolveEntry(entry, atlases);
        if (!resolved) return null;

        const isPressed = resolved.inputId ? pressedSet.has(inputIdToString(resolved.inputId)) : false;
        const w = resolved.width * entry.scale;
        const h = resolved.height * entry.scale;

        const imgStyle: React.CSSProperties = {
          width: "100%",
          height: "100%",
          objectFit: "contain",
          imageRendering: "pixelated",
        };

        const isShape = entry.source.type === "shape";

        const renderImage = (imgRef: ImageRef, visible: boolean) => {
          if (imageRefIsEmpty(imgRef)) return null;
          const visStyle = { ...imgStyle, display: visible ? "block" : "none" };
          const atlasName = resolved.imageSource;
          if (serverBaseUrl) {
            const filename = typeof imgRef === "string" ? imgRef : imgRef.source;
            const url = getServerImageUrl(atlasName, layout.name, filename);
            return typeof imgRef === "string" ? (
              <img src={url} alt={resolved.entryLabel} style={visStyle} />
            ) : (
              <ServerSpriteImage
                src={url}
                rect={imgRef}
                alt={resolved.entryLabel}
                style={visStyle}
              />
            );
          }
          // Local mode: use AtlasImage for atlas refs, or layout images for inline
          return (
            <AtlasImage
              atlasName={atlasName || layout.name}
              imageRef={imgRef}
              alt={resolved.entryLabel}
              style={visStyle}
              layoutMode={!atlasName}
            />
          );
        };

        return (
          <div
            key={entry.id}
            style={{
              position: "absolute",
              left: entry.x - w / 2,
              top: entry.y - h / 2,
              width: w,
              height: h,
              transform: `rotate(${entry.rotation}deg)`,
              zIndex: entry.z_index,
            }}
          >
            {isShape ? (() => {
              const src = entry.source as Extract<typeof entry.source, { type: "shape" }>;
              const styles = layout.shape_styles ?? [];
              const unpressedVis = resolveShapeStyle(src, styles);
              const pressedVis = resolveShapeStyle(src, styles, src.pressed_shape_style_id ?? src.shape_style_id);
              return (
                <>
                  <ShapeElement shape={src.shape} vis={unpressedVis} visible={!isPressed} />
                  <ShapeElement shape={src.shape} vis={pressedVis} visible={isPressed} />
                </>
              );
            })() : (
              <>
                {resolved.unpressedImage && renderImage(resolved.unpressedImage, !isPressed)}
                {resolved.pressedImage && renderImage(resolved.pressedImage, isPressed)}
              </>
            )}
            {entry.label && <LabelOverlay config={entry.label} textStyles={layout.text_styles ?? []} isPressed={isPressed} />}
          </div>
        );
      })}
    </div>
  );
}

function ShapeElement({ shape, vis, visible }: {
  shape: string;
  vis: { color: string; fill: boolean; stroke_color?: string; stroke_width?: number };
  visible: boolean;
}) {
  const sw = vis.stroke_width ?? 0;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: vis.fill ? vis.color : "transparent",
        borderRadius: shape === "circle" ? "50%" : 0,
        border: sw > 0 ? `${sw}px solid ${vis.stroke_color ?? "#ffffff"}` : "none",
        boxSizing: "border-box",
        display: visible ? "block" : "none",
      }}
    />
  );
}

/** Renders a sprite rect from a server-hosted image via canvas. */
function ServerSpriteImage({
  src,
  rect,
  alt,
  style,
}: {
  src: string;
  rect: { x: number; y: number; w: number; h: number };
  alt: string;
  style: React.CSSProperties;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      canvas.width = rect.w;
      canvas.height = rect.h;
      ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
    };
    img.src = src;
  }, [src, rect.x, rect.y, rect.w, rect.h]);

  return <canvas ref={canvasRef} title={alt} style={style} />;
}
