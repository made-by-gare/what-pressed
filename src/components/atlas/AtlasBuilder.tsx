import { useState } from "react";
import { useAtlas } from "../../hooks/useAtlas";
import { useInputState } from "../../hooks/useInputState";
import { AtlasEntryEditor } from "./AtlasEntryEditor";
import type { Atlas, AtlasEntry } from "../../types/atlas";
import { inputIdToString } from "../../types/input";
import {
  importAtlasImage,
  exportAtlasZip,
  importAtlasZip,
  createDefaultAtlas,
} from "../../lib/commands";
import { openCommunityBrowser } from "../../lib/communityCommands";
import { open, save } from "@tauri-apps/plugin-dialog";
import { AtlasImage } from "./AtlasImage";

export function AtlasBuilder() {
  const {
    atlasList,
    currentAtlas,
    load,
    save: saveAtlas,
    remove,
    refresh,
  } = useAtlas();
  const inputState = useInputState();
  const [newName, setNewName] = useState("");

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
    const path = await open({
      filters: [{ name: "ZIP Archive", extensions: ["zip"] }],
    });
    if (path) {
      const name = await importAtlasZip(path as string);
      await refresh();
      await load(name);
    }
  };

  const handleCreateDefault = async () => {
    await createDefaultAtlas();
    await refresh();
    await load("default");
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
      saveAtlas({
        ...currentAtlas,
        source_images: [...(currentAtlas.source_images ?? []), filename],
      });
    }
  };

  const handleRemoveSourceImage = (filename: string) => {
    if (!currentAtlas) return;
    saveAtlas({
      ...currentAtlas,
      source_images: (currentAtlas.source_images ?? []).filter(
        (f) => f !== filename,
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
        updateEntry({ ...entry, [field]: filename });
      }
    }
  };

  const pressedSet = new Set(
    inputState.pressed.map((id) => inputIdToString(id)),
  );

  const sourceImages = currentAtlas?.source_images ?? [];
  const isCommunity = currentAtlas
    ? atlasList.find((a) => a.name === currentAtlas.name)?.source === "community"
    : false;

  return (
    <div className="atlas-builder">
      <div className="atlas-sidebar panel">
        <div className="panel-header">Atlases</div>
        <div className="atlas-list">
          {atlasList.map((info) => (
            <div
              key={info.name}
              className={`atlas-item ${currentAtlas?.name === info.name ? "active" : ""}`}
              onClick={() => load(info.name)}
            >
              <span>
                {info.name}
                {info.source === "community" && (
                  <span className="atlas-community-badge">community</span>
                )}
              </span>
              {info.source === "local" && (
                <button
                  className="btn btn-danger btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(info.name);
                  }}
                >
                  X
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="atlas-create">
          <input
            type="text"
            placeholder="New atlas name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createNew()}
          />
          <button className="btn btn-primary" onClick={createNew}>
            Create
          </button>
        </div>
        <div className="atlas-actions">
          <button className="btn" onClick={handleImport}>
            Import ZIP
          </button>
          {currentAtlas && (
            <button className="btn" onClick={handleExport}>
              Export ZIP
            </button>
          )}
        </div>
        <button
          className="btn"
          style={{ marginTop: 8, width: "100%" }}
          onClick={handleCreateDefault}
        >
          Generate Default KB
        </button>
        <button
          className="btn btn-primary"
          style={{ marginTop: 8, width: "100%" }}
          onClick={() => openCommunityBrowser()}
        >
          Browse Community
        </button>
      </div>

      <div className="atlas-entries panel">
        {currentAtlas ? (
          <>
            <div className="panel-header">
              {currentAtlas.name} - Entries
              {!isCommunity && (
                <button
                  className="btn btn-primary"
                  style={{ marginLeft: "auto", float: "right" }}
                  onClick={addEntry}
                >
                  + Add Entry
                </button>
              )}
            </div>

            {isCommunity && (
              <div className="atlas-readonly-notice">
                This is a community atlas (read-only). Fork it from the Community Browser to edit.
              </div>
            )}

            {currentAtlas.origin && (
              <div className="atlas-origin">
                Forked from community atlas: <strong>{currentAtlas.origin}</strong>
              </div>
            )}

            {!isCommunity && (
            <div className="source-images-section">
              <div className="source-images-header">
                <span className="source-images-title">Source Images</span>
                <button className="btn btn-sm" onClick={handleAddSourceImage}>
                  + Add Source Image
                </button>
              </div>
              {sourceImages.length > 0 ? (
                <div className="source-images-list">
                  {sourceImages.map((name) => (
                    <div key={name} className="source-image-thumb">
                      <AtlasImage
                        atlasName={currentAtlas.name}
                        filename={name}
                        alt={name}
                      />
                      <button
                        className="btn btn-danger btn-sm source-remove"
                        onClick={() => handleRemoveSourceImage(name)}
                      >
                        X
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="source-images-hint">
                  Add source images (spritesheets) to crop regions from them.
                </div>
              )}
            </div>
            )}

            <div className="entries-list">
              {currentAtlas.entries.map((entry) => (
                <AtlasEntryEditor
                  key={entry.id}
                  entry={entry}
                  atlasName={currentAtlas.name}
                  isPressed={pressedSet.has(inputIdToString(entry.input_id))}
                  currentInput={
                    inputState.pressed.length > 0 ? inputState.pressed[0] : null
                  }
                  sourceImages={sourceImages}
                  onUpdate={isCommunity ? undefined : updateEntry}
                  onRemove={isCommunity ? undefined : () => removeEntry(entry.id)}
                  onUploadImage={isCommunity ? undefined : handleUploadImage}
                />
              ))}
              {currentAtlas.entries.length === 0 && (
                <div className="empty-state">
                  No entries yet. Click "+ Add Entry" to create one.
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="empty-state">
            Select or create an atlas to get started.
          </div>
        )}
      </div>

      <style>{`
        .atlas-builder {
          display: grid;
          grid-template-columns: 250px 1fr;
          gap: 16px;
          height: calc(100vh - 80px);
        }
        .atlas-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-bottom: 12px;
          max-height: 300px;
          overflow-y: auto;
        }
        .atlas-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          border-radius: 4px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .atlas-item:hover {
          background: rgba(255,255,255,0.05);
        }
        .atlas-item.active {
          background: rgba(232, 115, 12, 0.15);
          color: #e8730c;
        }
        .atlas-community-badge {
          font-size: 10px;
          background: rgba(100, 180, 255, 0.15);
          color: #6cb4ee;
          padding: 1px 6px;
          border-radius: 4px;
          margin-left: 6px;
          font-weight: 600;
        }
        .btn-sm {
          padding: 2px 8px;
          font-size: 11px;
        }
        .atlas-create {
          display: flex;
          gap: 8px;
          margin-bottom: 8px;
        }
        .atlas-create input {
          flex: 1;
          min-width: 0;
        }
        .atlas-actions {
          display: flex;
          gap: 8px;
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
        .atlas-readonly-notice {
          font-size: 12px;
          color: #6cb4ee;
          padding: 8px 12px;
          margin-bottom: 8px;
          background: rgba(100, 180, 255, 0.08);
          border: 1px solid rgba(100, 180, 255, 0.2);
          border-radius: 4px;
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
        .entries-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          overflow-y: auto;
        }
        .empty-state {
          text-align: center;
          color: #667;
          padding: 40px;
          font-style: italic;
        }
      `}</style>
    </div>
  );
}
