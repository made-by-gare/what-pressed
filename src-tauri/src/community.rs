use crate::atlas::Atlas;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tauri::ipc::Channel;

const REPO_BASE: &str =
    "https://raw.githubusercontent.com/made-by-gare/what-pressed-atlases/main";

// ── Types ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommunityIndex {
    pub version: u32,
    pub atlases: Vec<CommunityIndexEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommunityIndexEntry {
    pub name: String,
    pub display_name: String,
    pub description: String,
    pub author: String,
    #[serde(rename = "version")]
    pub semver: String,
    pub thumbnail_url: String,
    pub entry_count: u32,
    pub updated_at: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub origin: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommunityManifest {
    pub installed: HashMap<String, InstalledAtlas>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledAtlas {
    pub semver: String,
    pub installed_at: String,
}

// ── Paths ──

fn community_dir(data_dir: &Path) -> PathBuf {
    data_dir.join("community-atlases")
}

fn community_atlas_dir(data_dir: &Path, name: &str) -> PathBuf {
    community_dir(data_dir).join(name)
}

fn manifest_path(data_dir: &Path) -> PathBuf {
    data_dir.join("community-atlases.json")
}

// ── Manifest ──

pub fn load_manifest(data_dir: &Path) -> CommunityManifest {
    let path = manifest_path(data_dir);
    if path.exists() {
        if let Ok(content) = std::fs::read_to_string(&path) {
            if let Ok(manifest) = serde_json::from_str(&content) {
                return manifest;
            }
        }
    }
    CommunityManifest {
        installed: HashMap::new(),
    }
}

fn save_manifest(data_dir: &Path, manifest: &CommunityManifest) -> Result<(), String> {
    let path = manifest_path(data_dir);
    let content = serde_json::to_string_pretty(manifest).map_err(|e| e.to_string())?;
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

// ── Fetch ──

pub async fn fetch_index() -> Result<CommunityIndex, String> {
    let url = format!("{}/index.json", REPO_BASE);
    let resp = reqwest::get(&url)
        .await
        .map_err(|e| format!("Failed to fetch community index: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()));
    }
    resp.json::<CommunityIndex>()
        .await
        .map_err(|e| format!("Failed to parse community index: {}", e))
}

async fn fetch_bytes(url: &str) -> Result<Vec<u8>, String> {
    let resp = reqwest::get(url)
        .await
        .map_err(|e| format!("Download failed: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("HTTP {} for {}", resp.status(), url));
    }
    resp.bytes()
        .await
        .map(|b| b.to_vec())
        .map_err(|e| format!("Failed to read response: {}", e))
}

// ── Progress ──

#[derive(Debug, Clone, Serialize)]
pub struct InstallProgress {
    pub step: String,
    pub current: u32,
    pub total: u32,
}

// ── Install ──

pub async fn install_atlas(
    data_dir: &Path,
    name: &str,
    on_progress: &Channel<InstallProgress>,
) -> Result<(), String> {
    let _ = on_progress.send(InstallProgress {
        step: "Downloading atlas.json...".into(),
        current: 0,
        total: 0,
    });

    let atlas_url = format!("{}/atlases/{}/atlas.json", REPO_BASE, name);
    let atlas_bytes = fetch_bytes(&atlas_url).await?;
    let atlas: Atlas =
        serde_json::from_slice(&atlas_bytes).map_err(|e| format!("Invalid atlas.json: {}", e))?;

    let dir = community_atlas_dir(data_dir, name);
    let images_dir = dir.join("images");
    std::fs::create_dir_all(&images_dir).map_err(|e| e.to_string())?;

    // Download all images referenced in entries
    let mut image_files: Vec<String> = Vec::new();
    for entry in &atlas.entries {
        if !entry.pressed_image.is_empty() {
            image_files.push(entry.pressed_image.filename().to_string());
        }
        if !entry.unpressed_image.is_empty() {
            image_files.push(entry.unpressed_image.filename().to_string());
        }
    }
    // Also source images
    for img in &atlas.source_images {
        image_files.push(img.filename().to_string());
    }
    // Deduplicate
    image_files.sort();
    image_files.dedup();

    let total = image_files.len() as u32 + 1; // +1 for thumbnail

    for (i, filename) in image_files.iter().enumerate() {
        let _ = on_progress.send(InstallProgress {
            step: format!("Downloading {}", filename),
            current: i as u32 + 1,
            total,
        });
        let url = format!("{}/atlases/{}/images/{}", REPO_BASE, name, filename);
        let data = fetch_bytes(&url).await?;
        std::fs::write(images_dir.join(filename), &data).map_err(|e| e.to_string())?;
    }

    // Download thumbnail if it exists (best-effort)
    let _ = on_progress.send(InstallProgress {
        step: "Downloading thumbnail...".into(),
        current: total,
        total,
    });
    let thumb_url = format!("{}/atlases/{}/thumbnail.png", REPO_BASE, name);
    if let Ok(data) = fetch_bytes(&thumb_url).await {
        std::fs::write(dir.join("thumbnail.png"), &data).ok();
    }

    // Save atlas.json
    std::fs::write(dir.join("atlas.json"), &atlas_bytes).map_err(|e| e.to_string())?;

    // Update manifest
    let mut manifest = load_manifest(data_dir);
    manifest.installed.insert(
        name.to_string(),
        InstalledAtlas {
            semver: atlas.semver.unwrap_or_else(|| "0.0.0".into()),
            installed_at: chrono_now(),
        },
    );
    save_manifest(data_dir, &manifest)?;

    Ok(())
}

// ── Uninstall ──

pub fn uninstall_atlas(data_dir: &Path, name: &str) -> Result<(), String> {
    let dir = community_atlas_dir(data_dir, name);
    if dir.exists() {
        std::fs::remove_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    let mut manifest = load_manifest(data_dir);
    manifest.installed.remove(name);
    save_manifest(data_dir, &manifest)?;
    Ok(())
}

// ── Fork ──

pub fn fork_atlas(data_dir: &Path, name: &str, new_name: &str) -> Result<String, String> {
    let src = community_atlas_dir(data_dir, name);
    if !src.exists() {
        return Err(format!("Community atlas '{}' not installed", name));
    }
    let dest = data_dir.join("atlases").join(new_name);
    if dest.exists() {
        return Err(format!(
            "Local atlas '{}' already exists. Choose a different name.",
            new_name
        ));
    }
    copy_dir_recursive(&src, &dest)?;

    // Update atlas.json with new name and stamp origin
    let atlas_path = dest.join("atlas.json");
    if let Ok(content) = std::fs::read_to_string(&atlas_path) {
        if let Ok(mut atlas) = serde_json::from_str::<Atlas>(&content) {
            atlas.name = new_name.to_string();
            if atlas.origin.is_none() {
                atlas.origin = Some(name.to_string());
            }
            if let Ok(updated) = serde_json::to_string_pretty(&atlas) {
                let _ = std::fs::write(&atlas_path, updated);
            }
        }
    }

    Ok(new_name.to_string())
}

fn copy_dir_recursive(src: &Path, dest: &Path) -> Result<(), String> {
    std::fs::create_dir_all(dest).map_err(|e| e.to_string())?;
    for entry in std::fs::read_dir(src).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let src_path = entry.path();
        let dest_path = dest.join(entry.file_name());
        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dest_path)?;
        } else {
            std::fs::copy(&src_path, &dest_path).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

// ── List / Load ──

pub fn list_community_atlases(data_dir: &Path) -> Result<Vec<String>, String> {
    let dir = community_dir(data_dir);
    if !dir.exists() {
        return Ok(vec![]);
    }
    let mut names = Vec::new();
    for entry in std::fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        if entry.path().is_dir() {
            if let Some(name) = entry.file_name().to_str() {
                names.push(name.to_string());
            }
        }
    }
    names.sort();
    Ok(names)
}

pub fn load_community_atlas(data_dir: &Path, name: &str) -> Result<Atlas, String> {
    let path = community_atlas_dir(data_dir, name).join("atlas.json");
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

// ── Util ──

fn chrono_now() -> String {
    // Simple ISO-8601 timestamp without pulling in chrono crate
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    // Format as ISO-8601 (approximate — good enough for a manifest)
    let secs_per_day = 86400u64;
    let days = now / secs_per_day;
    let time_secs = now % secs_per_day;
    let hours = time_secs / 3600;
    let minutes = (time_secs % 3600) / 60;
    let seconds = time_secs % 60;

    // Days since 1970-01-01
    let mut y = 1970i64;
    let mut remaining = days as i64;
    loop {
        let days_in_year = if is_leap(y) { 366 } else { 365 };
        if remaining < days_in_year {
            break;
        }
        remaining -= days_in_year;
        y += 1;
    }
    let months = [
        31,
        if is_leap(y) { 29 } else { 28 },
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
    ];
    let mut m = 1;
    for &d in &months {
        if remaining < d {
            break;
        }
        remaining -= d;
        m += 1;
    }
    let day = remaining + 1;
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        y, m, day, hours, minutes, seconds
    )
}

fn is_leap(y: i64) -> bool {
    y % 4 == 0 && (y % 100 != 0 || y % 400 == 0)
}
