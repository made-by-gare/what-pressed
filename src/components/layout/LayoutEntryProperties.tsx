import type { LayoutEntry } from "../../types/layout";
import type { AtlasEntry } from "../../types/atlas";

interface Props {
  entry: LayoutEntry;
  atlasEntry: AtlasEntry | undefined;
  onUpdate: (entry: LayoutEntry) => void;
  onRemove: () => void;
}

export function LayoutEntryProperties({
  entry,
  atlasEntry,
  onUpdate,
  onRemove,
}: Props) {
  return (
    <div className="entry-properties">
      <div className="panel-header">Properties</div>
      {atlasEntry && <div className="prop-label">{atlasEntry.label}</div>}

      <div className="prop-row">
        <label>X:</label>
        <input
          type="number"
          value={entry.x}
          onChange={(e) =>
            onUpdate({ ...entry, x: parseFloat(e.target.value) || 0 })
          }
        />
      </div>
      <div className="prop-row">
        <label>Y:</label>
        <input
          type="number"
          value={entry.y}
          onChange={(e) =>
            onUpdate({ ...entry, y: parseFloat(e.target.value) || 0 })
          }
        />
      </div>
      <div className="prop-row">
        <label>Scale:</label>
        <input
          type="number"
          step="0.1"
          min="0.1"
          value={entry.scale}
          onChange={(e) =>
            onUpdate({ ...entry, scale: parseFloat(e.target.value) || 1 })
          }
        />
      </div>
      <div className="prop-row">
        <label>Rotation:</label>
        <input
          type="number"
          step="15"
          value={entry.rotation}
          onChange={(e) =>
            onUpdate({ ...entry, rotation: parseFloat(e.target.value) || 0 })
          }
        />
      </div>
      <div className="prop-row">
        <label>Z-Index:</label>
        <input
          type="number"
          value={entry.z_index}
          onChange={(e) =>
            onUpdate({ ...entry, z_index: parseInt(e.target.value) || 0 })
          }
        />
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
        }
        .prop-label {
          font-weight: 600;
          color: #e8730c;
          margin-bottom: 4px;
        }
        .prop-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .prop-row label {
          min-width: 60px;
          color: #999;
          font-size: 13px;
        }
        .prop-row input {
          flex: 1;
        }
      `}</style>
    </div>
  );
}
