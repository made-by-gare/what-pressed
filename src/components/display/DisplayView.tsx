import { useState, useEffect } from "react";
import { useInputState } from "../../hooks/useInputState";
import { useAtlas } from "../../hooks/useAtlas";
import { useLayout } from "../../hooks/useLayout";
import { DisplayRenderer } from "./DisplayRenderer";
import {
  startServer,
  stopServer,
  getServerPort,
  setActiveLayout,
} from "../../lib/commands";
import { inputIdToString } from "../../types/input";

export function DisplayView() {
  const inputState = useInputState();
  const { currentAtlas, load: loadAtlas } = useAtlas();
  const { layoutNames, currentLayout, load: loadLayout } = useLayout();
  const [serverPort, setServerPort] = useState<number | null>(null);
  const [portInput, setPortInput] = useState(9120);

  // Restore last used layout
  useEffect(() => {
    getServerPort()
      .then(setServerPort)
      .catch(() => {});
    const last = localStorage.getItem("wp-last-layout");
    if (last && layoutNames.includes(last)) {
      loadLayout(last);
    }
  }, [layoutNames]);

  const handleSelectLayout = async (name: string) => {
    localStorage.setItem("wp-last-layout", name);
    await loadLayout(name);
  };

  // When layout loads, also load its atlas and persist selection
  useEffect(() => {
    if (currentLayout && currentLayout.atlas_name) {
      loadAtlas(currentLayout.atlas_name);
      setActiveLayout(currentLayout.name).catch(() => {});
      localStorage.setItem("wp-last-layout", currentLayout.name);
    }
  }, [currentLayout?.name]);

  const handleStartServer = async () => {
    await startServer(portInput);
    setServerPort(portInput);
  };

  const handleStopServer = async () => {
    await stopServer();
    setServerPort(null);
  };

  const pressedSet = new Set(
    inputState.pressed.map((id) => inputIdToString(id)),
  );

  return (
    <div className="display-view">
      <div className="display-controls panel">
        <div className="panel-header">Display Controls</div>

        <div className="control-row">
          <label>Layout:</label>
          {layoutNames.length > 0 ? (
            <select
              value={currentLayout?.name || ""}
              onChange={(e) =>
                e.target.value && handleSelectLayout(e.target.value)
              }
            >
              <option value="">Select layout...</option>
              {layoutNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          ) : (
            <span className="no-layouts-hint">
              No layouts yet — create one in the Layout Editor tab
            </span>
          )}
        </div>

        <div className="control-section">
          <div className="panel-header">OBS Server</div>
          {serverPort ? (
            <div>
              <div className="server-status">Running on port {serverPort}</div>
              <div className="server-url">http://localhost:{serverPort}/</div>
              <button className="btn btn-danger" onClick={handleStopServer}>
                Stop Server
              </button>
            </div>
          ) : (
            <div className="server-start">
              <input
                type="number"
                value={portInput}
                onChange={(e) => setPortInput(parseInt(e.target.value) || 9120)}
                style={{ width: 80 }}
              />
              <button className="btn btn-primary" onClick={handleStartServer}>
                Start Server
              </button>
            </div>
          )}
        </div>

        <div className="control-section">
          <div className="panel-header">Live Input</div>
          <div className="input-display">
            {inputState.pressed.length > 0 ? (
              inputState.pressed.map((id, i) => (
                <span key={i} className="pressed-badge">
                  {inputIdToString(id)}
                </span>
              ))
            ) : (
              <span className="no-input">No inputs pressed</span>
            )}
          </div>
          {Object.keys(inputState.axes).length > 0 && (
            <div className="axes-display">
              {Object.entries(inputState.axes).map(([name, value]) => (
                <div key={name} className="axis-row">
                  <span>{name}:</span>
                  <span>{value.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="display-canvas-area">
        {currentLayout && currentAtlas ? (
          <DisplayRenderer
            layout={currentLayout}
            atlas={currentAtlas}
            pressedSet={pressedSet}
          />
        ) : (
          <div className="panel empty-state">
            Select a layout to preview the display.
          </div>
        )}
      </div>

      <style>{`
        .display-view {
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: 16px;
          height: calc(100vh - 80px);
        }
        .control-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        .control-row label {
          min-width: 60px;
          color: #999;
        }
        .control-row select { flex: 1; }
        .control-section { margin-top: 16px; }
        .server-status {
          color: #2ecc71;
          font-weight: 600;
          margin-bottom: 4px;
        }
        .server-url {
          font-family: monospace;
          font-size: 12px;
          color: #999;
          margin-bottom: 8px;
          user-select: all;
        }
        .server-start {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .input-display {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }
        .pressed-badge {
          background: #e8730c;
          color: white;
          padding: 2px 8px;
          border-radius: 4px;
          font-family: monospace;
          font-size: 12px;
        }
        .no-input, .no-layouts-hint {
          color: #667;
          font-style: italic;
          font-size: 12px;
        }
        .axes-display {
          margin-top: 8px;
          font-size: 12px;
          font-family: monospace;
        }
        .axis-row {
          display: flex;
          justify-content: space-between;
          padding: 2px 0;
        }
        .display-canvas-area {
          overflow: hidden;
          border-radius: 8px;
        }
      `}</style>
    </div>
  );
}
