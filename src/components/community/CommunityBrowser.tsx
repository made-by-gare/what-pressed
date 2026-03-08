import { useState, useEffect, useCallback, useRef } from "react";
import { ask } from "@tauri-apps/plugin-dialog";
import type {
  CommunityIndex,
  CommunityManifest,
  CommunityIndexEntry,
} from "../../types/community";
import {
  fetchCommunityIndex,
  getCommunityManifest,
  installCommunityAtlas,
  uninstallCommunityAtlas,
  forkCommunityAtlas,
} from "../../lib/communityCommands";
import type { InstallProgress } from "../../lib/communityCommands";
import { CommunityAtlasCard } from "./CommunityAtlasCard";

export function CommunityBrowser() {
  const [index, setIndex] = useState<CommunityIndex | null>(null);
  const [manifest, setManifest] = useState<CommunityManifest | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingAtlas, setLoadingAtlas] = useState<string | null>(null);
  const [installProgress, setInstallProgress] =
    useState<InstallProgress | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [installedOnly, setInstalledOnly] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [cooldownSecs, setCooldownSecs] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [forkDialog, setForkDialog] = useState<{ name: string; value: string } | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }, []);

  const refresh = useCallback(async (showFeedback = false) => {
    setRefreshing(true);
    try {
      const [idx, man] = await Promise.all([
        fetchCommunityIndex(),
        getCommunityManifest(),
      ]);
      setIndex(idx);
      setManifest(man);
      setError(null);
      if (showFeedback) {
        showToast(`Index updated — ${idx.atlases.length} atlas(es) available`);
      }
    } catch (e) {
      setError(String(e));
    }
    setRefreshing(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleRefresh = async () => {
    if (cooldownSecs > 0 || refreshing) return;
    await refresh(true);
    setCooldownSecs(10);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldownSecs((s) => {
        if (s <= 1) {
          clearInterval(cooldownRef.current!);
          cooldownRef.current = null;
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  const filtered: CommunityIndexEntry[] = index
    ? index.atlases.filter((a) => {
        if (installedOnly && !manifest?.installed[a.name]) return false;
        const q = search.toLowerCase();
        return (
          a.display_name.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          a.author.toLowerCase().includes(q)
        );
      })
    : [];

  const handleInstall = async (name: string) => {
    setLoadingAtlas(name);
    setInstallProgress(null);
    try {
      await installCommunityAtlas(name, (p) => setInstallProgress(p));
      await refresh();
      showToast(`"${name}" installed successfully`);
    } catch (e) {
      setError(String(e));
    }
    setInstallProgress(null);
    setLoadingAtlas(null);
  };

  const handleUninstall = async (name: string) => {
    const confirmed = await ask(
      `Remove "${name}"? This will delete the installed atlas.`,
      { title: "Remove Atlas", kind: "warning" },
    );
    if (!confirmed) return;
    setLoadingAtlas(name);
    try {
      await uninstallCommunityAtlas(name);
      await refresh();
      showToast(`"${name}" removed`);
    } catch (e) {
      setError(String(e));
    }
    setLoadingAtlas(null);
  };

  const handleFork = (name: string) => {
    setForkDialog({ name, value: name });
  };

  const handleForkConfirm = async () => {
    if (!forkDialog) return;
    const newName = forkDialog.value.trim();
    if (!newName) return;
    const sourceName = forkDialog.name;
    setForkDialog(null);
    setLoadingAtlas(sourceName);
    try {
      const forkedName = await forkCommunityAtlas(sourceName, newName);
      await refresh();
      showToast(`Forked as "${forkedName}" — find it in Atlas Builder`);
    } catch (e) {
      setError(String(e));
    }
    setLoadingAtlas(null);
  };

  return (
    <div className="community-browser">
      <div className="community-header">
        <h1>Community Atlases</h1>
        <p className="community-subtitle">
          Browse and install atlases shared by the community
        </p>
      </div>

      <div className="community-search">
        <input
          type="text"
          placeholder="Search atlases..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className="community-installed-toggle">
          <input
            type="checkbox"
            checked={installedOnly}
            onChange={(e) => setInstalledOnly(e.target.checked)}
          />
          Installed only
        </label>
        <button
          className="btn"
          onClick={handleRefresh}
          disabled={refreshing || cooldownSecs > 0}
          title="Re-fetch the atlas index from GitHub"
        >
          {refreshing ? "Refreshing..." : cooldownSecs > 0 ? `Refresh (${cooldownSecs}s)` : "Refresh"}
        </button>
      </div>

      {error && <div className="community-error">{error}</div>}

      {!index && !error && (
        <div className="community-loading">Loading community atlases...</div>
      )}

      <div className="community-grid">
        {filtered.map((atlas) => (
          <CommunityAtlasCard
            key={atlas.name}
            atlas={atlas}
            installed={manifest?.installed[atlas.name] ?? null}
            onInstall={() => handleInstall(atlas.name)}
            onUninstall={() => handleUninstall(atlas.name)}
            onUpdate={() => handleInstall(atlas.name)}
            onFork={() => handleFork(atlas.name)}
            loading={loadingAtlas === atlas.name}
            progress={loadingAtlas === atlas.name ? installProgress : null}
          />
        ))}
        {index && filtered.length === 0 && (
          <div className="empty-state">
            {installedOnly
              ? "No installed atlases. Browse and install some from the list."
              : search
                ? "No atlases match your search."
                : "No community atlases available yet."}
          </div>
        )}
      </div>

      {forkDialog && (
        <div className="fork-overlay" onClick={() => setForkDialog(null)}>
          <div className="fork-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="fork-dialog-title">Fork Atlas</div>
            <p className="fork-dialog-desc">
              Create an editable local copy of "{forkDialog.name}".
            </p>
            <label className="fork-dialog-label">Name:</label>
            <input
              type="text"
              value={forkDialog.value}
              onChange={(e) =>
                setForkDialog({ ...forkDialog, value: e.target.value })
              }
              onKeyDown={(e) => e.key === "Enter" && handleForkConfirm()}
              autoFocus
            />
            <div className="fork-dialog-actions">
              <button className="btn" onClick={() => setForkDialog(null)}>
                Cancel
              </button>
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

      {toast && <div className="community-toast">{toast}</div>}

      <style>{`
        .community-browser {
          max-width: 900px;
          width: 100%;
          margin: 0 auto;
          padding: 20px;
        }
        .community-header {
          margin-bottom: 20px;
        }
        .community-header h1 {
          font-size: 24px;
          color: #e8730c;
          margin-bottom: 4px;
        }
        .community-subtitle {
          color: #888;
          font-size: 14px;
        }
        .community-search {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
        }
        .community-search input[type="text"] {
          flex: 1;
        }
        .community-installed-toggle {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 13px;
          color: #999;
          cursor: pointer;
          white-space: nowrap;
        }
        .community-installed-toggle input {
          width: auto;
        }
        .community-error {
          background: rgba(231, 76, 60, 0.15);
          border: 1px solid #c0392b;
          border-radius: 6px;
          padding: 12px;
          margin-bottom: 16px;
          color: #e74c3c;
          font-size: 13px;
        }
        .community-loading {
          text-align: center;
          color: #888;
          padding: 40px;
          font-style: italic;
        }
        .community-grid {
          display: flex;
          flex-direction: column;
          gap: 12px;
          min-height: 200px;
        }
        .community-card {
          display: flex;
          gap: 16px;
          align-items: center;
          background: #2a2a2a;
          border: 1px solid #3a3a3a;
          border-radius: 8px;
          padding: 16px;
          transition: border-color 0.2s;
        }
        .community-card:hover {
          border-color: #555;
        }
        .community-card-thumb {
          width: 80px;
          height: 80px;
          flex-shrink: 0;
          border-radius: 6px;
          overflow: hidden;
          background: #1a1a1a;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .community-card-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .community-card-info {
          flex: 1;
          min-width: 0;
        }
        .community-card-title {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 4px;
        }
        .community-card-meta {
          font-size: 12px;
          color: #888;
          margin-bottom: 6px;
        }
        .community-card-desc {
          font-size: 13px;
          color: #aaa;
          line-height: 1.4;
        }
        .community-card-origin {
          font-size: 11px;
          color: #e8730c;
          margin-top: 4px;
        }
        .community-card-actions {
          display: flex;
          gap: 8px;
          flex-shrink: 0;
          align-items: center;
        }
        .community-badge-installed {
          background: rgba(46, 204, 113, 0.15);
          color: #2ecc71;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
        }
        .community-card-progress {
          margin-top: 8px;
        }
        .community-progress-bar {
          height: 6px;
          background: #1a1a1a;
          border-radius: 3px;
          overflow: hidden;
        }
        .community-progress-fill {
          height: 100%;
          background: #e8730c;
          border-radius: 3px;
          transition: width 0.15s ease;
        }
        .community-progress-text {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: #888;
          margin-top: 4px;
        }
        .community-progress-step {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          min-width: 0;
        }
        .community-progress-count {
          flex-shrink: 0;
          margin-left: 8px;
        }
        .fork-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
        }
        .fork-dialog {
          background: #2a2a2a;
          border: 1px solid #3a3a3a;
          border-radius: 10px;
          padding: 24px;
          width: 360px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .fork-dialog-title {
          font-size: 18px;
          font-weight: 600;
          color: #e8730c;
        }
        .fork-dialog-desc {
          font-size: 13px;
          color: #aaa;
          margin: 0;
        }
        .fork-dialog-label {
          font-size: 12px;
          color: #999;
          margin-top: 4px;
        }
        .fork-dialog-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 8px;
        }
        .community-toast {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          background: #2ecc71;
          color: #111;
          padding: 10px 20px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          z-index: 200;
          animation: toast-in 0.3s ease;
        }
        @keyframes toast-in {
          from { opacity: 0; transform: translateX(-50%) translateY(10px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}
