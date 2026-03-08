import { useState, useRef, useCallback, useEffect } from "react";
import type { ImageRef, SourceImage } from "../../types/atlas";
import { sourceImageFilename } from "../../types/atlas";
import { AtlasImage } from "./AtlasImage";

interface Props {
  atlasName: string;
  sourceImages: SourceImage[];
  existingRef?: ImageRef;
  onSelect: (ref_: ImageRef) => void;
  onCancel: () => void;
  onUpdateSource?: (filename: string, updated: SourceImage) => void;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

type DragMode =
  | { type: "create"; startX: number; startY: number }
  | { type: "move"; offsetX: number; offsetY: number }
  | { type: "resize"; handle: string; origRect: Rect };

function getGridSize(si: SourceImage): { w?: number; h?: number } {
  if (typeof si === "string") return {};
  return { w: si.grid_width, h: si.grid_height };
}

function clampRect(r: Rect, maxW: number, maxH: number): Rect {
  let { x, y, w, h } = r;
  if (w < 1) w = 1;
  if (h < 1) h = 1;
  if (x < 0) x = 0;
  if (y < 0) y = 0;
  if (x + w > maxW) x = maxW - w;
  if (y + h > maxH) y = maxH - h;
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
}

export function SourceImageRectSelector({
  atlasName,
  sourceImages,
  existingRef,
  onSelect,
  onCancel,
  onUpdateSource,
}: Props) {
  const existingSource =
    existingRef && typeof existingRef !== "string" ? existingRef.source : null;
  const initialSource =
    existingSource ??
    (sourceImages.length > 0 ? sourceImageFilename(sourceImages[0]) : "");

  const [selectedSource, setSelectedSource] = useState(initialSource);
  const [rect, setRect] = useState<Rect | null>(
    existingRef && typeof existingRef !== "string"
      ? { x: existingRef.x, y: existingRef.y, w: existingRef.w, h: existingRef.h }
      : null,
  );
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [dragMode, setDragMode] = useState<DragMode | null>(null);
  const [shiftHeld, setShiftHeld] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });

  const currentSourceImage = sourceImages.find(
    (si) => sourceImageFilename(si) === selectedSource,
  );
  const grid = currentSourceImage ? getGridSize(currentSourceImage) : {};
  const gridW = grid.w;
  const gridH = grid.h;
  const hasGrid = !!(gridW && gridH);
  const shouldSnap = snapEnabled && hasGrid;

  const setGrid = (newW?: number, newH?: number) => {
    if (!onUpdateSource) return;
    const updated: SourceImage =
      newW || newH
        ? { filename: selectedSource, grid_width: newW, grid_height: newH }
        : selectedSource;
    onUpdateSource(selectedSource, updated);
  };

  const snap = useCallback(
    (x: number, y: number): { x: number; y: number } => {
      if (!shouldSnap || !gridW || !gridH) return { x, y };
      return {
        x: Math.round(x / gridW) * gridW,
        y: Math.round(y / gridH) * gridH,
      };
    },
    [shouldSnap, gridW, gridH],
  );

  const toImageCoords = useCallback(
    (clientX: number, clientY: number) => {
      const img = imgRef.current;
      if (!img || naturalSize.w === 0) return { x: 0, y: 0 };
      const bounds = img.getBoundingClientRect();
      const scaleX = naturalSize.w / bounds.width;
      const scaleY = naturalSize.h / bounds.height;
      return {
        x: Math.max(0, Math.min(naturalSize.w, (clientX - bounds.left) * scaleX)),
        y: Math.max(0, Math.min(naturalSize.h, (clientY - bounds.top) * scaleY)),
      };
    },
    [naturalSize],
  );

  // Determine what handle the mouse is over
  const getHandle = useCallback(
    (clientX: number, clientY: number): string | null => {
      if (!rect || !imgRef.current || naturalSize.w === 0) return null;
      const bounds = imgRef.current.getBoundingClientRect();
      const scaleX = bounds.width / naturalSize.w;
      const scaleY = bounds.height / naturalSize.h;

      const rx = rect.x * scaleX;
      const ry = rect.y * scaleY;
      const rw = rect.w * scaleX;
      const rh = rect.h * scaleY;

      const mx = clientX - bounds.left;
      const my = clientY - bounds.top;

      const edgeTolerance = 8;

      const nearLeft = Math.abs(mx - rx) < edgeTolerance;
      const nearRight = Math.abs(mx - (rx + rw)) < edgeTolerance;
      const nearTop = Math.abs(my - ry) < edgeTolerance;
      const nearBottom = Math.abs(my - (ry + rh)) < edgeTolerance;
      const insideX = mx > rx - edgeTolerance && mx < rx + rw + edgeTolerance;
      const insideY = my > ry - edgeTolerance && my < ry + rh + edgeTolerance;
      const inside = mx > rx && mx < rx + rw && my > ry && my < ry + rh;

      if (nearTop && nearLeft && insideX && insideY) return "nw";
      if (nearTop && nearRight && insideX && insideY) return "ne";
      if (nearBottom && nearLeft && insideX && insideY) return "sw";
      if (nearBottom && nearRight && insideX && insideY) return "se";
      if (nearTop && insideX) return "n";
      if (nearBottom && insideX) return "s";
      if (nearLeft && insideY) return "w";
      if (nearRight && insideY) return "e";
      if (inside) return "move";

      return null;
    },
    [rect, naturalSize],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const pos = toImageCoords(e.clientX, e.clientY);
      const handle = getHandle(e.clientX, e.clientY);

      if (handle === "move" && rect) {
        setDragMode({ type: "move", offsetX: pos.x - rect.x, offsetY: pos.y - rect.y });
      } else if (handle && handle !== "move" && rect) {
        setDragMode({ type: "resize", handle, origRect: { ...rect } });
      } else {
        const snapped = snap(pos.x, pos.y);
        setDragMode({ type: "create", startX: snapped.x, startY: snapped.y });
        setRect(null);
      }
    },
    [toImageCoords, getHandle, rect, snap],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragMode) {
        // Update cursor based on handle
        const container = e.currentTarget as HTMLElement;
        const handle = getHandle(e.clientX, e.clientY);
        const cursors: Record<string, string> = {
          nw: "nwse-resize", ne: "nesw-resize", sw: "nesw-resize", se: "nwse-resize",
          n: "ns-resize", s: "ns-resize", w: "ew-resize", e: "ew-resize",
          move: "grab",
        };
        container.style.cursor = handle ? cursors[handle] : "crosshair";
        return;
      }

      const raw = toImageCoords(e.clientX, e.clientY);
      const shift = e.shiftKey;

      if (dragMode.type === "create") {
        const pos = snap(raw.x, raw.y);
        let x = Math.min(dragMode.startX, pos.x);
        let y = Math.min(dragMode.startY, pos.y);
        let w = Math.abs(pos.x - dragMode.startX);
        let h = Math.abs(pos.y - dragMode.startY);
        if (shift) {
          const size = Math.max(w, h);
          w = size;
          h = size;
          if (pos.x < dragMode.startX) x = dragMode.startX - size;
          if (pos.y < dragMode.startY) y = dragMode.startY - size;
        }
        if (w > 0 && h > 0) {
          setRect(clampRect({ x, y, w, h }, naturalSize.w, naturalSize.h));
        }
      } else if (dragMode.type === "move" && rect) {
        let newX = raw.x - dragMode.offsetX;
        let newY = raw.y - dragMode.offsetY;
        const snapped = snap(newX, newY);
        newX = snapped.x;
        newY = snapped.y;
        setRect(clampRect({ x: newX, y: newY, w: rect.w, h: rect.h }, naturalSize.w, naturalSize.h));
      } else if (dragMode.type === "resize" && rect) {
        const { handle, origRect } = dragMode;
        let { x, y, w, h } = origRect;
        const pos = snap(raw.x, raw.y);

        if (handle.includes("e")) w = pos.x - x;
        if (handle.includes("w")) { w = (x + w) - pos.x; x = pos.x; }
        if (handle.includes("s")) h = pos.y - y;
        if (handle.includes("n")) { h = (y + h) - pos.y; y = pos.y; }

        if (shift) {
          const aspect = origRect.w / origRect.h;
          if (handle === "n" || handle === "s") {
            w = Math.round(h * aspect);
          } else if (handle === "e" || handle === "w") {
            h = Math.round(w / aspect);
          } else {
            // Corner: constrain to original aspect ratio
            if (w / h > aspect) {
              w = Math.round(h * aspect);
            } else {
              h = Math.round(w / aspect);
            }
          }
        }

        if (w > 0 && h > 0) {
          setRect(clampRect({ x, y, w, h }, naturalSize.w, naturalSize.h));
        }
      }
    },
    [dragMode, toImageCoords, snap, rect, naturalSize, getHandle],
  );

  const handleMouseUp = useCallback(() => {
    setDragMode(null);
  }, []);

  // Track shift key
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "Shift") setShiftHeld(true);
      if (e.key === "Escape") onCancel();
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "Shift") setShiftHeld(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [onCancel]);

  const handleConfirm = () => {
    if (!rect || rect.w < 1 || rect.h < 1) return;
    onSelect({
      source: selectedSource,
      x: rect.x,
      y: rect.y,
      w: rect.w,
      h: rect.h,
    });
  };

  const getOverlayStyle = (): React.CSSProperties | null => {
    if (!rect || !imgRef.current || naturalSize.w === 0) return null;
    const bounds = imgRef.current.getBoundingClientRect();
    const scaleX = bounds.width / naturalSize.w;
    const scaleY = bounds.height / naturalSize.h;
    return {
      left: rect.x * scaleX,
      top: rect.y * scaleY,
      width: rect.w * scaleX,
      height: rect.h * scaleY,
    };
  };

  const getGridLines = () => {
    if (!shouldSnap || !gridW || !gridH || !imgRef.current || naturalSize.w === 0) return null;
    const bounds = imgRef.current.getBoundingClientRect();
    const scaleX = bounds.width / naturalSize.w;
    const scaleY = bounds.height / naturalSize.h;
    const lines: React.ReactNode[] = [];
    for (let x = gridW; x < naturalSize.w; x += gridW) {
      lines.push(
        <div key={`v${x}`} className="grid-line grid-line-v" style={{ left: x * scaleX }} />,
      );
    }
    for (let y = gridH; y < naturalSize.h; y += gridH) {
      lines.push(
        <div key={`h${y}`} className="grid-line grid-line-h" style={{ top: y * scaleY }} />,
      );
    }
    return lines;
  };

  const overlayStyle = getOverlayStyle();

  return (
    <div className="rect-selector-overlay" onClick={onCancel}>
      <div className="rect-selector-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rect-selector-header">
          <span>Select Region from Source Image</span>
          <button className="btn btn-sm" onClick={onCancel}>
            Close
          </button>
        </div>

        <div className="rect-selector-toolbar">
          {sourceImages.length > 1 && (
            <div className="source-picker">
              {sourceImages.map((si) => {
                const fname = sourceImageFilename(si);
                return (
                  <button
                    key={fname}
                    className={`btn btn-sm ${selectedSource === fname ? "btn-primary" : ""}`}
                    onClick={() => {
                      setSelectedSource(fname);
                      setRect(null);
                    }}
                  >
                    {fname.length > 25 ? "..." + fname.slice(-22) : fname}
                  </button>
                );
              })}
            </div>
          )}
          <div className="grid-controls">
            <span className="grid-controls-label">Grid:</span>
            <input
              type="number"
              placeholder="W"
              value={gridW ?? ""}
              onChange={(e) => setGrid(parseInt(e.target.value) || undefined, gridH)}
              className="grid-input"
            />
            <span className="grid-controls-x">x</span>
            <input
              type="number"
              placeholder="H"
              value={gridH ?? ""}
              onChange={(e) => setGrid(gridW, parseInt(e.target.value) || undefined)}
              className="grid-input"
            />
            {hasGrid && (
              <label className="snap-toggle">
                <input
                  type="checkbox"
                  checked={snapEnabled}
                  onChange={(e) => setSnapEnabled(e.target.checked)}
                />
                Snap
              </label>
            )}
          </div>
        </div>

        <div className="rect-selector-canvas">
          <div
            className="image-container"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <AtlasImage
              ref={imgRef as React.Ref<HTMLImageElement>}
              atlasName={atlasName}
              imageRef={selectedSource}
              alt="source"
              draggable={false}
              onLoad={(e) => {
                const img = e.currentTarget;
                setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
              }}
              className="source-image"
            />
            {getGridLines()}
            {overlayStyle && (
              <>
                <div className="selection-rect" style={overlayStyle} />
                <div className="handle handle-nw" style={{ left: overlayStyle.left as number - 4, top: overlayStyle.top as number - 4 }} />
                <div className="handle handle-ne" style={{ left: (overlayStyle.left as number) + (overlayStyle.width as number) - 4, top: overlayStyle.top as number - 4 }} />
                <div className="handle handle-sw" style={{ left: overlayStyle.left as number - 4, top: (overlayStyle.top as number) + (overlayStyle.height as number) - 4 }} />
                <div className="handle handle-se" style={{ left: (overlayStyle.left as number) + (overlayStyle.width as number) - 4, top: (overlayStyle.top as number) + (overlayStyle.height as number) - 4 }} />
              </>
            )}
          </div>
        </div>

        <div className="rect-selector-footer">
          <div className="rect-info">
            {rect ? (
              <>
                {rect.w} x {rect.h} px at ({rect.x}, {rect.y})
              </>
            ) : (
              <span className="rect-hint">Click and drag to select a region. {shiftHeld ? "⇧ Constrain" : "Hold Shift to constrain."}</span>
            )}
          </div>
          <div className="rect-selector-actions">
            <button className="btn" onClick={onCancel}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              disabled={!rect}
              onClick={handleConfirm}
            >
              Use Selection
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .rect-selector-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .rect-selector-modal {
          background: #1e1e1e;
          border: 1px solid #3a3a3a;
          border-radius: 8px;
          padding: 16px;
          max-width: 90vw;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .rect-selector-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-weight: 600;
        }
        .rect-selector-toolbar {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .source-picker {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
          flex: 1;
        }
        .grid-controls {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
        }
        .grid-controls-label {
          font-size: 12px;
          color: #999;
        }
        .grid-controls-x {
          font-size: 12px;
          color: #666;
        }
        .grid-input {
          width: 52px !important;
          padding: 4px 6px !important;
          font-size: 12px !important;
        }
        .snap-toggle {
          display: flex;
          align-items: center;
          gap: 3px;
          font-size: 12px;
          color: #999;
          cursor: pointer;
          margin-left: 4px;
        }
        .snap-toggle input {
          width: auto;
        }
        .rect-selector-canvas {
          overflow: auto;
          max-height: 60vh;
          border: 1px solid #3a3a3a;
          border-radius: 4px;
          background: #111;
        }
        .image-container {
          position: relative;
          display: inline-block;
          cursor: crosshair;
          user-select: none;
        }
        .source-image {
          display: block;
          max-width: 800px;
          max-height: 55vh;
          object-fit: contain;
        }
        .selection-rect {
          position: absolute;
          border: 2px solid #e8730c;
          background: rgba(232, 115, 12, 0.15);
          pointer-events: none;
        }
        .handle {
          position: absolute;
          width: 8px;
          height: 8px;
          background: #e8730c;
          border: 1px solid #fff;
          border-radius: 2px;
          pointer-events: none;
        }
        .grid-line {
          position: absolute;
          pointer-events: none;
          opacity: 0.25;
        }
        .grid-line-v {
          top: 0;
          bottom: 0;
          width: 1px;
          background: #e8730c;
        }
        .grid-line-h {
          left: 0;
          right: 0;
          height: 1px;
          background: #e8730c;
        }
        .rect-selector-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .rect-info {
          font-size: 12px;
          color: #999;
          font-family: monospace;
        }
        .rect-hint {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-style: italic;
          color: #666;
        }
        .rect-selector-actions {
          display: flex;
          gap: 8px;
          flex-shrink: 0;
        }
      `}</style>
    </div>
  );
}
