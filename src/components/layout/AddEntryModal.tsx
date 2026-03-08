import { useState, useEffect } from "react";
import type { Atlas } from "../../types/atlas";
import { imageRefIsEmpty } from "../../types/atlas";
import { AtlasImage } from "../atlas/AtlasImage";


interface AtlasInfo {
  name: string;
  source: string;
}

interface Props {
  atlasList: AtlasInfo[];
  atlases: Map<string, Atlas>;
  onLoadAtlas: (name: string) => void;
  onAddFromAtlas: (atlasName: string, entryId: string) => void;
  onAddShape: (decoration: boolean) => void;
  onAddImage: (decoration: boolean) => void;
  onClose: () => void;
}

type View = "menu" | "atlas-picker";

export function AddEntryModal({
  atlasList,
  atlases,
  onLoadAtlas,
  onAddFromAtlas,
  onAddShape,
  onAddImage,
  onClose,
}: Props) {
  const [view, setView] = useState<View>("menu");
  const [selectedAtlas, setSelectedAtlas] = useState("");
  const [search, setSearch] = useState("");

  const atlas = selectedAtlas ? atlases.get(selectedAtlas) : null;

  // Load atlas data when selected
  useEffect(() => {
    if (selectedAtlas && !atlases.has(selectedAtlas)) {
      onLoadAtlas(selectedAtlas);
    }
  }, [selectedAtlas]);

  const filteredEntries = atlas
    ? atlas.entries.filter((ae) =>
        ae.label.toLowerCase().includes(search.toLowerCase()),
      )
    : [];

  const styles = (
    <style>{`
        .add-entry-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 200;
        }
        .add-entry-modal {
          background: #2a2a2a;
          border: 1px solid #3a3a3a;
          border-radius: 10px;
          padding: 20px;
          width: 340px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .atlas-picker-modal {
          width: 600px;
          max-height: 80vh;
        }
        .aem-header {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .aem-back {
          background: none;
          border: none;
          color: #999;
          font-size: 18px;
          cursor: pointer;
          padding: 0 4px;
        }
        .aem-back:hover { color: #e8730c; }
        .aem-title {
          font-size: 16px;
          font-weight: 600;
          color: #e8730c;
        }
        .aem-section-label {
          font-size: 12px;
          font-weight: 600;
          color: #bbb;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .aem-section-hint {
          font-size: 11px;
          color: #666;
          margin-bottom: 4px;
        }
        .aem-section {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .aem-options {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .aem-option {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          border-radius: 6px;
          border: 1px solid rgba(255,255,255,0.06);
          background: rgba(255,255,255,0.02);
          cursor: pointer;
          text-align: left;
          color: inherit;
          transition: background 0.1s, border-color 0.1s;
        }
        .aem-option:hover {
          background: rgba(255,255,255,0.06);
          border-color: rgba(255,255,255,0.12);
        }
        .aem-option-icon {
          width: 32px;
          height: 32px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 700;
          flex-shrink: 0;
        }
        .aem-icon-atlas { background: rgba(110,180,238,0.15); color: #6cb4ee; }
        .aem-icon-image { background: rgba(46,204,113,0.15); color: #2ecc71; }
        .aem-icon-shape { background: rgba(232,115,12,0.15); color: #e8730c; }
        .aem-option-info {
          display: flex;
          flex-direction: column;
          gap: 1px;
          min-width: 0;
        }
        .aem-option-name {
          font-size: 13px;
          font-weight: 500;
          color: #ddd;
        }
        .aem-option-desc {
          font-size: 11px;
          color: #777;
        }
        .aem-divider {
          height: 1px;
          background: #3a3a3a;
        }
        .aem-atlas-select {
          width: 100%;
        }
        .aem-search {
          width: 100%;
        }
        .aem-atlas-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
          gap: 6px;
          max-height: 50vh;
          overflow-y: auto;
          padding: 2px 6px 2px 2px;
        }
        .aem-hint {
          grid-column: 1 / -1;
          text-align: center;
          color: #666;
          font-size: 12px;
          padding: 16px;
        }
        .aem-atlas-entry {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 6px;
          border-radius: 6px;
          border: 1px solid rgba(255,255,255,0.06);
          background: rgba(255,255,255,0.02);
          cursor: pointer;
          color: inherit;
          transition: background 0.1s, border-color 0.1s;
        }
        .aem-atlas-entry:hover {
          background: rgba(232,115,12,0.1);
          border-color: rgba(232,115,12,0.3);
        }
        .aem-atlas-thumb {
          width: 48px;
          height: 48px;
          border-radius: 4px;
          background: rgba(255,255,255,0.04);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .aem-atlas-thumb-img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          image-rendering: pixelated;
        }
        .aem-atlas-thumb-letter {
          font-size: 18px;
          font-weight: 600;
          color: #555;
        }
        .aem-atlas-entry-label {
          font-size: 10px;
          color: #aaa;
          text-align: center;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          width: 100%;
        }
    `}</style>
  );

  if (view === "atlas-picker") {
    return (
      <div className="add-entry-overlay" onClick={onClose}>
        <div className="add-entry-modal atlas-picker-modal" onClick={(e) => e.stopPropagation()}>
          <div className="aem-header">
            <button className="aem-back" onClick={() => setView("menu")}>&larr;</button>
            <span className="aem-title">From Atlas</span>
          </div>

          <select
            className="aem-atlas-select"
            value={selectedAtlas}
            onChange={(e) => {
              setSelectedAtlas(e.target.value);
              setSearch("");
            }}
          >
            <option value="">Select atlas...</option>
            {atlasList.map((info) => (
              <option key={info.name} value={info.name}>
                {info.name}{info.source === "community" ? " (community)" : ""}
              </option>
            ))}
          </select>

          {selectedAtlas && (
            <input
              className="aem-search"
              type="text"
              placeholder="Search entries..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          )}

          <div className="aem-atlas-grid">
            {!selectedAtlas && (
              <div className="aem-hint">Choose an atlas above</div>
            )}
            {selectedAtlas && !atlas && (
              <div className="aem-hint">Loading...</div>
            )}
            {selectedAtlas && atlas && filteredEntries.length === 0 && (
              <div className="aem-hint">No entries match</div>
            )}
            {filteredEntries.map((ae) => (
              <button
                key={ae.id}
                className="aem-atlas-entry"
                onClick={() => {
                  onAddFromAtlas(selectedAtlas, ae.id);
                  onClose();
                }}
                title={ae.label}
              >
                <div className="aem-atlas-thumb">
                  {!imageRefIsEmpty(ae.unpressed_image) ? (
                    <AtlasImage
                      atlasName={selectedAtlas}
                      imageRef={ae.unpressed_image}
                      alt={ae.label}
                      className="aem-atlas-thumb-img"
                    />
                  ) : (
                    <span className="aem-atlas-thumb-letter">
                      {ae.label.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <span className="aem-atlas-entry-label">{ae.label}</span>
              </button>
            ))}
          </div>
        </div>
        {styles}
      </div>
    );
  }

  return (
    <div className="add-entry-overlay" onClick={onClose}>
      <div className="add-entry-modal" onClick={(e) => e.stopPropagation()}>
        <div className="aem-title">Add Entry</div>

        <div className="aem-section">
          <div className="aem-section-label">Input</div>
          <div className="aem-section-hint">Responds to key/button presses</div>
          <div className="aem-options">
            <button className="aem-option" onClick={() => setView("atlas-picker")}>
              <div className="aem-option-icon aem-icon-atlas">A</div>
              <div className="aem-option-info">
                <span className="aem-option-name">From Atlas</span>
                <span className="aem-option-desc">Use a pre-made atlas entry</span>
              </div>
            </button>
            <button className="aem-option" onClick={() => { onAddImage(false); onClose(); }}>
              <div className="aem-option-icon aem-icon-image">I</div>
              <div className="aem-option-info">
                <span className="aem-option-name">Image</span>
                <span className="aem-option-desc">Custom pressed/unpressed images</span>
              </div>
            </button>
            <button className="aem-option" onClick={() => { onAddShape(false); onClose(); }}>
              <div className="aem-option-icon aem-icon-shape">S</div>
              <div className="aem-option-info">
                <span className="aem-option-name">Shape</span>
                <span className="aem-option-desc">Rectangle or circle with colors</span>
              </div>
            </button>
          </div>
        </div>

        <div className="aem-divider" />

        <div className="aem-section">
          <div className="aem-section-label">Decoration</div>
          <div className="aem-section-hint">Static background element, no input</div>
          <div className="aem-options">
            <button className="aem-option" onClick={() => { onAddImage(true); onClose(); }}>
              <div className="aem-option-icon aem-icon-image">I</div>
              <div className="aem-option-info">
                <span className="aem-option-name">Image</span>
                <span className="aem-option-desc">Static background image</span>
              </div>
            </button>
            <button className="aem-option" onClick={() => { onAddShape(true); onClose(); }}>
              <div className="aem-option-icon aem-icon-shape">S</div>
              <div className="aem-option-info">
                <span className="aem-option-name">Shape</span>
                <span className="aem-option-desc">Static background shape</span>
              </div>
            </button>
          </div>
        </div>
      </div>
      {styles}
    </div>
  );
}
