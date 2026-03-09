import { useRef, useCallback, useState, useEffect } from "react";
import type { Layout, LayoutEntry } from "../../types/layout";
import { getEntryDimensions, resolveShapeStyle, resolveTextStyle } from "../../types/layout";
import type { Atlas } from "../../types/atlas";
import { imageRefIsEmpty } from "../../types/atlas";
import { AtlasImage } from "../atlas/AtlasImage";

interface Props {
  layout: Layout;
  atlases: Map<string, Atlas>;
  selectedEntryId: string | null;
  gridSize: number;
  snapToGrid: boolean;
  onSelectEntry: (id: string | null) => void;
  onUpdateEntry: (entry: LayoutEntry) => void;
}

type DragMode = "move" | "scale" | "rotate";
type Corner = "tl" | "tr" | "bl" | "br";

interface DragState {
  mode: DragMode;
  id: string;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  origScale: number;
  origRotation: number;
  corner?: Corner;
  // Center of the entry in client coords (for rotation)
  centerX?: number;
  centerY?: number;
}

// Resize cursors ordered by angle: 0°=n, 45°=ne, 90°=e, etc.
const RESIZE_CURSORS = [
  "ns-resize", "nesw-resize", "ew-resize", "nwse-resize",
  "ns-resize", "nesw-resize", "ew-resize", "nwse-resize",
] as const;

// Base angles for each corner (unrotated): tl=315°, tr=45°, br=135°, bl=225°
const CORNER_BASE_ANGLES: Record<Corner, number> = {
  tl: 315, tr: 45, br: 135, bl: 225,
};

function getScaleCursor(corner: Corner, rotation: number): string {
  const angle = ((CORNER_BASE_ANGLES[corner] + rotation) % 360 + 360) % 360;
  const idx = Math.round(angle / 45) % 8;
  return RESIZE_CURSORS[idx];
}

function getEntryDims(entry: LayoutEntry, atlases: Map<string, Atlas>) {
  return getEntryDimensions(entry, (aName, eId) => {
    const atlas = atlases.get(aName);
    const ae = atlas?.entries.find((e) => e.id === eId);
    return ae ? { width: ae.width, height: ae.height } : null;
  });
}

