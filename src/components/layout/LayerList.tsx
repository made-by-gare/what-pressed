import { useRef, useState, useEffect, useCallback } from "react";
import type { LayoutEntry, ShapeStyle } from "../../types/layout";
import { resolveShapeStyle } from "../../types/layout";
import type { Atlas } from "../../types/atlas";
import { imageRefIsEmpty } from "../../types/atlas";
import { AtlasImage } from "../atlas/AtlasImage";

interface Props {
  entries: LayoutEntry[];
  atlases: Map<string, Atlas>;
  layoutName: string;
  shapeStyles: ShapeStyle[];
  selectedEntryId: string | null;
  onSelectEntry: (id: string) => void;
  onReorder: (entries: LayoutEntry[]) => void;
  onAdd: () => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
}

function getEntryLabel(entry: LayoutEntry, atlases: Map<string, Atlas>): string {
  const src = entry.source;
  if (src.type === "atlas") {
    const atlas = atlases.get(src.atlas_name);
    const ae = atlas?.entries.find((e) => e.id === src.entry_id);
    return ae?.label || src.entry_id;
  }
  return src.label;
}

function getEntryTypeTag(entry: LayoutEntry): string {
  const src = entry.source;
  if (src.type === "atlas") return "atlas";
  if (src.type === "shape") return src.shape;
  return "inline";
}

function isDecoration(entry: LayoutEntry): boolean {
  const src = entry.source;
  if (src.type === "atlas") return false;
  return !src.input_id;
}

function LayerThumb({
  entry,
  atlases,
  layoutName,
  shapeStyles,
}: {
  entry: LayoutEntry;
  atlases: Map<string, Atlas>;
  layoutName: string;
  shapeStyles: ShapeStyle[];
}) {
  const src = entry.source;

  if (src.type === "shape") {
    const vis = resolveShapeStyle(src, shapeStyles);
    const sw = vis.stroke_width ?? 0;
    return (
      <div
        className="layer-thumb-shape"
        style={{
          backgroundColor: vis.fill ? vis.color : "transparent",
          borderRadius: src.shape === "circle" ? "50%" : 2,
          border: sw > 0 ? `2px solid ${vis.stroke_color ?? "#ffffff"}` : undefined,
          boxSizing: "border-box",
        }}
      />
    );
  }

  if (src.type === "atlas") {
    const atlas = atlases.get(src.atlas_name);
    const ae = atlas?.entries.find((e) => e.id === src.entry_id);
    if (ae && !imageRefIsEmpty(ae.unpressed_image)) {
      return (
        <AtlasImage
          atlasName={src.atlas_name}
          imageRef={ae.unpressed_image}
          alt={ae.label}
          className="layer-thumb-img"
        />
      );
    }
  }

  if (src.type === "inline" && !imageRefIsEmpty(src.unpressed_image)) {
    return (
      <AtlasImage
        atlasName={layoutName}
        imageRef={src.unpressed_image}
        alt={src.label}
        className="layer-thumb-img"
        layoutMode
      />
    );
  }

  // Fallback: letter icon
  const label = getEntryLabel(entry, atlases);
  return (
    <div className="layer-thumb-fallback">
      {label.charAt(0).toUpperCase()}
    </div>
  );
}

