import { useState, useRef, useCallback, useEffect } from "react";
import { cropAtlasImage } from "../../lib/commands";
import { AtlasImage } from "./AtlasImage";

interface Props {
  atlasName: string;
  sourceImages: string[];
  onSelect: (filename: string) => void;
  onCancel: () => void;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function SourceImageRectSelector({
  atlasName,
  sourceImages,
  onSelect,
  onCancel,
}: Props) {
  const [selectedSource, setSelectedSource] = useState(sourceImages[0] ?? "");
  const [rect, setRect] = useState<Rect | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [cropping, setCropping] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });

  const toImageCoords = useCallback(
    (clientX: number, clientY: number) => {
      const img = imgRef.current;
      if (!img || naturalSize.w === 0) return { x: 0, y: 0 };
      const bounds = img.getBoundingClientRect();
      const scaleX = naturalSize.w / bounds.width;
      const scaleY = naturalSize.h / bounds.height;
      return {
        x: Math.round(
          Math.max(
            0,
            Math.min(naturalSize.w, (clientX - bounds.left) * scaleX),
          ),
        ),
        y: Math.round(
          Math.max(0, Math.min(naturalSize.h, (clientY - bounds.top) * scaleY)),
        ),
      };
    },
    [naturalSize],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const pos = toImageCoords(e.clientX, e.clientY);
      setDragStart(pos);
      setDragging(true);
      setRect(null);
    },
    [toImageCoords],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging) return;
      const pos = toImageCoords(e.clientX, e.clientY);
      const x = Math.min(dragStart.x, pos.x);
      const y = Math.min(dragStart.y, pos.y);
      const w = Math.abs(pos.x - dragStart.x);
      const h = Math.abs(pos.y - dragStart.y);
      if (w > 1 && h > 1) {
        setRect({ x, y, w, h });
      }
    },
    [dragging, dragStart, toImageCoords],
  );

  const handleMouseUp = useCallback(() => {
    setDragging(false);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  const handleCrop = async () => {
    if (!rect || rect.w < 1 || rect.h < 1) return;
    setCropping(true);
    try {
      const filename = await cropAtlasImage(
        atlasName,
        selectedSource,
        rect.x,
        rect.y,
        rect.w,
        rect.h,
      );
      onSelect(filename);
    } catch (err) {
      console.error("Crop failed:", err);
      setCropping(false);
    }
  };

  // Compute overlay rect position relative to displayed image
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

        {sourceImages.length > 1 && (
          <div className="source-picker">
            {sourceImages.map((name) => (
              <button
                key={name}
                className={`btn btn-sm ${selectedSource === name ? "btn-primary" : ""}`}
                onClick={() => {
                  setSelectedSource(name);
                  setRect(null);
                }}
              >
                {name.length > 25 ? "..." + name.slice(-22) : name}
              </button>
            ))}
          </div>
        )}

        <div className="rect-selector-canvas">
          <div
            className="image-container"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <AtlasImage
              ref={imgRef}
              atlasName={atlasName}
              filename={selectedSource}
              alt="source"
              draggable={false}
              onLoad={(e) => {
                const img = e.currentTarget;
                setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
              }}
              className="source-image"
            />
            {overlayStyle && (
              <div className="selection-rect" style={overlayStyle} />
            )}
          </div>
        </div>

        {rect && (
          <div className="rect-info">
            {rect.w} x {rect.h} px (at {rect.x}, {rect.y})
          </div>
        )}

        <div className="rect-selector-actions">
          <button
            className="btn btn-primary"
            disabled={!rect || cropping}
            onClick={handleCrop}
          >
            {cropping ? "Cropping..." : "Crop & Use"}
          </button>
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
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
        .source-picker {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
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
        .rect-info {
          font-size: 12px;
          color: #999;
          text-align: center;
          font-family: monospace;
        }
        .rect-selector-actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
        }
      `}</style>
    </div>
  );
}
