import React from "react";
import type { Layout } from "../../types/layout";
import type { Atlas, ImageRef } from "../../types/atlas";
import { imageRefIsEmpty } from "../../types/atlas";
import { inputIdToString } from "../../types/input";
import { AtlasImage } from "../atlas/AtlasImage";

interface Props {
  layout: Layout;
  atlas: Atlas;
  pressedSet: Set<string>;
  serverBaseUrl?: string;
}

export function DisplayRenderer({
  layout,
  atlas,
  pressedSet,
  serverBaseUrl,
}: Props) {
  const sorted = [...layout.entries].sort((a, b) => a.z_index - b.z_index);

  const getServerImageUrl = (filename: string) => {
    if (!filename) return "";
    const base = serverBaseUrl || "http://localhost:9120";
    return `${base}/api/atlas/${layout.atlas_name}/images/${filename}`;
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
        const atlasEntry = atlas.entries.find(
          (ae) => ae.id === entry.atlas_entry_id,
        );
        if (!atlasEntry) return null;

        const isPressed = pressedSet.has(inputIdToString(atlasEntry.input_id));
        const pressedRef = atlasEntry.pressed_image;
        const unpressedRef = atlasEntry.unpressed_image;
        const hasPressedImg = !imageRefIsEmpty(pressedRef);
        const hasUnpressedImg = !imageRefIsEmpty(unpressedRef);

        const imgStyle = {
          width: "100%" as const,
          height: "100%" as const,
          objectFit: "contain" as const,
          imageRendering: "pixelated" as const,
        };

        const renderImage = (ref: ImageRef, visible: boolean) => {
          const visStyle = { ...imgStyle, display: visible ? "block" as const : "none" as const };
          if (serverBaseUrl) {
            return typeof ref === "string" ? (
              <img
                src={getServerImageUrl(ref)}
                alt={atlasEntry.label}
                style={visStyle}
              />
            ) : (
              <ServerSpriteImage
                src={getServerImageUrl(ref.source)}
                rect={ref}
                alt={atlasEntry.label}
                style={visStyle}
              />
            );
          }
          return (
            <AtlasImage
              atlasName={layout.atlas_name}
              imageRef={ref}
              alt={atlasEntry.label}
              style={visStyle}
            />
          );
        };

        return (
          <div
            key={entry.id}
            style={{
              position: "absolute",
              left: entry.x - (atlasEntry.width * entry.scale) / 2,
              top: entry.y - (atlasEntry.height * entry.scale) / 2,
              width: atlasEntry.width * entry.scale,
              height: atlasEntry.height * entry.scale,
              transform: `rotate(${entry.rotation}deg)`,
              zIndex: entry.z_index,
            }}
          >
            {hasUnpressedImg && renderImage(unpressedRef, !isPressed)}
            {hasPressedImg && renderImage(pressedRef, isPressed)}
          </div>
        );
      })}
    </div>
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
