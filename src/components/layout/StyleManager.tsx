import { useState, useEffect, useRef, useMemo } from "react";
import type { Layout, ShapeStyle, TextStyle } from "../../types/layout";
import { listSystemFonts } from "../../lib/commands";

interface Props {
  layout: Layout;
  onSave: (layout: Layout) => void;
  onClose: () => void;
}

type Tab = "shape" | "text";

function countShapeStyleUsers(layout: Layout, styleId: string): number {
  return layout.entries.filter(
    (e) =>
      e.source.type === "shape" &&
      (e.source.shape_style_id === styleId || e.source.pressed_shape_style_id === styleId),
  ).length;
}

function countTextStyleUsers(layout: Layout, styleId: string): number {
  return layout.entries.filter(
    (e) => e.label?.text_style_id === styleId || e.label?.pressed_text_style_id === styleId,
  ).length;
}

function FontPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [fonts, setFonts] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listSystemFonts().then(setFonts).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(() => {
    if (!search) return fonts;
    const q = search.toLowerCase();
    return fonts.filter((f) => f.toLowerCase().includes(q));
  }, [fonts, search]);

  return (
    <div ref={ref} style={{ position: "relative", flex: 1 }}>
      <input
        type="text"
        value={open ? search : value}
        onFocus={() => { setOpen(true); setSearch(""); }}
        onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
        placeholder="Search fonts..."
        style={{ width: "100%", boxSizing: "border-box" }}
      />
      {open && (
        <div className="font-picker-dropdown">
          {filtered.slice(0, 100).map((f) => (
            <div
              key={f}
              className={`font-picker-option${f === value ? " selected" : ""}`}
              style={{ fontFamily: f }}
              onMouseDown={(e) => { e.preventDefault(); onChange(f); setOpen(false); }}
            >
              {f}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="font-picker-option" style={{ color: "#666" }}>No fonts found</div>
          )}
          {filtered.length > 100 && (
            <div className="font-picker-option" style={{ color: "#666" }}>
              {filtered.length - 100} more — type to filter
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function StyleManager({ layout, onSave, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("shape");
  const [editingId, setEditingId] = useState<string | null>(null);

  const shapeStyles = layout.shape_styles ?? [];
  const textStyles = layout.text_styles ?? [];

  const updateShapeStyles = (styles: ShapeStyle[]) => {
    onSave({ ...layout, shape_styles: styles });
  };

  const updateTextStyles = (styles: TextStyle[]) => {
    onSave({ ...layout, text_styles: styles });
  };

  const addShapeStyle = () => {
    const id = crypto.randomUUID();
    const style: ShapeStyle = {
      id,
      name: `Shape Style ${shapeStyles.length + 1}`,
      color: "#444444",
    };
    updateShapeStyles([...shapeStyles, style]);
    setEditingId(id);
  };

  const addTextStyle = () => {
    const id = crypto.randomUUID();
    const style: TextStyle = {
      id,
      name: `Text Style ${textStyles.length + 1}`,
      color: "#ffffff",
    };
    updateTextStyles([...textStyles, style]);
    setEditingId(id);
  };

  const updateShapeStyle = (id: string, partial: Partial<ShapeStyle>) => {
    updateShapeStyles(
      shapeStyles.map((s) => (s.id === id ? { ...s, ...partial } : s)),
    );
  };

  const updateTextStyle = (id: string, partial: Partial<TextStyle>) => {
    updateTextStyles(
      textStyles.map((s) => (s.id === id ? { ...s, ...partial } : s)),
    );
  };

  const removeShapeStyle = (id: string) => {
    updateShapeStyles(shapeStyles.filter((s) => s.id !== id));
  };

  const removeTextStyle = (id: string) => {
    updateTextStyles(textStyles.filter((s) => s.id !== id));
  };

  return (
    <div className="add-modal-overlay" onClick={onClose}>
      <div className="style-mgr-modal" onClick={(e) => e.stopPropagation()}>
        <div className="add-modal-title">Styles</div>

        <div className="style-mgr-tabs">
          <button
            className={`style-mgr-tab${tab === "shape" ? " active" : ""}`}
            onClick={() => setTab("shape")}
          >
            Shape ({shapeStyles.length})
          </button>
          <button
            className={`style-mgr-tab${tab === "text" ? " active" : ""}`}
            onClick={() => setTab("text")}
          >
            Text ({textStyles.length})
          </button>
        </div>

        <div className="style-mgr-list">
          {tab === "shape" && (
            <>
              {shapeStyles.length === 0 && (
                <div className="empty-state" style={{ padding: 16, fontSize: 12 }}>
                  No shape styles yet. Create one to reuse colors across shapes.
                </div>
              )}
              {shapeStyles.map((style) => {
                const users = countShapeStyleUsers(layout, style.id);
                const isEditing = editingId === style.id;
                return (
                  <div key={style.id} className="style-mgr-item">
                    <div className="style-mgr-item-header">
                      <div
                        className="style-mgr-swatch"
                        style={{ backgroundColor: style.fill !== false ? style.color : "transparent" }}
                      />
                      <input
                        className="style-mgr-name"
                        value={style.name}
                        onChange={(e) => updateShapeStyle(style.id, { name: e.target.value })}
                      />
                      <span className="style-mgr-users" title={`Used by ${users} entries`}>
                        {users}
                      </span>
                      <button
                        className="btn btn-sm"
                        onClick={() => setEditingId(isEditing ? null : style.id)}
                      >
                        {isEditing ? "Done" : "Edit"}
                      </button>
                      <button
                        className="btn btn-sm style-mgr-del"
                        onClick={() => removeShapeStyle(style.id)}
                        disabled={users > 0}
                        title={users > 0 ? `Used by ${users} entries` : "Delete style"}
                      >
                        x
                      </button>
                    </div>
                    {isEditing && (
                      <div className="style-mgr-detail">
                        <div className="style-mgr-row">
                          <label>Fill:</label>
                          <input
                            type="checkbox"
                            checked={style.fill !== false}
                            onChange={(e) => updateShapeStyle(style.id, { fill: e.target.checked })}
                          />
                          {style.fill !== false && (
                            <input
                              type="color"
                              value={style.color}
                              onChange={(e) => updateShapeStyle(style.id, { color: e.target.value })}
                            />
                          )}
                        </div>
                        <div className="style-mgr-row">
                          <label>Stroke:</label>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={style.stroke_width ?? 0}
                            onChange={(e) =>
                              updateShapeStyle(style.id, { stroke_width: parseFloat(e.target.value) || 0 })
                            }
                            style={{ width: 60 }}
                          />
                          {(style.stroke_width ?? 0) > 0 && (
                            <input
                              type="color"
                              value={style.stroke_color ?? "#ffffff"}
                              onChange={(e) => updateShapeStyle(style.id, { stroke_color: e.target.value })}
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              <button className="btn btn-primary btn-sm" onClick={addShapeStyle}>
                + New Shape Style
              </button>
            </>
          )}

          {tab === "text" && (
            <>
              {textStyles.length === 0 && (
                <div className="empty-state" style={{ padding: 16, fontSize: 12 }}>
                  No text styles yet. Create one to reuse text appearance across labels.
                </div>
              )}
              {textStyles.map((style) => {
                const users = countTextStyleUsers(layout, style.id);
                const isEditing = editingId === style.id;
                return (
                  <div key={style.id} className="style-mgr-item">
                    <div className="style-mgr-item-header">
                      <div
                        className="style-mgr-swatch"
                        style={{ backgroundColor: style.color }}
                      />
                      <input
                        className="style-mgr-name"
                        value={style.name}
                        onChange={(e) => updateTextStyle(style.id, { name: e.target.value })}
                      />
                      <span className="style-mgr-users" title={`Used by ${users} entries`}>
                        {users}
                      </span>
                      <button
                        className="btn btn-sm"
                        onClick={() => setEditingId(isEditing ? null : style.id)}
                      >
                        {isEditing ? "Done" : "Edit"}
                      </button>
                      <button
                        className="btn btn-sm style-mgr-del"
                        onClick={() => removeTextStyle(style.id)}
                        disabled={users > 0}
                        title={users > 0 ? `Used by ${users} entries` : "Delete style"}
                      >
                        x
                      </button>
                    </div>
                    {isEditing && (
                      <div className="style-mgr-detail">
                        <div className="style-mgr-row">
                          <label>Color:</label>
                          <input
                            type="color"
                            value={style.color}
                            onChange={(e) => updateTextStyle(style.id, { color: e.target.value })}
                          />
                        </div>
                        <div className="style-mgr-row">
                          <label>Font:</label>
                          <FontPicker
                            value={style.font_family ?? "sans-serif"}
                            onChange={(v) => updateTextStyle(style.id, { font_family: v })}
                          />
                        </div>
                        <div className="style-mgr-row">
                          <label>Size:</label>
                          <input
                            type="number"
                            min={6}
                            value={style.font_size ?? 14}
                            onChange={(e) =>
                              updateTextStyle(style.id, { font_size: parseInt(e.target.value) || 14 })
                            }
                            style={{ width: 60 }}
                          />
                        </div>
                        <div className="style-mgr-row">
                          <label>Bold:</label>
                          <input
                            type="checkbox"
                            checked={style.bold ?? false}
                            onChange={(e) => updateTextStyle(style.id, { bold: e.target.checked })}
                          />
                          <label style={{ marginLeft: 8 }}>Italic:</label>
                          <input
                            type="checkbox"
                            checked={style.italic ?? false}
                            onChange={(e) => updateTextStyle(style.id, { italic: e.target.checked })}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              <button className="btn btn-primary btn-sm" onClick={addTextStyle}>
                + New Text Style
              </button>
            </>
          )}
        </div>

        <style>{`
          .style-mgr-modal {
            background: #2a2a2a;
            border: 1px solid #3a3a3a;
            border-radius: 10px;
            padding: 24px;
            width: 460px;
            max-height: 80vh;
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .style-mgr-tabs {
            display: flex;
            gap: 4px;
            border-bottom: 1px solid #3a3a3a;
            padding-bottom: 8px;
          }
          .style-mgr-tab {
            background: none;
            border: none;
            color: #999;
            font-size: 13px;
            padding: 4px 12px;
            border-radius: 4px;
            cursor: pointer;
          }
          .style-mgr-tab.active {
            background: rgba(232, 115, 12, 0.15);
            color: #e8730c;
          }
          .style-mgr-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
            overflow-y: auto;
            min-height: 0;
          }
          .style-mgr-item {
            border: 1px solid #3a3a3a;
            border-radius: 6px;
            overflow: hidden;
          }
          .style-mgr-item-header {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 8px;
            background: #222;
          }
          .style-mgr-swatch {
            width: 16px;
            height: 16px;
            border-radius: 3px;
            border: 1px solid rgba(255,255,255,0.15);
            flex-shrink: 0;
          }
          .style-mgr-name {
            flex: 1;
            min-width: 0;
            background: transparent;
            border: none;
            border-bottom: 1px solid transparent;
            color: #ddd;
            font-size: 13px;
            padding: 0 4px;
            outline: none;
          }
          .style-mgr-name:focus {
            border-bottom-color: #e8730c;
          }
          .style-mgr-users {
            font-size: 10px;
            color: #666;
            background: rgba(255,255,255,0.06);
            padding: 1px 5px;
            border-radius: 8px;
            min-width: 16px;
            text-align: center;
          }
          .style-mgr-del {
            color: #e74c3c !important;
          }
          .style-mgr-del:disabled {
            opacity: 0.3;
            cursor: not-allowed;
          }
          .style-mgr-detail {
            padding: 8px 10px;
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          .style-mgr-row {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
          }
          .style-mgr-row label {
            min-width: 48px;
            color: #999;
            font-size: 12px;
          }
          .style-mgr-row input[type="checkbox"],
          .style-mgr-row input[type="color"] {
            flex: none;
          }
          .font-picker-dropdown {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            max-height: 200px;
            overflow-y: auto;
            background: #1e1e1e;
            border: 1px solid #3a3a3a;
            border-radius: 4px;
            z-index: 100;
          }
          .font-picker-option {
            padding: 4px 8px;
            font-size: 13px;
            cursor: pointer;
            color: #ccc;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .font-picker-option:hover {
            background: rgba(232, 115, 12, 0.15);
          }
          .font-picker-option.selected {
            background: rgba(232, 115, 12, 0.25);
            color: #e8730c;
          }
        `}</style>
      </div>
    </div>
  );
}
