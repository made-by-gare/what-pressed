import type { CommunityIndexEntry } from "../../types/community";
import type { InstallProgress } from "../../lib/communityCommands";

interface Props {
  atlas: CommunityIndexEntry;
  installed: { semver: string; installed_at: string } | null;
  onInstall: () => void;
  onUninstall: () => void;
  onUpdate: () => void;
  onFork: () => void;
  loading: boolean;
  progress: InstallProgress | null;
}

export function CommunityAtlasCard({
  atlas,
  installed,
  onInstall,
  onUninstall,
  onUpdate,
  onFork,
  loading,
  progress,
}: Props) {
  const hasUpdate = installed && installed.semver !== atlas.version;

  return (
    <div className="community-card">
      <div className="community-card-thumb">
        <img
          src={`https://raw.githubusercontent.com/made-by-gare/what-pressed-atlases/main/${atlas.thumbnail_url}`}
          alt={atlas.display_name}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      </div>
      <div className="community-card-info">
        <div className="community-card-title">{atlas.display_name}</div>
        <div className="community-card-meta">
          by {atlas.author} &middot; {atlas.entry_count} entries &middot; v
          {atlas.version}
        </div>
        <div className="community-card-desc">{atlas.description}</div>
        {atlas.origin && (
          <div className="community-card-origin">
            Based on: {atlas.origin}
          </div>
        )}
        {loading && progress && progress.total > 0 && (
          <div className="community-card-progress">
            <div className="community-progress-bar">
              <div
                className="community-progress-fill"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
            <div className="community-progress-text">
              <span className="community-progress-step">{progress.step}</span>
              <span className="community-progress-count">{progress.current}/{progress.total}</span>
            </div>
          </div>
        )}
      </div>
      <div className="community-card-actions">
        {!installed && (
          <button
            className="btn btn-primary"
            onClick={onInstall}
            disabled={loading}
          >
            {loading ? "Installing..." : "Install"}
          </button>
        )}
        {installed && hasUpdate && (
          <button
            className="btn btn-primary"
            onClick={onUpdate}
            disabled={loading}
          >
            {loading ? "Updating..." : "Update"}
          </button>
        )}
        {installed && !hasUpdate && (
          <span className="community-badge-installed">Installed</span>
        )}
        {installed && (
          <>
            <button className="btn" onClick={onFork} disabled={loading}>
              Fork
            </button>
            <button
              className="btn btn-danger"
              onClick={onUninstall}
              disabled={loading}
            >
              Remove
            </button>
          </>
        )}
      </div>
    </div>
  );
}
