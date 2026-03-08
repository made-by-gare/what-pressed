import { useState, useRef, useEffect } from "react";
import { useAtlas } from "../../hooks/useAtlas";
import { useInputState } from "../../hooks/useInputState";
import { AtlasEntryEditor } from "./AtlasEntryEditor";
import type { Atlas, AtlasEntry, SourceImage } from "../../types/atlas";
import { imageRefIsEmpty, sourceImageFilename } from "../../types/atlas";
import { inputIdToString } from "../../types/input";
import {
  importAtlasImage,
  exportAtlasZip,
  importAtlasZip,
  listLayouts,
  loadLayout,
} from "../../lib/commands";
import {
  openCommunityBrowser,
  uninstallCommunityAtlas,
  forkCommunityAtlas,
} from "../../lib/communityCommands";
import { open, save, ask } from "@tauri-apps/plugin-dialog";
import { readFile, BaseDirectory } from "@tauri-apps/plugin-fs";
import { AtlasImage } from "./AtlasImage";

export function AtlasBuilder() {
  const {
    atlasList,
    currentAtlas,
    load,
    save: saveAtlas,
    remove,
    refresh,
    clear: clearAtlas,
  } = useAtlas();
  const inputState = useInputState();
  const [restored, setRestored] = useState(false);
  const [newName, setNewName] = useState("");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedEntryId, _setSelectedEntryId] = useState<string | null>(
    () => localStorage.getItem("wp-last-atlas-entry"),
  );
  const setSelectedEntryId = (id: string | null) => {
    _setSelectedEntryId(id);
    if (id) localStorage.setItem("wp-last-atlas-entry", id);
    else localStorage.removeItem("wp-last-atlas-entry");
  };
  const [forkDialog, setForkDialog] = useState<{ name: string; value: string } | null>(null);
  const [localCollapsed, setLocalCollapsed] = useState(false);
  const [communityCollapsed, setCommunityCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Restore last selected atlas for this tab
  useEffect(() => {
    const last = localStorage.getItem("wp-last-atlas-builder");
    if (last && atlasList.some((a) => a.name === last)) {
      load(last).finally(() => setRestored(true));
    } else if (atlasList.length > 0 || !last) {
      setRestored(true);
    }
  }, [atlasList]);

  const handleLoadAtlas = (name: string) => {
    if (currentAtlas?.name === name) {
      clearAtlas();
      localStorage.removeItem("wp-last-atlas-builder");
    } else {
      load(name);
      localStorage.setItem("wp-last-atlas-builder", name);
    }
  };

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
    if (!newName.trim()) return;
    const atlas: Atlas = {
      name: newName.trim(),
      version: 1,
      entries: [],
      source_images: [],
    };
    saveAtlas(atlas);
    setNewName("");
    setAddModalOpen(false);
  };

  const addEntry = () => {
    if (!currentAtlas) return;
    const entry: AtlasEntry = {
      id: crypto.randomUUID(),
      input_id: { type: "Key", value: "Unknown" },
      label: "New Entry",
      pressed_image: "",
      unpressed_image: "",
      width: 64,
      height: 64,
    };
    saveAtlas({
      ...currentAtlas,
      entries: [...currentAtlas.entries, entry],
    });
  };

  const updateEntry = (updated: AtlasEntry) => {
    if (!currentAtlas) return;
    saveAtlas({
      ...currentAtlas,
      entries: currentAtlas.entries.map((e) =>
        e.id === updated.id ? updated : e,
      ),
    });
  };

  const removeEntry = (id: string) => {
    if (!currentAtlas) return;
    saveAtlas({
      ...currentAtlas,
      entries: currentAtlas.entries.filter((e) => e.id !== id),
    });
    if (selectedEntryId === id) setSelectedEntryId(null);
  };

  const handleDelete = async () => {
    if (!currentAtlas) return;
    setMenuOpen(false);

    // Check for dependent layouts
    const layoutNames = await listLayouts();
    const dependentLayouts: string[] = [];
    for (const name of layoutNames) {
      try {
        const layout = await loadLayout(name);
        if (layout.atlas_name === currentAtlas.name) {
          dependentLayouts.push(name);
        }
      } catch {
        // skip unreadable layouts
      }
    }

    if (dependentLayouts.length > 0) {
      const confirmed = await ask(
        `The following layouts depend on "${currentAtlas.name}":\n\n${dependentLayouts.map((n) => `• ${n}`).join("\n")}\n\nThese layouts will stop working if you delete this atlas. Continue?`,
        { title: "Atlas Has Dependent Layouts", kind: "warning" },
      );
      if (!confirmed) return;
    } else {
      const confirmed = await ask(
        `Delete atlas "${currentAtlas.name}"? This cannot be undone.`,
        { title: "Delete Atlas", kind: "warning" },
      );
      if (!confirmed) return;
    }

    remove(currentAtlas.name);
  };

  const handleCommunityUninstall = async () => {
    if (!currentAtlas) return;
    setMenuOpen(false);
    const confirmed = await ask(
      `Remove "${currentAtlas.name}"? This will delete the installed community atlas.`,
      { title: "Remove Atlas", kind: "warning" },
    );
    if (!confirmed) return;
    await uninstallCommunityAtlas(currentAtlas.name);
    clearAtlas();
    localStorage.removeItem("wp-last-atlas-builder");
    await refresh();
  };

  const handleFork = () => {
    if (!currentAtlas) return;
    setMenuOpen(false);
    setForkDialog({ name: currentAtlas.name, value: currentAtlas.name });
  };

  const handleForkConfirm = async () => {
    if (!forkDialog) return;
    const newName = forkDialog.value.trim();
    if (!newName) return;
    setForkDialog(null);
    try {
      const forkedName = await forkCommunityAtlas(forkDialog.name, newName);
      await refresh();
      await load(forkedName);
    } catch (e) {
      console.error("Fork failed:", e);
    }
  };

  const handleExport = async () => {
    if (!currentAtlas) return;
    const path = await save({
      defaultPath: `${currentAtlas.name}.zip`,
      filters: [{ name: "ZIP Archive", extensions: ["zip"] }],
    });
    if (path) {
      await exportAtlasZip(currentAtlas.name, path);
    }
  };

  const handleImport = async () => {
    setAddModalOpen(false);
    const path = await open({
      filters: [{ name: "ZIP Archive", extensions: ["zip"] }],
    });
    if (path) {
      const name = await importAtlasZip(path as string);
      await refresh();
      await load(name);
    }
  };

  const handleAddSourceImage = async () => {
    if (!currentAtlas) return;
    const path = await open({
      filters: [
        { name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp"] },
      ],
    });
    if (path) {
      const filename = await importAtlasImage(
        currentAtlas.name,
        path as string,
      );
      const newSource: SourceImage = { filename };
      saveAtlas({
        ...currentAtlas,
        source_images: [...(currentAtlas.source_images ?? []), newSource],
      });
    }
  };

  const handleRemoveSourceImage = (si: SourceImage) => {
    if (!currentAtlas) return;
    const fname = sourceImageFilename(si);
    saveAtlas({
      ...currentAtlas,
      source_images: (currentAtlas.source_images ?? []).filter(
        (s) => sourceImageFilename(s) !== fname,
      ),
    });
  };

  const handleUpdateSourceImage = (oldFilename: string, updated: SourceImage) => {
    if (!currentAtlas) return;
    saveAtlas({
      ...currentAtlas,
      source_images: (currentAtlas.source_images ?? []).map((s) =>
        sourceImageFilename(s) === oldFilename ? updated : s,
      ),
    });
  };

  const handleUploadImage = async (
    entryId: string,
    field: "pressed_image" | "unpressed_image",
  ) => {
    if (!currentAtlas) return;
    const path = await open({
      filters: [
        { name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp"] },
      ],
    });
    if (path) {
      const filename = await importAtlasImage(
        currentAtlas.name,
        path as string,
      );
      const entry = currentAtlas.entries.find((e) => e.id === entryId);
      if (entry) {
        // Read image dimensions and update entry size
        const dims = await getImageDimensions(currentAtlas.name, filename);
        updateEntry({
          ...entry,
          [field]: filename,
          ...(dims ? { width: dims.w, height: dims.h } : {}),
        });
      }
    }
  };

  const getImageDimensions = (
    atlasName: string,
    filename: string,
  ): Promise<{ w: number; h: number } | null> => {
    return new Promise((resolve) => {
      readFile(`atlases/${atlasName}/images/${filename}`, {
        baseDir: BaseDirectory.AppData,
      })
        .catch(() =>
          readFile(`community-atlases/${atlasName}/images/${filename}`, {
            baseDir: BaseDirectory.AppData,
          }),
        )
        .then((data) => {
          const blob = new Blob([data]);
          const url = URL.createObjectURL(blob);
          const img = new Image();
          img.onload = () => {
            resolve({ w: img.naturalWidth, h: img.naturalHeight });
            URL.revokeObjectURL(url);
          };
          img.onerror = () => {
            resolve(null);
            URL.revokeObjectURL(url);
          };
          img.src = url;
        })
        .catch(() => resolve(null));
    });
  };

  const pressedSet = new Set(
    inputState.pressed.map((id) => inputIdToString(id)),
  );

  const sourceImages: SourceImage[] = currentAtlas?.source_images ?? [];
  const isCommunity = currentAtlas
    ? atlasList.find((a) => a.name === currentAtlas.name)?.source === "community"
    : false;

  const localAtlases = atlasList.filter((a) => a.source === "local");
  const communityAtlases = atlasList.filter((a) => a.source === "community");
  const selectedEntry = currentAtlas?.entries.find((e) => e.id === selectedEntryId) ?? null;

  return (
    <div className="atlas-builder">
      <div className="atlas-sidebar panel">
        <div className="atlas-section">
          <div
            className="atlas-section-header"
            onClick={() => setLocalCollapsed(!localCollapsed)}
          >
            <span className="atlas-section-arrow">{localCollapsed ? "▸" : "▾"}</span>
            <span className="atlas-section-title">Local</span>
            <button
              className="btn btn-primary btn-sm"
              onClick={(e) => { e.stopPropagation(); setAddModalOpen(true); }}
              title="Add atlas"
            >
              +
            </button>
          </div>
          {!localCollapsed && (
            <div className="atlas-list">
              {localAtlases.map((info) => (
                <div
                  key={info.name}
                  className={`atlas-item ${currentAtlas?.name === info.name ? "active" : ""}`}
                  onClick={() => handleLoadAtlas(info.name)}
                >
                  {info.name}
                </div>
              ))}
              {restored && localAtlases.length === 0 && (
                <div className="atlas-section-empty">
                  No local atlases. Create one or fork from community.
                </div>
              )}
            </div>
          )}
        </div>
        <div className="atlas-section">
          <div
            className="atlas-section-header"
            onClick={() => setCommunityCollapsed(!communityCollapsed)}
          >
            <span className="atlas-section-arrow">{communityCollapsed ? "▸" : "▾"}</span>
            <span className="atlas-section-title">Community</span>
            <button
              className="btn btn-primary btn-sm"
              onClick={(e) => { e.stopPropagation(); openCommunityBrowser(); }}
              title="Browse community atlases"
            >
              Browse
            </button>
          </div>
          {!communityCollapsed && (
            <div className="atlas-list">
              {communityAtlases.map((info) => (
                <div
                  key={info.name}
                  className={`atlas-item ${currentAtlas?.name === info.name ? "active" : ""}`}
                  onClick={() => handleLoadAtlas(info.name)}
                >
                  {info.name}
                </div>
              ))}
              {restored && communityAtlases.length === 0 && (
                <div className="atlas-section-empty">
                  No installed community atlases. Browse to find some.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="atlas-main">
        {!restored ? null : currentAtlas ? (
          <>
            <div className="atlas-toolbar">
              <span className="atlas-toolbar-name">{currentAtlas.name}</span>
              <span className="atlas-toolbar-count">{currentAtlas.entries.length} entries</span>
              <div className="atlas-toolbar-actions">
                {!isCommunity && (
                  <button className="btn btn-primary btn-sm" onClick={addEntry}>
                    + Add Entry
                  </button>
                )}
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
                      {isCommunity ? (
                        <>
                          <button onClick={handleFork}>Fork to Local</button>
                          <button className="actions-menu-danger" onClick={handleCommunityUninstall}>
                            Remove
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => { setMenuOpen(false); handleExport(); }}>
                            Export ZIP
                          </button>
                          <button className="actions-menu-danger" onClick={handleDelete}>
                            Delete Atlas
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {isCommunity && (
              <div className="atlas-meta">
                <div className="atlas-readonly-notice">
                  Community atlas (read-only). Use the menu to fork an editable local copy.
                </div>
                {currentAtlas.description && (
                  <div className="atlas-meta-desc">{currentAtlas.description}</div>
                )}
                <div className="atlas-meta-details">
                  {currentAtlas.author && <span>By <strong>{currentAtlas.author}</strong></span>}
                  {currentAtlas.semver && <span>v{currentAtlas.semver}</span>}
                </div>
              </div>
            )}

            {currentAtlas.origin && (
              <div className="atlas-origin">
                Forked from community atlas: <strong>{currentAtlas.origin}</strong>
              </div>
            )}

            <div className="atlas-content">
              {isCommunity ? (
                <div className="entries-grid">
                  {currentAtlas.entries.map((entry) => (
                    <div
                      key={entry.id}
                      className={`entry-card ${pressedSet.has(inputIdToString(entry.input_id)) ? "pressed" : ""}`}
                    >
                      <div className="entry-card-images">
                        {!imageRefIsEmpty(entry.unpressed_image) ? (
                          <AtlasImage
                            atlasName={currentAtlas.name}
                            imageRef={entry.unpressed_image}
                            alt="unpressed"
                            className="entry-card-img"
                          />
                        ) : (
                          <div className="entry-card-img-empty" />
                        )}
                        {!imageRefIsEmpty(entry.pressed_image) ? (
                          <AtlasImage
                            atlasName={currentAtlas.name}
                            imageRef={entry.pressed_image}
                            alt="pressed"
                            className="entry-card-img"
                          />
                        ) : (
                          <div className="entry-card-img-empty" />
                        )}
                      </div>
                      <div className="entry-card-label">{entry.label}</div>
                      <div className="entry-card-input">{inputIdToString(entry.input_id)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="master-detail">
                  <div className="entry-list-panel">
                    {currentAtlas.entries.map((entry) => (
                      <div
                        key={entry.id}
                        className={`entry-list-item ${pressedSet.has(inputIdToString(entry.input_id)) ? "pressed" : ""} ${selectedEntryId === entry.id ? "selected" : ""}`}
                        onClick={() => setSelectedEntryId(selectedEntryId === entry.id ? null : entry.id)}
                      >
                        <div className="entry-list-thumbs">
                          {!imageRefIsEmpty(entry.unpressed_image) ? (
                            <AtlasImage
                              atlasName={currentAtlas.name}
                              imageRef={entry.unpressed_image}
                              alt="up"
                              className="entry-list-thumb"
                            />
                          ) : (
                            <div className="entry-list-thumb-empty" />
                          )}
                        </div>
                        <div className="entry-list-info">
                          <span className="entry-list-label">{entry.label}</span>
                          <span className="entry-list-input">{inputIdToString(entry.input_id)}</span>
                        </div>
                      </div>
                    ))}
                    {currentAtlas.entries.length === 0 && (
                      <div className="empty-state" style={{ padding: 20 }}>
                        No entries yet. Click "+ Add Entry" to create one.
                      </div>
                    )}
                  </div>
                  <div className="entry-edit-panel">
                    {selectedEntry ? (
                      <AtlasEntryEditor
                        key={selectedEntry.id}
                        entry={selectedEntry}
                        atlasName={currentAtlas.name}
                        isPressed={pressedSet.has(inputIdToString(selectedEntry.input_id))}
                        currentInput={
                          inputState.pressed.length > 0 ? inputState.pressed[0] : null
                        }
                        sourceImages={sourceImages}
                        onUpdate={updateEntry}
                        onRemove={() => removeEntry(selectedEntry.id)}
                        onUploadImage={handleUploadImage}
                        onUpdateSource={handleUpdateSourceImage}
                      />
                    ) : (
                      <div className="empty-state" style={{ padding: 20 }}>
                        Select an entry to edit.
                      </div>
                    )}

                    {!isCommunity && (
                      <div className="source-images-section">
                        <div className="source-images-header">
                          <span className="source-images-title">Source Images</span>
                          <button className="btn btn-sm" onClick={handleAddSourceImage}>
                            + Add
                          </button>
                        </div>
                        {sourceImages.length > 0 ? (
                          <div className="source-images-list">
                            {sourceImages.map((si) => {
                              const fname = sourceImageFilename(si);
                              return (
                                <div key={fname} className="source-image-thumb">
                                  <AtlasImage
                                    atlasName={currentAtlas.name}
                                    imageRef={fname}
                                    alt={fname}
                                  />
                                  <button
                                    className="btn btn-danger btn-sm source-remove"
                                    onClick={() => handleRemoveSourceImage(si)}
                                  >
                                    X
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="source-images-hint">
                            Add source images to select sprite regions from.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <p>Select or create an atlas to get started.</p>
            <button
              className="btn btn-primary"
              style={{ marginTop: 12 }}
              onClick={() => openCommunityBrowser()}
            >
              Browse Community Atlases
            </button>
          </div>
        )}
      </div>

      {addModalOpen && (
        <div className="add-modal-overlay" onClick={() => setAddModalOpen(false)}>
          <div className="add-modal" onClick={(e) => e.stopPropagation()}>
            <div className="add-modal-title">Add Atlas</div>
            <div className="add-modal-section">
              <label className="add-modal-label">Create new</label>
              <div className="add-modal-row">
                <input
                  type="text"
                  placeholder="Atlas name..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createNew()}
                  autoFocus
                />
                <button
                  className="btn btn-primary"
                  onClick={createNew}
                  disabled={!newName.trim()}
                >
                  Create
                </button>
              </div>
            </div>
            <div className="add-modal-divider" />
            <div className="add-modal-section">
              <button className="btn" style={{ width: "100%" }} onClick={handleImport}>
                Import from ZIP
              </button>
            </div>
          </div>
        </div>
      )}

      {forkDialog && (
        <div className="add-modal-overlay" onClick={() => setForkDialog(null)}>
          <div className="add-modal" onClick={(e) => e.stopPropagation()}>
            <div className="add-modal-title">Fork Atlas</div>
            <p style={{ fontSize: 13, color: "#aaa", margin: 0 }}>
              Create an editable local copy of "{forkDialog.name}".
            </p>
            <label className="add-modal-label">Name:</label>
            <input
              type="text"
              value={forkDialog.value}
              onChange={(e) => setForkDialog({ ...forkDialog, value: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && handleForkConfirm()}
              autoFocus
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn" onClick={() => setForkDialog(null)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleForkConfirm}
                disabled={!forkDialog.value.trim()}
              >
                Fork
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .atlas-builder {
          display: grid;
          grid-template-columns: 240px 1fr;
          gap: 16px;
          height: 100%;
        }
        .atlas-list {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .atlas-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px 8px;
          border-radius: 4px;
          cursor: pointer;
          transition: background 0.2s;
          font-size: 13px;
        }
        .atlas-item:hover {
          background: rgba(255,255,255,0.05);
        }
        .atlas-item.active {
          background: rgba(232, 115, 12, 0.15);
          color: #e8730c;
        }
        .btn-sm {
          padding: 3px 10px;
          font-size: 12px;
        }
        .atlas-sidebar.panel {
          padding: 10px 8px;
          overflow-y: auto;
        }
        .atlas-main {
          display: flex;
          flex-direction: column;
          overflow: hidden;
          min-height: 0;
        }
        .atlas-toolbar {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          background: #2a2a2a;
          border: 1px solid #3a3a3a;
          border-radius: 8px 8px 0 0;
          flex-shrink: 0;
        }
        .atlas-toolbar-name {
          font-size: 16px;
          font-weight: 600;
          color: #e8730c;
        }
        .atlas-toolbar-count {
          font-size: 12px;
          color: #777;
        }
        .atlas-toolbar-actions {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .atlas-content {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          background: #232323;
          border: 1px solid #3a3a3a;
          border-top: none;
          border-radius: 0 0 8px 8px;
          overflow: hidden;
        }
        .master-detail {
          display: flex;
          flex: 1;
          min-height: 0;
        }
        .entry-list-panel {
          width: 280px;
          min-width: 200px;
          border-right: 1px solid #3a3a3a;
          overflow-y: auto;
          flex-shrink: 0;
        }
        .entry-list-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 10px;
          cursor: pointer;
          border-bottom: 1px solid #2a2a2a;
          transition: background 0.1s;
        }
        .entry-list-item:hover {
          background: rgba(255,255,255,0.03);
        }
        .entry-list-item.selected {
          background: rgba(232, 115, 12, 0.12);
          border-left: 3px solid #e8730c;
          padding-left: 7px;
        }
        .entry-list-item.pressed {
          background: rgba(232, 115, 12, 0.06);
        }
        .entry-list-item.selected.pressed {
          background: rgba(232, 115, 12, 0.2);
        }
        .entry-list-thumbs {
          flex-shrink: 0;
        }
        .entry-list-thumb {
          width: 28px;
          height: 28px;
          object-fit: contain;
          background: #2a2a2a;
          border-radius: 3px;
        }
        .entry-list-thumb-empty {
          width: 28px;
          height: 28px;
          background: #2a2a2a;
          border: 1px dashed #3a3a3a;
          border-radius: 3px;
        }
        .entry-list-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 1px;
        }
        .entry-list-label {
          font-size: 12px;
          font-weight: 600;
          color: #e0e0e0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .entry-list-input {
          font-size: 10px;
          color: #777;
          font-family: monospace;
        }
        .entry-list-size {
          font-size: 10px;
          color: #555;
          flex-shrink: 0;
        }
        .entry-edit-panel {
          flex: 1;
          min-width: 0;
          overflow-y: auto;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .atlas-section {
          margin-bottom: 8px;
        }
        .atlas-section-header {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 4px;
          cursor: pointer;
          user-select: none;
          border-radius: 4px;
        }
        .atlas-section-header:hover {
          background: rgba(255,255,255,0.03);
        }
        .atlas-section-arrow {
          font-size: 18px;
          color: #999;
          width: 18px;
        }
        .atlas-section-title {
          font-size: 14px;
          font-weight: 600;
          color: #ccc;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          flex: 1;
        }
        .atlas-section-empty {
          font-size: 13px;
          color: #999;
          font-style: italic;
          padding: 8px 12px;
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
        }
        .add-modal-row input {
          flex: 1;
          min-width: 0;
        }
        .add-modal-divider {
          height: 1px;
          background: #3a3a3a;
        }
        .source-images-section {
          margin-bottom: 12px;
          padding: 8px;
          border: 1px solid #3a3a3a;
          border-radius: 6px;
          background: #181818;
        }
        .source-images-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .source-images-title {
          font-size: 12px;
          font-weight: 600;
          color: #999;
          text-transform: uppercase;
        }
        .source-images-list {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .source-image-thumb {
          position: relative;
          width: 64px;
          height: 64px;
        }
        .source-image-thumb img {
          width: 64px;
          height: 64px;
          object-fit: cover;
          border-radius: 4px;
          border: 1px solid #3a3a3a;
        }
        .source-remove {
          position: absolute;
          top: -4px;
          right: -4px;
          padding: 0 4px !important;
          font-size: 9px !important;
          line-height: 16px;
        }
        .source-images-hint {
          font-size: 11px;
          color: #556;
          font-style: italic;
        }
        .atlas-meta {
          margin-bottom: 12px;
          padding: 12px;
          background: rgba(100, 180, 255, 0.06);
          border: 1px solid rgba(100, 180, 255, 0.15);
          border-radius: 6px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .atlas-readonly-notice {
          font-size: 12px;
          color: #6cb4ee;
        }
        .atlas-meta-desc {
          font-size: 13px;
          color: #bbb;
          line-height: 1.4;
        }
        .atlas-meta-details {
          display: flex;
          gap: 16px;
          font-size: 12px;
          color: #888;
        }
        .atlas-meta-details strong {
          color: #ccc;
        }
        .atlas-origin {
          font-size: 12px;
          color: #888;
          padding: 6px 10px;
          margin-bottom: 8px;
          background: rgba(232, 115, 12, 0.08);
          border: 1px solid rgba(232, 115, 12, 0.2);
          border-radius: 4px;
        }
        .atlas-origin strong {
          color: #e8730c;
        }
        .entries-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 8px;
          overflow-y: auto;
          flex: 1;
          min-height: 0;
          padding: 2px;
        }
        .entry-card {
          background: #181818;
          border: 1px solid #3a3a3a;
          border-radius: 6px;
          padding: 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          transition: border-color 0.15s;
        }
        .entry-card.pressed {
          border-color: #e8730c;
          box-shadow: 0 0 8px rgba(232, 115, 12, 0.3);
        }
        .entry-card-images {
          display: flex;
          gap: 4px;
        }
        .entry-card-img {
          width: 40px;
          height: 40px;
          object-fit: contain;
          background: #2a2a2a;
          border-radius: 3px;
        }
        .entry-card-img-empty {
          width: 40px;
          height: 40px;
          background: #2a2a2a;
          border: 1px dashed #3a3a3a;
          border-radius: 3px;
        }
        .entry-card-label {
          font-size: 12px;
          font-weight: 600;
          color: #e0e0e0;
          text-align: center;
        }
        .entry-card-input {
          font-size: 10px;
          color: #777;
          font-family: monospace;
          text-align: center;
          word-break: break-all;
        }
        .empty-state {
          text-align: center;
          color: #667;
          padding: 40px;
          font-style: italic;
        }
        .actions-menu {
          position: relative;
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
