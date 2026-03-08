import { useState, useEffect } from "react";
import { useInputState } from "../../hooks/useInputState";
import { useLayout } from "../../hooks/useLayout";
import { DisplayRenderer } from "./DisplayRenderer";
import {
  startServer,
  stopServer,
  getServerPort,
  setActiveLayout,
  loadAtlas,
} from "../../lib/commands";
import type { Atlas } from "../../types/atlas";
import { inputIdToString } from "../../types/input";
import { openUrl } from "@tauri-apps/plugin-opener";

interface DisplayViewProps {
  onNavigate?: (tab: "atlas" | "layout" | "display") => void;
}

export function DisplayView({ onNavigate }: DisplayViewProps) {
  const inputState = useInputState();
  const { layoutNames, currentLayout, load: loadLayout, loadError } = useLayout();
  const [atlases, setAtlases] = useState<Map<string, Atlas>>(new Map());
  const [serverPort, setServerPort] = useState<number | null>(null);
  const [portInput, setPortInput] = useState(9120);

  // Auto-start server on mount if previously running
  useEffect(() => {
    getServerPort()
      .then((port) => {
        if (port) {
          setServerPort(port);
        } else {
          const savedPort = localStorage.getItem("wp-server-port");
          if (savedPort) {
            const p = parseInt(savedPort);
            setPortInput(p);
            startServer(p)
              .then(() => setServerPort(p))
              .catch(() => {});
          }
        }
      })
      .catch(() => {});
  }, []);

  // Restore last used layout, or auto-select first
  useEffect(() => {
    if (layoutNames.length === 0) return;
    const last = localStorage.getItem("wp-last-layout");
    if (last && layoutNames.includes(last)) {
      loadLayout(last);
    } else {
      loadLayout(layoutNames[0]);
    }
  }, [layoutNames]);

  const handleSelectLayout = async (name: string) => {
    localStorage.setItem("wp-last-layout", name);
    await loadLayout(name);
  };

  // When layout loads, resolve all referenced atlases
  useEffect(() => {
    if (!currentLayout) return;
    setActiveLayout(currentLayout.name).catch(() => {});
    localStorage.setItem("wp-last-layout", currentLayout.name);

    // Collect unique atlas names from atlas-type entries
    const atlasNames = new Set<string>();
    for (const entry of currentLayout.entries) {
      if (entry.source.type === "atlas") {
        atlasNames.add(entry.source.atlas_name);
      }
    }

    // Load all needed atlases
    const newAtlases = new Map<string, Atlas>();
    Promise.all(
      [...atlasNames].map((name) =>
        loadAtlas(name)
          .then((atlas) => newAtlases.set(name, atlas))
          .catch(() => {}),
      ),
    ).then(() => setAtlases(newAtlases));
  }, [currentLayout?.name, currentLayout?.version]);

  const handleStartServer = async () => {
    await startServer(portInput);
    setServerPort(portInput);
    localStorage.setItem("wp-server-port", String(portInput));
  };

  const handleStopServer = async () => {
    await stopServer();
    setServerPort(null);
    localStorage.removeItem("wp-server-port");
  };

  const pressedSet = new Set(
    inputState.pressed.map((id) => inputIdToString(id)),
  );

  const hasLayouts = layoutNames.length > 0;

  return (
    <div className={`display-view${hasLayouts ? "" : " display-view-welcome"}`}>
      {!hasLayouts ? (
        <div className="welcome-panel">
          <div className="welcome-icon">&#127918;</div>
          <div className="welcome-title">Welcome to What Pressed</div>
          <p className="welcome-text">
            Show your keyboard, mouse, and gamepad inputs as a live overlay - perfect for streams, tutorials, and videos.
          </p>
          <div className="welcome-steps">
            <div className="welcome-step">
              <span className="welcome-step-num">1</span>
              <span>Create a <strong>Layout</strong> - arrange shapes, images, and inputs on a canvas</span>
            </div>
            <div className="welcome-step">
              <span className="welcome-step-num">2</span>
              <span>Preview your layout here and start the <strong>OBS server</strong> to use it as a browser source</span>
            </div>
          </div>
          <p className="welcome-hint">
            Want a head start? Browse <strong>Atlases</strong> for pre-configured input sets with images you can drop right into a layout.
          </p>
          <div className="welcome-actions">
            <button className="btn btn-primary" onClick={() => onNavigate?.("layout")}>
              Create Your First Layout
            </button>
            <button className="btn" onClick={() => onNavigate?.("atlas")}>
              Browse Atlases
            </button>
          </div>
        </div>
      ) : (<>
      <div className="display-controls panel">
        <div className="panel-header">Display Controls</div>

        <div className="control-row">
          <label>Layout:</label>
          <select
            value={currentLayout?.name || ""}
            onChange={(e) => handleSelectLayout(e.target.value)}
          >
            {layoutNames.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        <div className="control-section">
          <div className="panel-header">OBS Server</div>
          {serverPort ? (
            <div>
              <div className="server-status">Running on port {serverPort}</div>
              <a
                className="server-url"
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  openUrl(`http://localhost:${serverPort}/`);
                }}
              >
                http://localhost:{serverPort}/
              </a>
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
        {currentLayout ? (
          <DisplayRenderer
            layout={currentLayout}
            atlases={atlases}
            pressedSet={pressedSet}
          />
        ) : loadError ? (
          <div className="panel empty-state">
            <span style={{ color: "#e74c3c" }}>
              Failed to load "{loadError.name}" - it may use an incompatible format.
            </span>
          </div>
        ) : (
          <div className="panel empty-state">
            Select a layout to preview the display.
          </div>
        )}
      </div>
      </>)}

      <style>{`
        .display-view {
          display: grid;
          grid-template-columns: 240px 1fr;
          gap: 16px;
          height: 100%;
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
          display: block;
          font-family: monospace;
          font-size: 12px;
          color: #6cb4ee;
          margin-bottom: 8px;
          cursor: pointer;
          text-decoration: none;
        }
        .server-url:hover {
          text-decoration: underline;
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
        .display-view-welcome {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .display-view-welcome .welcome-panel {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          padding: 32px;
          text-align: center;
          color: #999;
        }
        .display-view-welcome .welcome-icon {
          font-size: 48px;
          margin-bottom: 8px;
          opacity: 0.3;
        }
        .display-view-welcome .welcome-title {
          font-size: 20px;
          font-weight: 600;
          color: #ccc;
          margin-bottom: 8px;
        }
        .display-view-welcome .welcome-text {
          font-size: 13px;
          color: #777;
          max-width: 380px;
          line-height: 1.5;
          margin-bottom: 20px;
        }
        .display-view-welcome .welcome-steps {
          display: flex;
          flex-direction: column;
          gap: 10px;
          text-align: left;
        }
        .display-view-welcome .welcome-step {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          color: #999;
        }
        .display-view-welcome .welcome-step strong {
          color: #ccc;
        }
        .display-view-welcome .welcome-step-num {
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
        .display-view-welcome .welcome-hint {
          font-size: 12px;
          color: #666;
          max-width: 380px;
          line-height: 1.5;
          margin-top: 16px;
        }
        .display-view-welcome .welcome-hint strong {
          color: #999;
        }
        .welcome-actions {
          display: flex;
          gap: 10px;
          margin-top: 24px;
        }
      `}</style>
    </div>
  );
}
