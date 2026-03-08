import { useState, useRef, useEffect } from "react";
import type { LayoutEntry, EntrySource, LabelConfig, ShapeStyle, TextStyle } from "../../types/layout";
import type { Atlas } from "../../types/atlas";
import { imageRefIsEmpty } from "../../types/atlas";
import type { InputId } from "../../types/input";
import { AtlasImage } from "../atlas/AtlasImage";
import { InputAssign } from "../shared/InputAssign";
import { importLayoutImage } from "../../lib/commands";
import { open } from "@tauri-apps/plugin-dialog";

interface Props {
  entry: LayoutEntry;
  atlases: Map<string, Atlas>;
  layoutName: string;
  currentInput: InputId | null;
  shapeStyles: ShapeStyle[];
  textStyles: TextStyle[];
  onUpdate: (entry: LayoutEntry) => void;
  onRemove: () => void;
  onBack: () => void;
}

function getSourceLabel(source: EntrySource, atlases: Map<string, Atlas>): string {
  if (source.type === "atlas") {
    const atlas = atlases.get(source.atlas_name);
    const ae = atlas?.entries.find((e) => e.id === source.entry_id);
    return ae?.label || source.entry_id;
  }
  return source.label;
}

function isDecoration(source: EntrySource): boolean {
  if (source.type === "atlas") return false;
  return !source.input_id;
}

