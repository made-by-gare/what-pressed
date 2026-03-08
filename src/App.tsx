import { useState, useEffect } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { AtlasBuilder } from "./components/atlas/AtlasBuilder";
import { LayoutEditor } from "./components/layout/LayoutEditor";
import { DisplayView } from "./components/display/DisplayView";
import { CommunityBrowser } from "./components/community/CommunityBrowser";
import { useWebviewInput } from "./hooks/useWebviewInput";
import { check } from "@tauri-apps/plugin-updater";
import { ask } from "@tauri-apps/plugin-dialog";
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
        {appVersion && <span className="app-version">v{appVersion}</span>}
      </nav>
      <main className="tab-content">
        {activeTab === "atlas" && <AtlasBuilder />}
        {activeTab === "layout" && <LayoutEditor />}
        {activeTab === "display" && <DisplayView />}
      </main>
    </div>
  );
}

export default App;
