import { useState, useEffect, useRef } from "react";
import type { AtlasEntry } from "../../types/atlas";
import type { InputId } from "../../types/input";
import { inputIdToString } from "../../types/input";
import { SourceImageRectSelector } from "./SourceImageRectSelector";
import { AtlasImage } from "./AtlasImage";

interface Props {
  entry: AtlasEntry;
  atlasName: string;
  isPressed: boolean;
  currentInput: InputId | null;
  sourceImages: string[];
  onUpdate?: (entry: AtlasEntry) => void;
  onRemove?: () => void;
  onUploadImage?: (
    entryId: string,
    field: "pressed_image" | "unpressed_image",
  ) => void;
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

  // When allowMouse changes during listening, temporarily go idle so the
  // checkbox click (and its release) are fully ignored, then re-gate.
  useEffect(() => {
    if (listenPhase === "waitForInput") {
      setListenPhase("idle");
      const id = setTimeout(() => setListenPhase("waitForRelease"), 300);
      return () => clearTimeout(id);
    }
  }, [allowMouse]);

  // Main assignment logic
  useEffect(() => {
    if (listenPhase === "idle") return;

    if (listenPhase === "waitForRelease") {
      // Wait until all inputs are released before accepting new input
      if (!currentInput) {
        setListenPhase("waitForInput");
      }
      return;
    }

    // listenPhase === "waitForInput"
    if (!currentInput) return;
    if (!allowMouse && currentInput.type === "MouseButton") return;

    onUpdateRef.current?.({ ...entryRef.current, input_id: currentInput });
    setListenPhase("idle");
  }, [listenPhase, currentInput, allowMouse]);

  const readOnly = !onUpdate;

  const handleCropComplete = (filename: string) => {
    if (selectingFor && onUpdate) {
      onUpdate({ ...entry, [selectingFor]: filename });
    }
    setSelectingFor(null);
  };

  return (
    <div className={`entry-editor ${isPressed ? "pressed" : ""}`}>
      <div className="entry-header">
        {readOnly ? (
          <span className="entry-label">{entry.label}</span>
        ) : (
          <input
            type="text"
            value={entry.label}
            onChange={(e) => onUpdate({ ...entry, label: e.target.value })}
            className="entry-label"
          />
        )}
        {onRemove && (
          <button className="btn btn-danger btn-sm" onClick={onRemove}>
            Remove
          </button>
        )}
      </div>

      <div className="entry-row">
        <label>Input:</label>
        <span className="input-badge">{inputIdToString(entry.input_id)}</span>
        {!readOnly && (
          listenPhase !== "idle" ? (
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
                Allow mouse
              </label>
            </>
          ) : (
            <button className="btn btn-sm" onClick={startListening}>
              Assign
            </button>
          )
        )}
      </div>

      <div className="entry-row">
        <label>Size:</label>
        {readOnly ? (
          <span>{entry.width} x {entry.height}</span>
        ) : (
          <>
            <input
              type="number"
              value={entry.width}
              onChange={(e) =>
                onUpdate({ ...entry, width: parseInt(e.target.value) || 64 })
              }
              style={{ width: 60 }}
            />
            <span>x</span>
            <input
              type="number"
              value={entry.height}
              onChange={(e) =>
                onUpdate({ ...entry, height: parseInt(e.target.value) || 64 })
              }
              style={{ width: 60 }}
            />
          </>
        )}
      </div>

      <div className="entry-images">
        <div className="image-slot">
          <div className="image-label">Unpressed</div>
          {entry.unpressed_image ? (
            <AtlasImage
              atlasName={atlasName}
              filename={entry.unpressed_image}
              alt="unpressed"
              className="image-preview"
            />
          ) : (
            <div className="image-placeholder" />
          )}
          {!readOnly && (
            <div className="image-buttons">
              {sourceImages.length > 0 && (
                <button
                  className="btn btn-sm"
                  onClick={() => setSelectingFor("unpressed_image")}
                >
                  From Source
                </button>
              )}
              <button
                className="btn btn-sm"
                onClick={() => onUploadImage?.(entry.id, "unpressed_image")}
              >
                Upload
              </button>
            </div>
          )}
        </div>
        <div className="image-slot">
          <div className="image-label">Pressed</div>
          {entry.pressed_image ? (
            <AtlasImage
              atlasName={atlasName}
              filename={entry.pressed_image}
              alt="pressed"
              className="image-preview"
            />
          ) : (
            <div className="image-placeholder" />
          )}
          {!readOnly && (
            <div className="image-buttons">
              {sourceImages.length > 0 && (
                <button
                  className="btn btn-sm"
                  onClick={() => setSelectingFor("pressed_image")}
                >
                  From Source
                </button>
              )}
              <button
                className="btn btn-sm"
                onClick={() => onUploadImage?.(entry.id, "pressed_image")}
              >
                Upload
              </button>
            </div>
          )}
        </div>
      </div>

      {selectingFor && (
        <SourceImageRectSelector
          atlasName={atlasName}
          sourceImages={sourceImages}
          onSelect={handleCropComplete}
          onCancel={() => setSelectingFor(null)}
        />
      )}

      <style>{`
        .entry-editor {
          background: #181818;
          border: 1px solid #3a3a3a;
          border-radius: 6px;
          padding: 12px;
          transition: border-color 0.15s;
        }
        .entry-editor.pressed {
          border-color: #e8730c;
          box-shadow: 0 0 8px rgba(232, 115, 12, 0.3);
        }
        .entry-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .entry-label {
          font-weight: 600;
          font-size: 14px;
          background: transparent;
          border: 1px solid transparent;
          color: #e0e0e0;
          padding: 4px 8px;
          border-radius: 4px;
        }
        .entry-label:focus {
          border-color: #3a3a3a;
          background: #2a2a2a;
        }
        .entry-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
          font-size: 13px;
        }
        .entry-row label {
          min-width: 50px;
          color: #999;
        }
        .input-badge {
          background: #2a2a2a;
          padding: 4px 10px;
          border-radius: 4px;
          font-family: monospace;
          font-size: 12px;
        }
        .listening-indicator {
          color: #e8730c;
          font-style: italic;
          animation: pulse 1s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .mouse-toggle {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: #999;
          cursor: pointer;
          min-width: auto !important;
        }
        .mouse-toggle input {
          width: auto;
        }
        .entry-images {
          display: flex;
          gap: 16px;
        }
        .image-slot {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }
        .image-label {
          font-size: 11px;
          color: #999;
          text-transform: uppercase;
        }
        .image-preview {
          width: 64px;
          height: 64px;
          object-fit: contain;
          background: #2a2a2a;
          border-radius: 4px;
        }
        .image-placeholder {
          width: 64px;
          height: 64px;
          background: #2a2a2a;
          border: 1px dashed #3a3a3a;
          border-radius: 4px;
        }
        .image-buttons {
          display: flex;
          gap: 4px;
        }
      `}</style>
    </div>
  );
}