export function LayoutEntryProperties({
  entry,
  atlases,
  layoutName,
  currentInput,
  shapeStyles,
  textStyles,
  onUpdate,
  onRemove,
  onBack,
}: Props) {
  const src = entry.source;
  const label = getSourceLabel(src, atlases);
  const [editing, setEditing] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [editing]);
  const decoration = isDecoration(src);
  const isAtlas = src.type === "atlas";
  const isInline = src.type === "inline";
  const isShape = src.type === "shape";

  const updateSource = (partial: Partial<EntrySource>) => {
    onUpdate({ ...entry, source: { ...src, ...partial } as EntrySource });
  };

  const updateLabel = (partial: Partial<LabelConfig>) => {
    const current = entry.label || { text: "", color: "#ffffff" };
    onUpdate({ ...entry, label: { ...current, ...partial } });
  };

  const removeLabel = () => {
    const { label: _, ...rest } = entry;
    onUpdate(rest as LayoutEntry);
  };

  const inputId: InputId | null = isAtlas
    ? (() => {
        const atlas = atlases.get(src.atlas_name);
        const ae = atlas?.entries.find((e) => e.id === src.entry_id);
        return ae?.input_id ?? null;
      })()
    : src.input_id ?? null;

  const handlePickImage = async (field: "pressed_image" | "unpressed_image") => {
    if (!isInline) return;
    const path = await open({
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp"] }],
    });
    if (!path) return;
    const filename = await importLayoutImage(layoutName, path as string);
    updateSource({ [field]: filename });
  };

  return (
    <div className="entry-properties">
      <div className="panel-header">
        {isAtlas ? (
          <span className="prop-header-name">{label}</span>
        ) : editing ? (
          <input
            ref={nameInputRef}
            className="prop-header-input"
            type="text"
            value={src.label}
            onChange={(e) => updateSource({ label: e.target.value })}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => { if (e.key === "Enter") setEditing(false); }}
          />
        ) : (
          <span className="prop-header-name">
            {label}
            <button className="prop-label-edit" onClick={() => setEditing(true)} title="Rename">&#9998;</button>
          </span>
        )}
        <button className="back-btn" onClick={onBack} title="Back to layers">&larr;</button>
      </div>
      <div className="prop-type-badge">
        {isAtlas ? `atlas: ${src.atlas_name}` : isShape ? "shape" : "inline"}
        {decoration && " (decoration)"}
      </div>

      <div className="prop-row">
        <label>X:</label>
        <input
          type="number"
          value={entry.x}
          onChange={(e) => onUpdate({ ...entry, x: parseFloat(e.target.value) || 0 })}
        />
      </div>
      <div className="prop-row">
        <label>Y:</label>
        <input
          type="number"
          value={entry.y}
          onChange={(e) => onUpdate({ ...entry, y: parseFloat(e.target.value) || 0 })}
        />
      </div>
      <div className="prop-row">
        <label>Scale:</label>
        <input
          type="number"
          step="0.1"
          min="0.1"
          value={entry.scale}
          onChange={(e) => onUpdate({ ...entry, scale: parseFloat(e.target.value) || 1 })}
        />
      </div>
      <div className="prop-row">
        <label>Rotation:</label>
        <input
          type="number"
          step="15"
          value={entry.rotation}
          onChange={(e) => onUpdate({ ...entry, rotation: parseFloat(e.target.value) || 0 })}
        />
      </div>
      {/* Input binding — only for non-decoration entries */}
      {!decoration && inputId && (
        <div className="prop-section">
          <div className="prop-section-header">Input{isAtlas ? " (read-only)" : ""}</div>
          {isAtlas ? (
            <div className="prop-row">
              <label>Binding:</label>
              <span className="prop-readonly">{inputId.type}:{inputId.value}</span>
            </div>
          ) : (
            <InputAssign
              inputId={inputId}
              currentInput={currentInput}
              onAssign={(id) => updateSource({ input_id: id })}
            />
          )}
        </div>
      )}

      {/* Shape-specific properties */}
      {isShape && (
        <div className="prop-section">
          <div className="prop-section-header">Shape</div>
          <div className="prop-row">
            <label>Shape:</label>
            <select
              value={src.shape}
              onChange={(e) => updateSource({ shape: e.target.value as "rect" | "circle" })}
            >
              <option value="rect">Rectangle</option>
              <option value="circle">Circle</option>
            </select>
          </div>
          <div className="prop-row">
            <label>Width:</label>
            <input
              type="number"
              min={1}
              value={src.width}
              onChange={(e) => updateSource({ width: parseInt(e.target.value) || 64 })}
            />
          </div>
          <div className="prop-row">
            <label>Height:</label>
            <input
              type="number"
              min={1}
              value={src.height}
              onChange={(e) => updateSource({ height: parseInt(e.target.value) || 64 })}
            />
          </div>

          {!decoration && <div className="prop-subsection-header">Unpressed</div>}
          <div className="prop-row">
            <label>Style:</label>
            <select
              value={src.shape_style_id ?? ""}
              onChange={(e) => updateSource({ shape_style_id: e.target.value || undefined })}
            >
              <option value="">— select —</option>
              {shapeStyles.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          {!decoration && (
            <>
              <div className="prop-subsection-header">Pressed</div>
              <div className="prop-row">
                <label>Style:</label>
                <select
                  value={src.pressed_shape_style_id ?? ""}
                  onChange={(e) => updateSource({ pressed_shape_style_id: e.target.value || undefined })}
                >
                  <option value="">— select —</option>
                  {shapeStyles.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}
          {!src.shape_style_id && shapeStyles.length === 0 && (
            <div className="prop-style-note">
              Create shape styles via the Styles button in the toolbar.
            </div>
          )}
        </div>
      )}

      {/* Inline-specific properties */}
      {isInline && (
        <div className="prop-section">
          <div className="prop-section-header">Images</div>
          <div className="prop-row">
            <label>Width:</label>
            <input
              type="number"
              min={1}
              value={src.width}
              onChange={(e) => updateSource({ width: parseInt(e.target.value) || 64 })}
            />
          </div>
          <div className="prop-row">
            <label>Height:</label>
            <input
              type="number"
              min={1}
              value={src.height}
              onChange={(e) => updateSource({ height: parseInt(e.target.value) || 64 })}
            />
          </div>
          <div className="prop-image-row">
            <span className="prop-image-label">Unpressed:</span>
            {!imageRefIsEmpty(src.unpressed_image) ? (
              <div className="prop-image-preview">
                <AtlasImage
                  atlasName={layoutName}
                  imageRef={src.unpressed_image}
                  alt="unpressed"
                  className="prop-img-thumb"
                  layoutMode
                />
                <button className="btn btn-sm" onClick={() => updateSource({ unpressed_image: "" })}>x</button>
              </div>
            ) : (
              <button className="btn btn-sm" onClick={() => handlePickImage("unpressed_image")}>
                Choose...
              </button>
            )}
          </div>
          {!decoration && (
            <div className="prop-image-row">
              <span className="prop-image-label">Pressed:</span>
              {!imageRefIsEmpty(src.pressed_image) ? (
                <div className="prop-image-preview">
                  <AtlasImage
                    atlasName={layoutName}
                    imageRef={src.pressed_image}
                    alt="pressed"
                    className="prop-img-thumb"
                    layoutMode
                  />
                  <button className="btn btn-sm" onClick={() => updateSource({ pressed_image: "" })}>x</button>
                </div>
              ) : (
                <button className="btn btn-sm" onClick={() => handlePickImage("pressed_image")}>
                  Choose...
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Text label overlay */}
      <div className="prop-section">
        <div className="prop-section-header">
          Text Label
          {!entry.label && (
            <button
              className="btn btn-sm"
              style={{ marginLeft: 8 }}
              onClick={() => updateLabel({ text: label })}
            >
              + Add
            </button>
          )}
        </div>
        {entry.label && (
          <>
            <div className="prop-row">
              <label>Text:</label>
              <input
                type="text"
                value={entry.label.text}
                onChange={(e) => updateLabel({ text: e.target.value })}
              />
            </div>
            {!decoration && <div className="prop-subsection-header">Unpressed</div>}
            <div className="prop-row">
              <label>Style:</label>
              <select
                value={entry.label.text_style_id ?? ""}
                onChange={(e) => updateLabel({ text_style_id: e.target.value || undefined })}
              >
                <option value="">— select —</option>
                {textStyles.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            {!decoration && (
              <>
                <div className="prop-subsection-header">Pressed</div>
                <div className="prop-row">
                  <label>Style:</label>
                  <select
                    value={entry.label.pressed_text_style_id ?? ""}
                    onChange={(e) => updateLabel({ pressed_text_style_id: e.target.value || undefined })}
                  >
                    <option value="">— select —</option>
                    {textStyles.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
            {!entry.label.text_style_id && textStyles.length === 0 && (
              <div className="prop-style-note">
                Create text styles via the Styles button in the toolbar.
              </div>
            )}
            <button className="btn btn-sm" onClick={removeLabel} style={{ alignSelf: "flex-start" }}>
              Remove Label
            </button>
          </>
        )}
      </div>

      <button
        className="btn btn-danger"
        style={{ marginTop: 12, width: "100%" }}
        onClick={onRemove}
      >
        Remove from Layout
      </button>

      <style>{`
        .entry-properties {
          display: flex;
          flex-direction: column;
          gap: 8px;
          min-width: 0;
          max-width: 100%;
        }
        .entry-properties .panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .back-btn {
          background: none;
          border: none;
          color: #999;
          cursor: pointer;
          font-size: 16px;
          padding: 0 4px;
          line-height: 1;
        }
        .back-btn:hover {
          color: #e8730c;
        }
        .prop-header-name {
          display: flex;
          align-items: center;
          gap: 6px;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .prop-label-edit {
          background: none;
          border: none;
          color: #666;
          cursor: pointer;
          font-size: 12px;
          padding: 0;
          line-height: 1;
          flex-shrink: 0;
        }
        .prop-label-edit:hover {
          color: #e8730c;
        }
        .prop-header-input {
          font-weight: 600;
          color: #e8730c;
          font-size: 13px;
          background: transparent;
          border: none;
          border-bottom: 1px solid #e8730c;
          border-radius: 0;
          padding: 0;
          outline: none;
          flex: 1;
          min-width: 0;
        }
        .prop-type-badge {
          font-size: 11px;
          color: #888;
          margin-bottom: 4px;
        }
        .prop-row {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }
        .prop-row label {
          min-width: 60px;
          color: #999;
          font-size: 13px;
        }
        .prop-row input, .prop-row select {
          flex: 1;
          min-width: 0;
        }
        .prop-row input[type="checkbox"],
        .prop-row input[type="color"] {
          flex: none;
        }
        .prop-readonly {
          color: #ccc;
          font-family: monospace;
          font-size: 12px;
        }
        .prop-section {
          margin-top: 8px;
          border-top: 1px solid #333;
          padding-top: 8px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .prop-section-header {
          font-size: 11px;
          font-weight: 600;
          color: #aaa;
          text-transform: uppercase;
          display: flex;
          align-items: center;
        }
        .prop-subsection-header {
          font-size: 10px;
          font-weight: 600;
          color: #777;
          text-transform: uppercase;
          margin-top: 4px;
        }
        .prop-image-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .prop-image-label {
          min-width: 60px;
          color: #999;
          font-size: 13px;
        }
        .prop-image-preview {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .prop-img-thumb {
          width: 32px;
          height: 32px;
          object-fit: contain;
          border-radius: 3px;
          border: 1px solid #444;
        }
        .prop-style-note {
          font-size: 11px;
          color: #888;
          font-style: italic;
          padding: 4px 0;
        }
      `}</style>
    </div>
  );
}
