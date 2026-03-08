import { useState, useEffect, useRef, forwardRef, useCallback } from "react";
import { readFile, BaseDirectory } from "@tauri-apps/plugin-fs";
import type { ImageRef } from "../../types/atlas";

interface Props extends React.ImgHTMLAttributes<HTMLImageElement> {
  atlasName: string;
  /** A filename string or an ImageRef (sprite rect). */
  imageRef: ImageRef;
  /** If true, load from layouts/{atlasName}/images/ instead of atlases/. */
  layoutMode?: boolean;
}

// Module-level blob URL cache. URLs are kept for the lifetime of the app
// so tab switches and press/unpress toggles never re-read from disk.
const blobCache = new Map<string, { url: string; promise: Promise<string> }>();

function getBlobUrl(name: string, filename: string, layoutMode: boolean): Promise<string> {
  const key = `${layoutMode ? "layout:" : ""}${name}/${filename}`;
  const existing = blobCache.get(key);
  if (existing) return existing.promise;

  const basePath = layoutMode
    ? `layouts/${name}/images/${filename}`
    : `atlases/${name}/images/${filename}`;

  const promise = readFile(basePath, { baseDir: BaseDirectory.AppData })
    .catch(() => {
      if (layoutMode) throw new Error("not found");
      return readFile(`community-atlases/${name}/images/${filename}`, {
        baseDir: BaseDirectory.AppData,
      });
    })
    .then((data) => {
      const blob = new Blob([data]);
      const url = URL.createObjectURL(blob);
      const entry = blobCache.get(key);
      if (entry) entry.url = url;
      return url;
    })
    .catch(() => {
      blobCache.delete(key);
      return "";
    });

  blobCache.set(key, { url: "", promise });
  return promise;
}

/** Load a file from atlas or layout images dir, returning a cached blob URL. */
function useImageUrl(name: string, filename: string, layoutMode: boolean): string {
  const key = `${layoutMode ? "layout:" : ""}${name}/${filename}`;
  const [url, setUrl] = useState(() => {
    return blobCache.get(key)?.url || "";
  });

  useEffect(() => {
    if (!filename || !name) return;

    let cancelled = false;
    getBlobUrl(name, filename, layoutMode).then((blobUrl) => {
      if (!cancelled) setUrl(blobUrl);
    });

    return () => { cancelled = true; };
  }, [name, filename, layoutMode]);

  return url;
}

export const AtlasImage = forwardRef<HTMLImageElement | HTMLCanvasElement, Props>(
  ({ atlasName, imageRef, onLoad, layoutMode, ...imgProps }, ref) => {
    const filename = typeof imageRef === "string" ? imageRef : imageRef.source;
    const isRect = typeof imageRef !== "string";
    const url = useImageUrl(atlasName, filename, !!layoutMode);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const setRefs = useCallback(
      (el: HTMLCanvasElement | null) => {
        (canvasRef as React.MutableRefObject<HTMLCanvasElement | null>).current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) (ref as React.MutableRefObject<HTMLCanvasElement | null>).current = el;
      },
      [ref],
    );

    // For sprite rects, draw the sub-region onto a canvas
    useEffect(() => {
      if (!isRect || !url || !canvasRef.current) return;
      const { x, y, w, h } = imageRef as { source: string; x: number; y: number; w: number; h: number };
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const img = new Image();
      img.onload = () => {
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
      };
      img.src = url;
    }, [isRect, url, imageRef]);

    if (!url) return null;

    if (isRect) {
      const { className, style, alt } = imgProps;
      return (
        <canvas
          ref={setRefs}
          className={className}
          style={style}
          title={alt}
        />
      );
    }

    return <img ref={ref as React.Ref<HTMLImageElement>} src={url} onLoad={onLoad} {...imgProps} />;
  },
);
