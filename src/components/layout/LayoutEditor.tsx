import { useState, useCallback, useRef, useEffect } from "react";
import { useLayout } from "../../hooks/useLayout";
import { useAtlas } from "../../hooks/useAtlas";
import { useInputState } from "../../hooks/useInputState";
import { LayoutCanvas } from "./LayoutCanvas";
import { LayoutEntryProperties } from "./LayoutEntryProperties";
import { LayerList } from "./LayerList";
import { AddEntryModal } from "./AddEntryModal";
import { StyleManager } from "./StyleManager";
import type { Layout, LayoutEntry, EntrySource } from "../../types/layout";
import type { Atlas } from "../../types/atlas";
import { exportLayoutZip, importLayoutZip, renameLayout, loadAtlas as loadAtlasCmd } from "../../lib/commands";
import { open, save, ask } from "@tauri-apps/plugin-dialog";

export function LayoutEditor() {
  const {
    layoutNames,
    currentLayout,
    load,
    save: saveLayout,
    remove,
    refresh,
    clear: clearLayout,
    loadError,
  } = useLayout();
  const { atlasList } = useAtlas();
  const inputState = useInputState();
  const currentInput = inputState.pressed.length > 0 ? inputState.pressed[0] : null;
  const [restored, setRestored] = useState(false);
  const [atlases, setAtlases] = useState<Map<string, Atlas>>(new Map());
  const [newName, setNewName] = useState("");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [canvasWidth, setCanvasWidth] = useState(800);
  const [canvasHeight, setCanvasHeight] = useState(600);
  const [gridSize, setGridSize] = useState(20);
  const [snapToGrid, setSnapToGrid] = useState(() => localStorage.getItem("wp-snap-to-grid") === "true");
  const [addLayoutOpen, setAddLayoutOpen] = useState(false);
  const [addEntryOpen, setAddEntryOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTo, setRenameTo] = useState("");
  const [resizeOpen, setResizeOpen] = useState(false);
  const [stylesOpen, setStylesOpen] = useState(false);
  const [resizeW, setResizeW] = useState(800);
  const [resizeH, setResizeH] = useState(600);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const last = localStorage.getItem("wp-last-layout-editor");
    if (last && layoutNames.includes(last)) {
      load(last).finally(() => setRestored(true));
    } else if (layoutNames.length > 0 || !last) {
      setRestored(true);
    }
  }, [layoutNames]);

  useEffect(() => {
    if (!currentLayout) { setAtlases(new Map()); return; }
    const names = new Set<string>();
    for (const entry of currentLayout.entries) {
      if (entry.source.type === "atlas") {
        names.add(entry.source.atlas_name);
      }
    }
    const newMap = new Map<string, Atlas>();
    Promise.all(
      [...names].map((n) =>
        loadAtlasCmd(n)
          .then((a) => newMap.set(n, a))
          .catch(() => {}),
      ),
    ).then(() => setAtlases(newMap));
  }, [currentLayout?.name, currentLayout?.version]);

  // Sync grid size from layout when switching layouts
  useEffect(() => {
    if (currentLayout) {
      setGridSize(currentLayout.grid_size ?? 20);
    }
  }, [currentLayout?.name]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const nameExists = layoutNames.includes(newName.trim());

  const createNew = () => {
    if (!newName.trim() || nameExists) return;
    const layout: Layout = {
      name: newName.trim(),
      version: 1,
      canvas_width: canvasWidth,
      canvas_height: canvasHeight,
      grid_size: 20,
      entries: [],
    };
    saveLayout(layout);
    setNewName("");
    setAddLayoutOpen(false);
  };

  const addEntryFromAtlas = (atlasName: string, atlasEntryId: string) => {
    if (!currentLayout) return;
    const source: EntrySource = { type: "atlas", atlas_name: atlasName, entry_id: atlasEntryId };
    const entry: LayoutEntry = {
      id: crypto.randomUUID(),
      x: currentLayout.canvas_width / 2,
      y: currentLayout.canvas_height / 2,
      scale: 1,
      rotation: 0,
      z_index: currentLayout.entries.length,
      source,
    };
    saveLayout({
      ...currentLayout,
      entries: [...currentLayout.entries, entry],
    });
    setSelectedEntryId(entry.id);
    if (!atlases.has(atlasName)) {
      loadAtlasCmd(atlasName).then((a) => {
        setAtlases((prev) => new Map(prev).set(atlasName, a));
      }).catch(() => {});
    }
  };

  const addShapeEntry = (decoration: boolean) => {
    if (!currentLayout) return;
    // Ensure at least one shape style exists
    let shapeStyles = [...(currentLayout.shape_styles ?? [])];
    if (shapeStyles.length === 0) {
      shapeStyles.push({
        id: crypto.randomUUID(),
        name: "Default",
        color: "#444444",
      });
    }
    const source: EntrySource = {
      type: "shape",
      ...(decoration ? {} : { input_id: { type: "Key" as const, value: "Space" } }),
      label: decoration ? "Decoration" : "Shape",
      shape: "rect",
      shape_style_id: shapeStyles[0].id,
      color: "#444444",
      pressed_color: decoration ? "#444444" : "#e8730c",
      width: 64,
      height: 64,
    };
    const existingEntries = decoration
      ? currentLayout.entries.map((e) => ({ ...e, z_index: e.z_index + 1 }))
      : currentLayout.entries;
    const entry: LayoutEntry = {
      id: crypto.randomUUID(),
      x: currentLayout.canvas_width / 2,
      y: currentLayout.canvas_height / 2,
      scale: 1,
      rotation: 0,
      z_index: decoration ? 0 : currentLayout.entries.length,
      source,
    };
    saveLayout({
      ...currentLayout,
      shape_styles: shapeStyles,
      entries: [...existingEntries, entry],
    });
    setSelectedEntryId(entry.id);
  };

  const addInlineEntry = (decoration: boolean) => {
    if (!currentLayout) return;
    const source: EntrySource = {
      type: "inline",
      ...(decoration ? {} : { input_id: { type: "Key" as const, value: "Space" } }),
      label: decoration ? "Decoration" : "Key",
      pressed_image: "",
      unpressed_image: "",
      width: 64,
      height: 64,
    };
    const existingEntries = decoration
      ? currentLayout.entries.map((e) => ({ ...e, z_index: e.z_index + 1 }))
      : currentLayout.entries;
    const entry: LayoutEntry = {
      id: crypto.randomUUID(),
      x: currentLayout.canvas_width / 2,
      y: currentLayout.canvas_height / 2,
      scale: 1,
      rotation: 0,
      z_index: decoration ? 0 : existingEntries.length,
      source,
    };
    saveLayout({
      ...currentLayout,
      entries: [...existingEntries, entry],
    });
    setSelectedEntryId(entry.id);
  };

  const updateEntry = useCallback(
    (updated: LayoutEntry) => {
      if (!currentLayout) return;
      saveLayout({
        ...currentLayout,
        entries: currentLayout.entries.map((e) =>
          e.id === updated.id ? updated : e,
        ),
      });
    },
    [currentLayout, saveLayout],
  );

  const removeEntry = (id: string) => {
    if (!currentLayout) return;
    saveLayout({
      ...currentLayout,
      entries: currentLayout.entries.filter((e) => e.id !== id),
    });
    if (selectedEntryId === id) setSelectedEntryId(null);
  };

  const duplicateEntry = (id: string) => {
    if (!currentLayout) return;
    const original = currentLayout.entries.find((e) => e.id === id);
    if (!original) return;
    const newZ = original.z_index + 1;
    // Bump entries at or above the new z_index up by 1
    const shifted = currentLayout.entries.map((e) =>
      e.z_index >= newZ ? { ...e, z_index: e.z_index + 1 } : e,
    );
    const source = original.source;
    const dupSource = source.type === "atlas" ? source
      : { ...source, label: source.label + " Copy" };
    const duplicate: LayoutEntry = {
      ...original,
      id: crypto.randomUUID(),
      x: original.x + 20,
      y: original.y + 20,
      z_index: newZ,
      source: dupSource as EntrySource,
    };
    saveLayout({
      ...currentLayout,
      entries: [...shifted, duplicate],
    });
    setSelectedEntryId(duplicate.id);
  };

  const handleExport = async () => {
    if (!currentLayout) return;
    const path = await save({
      defaultPath: `${currentLayout.name}.zip`,
      filters: [{ name: "ZIP Archive", extensions: ["zip"] }],
    });
    if (path) {
      await exportLayoutZip(currentLayout.name, path);
    }
  };

  const handleImport = async () => {
    setAddLayoutOpen(false);
    const path = await open({
      filters: [{ name: "ZIP Archive", extensions: ["zip"] }],
    });
    if (path) {
      const name = await importLayoutZip(path as string);
      await refresh();
      await load(name);
    }
  };

  const handleDelete = async () => {
    if (!currentLayout) return;
    setMenuOpen(false);
    const confirmed = await ask(
      `Delete layout "${currentLayout.name}"? This cannot be undone.`,
      { title: "Delete Layout", kind: "warning" },
    );
    if (confirmed) {
      remove(currentLayout.name);
    }
  };

  const handleRename = async () => {
    if (!currentLayout || !renameTo.trim()) return;
    const oldName = currentLayout.name;
    const newName = renameTo.trim();
    if (oldName === newName) { setRenameOpen(false); return; }
    try {
      await renameLayout(oldName, newName);
      await refresh();
      await load(newName);
      localStorage.setItem("wp-last-layout-editor", newName);
      setRenameOpen(false);
    } catch (err) {
      console.error("Failed to rename layout:", err);
      alert(`Rename failed: ${err}`);
    }
  };

  const handleResize = () => {
    if (!currentLayout) return;
    saveLayout({
      ...currentLayout,
      canvas_width: Math.max(1, resizeW),
      canvas_height: Math.max(1, resizeH),
    });
    setResizeOpen(false);
  };

  const handleLoadLayout = async (name: string) => {
    if (currentLayout?.name === name) {
      clearLayout();
      localStorage.removeItem("wp-last-layout-editor");
      return;
    }
    const layout = await load(name);
    if (layout) {
      localStorage.setItem("wp-last-layout-editor", name);
    }
  };

  const selectedEntry = currentLayout?.entries.find(
    (e) => e.id === selectedEntryId,
  );

  return (
    <div className="layout-editor">
      {/* Left sidebar — layout list only */}
      <div className="layout-sidebar panel">
        <div className="panel-header sidebar-header">
          <span>Layouts</span>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setAddLayoutOpen(true)}
            title="Add layout"
          >
            +
          </button>
        </div>
        <div className="layout-list">
          {layoutNames.map((name) => (
            <div
              key={name}
              className={`layout-item ${currentLayout?.name === name ? "active" : ""}`}
              onClick={() => handleLoadLayout(name)}
            >
              <span>{name}</span>
            </div>
          ))}
          {restored && layoutNames.length === 0 && (
            <div className="empty-state" style={{ padding: 16 }}>
              No layouts yet.
            </div>
          )}
        </div>
      </div>

      {/* Canvas area */}
      <div className="layout-canvas-area">
        {currentLayout && (
          <div className="canvas-toolbar">
            <span className="canvas-layout-name">{currentLayout.name}</span>
            <label className="snap-toggle">
              <input
                type="checkbox"
                checked={snapToGrid}
                onChange={(e) => {
                  setSnapToGrid(e.target.checked);
                  localStorage.setItem("wp-snap-to-grid", String(e.target.checked));
                }}
              />
              Snap to grid
            </label>
            <label className="grid-size-label">
              Grid:
              <input
                type="number"
                min={4}
                max={200}
                value={gridSize}
                onChange={(e) => {
                  const v = Math.max(4, parseInt(e.target.value) || 20);
                  setGridSize(v);
                  if (currentLayout) {
                    saveLayout({ ...currentLayout, grid_size: v });
                  }
                }}
                style={{ width: 64 }}
              />
              px
            </label>
            <button
              className="btn btn-sm"
              onClick={() => setStylesOpen(true)}
              title="Manage styles"
            >
              Styles
            </button>
            <div className="actions-menu" ref={menuRef}>
              <button
                className="btn btn-sm actions-menu-trigger"
                onClick={() => setMenuOpen(!menuOpen)}
                title="Actions"
              >
                ⋮
              </button>
              {menuOpen && (
                <div className="actions-menu-dropdown">
                  <button onClick={() => {
                    setMenuOpen(false);
                    setRenameTo(currentLayout?.name || "");
                    setRenameOpen(true);
                  }}>
                    Rename
                  </button>
                  <button onClick={() => {
                    setMenuOpen(false);
                    setResizeW(currentLayout?.canvas_width || 800);
                    setResizeH(currentLayout?.canvas_height || 600);
                    setResizeOpen(true);
                  }}>
                    Canvas Size
                  </button>
                  <button onClick={() => { setMenuOpen(false); handleExport(); }}>
                    Export Layout
                  </button>
                  <button className="actions-menu-danger" onClick={handleDelete}>
                    Delete Layout
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        {currentLayout ? (
          <LayoutCanvas
            layout={currentLayout}
            atlases={atlases}
            selectedEntryId={selectedEntryId}
            gridSize={gridSize}
            snapToGrid={snapToGrid}
            onSelectEntry={setSelectedEntryId}
            onUpdateEntry={updateEntry}
          />
        ) : loadError ? (
          <div className="panel corrupt-layout-state">
            <div className="corrupt-icon">!</div>
            <div className="corrupt-title">Layout cannot be loaded</div>
            <div className="corrupt-name">{loadError.name}</div>
            <div className="corrupt-detail">{loadError.error}</div>
            <p className="corrupt-hint">
              This layout may use an older or incompatible format.
            </p>
            <button
              className="btn btn-danger"
              onClick={async () => {
                await remove(loadError.name);
                clearLayout();
                localStorage.removeItem("wp-last-layout-editor");
              }}
            >
              Delete Layout
            </button>
          </div>
        ) : restored ? (
          <div className="welcome-panel">
            <div className="welcome-icon">&#9000;</div>
            <div className="welcome-title">Layout Editor</div>
            <p className="welcome-text">
              Create visual layouts for your input overlay. Each layout is a canvas where you can place images and shapes for decorations or key inputs that react to your input in real time.
            </p>
            <div className="welcome-steps">
              <div className="welcome-step">
                <span className="welcome-step-num">1</span>
                <span>Create or select a layout from the sidebar</span>
              </div>
              <div className="welcome-step">
                <span className="welcome-step-num">2</span>
                <span>Add entries from an atlas or as custom shapes/images</span>
              </div>
              <div className="welcome-step">
                <span className="welcome-step-num">3</span>
                <span>Arrange, resize, and rotate entries on the canvas</span>
              </div>
              <div className="welcome-step">
                <span className="welcome-step-num">4</span>
                <span>Use the Display tab to preview and serve to OBS</span>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Right panel — properties or layers */}
      <div className={`layout-properties panel${currentLayout ? " panel-open" : ""}`}>
        {selectedEntry ? (
          <LayoutEntryProperties
            entry={selectedEntry}
            atlases={atlases}
            layoutName={currentLayout?.name || ""}
            currentInput={currentInput}
            shapeStyles={currentLayout?.shape_styles ?? []}
            textStyles={currentLayout?.text_styles ?? []}
            onUpdate={updateEntry}
            onRemove={() => removeEntry(selectedEntry.id)}
            onBack={() => setSelectedEntryId(null)}
          />
        ) : currentLayout ? (
          <LayerList
            entries={currentLayout.entries}
            atlases={atlases}
            layoutName={currentLayout.name}
            shapeStyles={currentLayout.shape_styles ?? []}
            selectedEntryId={selectedEntryId}
            onSelectEntry={setSelectedEntryId}
            onReorder={(updated) => {
              saveLayout({
                ...currentLayout,
                entries: currentLayout.entries.map((e) => {
                  const u = updated.find((u) => u.id === e.id);
                  return u ? { ...e, z_index: u.z_index } : e;
                }),
              });
            }}
            onAdd={() => setAddEntryOpen(true)}
            onDuplicate={duplicateEntry}
            onRemove={removeEntry}
          />
        ) : null}
      </div>

      {/* Add Layout modal */}
      {addLayoutOpen && (
        <div className="add-modal-overlay" onClick={() => setAddLayoutOpen(false)}>
          <div className="add-modal" onClick={(e) => e.stopPropagation()}>
            <div className="add-modal-title">Add Layout</div>
            <div className="add-modal-section">
              <label className="add-modal-label">Create new</label>
              <input
                type="text"
                placeholder="Layout name..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createNew()}
                autoFocus
              />
              {nameExists && (
                <span style={{ color: "#e74c3c", fontSize: 11 }}>
                  A layout with this name already exists.
                </span>
              )}
              <div className="add-modal-row">
                <input
                  type="number"
                  value={canvasWidth}
                  onChange={(e) => setCanvasWidth(parseInt(e.target.value) || 800)}
                  style={{ width: 80 }}
                  placeholder="Width"
                />
                <span style={{ lineHeight: "32px", color: "#999" }}>x</span>
                <input
                  type="number"
                  value={canvasHeight}
                  onChange={(e) => setCanvasHeight(parseInt(e.target.value) || 600)}
                  style={{ width: 80 }}
                  placeholder="Height"
                />
              </div>
              <button
                className="btn btn-primary"
                onClick={createNew}
                disabled={!newName.trim() || nameExists}
              >
                Create
              </button>
            </div>
            <div className="add-modal-divider" />
            <div className="add-modal-section">
              <button className="btn" style={{ width: "100%" }} onClick={handleImport}>
                Import Bundle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Entry modal */}
      {addEntryOpen && (
        <AddEntryModal
          atlasList={atlasList}
          atlases={atlases}
          onLoadAtlas={(name) => {
            loadAtlasCmd(name).then((a) => {
              setAtlases((prev) => new Map(prev).set(name, a));
            }).catch(() => {});
          }}
          onAddFromAtlas={(atlasName, entryId) => {
            addEntryFromAtlas(atlasName, entryId);
          }}
          onAddShape={addShapeEntry}
          onAddImage={addInlineEntry}
          onClose={() => setAddEntryOpen(false)}
        />
      )}

      {/* Rename modal */}
      {renameOpen && (
        <div className="add-modal-overlay" onClick={() => setRenameOpen(false)}>
          <div className="add-modal" onClick={(e) => e.stopPropagation()}>
            <div className="add-modal-title">Rename Layout</div>
            <div className="add-modal-section">
              <input
                type="text"
                value={renameTo}
                onChange={(e) => setRenameTo(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRename()}
                autoFocus
                placeholder="New name..."
              />
              {renameTo.trim() && renameTo.trim() !== currentLayout?.name && layoutNames.includes(renameTo.trim()) && (
                <span style={{ color: "#e74c3c", fontSize: 11 }}>
                  A layout with this name already exists.
                </span>
              )}
              <button
                className="btn btn-primary"
                onClick={handleRename}
                disabled={!renameTo.trim() || renameTo.trim() === currentLayout?.name || layoutNames.includes(renameTo.trim())}
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Canvas size modal */}
      {resizeOpen && (
        <div className="add-modal-overlay" onClick={() => setResizeOpen(false)}>
          <div className="add-modal" onClick={(e) => e.stopPropagation()}>
            <div className="add-modal-title">Canvas Size</div>
            <div className="add-modal-section">
              <div className="add-modal-row">
                <label style={{ color: "#999", fontSize: 13 }}>Width:</label>
                <input
                  type="number"
                  min={1}
                  value={resizeW}
                  onChange={(e) => setResizeW(parseInt(e.target.value) || 1)}
                  autoFocus
                  style={{ width: 100 }}
                />
              </div>
              <div className="add-modal-row">
                <label style={{ color: "#999", fontSize: 13 }}>Height:</label>
                <input
                  type="number"
                  min={1}
                  value={resizeH}
                  onChange={(e) => setResizeH(parseInt(e.target.value) || 1)}
                  style={{ width: 100 }}
                />
              </div>
              <button className="btn btn-primary" onClick={handleResize}>
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Styles modal */}
      {stylesOpen && currentLayout && (
        <StyleManager
          layout={currentLayout}
          onSave={saveLayout}
          onClose={() => setStylesOpen(false)}
        />
      )}

      <style>{`
        .layout-editor {
          display: grid;
          grid-template-columns: 200px 1fr 0px;
          gap: 16px;
          height: 100%;
          transition: grid-template-columns 0.25s ease;
        }
        .layout-editor:has(.panel-open) {
          grid-template-columns: 200px 1fr 240px;
        }
        .layout-properties {
          overflow: hidden;
          transition: opacity 0.2s ease;
          opacity: 0;
        }
        .layout-properties.panel-open {
          overflow-y: auto;
          overflow-x: hidden;
          min-width: 0;
          opacity: 1;
        }
        .layout-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
          overflow-y: auto;
        }
        .layout-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          border-radius: 4px;
          cursor: pointer;
        }
        .layout-item:hover { background: rgba(255,255,255,0.05); }
        .layout-item.active { background: rgba(232, 115, 12, 0.15); color: #e8730c; }
        .sidebar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .btn-sm {
          padding: 2px 8px;
          font-size: 11px;
        }
        .add-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
        }
        .add-modal {
          background: #2a2a2a;
          border: 1px solid #3a3a3a;
          border-radius: 10px;
          padding: 24px;
          width: 380px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .add-modal-title {
          font-size: 18px;
          font-weight: 600;
          color: #e8730c;
        }
        .add-modal-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .add-modal-label {
          font-size: 12px;
          color: #999;
          font-weight: 600;
        }
        .add-modal-row {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .add-modal-divider {
          height: 1px;
          background: #3a3a3a;
        }
        .layout-canvas-area {
          overflow: hidden;
          border-radius: 8px;
          display: flex;
          flex-direction: column;
        }
        .canvas-toolbar {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 6px 10px;
          background: #1a1a1a;
          border-bottom: 1px solid #3a3a3a;
          font-size: 12px;
          flex-shrink: 0;
        }
        .canvas-layout-name {
          font-weight: 600;
          color: #e8730c;
          margin-right: auto;
        }
        .snap-toggle, .grid-size-label {
          display: flex;
          align-items: center;
          gap: 4px;
          color: #999;
          cursor: pointer;
        }
        .snap-toggle input, .grid-size-label input {
          width: auto;
        }
        .actions-menu {
          position: relative;
          margin-left: 8px;
        }
        .actions-menu-trigger {
          font-size: 16px !important;
          padding: 2px 8px !important;
          line-height: 1;
        }
        .actions-menu-dropdown {
          position: absolute;
          top: 100%;
          right: 0;
          margin-top: 4px;
          background: #2a2a2a;
          border: 1px solid #3a3a3a;
          border-radius: 6px;
          min-width: 160px;
          z-index: 50;
          overflow: hidden;
        }
        .actions-menu-dropdown button {
          display: block;
          width: 100%;
          text-align: left;
          padding: 8px 12px;
          border: none;
          background: transparent;
          color: #e0e0e0;
          font-size: 13px;
          cursor: pointer;
        }
        .actions-menu-dropdown button:hover {
          background: rgba(255,255,255,0.08);
        }
        .actions-menu-danger {
          color: #e74c3c !important;
        }
        .actions-menu-danger:hover {
          background: rgba(231, 76, 60, 0.15) !important;
        }
        .welcome-panel {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          padding: 32px;
          text-align: center;
          color: #999;
        }
        .welcome-icon {
          font-size: 48px;
          margin-bottom: 8px;
          opacity: 0.3;
        }
        .welcome-title {
          font-size: 20px;
          font-weight: 600;
          color: #ccc;
          margin-bottom: 8px;
        }
        .welcome-text {
          font-size: 13px;
          color: #777;
          max-width: 380px;
          line-height: 1.5;
          margin-bottom: 20px;
        }
        .welcome-steps {
          display: flex;
          flex-direction: column;
          gap: 10px;
          text-align: left;
        }
        .welcome-step {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          color: #999;
        }
        .welcome-step-num {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: rgba(232, 115, 12, 0.15);
          color: #e8730c;
          font-size: 12px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .corrupt-layout-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 32px;
          text-align: center;
        }
        .corrupt-icon {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: rgba(231, 76, 60, 0.15);
          color: #e74c3c;
          font-size: 28px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 4px;
        }
        .corrupt-title {
          font-size: 16px;
          font-weight: 600;
          color: #e0e0e0;
        }
        .corrupt-name {
          font-family: monospace;
          color: #e8730c;
          font-size: 14px;
        }
        .corrupt-detail {
          font-size: 11px;
          color: #888;
          font-family: monospace;
          max-width: 400px;
          word-break: break-word;
        }
        .corrupt-hint {
          color: #999;
          font-size: 13px;
          margin: 4px 0 8px;
        }
      `}</style>
    </div>
  );
}
