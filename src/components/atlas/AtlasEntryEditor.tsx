import { useState, useEffect, useRef } from "react";
import type { AtlasEntry, ImageRef, SourceImage } from "../../types/atlas";
import { imageRefIsEmpty } from "../../types/atlas";
import type { InputId } from "../../types/input";
import { inputIdToString } from "../../types/input";
import { SourceImageRectSelector } from "./SourceImageRectSelector";
import { AtlasImage } from "./AtlasImage";
import { ask } from "@tauri-apps/plugin-dialog";

interface Props {
  entry: AtlasEntry;
  atlasName: string;
  isPressed: boolean;
  currentInput: InputId | null;
  sourceImages: SourceImage[];
  onUpdate: (entry: AtlasEntry) => void;
  onRemove: () => void;
  onUploadImage: (
    entryId: string,
    field: "pressed_image" | "unpressed_image",
  ) => void;
  onUpdateSource?: (filename: string, updated: SourceImage) => void;
}

// "idle" = not listening
// "waitForRelease" = listening, but ignoring input until everything is released
// "waitForInput" = listening, will assign the next valid input
type ListenPhase = "idle" | "waitForRelease" | "waitForInput";

export function AtlasEntryEditor({
  entry,
  atlasName,
  isPressed,
  currentInput,
  sourceImages,
  onUpdate,
  onRemove,
  onUploadImage,
  onUpdateSource,
}: Props) {
  const [listenPhase, setListenPhase] = useState<ListenPhase>("idle");
  const [allowMouse, setAllowMouse] = useState(false);
  const [selectingFor, setSelectingFor] = useState<
    "pressed_image" | "unpressed_image" | null
  >(null);

  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const entryRef = useRef(entry);
  entryRef.current = entry;

  const startListening = () => {
    setListenPhase("waitForRelease");
  };

  const cancelListening = () => {
    setListenPhase("idle");
  };

  useEffect(() => {
    if (listenPhase === "waitForInput") {
      setListenPhase("idle");
      const id = setTimeout(() => setListenPhase("waitForRelease"), 300);
      return () => clearTimeout(id);
    }
  }, [allowMouse]);

  useEffect(() => {
    if (listenPhase === "idle") return;

    if (listenPhase === "waitForRelease") {
      if (!currentInput) {
        setListenPhase("waitForInput");
      }
      return;
    }

    if (!currentInput) return;
    if (!allowMouse && currentInput.type === "MouseButton") return;

    onUpdateRef.current({ ...entryRef.current, input_id: currentInput });
    setListenPhase("idle");
  }, [listenPhase, currentInput, allowMouse]);

  const handleRectSelect = (ref_: ImageRef) => {
    if (selectingFor) {
      // Only auto-set size from rect when the field had no image before
      const wasEmpty = imageRefIsEmpty(entry[selectingFor]);
      const sizeUpdate =
        wasEmpty && typeof ref_ !== "string"
          ? { width: ref_.w, height: ref_.h }
          : {};
      onUpdate({ ...entry, [selectingFor]: ref_, ...sizeUpdate });
    }
    setSelectingFor(null);
  };

  return (
    <div className={`entry-editor ${isPressed ? "pressed" : ""}`}>
      <div className="entry-editor-header">
        <div className="entry-editor-title">{entry.label || "Untitled"}</div>
        <span className="entry-editor-input-badge">{inputIdToString(entry.input_id)}</span>
      </div>

      <div className="entry-detail">
        <div className="entry-detail-row">
          <label>Label:</label>
          <input
            type="text"
            value={entry.label}
            onChange={(e) => onUpdate({ ...entry, label: e.target.value })}
          />
        </div>
        <div className="entry-detail-row">
          <label>Input:</label>
          <span className="input-badge">{inputIdToString(entry.input_id)}</span>
          {listenPhase !== "idle" ? (
            <>
              <span className="listening-indicator">
                {listenPhase === "waitForRelease"
                  ? "Release all..."
                  : "Press a key..."}
              </span>
              <button className="btn btn-sm" onClick={cancelListening}>
                Cancel
              </button>
              <label className="mouse-toggle">
                <input
                  type="checkbox"
                  checked={allowMouse}
                  onChange={(e) => setAllowMouse(e.target.checked)}
                />
                Mouse
              </label>
            </>
          ) : (
            <button className="btn btn-sm" onClick={startListening}>
              Assign
            </button>
          )}
        </div>
        <div className="entry-detail-row">
          <label>Display:</label>
          <input
            type="number"
            value={entry.width}
            onChange={(e) =>
              onUpdate({ ...entry, width: parseInt(e.target.value) || 64 })
            }
            style={{ width: 72 }}
          />
          <span>x</span>
          <input
            type="number"
            value={entry.height}
            onChange={(e) =>
              onUpdate({ ...entry, height: parseInt(e.target.value) || 64 })
            }
            style={{ width: 72 }}
          />
          <span className="entry-size-hint">px</span>
        </div>
        {(["unpressed_image", "pressed_image"] as const).map((field) => {
          const ref = entry[field];
          const empty = imageRefIsEmpty(ref);
          return (
            <div key={field} className="entry-img-section">
              <div className="entry-img-section-header">
                <span className="entry-img-section-label">
                  {field === "unpressed_image" ? "Unpressed" : "Pressed"}
                </span>
                <div className="entry-img-section-actions">
                  {sourceImages.length > 0 && (
                    <button
                      className="btn btn-sm"
                      onClick={() => setSelectingFor(field)}
                    >
                      {!empty && typeof ref !== "string" ? "Edit Rect" : "From Source"}
                    </button>
                  )}
                  <button
                    className="btn btn-sm"
                    onClick={() => onUploadImage(entry.id, field)}
                  >
                    Upload
                  </button>
                </div>
              </div>
              {!empty ? (
                <div className="entry-img-section-content">
                  <AtlasImage
                    atlasName={atlasName}
                    imageRef={ref}
                    alt={field === "unpressed_image" ? "unpressed" : "pressed"}
                    className="entry-img-section-preview"
                  />
                  <span className="entry-img-ref-info">
                    {typeof ref === "string"
                      ? ref
                      : `${ref.source} (${ref.x}, ${ref.y}, ${ref.w}x${ref.h})`}
                  </span>
                </div>
              ) : (
                <div className="entry-img-section-empty">No image set</div>
              )}
            </div>
          );
        })}
        <div className="entry-detail-footer">
          <button className="btn btn-danger btn-sm" onClick={async () => {
            const confirmed = await ask(
              `Remove entry "${entry.label}"?`,
              { title: "Remove Entry", kind: "warning" },
            );
            if (confirmed) onRemove();
          }}>
            Remove Entry
          </button>
        </div>
      </div>

      {selectingFor && (
        <SourceImageRectSelector
          atlasName={atlasName}
          sourceImages={sourceImages}
          existingRef={entry[selectingFor]}
          onSelect={handleRectSelect}
          onCancel={() => setSelectingFor(null)}
          onUpdateSource={onUpdateSource}
        />
      )}

      <style>{`
        .entry-editor {
          background: #181818;
          border: 1px solid #3a3a3a;
          border-radius: 6px;
          transition: border-color 0.15s;
        }
        .entry-editor.pressed {
          border-color: #e8730c;
          box-shadow: 0 0 8px rgba(232, 115, 12, 0.3);
        }
        .entry-editor-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-bottom: 1px solid #2a2a2a;
        }
        .entry-editor-title {
          font-size: 15px;
          font-weight: 600;
          color: #e0e0e0;
          flex: 1;
        }
        .entry-editor-input-badge {
          font-size: 11px;
          font-family: monospace;
          color: #777;
          background: #2a2a2a;
          padding: 2px 6px;
          border-radius: 3px;
        }
        .entry-detail {
          padding: 10px 12px 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .entry-detail-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
        }
        .entry-detail-row label {
          min-width: 44px;
          color: #999;
          font-size: 12px;
        }
        .entry-detail-row input[type="text"] {
          flex: 1;
          min-width: 0;
        }
        .input-badge {
          background: #2a2a2a;
          padding: 3px 8px;
          border-radius: 4px;
          font-family: monospace;
          font-size: 12px;
        }
        .listening-indicator {
          color: #e8730c;
          font-style: italic;
          font-size: 12px;
          animation: pulse 1s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .mouse-toggle {
          display: flex;
          align-items: center;
          gap: 3px;
          font-size: 11px;
          color: #999;
          cursor: pointer;
          min-width: auto !important;
        }
        .mouse-toggle input {
          width: auto;
        }
        .entry-size-hint {
          font-size: 11px;
          color: #666;
        }
        .entry-img-section {
          border: 1px solid #2a2a2a;
          border-radius: 6px;
          overflow: hidden;
        }
        .entry-img-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 10px;
          background: #222;
        }
        .entry-img-section-label {
          font-size: 12px;
          font-weight: 600;
          color: #999;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .entry-img-section-actions {
          display: flex;
          gap: 4px;
        }
        .entry-img-section-content {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
        }
        .entry-img-section-preview {
          width: 48px;
          height: 48px;
          object-fit: contain;
          background: #2a2a2a;
          border-radius: 4px;
          flex-shrink: 0;
        }
        .entry-img-ref-info {
          font-size: 11px;
          font-family: monospace;
          color: #777;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          min-width: 0;
        }
        .entry-img-section-empty {
          padding: 10px;
          font-size: 12px;
          color: #555;
          font-style: italic;
        }
        .entry-detail-footer {
          display: flex;
          justify-content: flex-end;
          padding-top: 4px;
        }
      `}</style>
    </div>
  );
}