export function LayoutCanvas({
  layout,
  atlases,
  selectedEntryId,
  gridSize,
  snapToGrid,
  onSelectEntry,
  onUpdateEntry,
}: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [activeDragMode, setActiveDragMode] = useState<DragMode | null>(null);
  const lockedRotateOnBottom = useRef<boolean | null>(null);
  const [viewScale, setViewScale] = useState(1);

  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const atlasesRef = useRef(atlases);
  atlasesRef.current = atlases;
  const viewScaleRef = useRef(viewScale);
  viewScaleRef.current = viewScale;
  const snapRef = useRef(snapToGrid);
  snapRef.current = snapToGrid;
  const gridRef = useRef(gridSize);
  gridRef.current = gridSize;
  const onUpdateRef = useRef(onUpdateEntry);
  onUpdateRef.current = onUpdateEntry;

  // Clear locked rotate handle position when drag ends
  useEffect(() => {
    if (!activeDragMode) lockedRotateOnBottom.current = null;
  }, [activeDragMode]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const update = () => {
      setViewScale(Math.min(el.clientWidth / layout.canvas_width, el.clientHeight / layout.canvas_height, 1));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [layout.canvas_width, layout.canvas_height]);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      const entry = layoutRef.current.entries.find((en) => en.id === drag.id);
      if (!entry) return;

      if (drag.mode === "move") {
        const dx = (e.clientX - drag.startX) / viewScaleRef.current;
        const dy = (e.clientY - drag.startY) / viewScaleRef.current;
        const dims = getEntryDims(entry, atlasesRef.current);

        let newX = drag.origX + dx;
        let newY = drag.origY + dy;

        if (snapRef.current) {
          const halfW = (dims.width * entry.scale) / 2;
          const halfH = (dims.height * entry.scale) / 2;
          newX = Math.round((newX - halfW) / gridRef.current) * gridRef.current + halfW;
          newY = Math.round((newY - halfH) / gridRef.current) * gridRef.current + halfH;
        } else {
          newX = Math.round(newX);
          newY = Math.round(newY);
        }

        onUpdateRef.current({ ...entry, x: newX, y: newY });
      } else if (drag.mode === "scale") {
        // Scale based on distance from center
        const cx = drag.centerX!;
        const cy = drag.centerY!;
        const startDist = Math.hypot(drag.startX - cx, drag.startY - cy);
        const curDist = Math.hypot(e.clientX - cx, e.clientY - cy);
        if (startDist < 1) return;

        let newScale = drag.origScale * (curDist / startDist);
        newScale = Math.max(0.1, Math.round(newScale * 20) / 20); // snap to 0.05 increments

        onUpdateRef.current({ ...entry, scale: newScale });
      } else if (drag.mode === "rotate") {
        const cx = drag.centerX!;
        const cy = drag.centerY!;
        const startAngle = Math.atan2(drag.startY - cy, drag.startX - cx);
        const curAngle = Math.atan2(e.clientY - cy, e.clientX - cx);
        let deg = drag.origRotation + ((curAngle - startAngle) * 180) / Math.PI;

        // Snap to 15-degree increments when holding shift
        if (e.shiftKey) {
          deg = Math.round(deg / 15) * 15;
        } else {
          deg = Math.round(deg);
        }

        onUpdateRef.current({ ...entry, rotation: deg });
      }
    };

    const handleUp = () => {
      if (dragRef.current) {
        dragRef.current = null;
        setActiveDragMode(null);
        lockedRotateOnBottom.current = null;
      }
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, []);

  const startMove = useCallback(
    (e: React.MouseEvent, entry: LayoutEntry) => {
      e.stopPropagation();
      e.preventDefault();
      onSelectEntry(entry.id);
      dragRef.current = {
        mode: "move",
        id: entry.id,
        startX: e.clientX,
        startY: e.clientY,
        origX: entry.x,
        origY: entry.y,
        origScale: entry.scale,
        origRotation: entry.rotation,
      };
      setActiveDragMode("move");
    },
    [onSelectEntry],
  );

  const startScale = useCallback(
    (e: React.MouseEvent, entry: LayoutEntry, corner: Corner) => {
      e.stopPropagation();
      e.preventDefault();

      // Find center of entry in client coords
      const canvasEl = canvasRef.current;
      if (!canvasEl) return;
      const canvasRect = canvasEl.getBoundingClientRect();
      const cx = canvasRect.left + entry.x * viewScaleRef.current;
      const cy = canvasRect.top + entry.y * viewScaleRef.current;

      dragRef.current = {
        mode: "scale",
        id: entry.id,
        startX: e.clientX,
        startY: e.clientY,
        origX: entry.x,
        origY: entry.y,
        origScale: entry.scale,
        origRotation: entry.rotation,
        corner,
        centerX: cx,
        centerY: cy,
      };
      setActiveDragMode("scale");
    },
    [],
  );

  const startRotate = useCallback(
    (e: React.MouseEvent, entry: LayoutEntry) => {
      e.stopPropagation();
      e.preventDefault();

      const canvasEl = canvasRef.current;
      if (!canvasEl) return;
      const canvasRect = canvasEl.getBoundingClientRect();
      const cx = canvasRect.left + entry.x * viewScaleRef.current;
      const cy = canvasRect.top + entry.y * viewScaleRef.current;

      // Lock rotate handle position (top/bottom) for duration of drag
      const dims = getEntryDims(entry, atlasesRef.current);
      const h = dims.height * entry.scale;
      const vs = viewScaleRef.current;
      const rotDist = 24 / vs;
      const handleSz = 8 / vs;
      const rotRad = (entry.rotation * Math.PI) / 180;
      const handleOffY = -Math.cos(rotRad) * (h / 2 + rotDist + handleSz / 2);
      lockedRotateOnBottom.current = entry.y + handleOffY < 0;

      dragRef.current = {
        mode: "rotate",
        id: entry.id,
        startX: e.clientX,
        startY: e.clientY,
        origX: entry.x,
        origY: entry.y,
        origScale: entry.scale,
        origRotation: entry.rotation,
        centerX: cx,
        centerY: cy,
      };
      setActiveDragMode("rotate");
    },
    [],
  );

  const sorted = [...layout.entries].sort((a, b) => a.z_index - b.z_index);
  const selectedEntry = layout.entries.find((e) => e.id === selectedEntryId);

  const rotateCursor = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21 12a9 9 0 1 1-3-6.7'/%3E%3Cpath d='M21 3v5h-5'/%3E%3C/svg%3E\") 12 12, crosshair";
  let containerCursor: string | undefined;
  if (activeDragMode === "move") {
    containerCursor = "grabbing";
  } else if (activeDragMode === "rotate") {
    containerCursor = rotateCursor;
  } else if (activeDragMode === "scale" && dragRef.current?.corner && selectedEntry) {
    containerCursor = getScaleCursor(dragRef.current.corner, selectedEntry.rotation);
  }

  return (
    <div
      ref={canvasRef}
      className="canvas-container"
      style={containerCursor ? { cursor: containerCursor } : undefined}
      onMouseDown={() => onSelectEntry(null)}
    >
      <div
        className="canvas"
        style={{
          width: layout.canvas_width,
          height: layout.canvas_height,
          transform: `scale(${viewScale})`,
          transformOrigin: "top left",
          backgroundSize: `${gridSize}px ${gridSize}px`,
        }}
      >
        {sorted.map((entry) => {
          const dims = getEntryDims(entry, atlases);
          const isSelected = entry.id === selectedEntryId;
          const src = entry.source;
          const w = dims.width * entry.scale;
          const h = dims.height * entry.scale;

          let content: React.ReactNode = null;
          if (src.type === "atlas") {
            const atlas = atlases.get(src.atlas_name);
            const ae = atlas?.entries.find((e) => e.id === src.entry_id);
            if (ae && !imageRefIsEmpty(ae.unpressed_image)) {
              content = (
                <AtlasImage
                  atlasName={src.atlas_name}
                  imageRef={ae.unpressed_image}
                  alt={ae.label}
                  className="canvas-entry-img"
                />
              );
            } else {
              content = <div className="entry-label-overlay">{ae?.label || "?"}</div>;
            }
          } else if (src.type === "inline") {
            if (!imageRefIsEmpty(src.unpressed_image)) {
              content = (
                <AtlasImage
                  atlasName={layout.name}
                  imageRef={src.unpressed_image}
                  alt={src.label}
                  className="canvas-entry-img"
                  layoutMode
                />
              );
            } else {
              content = <div className="entry-label-overlay">{src.label}</div>;
            }
          } else {
            const vis = resolveShapeStyle(src, layout.shape_styles ?? []);
            const sw = vis.stroke_width ?? 0;
            content = (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  backgroundColor: vis.fill ? vis.color : "transparent",
                  borderRadius: src.shape === "circle" ? "50%" : 0,
                  border: sw > 0 ? `${sw}px solid ${vis.stroke_color ?? "#ffffff"}` : "none",
                  boxSizing: "border-box",
                }}
              />
            );
          }

          return (
            <div
              key={entry.id}
              className={`canvas-entry ${isSelected ? "selected" : ""}`}
              style={{
                position: "absolute",
                left: entry.x - w / 2,
                top: entry.y - h / 2,
                width: w,
                height: h,
                transform: `rotate(${entry.rotation}deg)`,
                zIndex: entry.z_index,
                cursor: activeDragMode === "move" && dragRef.current?.id === entry.id ? "grabbing" : "move",
                pointerEvents: activeDragMode ? "none" : "auto",
              }}
              onMouseDown={(e) => startMove(e, entry)}
            >
              {content}
              {entry.label && (() => {
                const tv = resolveTextStyle(entry.label, layout.text_styles ?? []);
                return (
                  <div className="entry-label-overlay" style={{
                    position: "absolute", inset: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: tv.font_size,
                    fontFamily: tv.font_family,
                    color: tv.color,
                    fontWeight: tv.bold ? "bold" : "normal",
                    fontStyle: tv.italic ? "italic" : "normal",
                    ...(entry.label.text_direction === "vertical" ? { writingMode: "vertical-rl", textOrientation: "upright" } as React.CSSProperties : {}),
                  }}>
                    {entry.label.text}
                  </div>
                );
              })()}
            </div>
          );
        })}

        {/* Transform handles overlay - rendered above all entries */}
        {selectedEntry && (() => {
          const dims = getEntryDims(selectedEntry, atlases);
          const w = dims.width * selectedEntry.scale;
          const h = dims.height * selectedEntry.scale;
          const handleSize = 8 / viewScale; // constant screen size
          const rotateDistance = 24 / viewScale;
          // Flip rotate handle to bottom when entry is near top of canvas
          // Lock position during active rotation drag to prevent popping
          const computedRotateOnBottom = (() => {
            const rotRad = (selectedEntry.rotation * Math.PI) / 180;
            const handleOffsetY = -Math.cos(rotRad) * (h / 2 + rotateDistance + handleSize / 2);
            return (selectedEntry.y + handleOffsetY) < 0;
          })();
          const rotateOnBottom = lockedRotateOnBottom.current !== null ? lockedRotateOnBottom.current : computedRotateOnBottom;

          return (
            <div
              className="transform-handles"
              style={{
                position: "absolute",
                left: selectedEntry.x - w / 2,
                top: selectedEntry.y - h / 2,
                width: w,
                height: h,
                transform: `rotate(${selectedEntry.rotation}deg)`,
                zIndex: 99999,
                pointerEvents: "none",
              }}
            >
              {/* Corner scale handles */}
              {(["tl", "tr", "bl", "br"] as Corner[]).map((corner) => {
                const isLeft = corner[1] === "l";
                const isTop = corner[0] === "t";
                return (
                  <div
                    key={corner}
                    className="handle handle-scale"
                    style={{
                      width: handleSize,
                      height: handleSize,
                      left: isLeft ? -handleSize / 2 : undefined,
                      right: isLeft ? undefined : -handleSize / 2,
                      top: isTop ? -handleSize / 2 : undefined,
                      bottom: isTop ? undefined : -handleSize / 2,
                      cursor: getScaleCursor(corner, selectedEntry.rotation),
                      pointerEvents: activeDragMode ? "none" : "auto",
                    }}
                    onMouseDown={(e) => startScale(e, selectedEntry, corner)}
                  />
                );
              })}

              {/* Rotate handle - above or below the entry */}
              <div
                className="rotate-stem"
                style={{
                  left: w / 2,
                  ...(rotateOnBottom
                    ? { top: h, height: rotateDistance }
                    : { top: -rotateDistance, height: rotateDistance }),
                }}
              />
              <div
                className="handle handle-rotate"
                style={{
                  width: handleSize,
                  height: handleSize,
                  left: w / 2 - handleSize / 2,
                  ...(rotateOnBottom
                    ? { top: h + rotateDistance - handleSize / 2 }
                    : { top: -rotateDistance - handleSize / 2 }),
                  pointerEvents: activeDragMode ? "none" : "auto",
                }}
                onMouseDown={(e) => startRotate(e, selectedEntry)}
              />
            </div>
          );
        })()}
      </div>

      <style>{`
        .canvas-container {
          width: 100%;
          height: 100%;
          background: #111;
          overflow: hidden;
          position: relative;
        }
        .canvas {
          position: relative;
          background-color: #1e1e1e;
          background-image:
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
          border: 1px solid #3a3a3a;
        }
        .canvas-entry {
          border: 2px solid transparent;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .canvas-entry.selected {
          border-color: #e8730c;
          box-shadow: 0 0 10px rgba(232, 115, 12, 0.4);
        }
        .canvas-entry-img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          pointer-events: none;
          user-select: none;
        }
        .entry-label-overlay {
          font-size: 11px;
          color: rgba(255,255,255,0.6);
          text-align: center;
          pointer-events: none;
          user-select: none;
        }
        .transform-handles {
          pointer-events: none;
        }
        .handle {
          position: absolute;
          border-radius: 2px;
        }
        .handle-scale {
          background: #fff;
          border: 1px solid #e8730c;
          box-shadow: 0 0 3px rgba(0,0,0,0.5);
        }
        .handle-rotate {
          background: #fff;
          border: 1px solid #e8730c;
          border-radius: 50%;
          box-shadow: 0 0 3px rgba(0,0,0,0.5);
          cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21 12a9 9 0 1 1-3-6.7'/%3E%3Cpath d='M21 3v5h-5'/%3E%3C/svg%3E") 12 12, crosshair;
        }
        .rotate-stem {
          position: absolute;
          width: 1px;
          background: #e8730c;
          opacity: 0.5;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
