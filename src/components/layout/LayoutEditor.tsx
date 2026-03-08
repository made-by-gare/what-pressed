import { useState, useCallback, useRef, useEffect } from "react";
import { useLayout } from "../../hooks/useLayout";
import { useAtlas } from "../../hooks/useAtlas";
import { LayoutCanvas } from "./LayoutCanvas";
import { LayoutEntryProperties } from "./LayoutEntryProperties";
import type { Layout, LayoutEntry } from "../../types/layout";
import { exportLayoutZip, importLayoutZip } from "../../lib/commands";
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
  } = useLayout();
  const { atlasList, currentAtlas, load: loadAtlas } = useAtlas();
  const [restored, setRestored] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [canvasWidth, setCanvasWidth] = useState(800);
  const [canvasHeight, setCanvasHeight] = useState(600);
  const [selectedAtlasName, setSelectedAtlasName] = useState("");
  const [gridSize, setGridSize] = useState(20);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Restore last selected layout for this tab
  useEffect(() => {
    const last = localStorage.getItem("wp-last-layout-editor");
    if (last && layoutNames.includes(last)) {
      load(last).then((layout) => {
        if (layout) loadAtlas(layout.atlas_name);
      }).finally(() => setRestored(true));
    } else if (layoutNames.length > 0 || !last) {
      setRestored(true);
    }
  }, [layoutNames]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const createNew = () => {
    if (!newName.trim() || !selectedAtlasName) return;
    const layout: Layout = {
      name: newName.trim(),
      version: 1,
      atlas_name: selectedAtlasName,
      canvas_width: canvasWidth,
      canvas_height: canvasHeight,
      entries: [],
    };
    saveLayout(layout);
    loadAtlas(selectedAtlasName);
    setNewName("");
    setAddModalOpen(false);
  };

  const addEntryFromAtlas = (atlasEntryId: string) => {
    if (!currentLayout) return;
    const entry: LayoutEntry = {
      id: crypto.randomUUID(),
      atlas_entry_id: atlasEntryId,
      x: currentLayout.canvas_width / 2,
      y: currentLayout.canvas_height / 2,
      scale: 1,
      rotation: 0,
      z_index: currentLayout.entries.length,
    };
    saveLayout({
      ...currentLayout,
      entries: [...currentLayout.entries, entry],
    });
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
    setAddModalOpen(false);
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

  const handleLoadLayout = async (name: string) => {
    if (currentLayout?.name === name) {
      clearLayout();
      localStorage.removeItem("wp-last-layout-editor");
      return;
    }
    const layout = await load(name);
    if (layout) {
      localStorage.setItem("wp-last-layout-editor", name);
      await loadAtlas(layout.atlas_name);
    }
  };

  const selectedEntry = currentLayout?.entries.find(
    (e) => e.id === selectedEntryId,
  );

  return (
    <div className="layout-editor">
      <div className="layout-sidebar panel">
        <div className="panel-header sidebar-header">
          <span>Layouts</span>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setAddModalOpen(true)}
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

        {currentAtlas && currentLayout && (
          <div className="atlas-palette">
            <div className="panel-header" style={{ marginTop: 16 }}>
              Atlas Entries
            </div>
            {currentAtlas.entries.map((ae) => (
              <button
                key={ae.id}
                className="btn palette-btn"
                onClick={() => addEntryFromAtlas(ae.id)}
              >
                + {ae.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="layout-canvas-area">
        <div className="canvas-toolbar">
          {currentLayout && (
            <span className="canvas-layout-name">{currentLayout.name}</span>
          )}
          <label className="snap-toggle">
            <input
              type="checkbox"
              checked={snapToGrid}
              onChange={(e) => setSnapToGrid(e.target.checked)}
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
              onChange={(e) =>
                setGridSize(Math.max(4, parseInt(e.target.value) || 20))
              }
              style={{ width: 64 }}
            />
            px
          </label>
          {currentLayout && (
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
                  <button onClick={() => { setMenuOpen(false); handleExport(); }}>
                    Export Bundle
                  </button>
                  <button className="actions-menu-danger" onClick={handleDelete}>
                    Delete Layout
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        {currentLayout && currentAtlas ? (
          <LayoutCanvas
            layout={currentLayout}
            atlas={currentAtlas}
            selectedEntryId={selectedEntryId}
            gridSize={gridSize}
            snapToGrid={snapToGrid}
            onSelectEntry={setSelectedEntryId}
            onUpdateEntry={updateEntry}
          />
        ) : restored ? (
          <div className="panel empty-state">
            Select or create a layout to get started.
          </div>
        ) : null}
      </div>

      <div className="layout-properties panel">
        {selectedEntry ? (
          <LayoutEntryProperties
            entry={selectedEntry}
            atlasEntry={currentAtlas?.entries.find(
              (ae) => ae.id === selectedEntry.atlas_entry_id,
            )}
            onUpdate={updateEntry}
            onRemove={() => removeEntry(selectedEntry.id)}
          />
        ) : (
          <div className="empty-state">Select an entry on the canvas.</div>
        )}
      </div>

      {addModalOpen && (
        <div className="add-modal-overlay" onClick={() => setAddModalOpen(false)}>
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
              <select
                value={selectedAtlasName}
                onChange={(e) => setSelectedAtlasName(e.target.value)}
              >
                <option value="">Select atlas...</option>
                {atlasList.map((info) => (
                  <option key={info.name} value={info.name}>
                    {info.name}{info.source === "community" ? " (community)" : ""}
                  </option>
                ))}
              </select>
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
                disabled={!newName.trim() || !selectedAtlasName}
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

      <style>{`
        .layout-editor {
          display: grid;
          grid-template-columns: 240px 1fr 240px;
          gap: 16px;
          height: 100%;
        }
        .layout-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-bottom: 12px;
          max-height: 200px;
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
        .atlas-palette {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .palette-btn {
          text-align: left;
          font-size: 12px;
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
      `}</style>
    </div>
  );
}
