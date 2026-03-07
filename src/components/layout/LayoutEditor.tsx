import { useState, useCallback } from "react";
import { useLayout } from "../../hooks/useLayout";
import { useAtlas } from "../../hooks/useAtlas";
import { LayoutCanvas } from "./LayoutCanvas";
import { LayoutEntryProperties } from "./LayoutEntryProperties";
import type { Layout, LayoutEntry } from "../../types/layout";
import { exportLayoutZip, importLayoutZip } from "../../lib/commands";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

export function LayoutEditor() {
  const {
    layoutNames,
    currentLayout,
    load,
    save: saveLayout,
    remove,
    refresh,
  } = useLayout();
  const { atlasNames, currentAtlas, load: loadAtlas } = useAtlas();
  const [newName, setNewName] = useState("");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [canvasWidth, setCanvasWidth] = useState(800);
  const [canvasHeight, setCanvasHeight] = useState(600);
  const [selectedAtlasName, setSelectedAtlasName] = useState("");
  const [gridSize, setGridSize] = useState(20);
  const [snapToGrid, setSnapToGrid] = useState(false);

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
    const path = await open({
      filters: [{ name: "ZIP Archive", extensions: ["zip"] }],
    });
    if (path) {
      const name = await importLayoutZip(path as string);
      await refresh();
      await load(name);
    }
  };

  const handleExportJson = async () => {
    if (!currentLayout) return;
    const path = await save({
      defaultPath: `${currentLayout.name}.json`,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (path) {
      await writeTextFile(path, JSON.stringify(currentLayout, null, 2));
    }
  };

  const handleImportJson = async () => {
    const path = await open({
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!path) return;
    const content = await readTextFile(path as string);
    const layout: Layout = JSON.parse(content);
    await saveLayout(layout);
    await refresh();
    await load(layout.name);
  };

  const handleLoadLayout = async (name: string) => {
    const layout = await load(name);
    if (layout) {
      await loadAtlas(layout.atlas_name);
    }
  };

  const selectedEntry = currentLayout?.entries.find(
    (e) => e.id === selectedEntryId,
  );

  return (
    <div className="layout-editor">
      <div className="layout-sidebar panel">
        <div className="panel-header">Layouts</div>
        <div className="layout-list">
          {layoutNames.map((name) => (
            <div
              key={name}
              className={`layout-item ${currentLayout?.name === name ? "active" : ""}`}
              onClick={() => handleLoadLayout(name)}
            >
              <span>{name}</span>
              <button
                className="btn btn-danger btn-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  remove(name);
                }}
              >
                X
              </button>
            </div>
          ))}
        </div>

        <div className="layout-create">
          <input
            type="text"
            placeholder="Layout name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <select
            value={selectedAtlasName}
            onChange={(e) => setSelectedAtlasName(e.target.value)}
          >
            <option value="">Select atlas...</option>
            {atlasNames.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <div style={{ display: "flex", gap: 4 }}>
            <input
              type="number"
              value={canvasWidth}
              onChange={(e) => setCanvasWidth(parseInt(e.target.value) || 800)}
              style={{ width: 60 }}
              placeholder="W"
            />
            <span style={{ lineHeight: "32px" }}>x</span>
            <input
              type="number"
              value={canvasHeight}
              onChange={(e) => setCanvasHeight(parseInt(e.target.value) || 600)}
              style={{ width: 60 }}
              placeholder="H"
            />
          </div>
          <button className="btn btn-primary" onClick={createNew}>
            Create
          </button>
        </div>

        <div className="layout-actions">
          <button className="btn" onClick={handleImportJson}>
            Import JSON
          </button>
          {currentLayout && (
            <button className="btn" onClick={handleExportJson}>
              Export JSON
            </button>
          )}
        </div>
        <div className="layout-actions" style={{ marginTop: 4 }}>
          <button className="btn" onClick={handleImport}>
            Import Bundle
          </button>
          {currentLayout && (
            <button className="btn" onClick={handleExport}>
              Export Bundle
            </button>
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
        ) : (
          <div className="panel empty-state">
            Select or create a layout to get started.
          </div>
        )}
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

      <style>{`
        .layout-editor {
          display: grid;
          grid-template-columns: 220px 1fr 220px;
          gap: 16px;
          height: calc(100vh - 80px);
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
        .layout-create {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 8px;
        }
        .layout-actions { display: flex; gap: 8px; }
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
      `}</style>
    </div>
  );
}
