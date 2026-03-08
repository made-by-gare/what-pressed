import { useState, useEffect } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { AtlasBuilder } from "./components/atlas/AtlasBuilder";
import { LayoutEditor } from "./components/layout/LayoutEditor";
import { DisplayView } from "./components/display/DisplayView";
import { CommunityBrowser } from "./components/community/CommunityBrowser";
import { useWebviewInput } from "./hooks/useWebviewInput";
import { check } from "@tauri-apps/plugin-updater";
import { ask } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import "./App.css";

type Tab = "atlas" | "layout" | "display";

function App() {
  const [activeTab, setActiveTab] = useState<Tab>("display");
  const [appVersion, setAppVersion] = useState("");
  const isCommunity = window.location.hash === "#/community";

  // Capture keyboard events from the webview and inject into the input system.
  // Needed because rdev can't see keyboard events when the Tauri window has focus on Windows.
  useWebviewInput();

  useEffect(() => {
    getVersion().then(setAppVersion);
  }, []);

  // Check for updates on startup (only in main window)
  useEffect(() => {
    if (isCommunity) return;
    check()
      .then(async (update) => {
        if (!update) return;
        const yes = await ask(
          `Version ${update.version} is available. Update now?`,
          { title: "Update Available", kind: "info" },
        );
        if (yes) {
          await update.downloadAndInstall();
        }
      })
      .catch((e) => console.warn("Update check failed:", e));
  }, [isCommunity]);

  if (isCommunity) {
    return (
      <div className="app">
        <CommunityBrowser />
      </div>
    );
  }

  return (
    <div className="app">
      <nav className="tab-bar">
        <button
          className={activeTab === "display" ? "active" : ""}
          onClick={() => setActiveTab("display")}
        >
          Display
        </button>
        <button
          className={activeTab === "layout" ? "active" : ""}
          onClick={() => setActiveTab("layout")}
        >
          Layout Editor
        </button>
        <button
          className={activeTab === "atlas" ? "active" : ""}
          onClick={() => setActiveTab("atlas")}
        >
          Atlases
        </button>
        <span className="tab-bar-divider" />
        {appVersion && <span className="app-version">v{appVersion}</span>}
        <a
          className="github-link"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            openUrl("https://github.com/made-by-gare/what-pressed");
          }}
          title="View on GitHub"
        >
          <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/>
          </svg>
        </a>
      </nav>
      <main className="tab-content">
        {activeTab === "atlas" && <AtlasBuilder />}
        {activeTab === "layout" && <LayoutEditor />}
        {activeTab === "display" && <DisplayView onNavigate={setActiveTab} />}
      </main>
    </div>
  );
}

export default App;
