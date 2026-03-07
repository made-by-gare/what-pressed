import { useRef, useCallback, useState } from "react";
import type { Layout, LayoutEntry } from "../../types/layout";
import type { Atlas } from "../../types/atlas";
import { AtlasImage } from "../atlas/AtlasImage";

interface Props {
  layout: Layout;
  atlas: Atlas;
  selectedEntryId: string | null;
  gridSize: number;
  snapToGrid: boolean;
  onSelectEntry: (id: string | null) => void;
  onUpdateEntry: (entry: LayoutEntry) => void;
}

export function LayoutCanvas({
  layout,
  atlas,
  selectedEntryId,
  gridSize,
  snapToGrid,
  onSelectEntry,
  onUpdateEntry,
}: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<{
    id: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const scale = canvasRef.current
    ? Math.min(
        canvasRef.current.clientWidth / layout.canvas_width,
        canvasRef.current.clientHeight / layout.canvas_height,
        1,
      )
    : 1;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, entry: LayoutEntry) => {
      e.stopPropagation();
      onSelectEntry(entry.id);
      setDragging({
        id: entry.id,
        startX: e.clientX,
        startY: e.clientY,
        origX: entry.x,
        origY: entry.y,
      });
    },
    [onSelectEntry],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging) return;
      const dx = (e.clientX - dragging.startX) / scale;
      const dy = (e.clientY - dragging.startY) / scale;
      const entry = layout.entries.find((en) => en.id === dragging.id);
      if (!entry) return;
      const atlasEntry = atlas.entries.find(
        (ae) => ae.id === entry.atlas_entry_id,
      );
      if (!atlasEntry) return;

      let newX = dragging.origX + dx;
      let newY = dragging.origY + dy;

      if (snapToGrid) {
        // Snap the top-left edge to the grid, then convert back to center
        const halfW = (atlasEntry.width * entry.scale) / 2;
        const halfH = (atlasEntry.height * entry.scale) / 2;
        newX = Math.round((newX - halfW) / gridSize) * gridSize + halfW;
        newY = Math.round((newY - halfH) / gridSize) * gridSize + halfH;
      } else {
        newX = Math.round(newX);
        newY = Math.round(newY);
      }

      onUpdateEntry({ ...entry, x: newX, y: newY });
    },
    [
      dragging,
      layout.entries,
      atlas.entries,
      onUpdateEntry,
      scale,
      snapToGrid,
      gridSize,
    ],
  );

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  const sorted = [...layout.entries].sort((a, b) => a.z_index - b.z_index);

  return (
    <div
      ref={canvasRef}
      className="canvas-container"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={() => onSelectEntry(null)}
    >
      <div
        className="canvas"
        style={{
          width: layout.canvas_width,
          height: layout.canvas_height,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          backgroundSize: `${gridSize}px ${gridSize}px`,
        }}
      >
        {sorted.map((entry) => {
          const atlasEntry = atlas.entries.find(
            (ae) => ae.id === entry.atlas_entry_id,
          );
          if (!atlasEntry) return null;
          const isSelected = entry.id === selectedEntryId;
          return (
            <div
              key={entry.id}
              className={`canvas-entry ${isSelected ? "selected" : ""}`}
              style={{
                position: "absolute",
                left: entry.x - (atlasEntry.width * entry.scale) / 2,
                top: entry.y - (atlasEntry.height * entry.scale) / 2,
                width: atlasEntry.width * entry.scale,
                height: atlasEntry.height * entry.scale,
                transform: `rotate(${entry.rotation}deg)`,
                zIndex: entry.z_index,
                cursor: "move",
              }}
              onMouseDown={(e) => handleMouseDown(e, entry)}
            >
              {atlasEntry.unpressed_image ? (
                <AtlasImage
                  atlasName={layout.atlas_name}
                  filename={atlasEntry.unpressed_image}
                  alt={atlasEntry.label}
                  className="canvas-entry-img"
                />
              ) : (
                <div className="entry-label-overlay">{atlasEntry.label}</div>
              )}
            </div>
          );
        })}
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
      `}</style>
    </div>
  );
}