export function LayerList({
  entries,
  atlases,
  layoutName,
  shapeStyles,
  selectedEntryId,
  onSelectEntry,
  onReorder,
  onAdd,
  onDuplicate,
  onRemove,
}: Props) {
  const sorted = [...entries].sort((a, b) => b.z_index - a.z_index);

  const [menuId, setMenuId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const didDrag = useRef(false);
  const scrollRaf = useRef<number>(0);

  const sortedRef = useRef(sorted);
  sortedRef.current = sorted;
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;

  useEffect(() => {
    if (!dragId) return;

    const handleMove = (e: MouseEvent) => {
      didDrag.current = true;
      const items = sortedRef.current;
      let targetIdx: number | null = null;
      for (let i = 0; i < items.length; i++) {
        const el = itemRefs.current.get(items[i].id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (e.clientY < rect.top + rect.height / 2) {
          targetIdx = i;
          break;
        }
        targetIdx = i + 1;
      }
      setOverIdx(targetIdx);

      // Auto-scroll when near edges
      const container = scrollRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        const edgeZone = 40;
        cancelAnimationFrame(scrollRaf.current);
        if (e.clientY < rect.top + edgeZone && container.scrollTop > 0) {
          const speed = Math.max(1, (edgeZone - (e.clientY - rect.top)) * 0.3);
          const scroll = () => {
            container.scrollTop -= speed;
            if (container.scrollTop > 0) scrollRaf.current = requestAnimationFrame(scroll);
          };
          scrollRaf.current = requestAnimationFrame(scroll);
        } else if (e.clientY > rect.bottom - edgeZone && container.scrollTop < container.scrollHeight - container.clientHeight) {
          const speed = Math.max(1, (edgeZone - (rect.bottom - e.clientY)) * 0.3);
          const scroll = () => {
            container.scrollTop += speed;
            if (container.scrollTop < container.scrollHeight - container.clientHeight) scrollRaf.current = requestAnimationFrame(scroll);
          };
          scrollRaf.current = requestAnimationFrame(scroll);
        }
      }
    };

    const handleUp = () => {
      cancelAnimationFrame(scrollRaf.current);
      const items = sortedRef.current;
      if (overIdx != null && dragId) {
        const fromIdx = items.findIndex((ent) => ent.id === dragId);
        let toIdx = overIdx;
        if (fromIdx !== -1 && fromIdx !== toIdx) {
          if (toIdx > fromIdx) toIdx--;
          const reordered = [...items];
          const [moved] = reordered.splice(fromIdx, 1);
          reordered.splice(toIdx, 0, moved);

          const updated = reordered.map((ent, i) => ({
            ...ent,
            z_index: reordered.length - 1 - i,
          }));
          onReorderRef.current(updated);
        }
      }
      setDragId(null);
      setOverIdx(null);
      setTimeout(() => { didDrag.current = false; }, 0);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [dragId, overIdx]);

  useEffect(() => {
    if (!menuId) return;
    const handleClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".layer-menu")) {
        setMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuId]);

  const handleMouseDown = useCallback((e: React.MouseEvent, id: string) => {
    if (!(e.target as HTMLElement).closest(".layer-handle")) return;
    e.preventDefault();
    didDrag.current = false;
    setDragId(id);
  }, []);

  const handleClick = useCallback((id: string) => {
    if (didDrag.current) return;
    onSelectEntry(id);
  }, [onSelectEntry]);

  const dragFromIdx = dragId ? sorted.findIndex((e) => e.id === dragId) : -1;

  return (
    <div className="layer-list" ref={listRef}>
      <div className="panel-header layer-list-header">
        <span>Layers</span>
        <button className="btn btn-primary btn-sm layer-add-btn" onClick={onAdd} title="Add entry">+</button>
      </div>
      <div className="layer-items" ref={scrollRef}>
        {sorted.length === 0 && (
          <div className="empty-state" style={{ padding: 12, fontSize: 12 }}>No entries yet.</div>
        )}
        {sorted.map((entry, idx) => {
          const label = getEntryLabel(entry, atlases);
          const tag = getEntryTypeTag(entry);
          const bg = isDecoration(entry);
          const isSelected = entry.id === selectedEntryId;
          const isDragging = dragId === entry.id;
          const showDropBefore = overIdx === idx && dragFromIdx !== idx && dragFromIdx !== idx - 1;
          const showDropAfter = overIdx === sorted.length && idx === sorted.length - 1 && dragFromIdx !== idx;

          return (
            <div
              key={entry.id}
              ref={(el) => {
                if (el) itemRefs.current.set(entry.id, el);
                else itemRefs.current.delete(entry.id);
              }}
              className={`layer-row${isSelected ? " selected" : ""}${isDragging ? " dragging" : ""}${showDropBefore ? " drop-before" : ""}${showDropAfter ? " drop-after" : ""}`}
              onMouseDown={(e) => handleMouseDown(e, entry.id)}
              onClick={() => handleClick(entry.id)}
            >
              <span className="layer-handle" title="Drag to reorder">⠿</span>
              <div className="layer-thumb">
                <LayerThumb entry={entry} atlases={atlases} layoutName={layoutName} shapeStyles={shapeStyles} />
              </div>
              <div className="layer-info">
                <span className="layer-name">{label}</span>
                <span className="layer-meta">
                  {bg ? "deco" : "input"} &middot; {tag}
                </span>
              </div>
              <div className="layer-menu">
                <button
                  className="layer-menu-trigger"
                  onClick={(e) => { e.stopPropagation(); setMenuId(menuId === entry.id ? null : entry.id); }}
                  title="Actions"
                >⋮</button>
                {menuId === entry.id && (
                  <div className="layer-menu-dropdown">
                    <button onClick={(e) => { e.stopPropagation(); setMenuId(null); onDuplicate(entry.id); }}>Duplicate</button>
                    <button className="layer-menu-danger" onClick={(e) => { e.stopPropagation(); setMenuId(null); onRemove(entry.id); }}>Remove</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        .layer-list {
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 0;
        }
        .layer-list-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .layer-add-btn {
          padding: 0 6px !important;
          font-size: 14px !important;
          line-height: 20px;
        }
        .layer-items {
          display: flex;
          flex-direction: column;
          gap: 1px;
          flex: 1;
          min-height: 0;
          overflow-y: auto;
        }
        .layer-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 5px 6px;
          border-radius: 4px;
          cursor: pointer;
          user-select: none;
          border: 1px solid rgba(255,255,255,0.06);
          transition: background 0.1s, border-color 0.1s;
        }
        .layer-row:hover {
          background: rgba(255,255,255,0.04);
          border-color: rgba(255,255,255,0.1);
        }
        .layer-row.selected {
          background: rgba(232, 115, 12, 0.12);
          border-color: rgba(232, 115, 12, 0.3);
        }
        .layer-row.dragging {
          opacity: 0.25;
        }
        .layer-row.drop-before {
          border-top: 2px solid #e8730c;
        }
        .layer-row.drop-after {
          border-bottom: 2px solid #e8730c;
        }
        .layer-handle {
          cursor: grab;
          color: #555;
          font-size: 12px;
          line-height: 1;
          flex-shrink: 0;
          padding: 4px 0;
        }
        .layer-handle:hover {
          color: #999;
        }
        .layer-handle:active {
          cursor: grabbing;
        }
        .layer-thumb {
          width: 32px;
          height: 32px;
          flex-shrink: 0;
          border-radius: 4px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .layer-thumb-img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          image-rendering: pixelated;
        }
        .layer-thumb-shape {
          width: 22px;
          height: 22px;
        }
        .layer-thumb-fallback {
          font-size: 14px;
          font-weight: 600;
          color: #666;
          line-height: 1;
        }
        .layer-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 1px;
        }
        .layer-name {
          font-size: 12px;
          color: #ddd;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .layer-meta {
          font-size: 10px;
          color: #666;
        }
        .layer-menu {
          position: relative;
          flex-shrink: 0;
        }
        .layer-menu-trigger {
          background: none;
          border: none;
          color: #555;
          cursor: pointer;
          font-size: 14px;
          padding: 2px 4px;
          line-height: 1;
          border-radius: 3px;
        }
        .layer-menu-trigger:hover {
          color: #ccc;
          background: rgba(255,255,255,0.08);
        }
        .layer-menu-dropdown {
          position: absolute;
          top: 100%;
          right: 0;
          margin-top: 2px;
          background: #2a2a2a;
          border: 1px solid #3a3a3a;
          border-radius: 6px;
          min-width: 110px;
          z-index: 50;
          overflow: hidden;
        }
        .layer-menu-dropdown button {
          display: block;
          width: 100%;
          text-align: left;
          padding: 6px 10px;
          border: none;
          background: transparent;
          color: #ddd;
          font-size: 12px;
          cursor: pointer;
        }
        .layer-menu-dropdown button:hover {
          background: rgba(255,255,255,0.08);
        }
        .layer-menu-danger {
          color: #e74c3c !important;
        }
        .layer-menu-danger:hover {
          background: rgba(231, 76, 60, 0.15) !important;
        }
      `}</style>
    </div>
  );
}
