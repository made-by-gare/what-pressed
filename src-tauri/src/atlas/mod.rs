pub mod default;

use crate::input::types::InputId;
use serde::{Deserialize, Serialize};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AtlasEntry {
    pub id: String,
    pub input_id: InputId,
    pub label: String,
    pub pressed_image: String,
    pub unpressed_image: String,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Atlas {
    pub name: String,
    pub version: u32,
    pub entries: Vec<AtlasEntry>,
    #[serde(default)]
    pub source_images: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub semver: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub author: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub origin: Option<String>,
}

fn atlases_dir(data_dir: &Path) -> PathBuf {
    data_dir.join("atlases")
}

fn atlas_dir(data_dir: &Path, name: &str) -> PathBuf {
    atlases_dir(data_dir).join(name)
}

pub fn list_atlases(data_dir: &Path) -> Result<Vec<String>, String> {
    let dir = atlases_dir(data_dir);
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

pub fn load_atlas(data_dir: &Path, name: &str) -> Result<Atlas, String> {
    let path = atlas_dir(data_dir, name).join("atlas.json");
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

pub fn save_atlas(data_dir: &Path, atlas: &Atlas) -> Result<(), String> {
    let dir = atlas_dir(data_dir, &atlas.name);
    std::fs::create_dir_all(dir.join("images")).map_err(|e| e.to_string())?;
    let path = dir.join("atlas.json");
    let content = serde_json::to_string_pretty(atlas).map_err(|e| e.to_string())?;
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

pub fn delete_atlas(data_dir: &Path, name: &str) -> Result<(), String> {
    let dir = atlas_dir(data_dir, name);
    if dir.exists() {
        std::fs::remove_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn import_atlas_image(
    data_dir: &Path,
    atlas_name: &str,
    source_path: &str,
) -> Result<String, String> {
    let images_dir = atlas_dir(data_dir, atlas_name).join("images");
    std::fs::create_dir_all(&images_dir).map_err(|e| e.to_string())?;

    let source = Path::new(source_path);
    let filename = source
        .file_name()
        .ok_or("Invalid filename")?
        .to_str()
        .ok_or("Invalid filename encoding")?;

    // Generate unique filename to avoid collisions
    let ext = source.extension().and_then(|e| e.to_str()).unwrap_or("png");
    let unique_name = format!(
        "{}_{}.{}",
        filename.trim_end_matches(&format!(".{}", ext)),
        uuid::Uuid::new_v4(),
        ext
    );

    let dest = images_dir.join(&unique_name);
    std::fs::copy(source, &dest).map_err(|e| e.to_string())?;

    Ok(unique_name)
}

pub fn export_atlas_zip(data_dir: &Path, name: &str, dest_path: &str) -> Result<(), String> {
    let dir = atlas_dir(data_dir, name);
    let file = std::fs::File::create(dest_path).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    // Add atlas.json
    let atlas_json = std::fs::read(dir.join("atlas.json")).map_err(|e| e.to_string())?;
    zip.start_file("atlas.json", options)
        .map_err(|e| e.to_string())?;
    zip.write_all(&atlas_json).map_err(|e| e.to_string())?;

    // Add images
    let images_dir = dir.join("images");
    if images_dir.exists() {
        for entry in std::fs::read_dir(&images_dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            if path.is_file() {
                let filename = entry.file_name();
                let name_str = filename.to_str().ok_or("Invalid filename")?;
                let data = std::fs::read(&path).map_err(|e| e.to_string())?;
                zip.start_file(format!("images/{}", name_str), options)
                    .map_err(|e| e.to_string())?;
                zip.write_all(&data).map_err(|e| e.to_string())?;
            }
        }
    }

    zip.finish().map_err(|e| e.to_string())?;
    Ok(())
}

pub fn import_atlas_zip(data_dir: &Path, zip_path: &str) -> Result<String, String> {
    let file = std::fs::File::open(zip_path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;

    // Read atlas.json first to get the name
    let atlas: Atlas = {
        let mut atlas_file = archive.by_name("atlas.json").map_err(|e| e.to_string())?;
        let mut content = String::new();
        atlas_file
            .read_to_string(&mut content)
            .map_err(|e| e.to_string())?;
        serde_json::from_str(&content).map_err(|e| e.to_string())?
    };

    let dir = atlas_dir(data_dir, &atlas.name);
    std::fs::create_dir_all(dir.join("images")).map_err(|e| e.to_string())?;

    // Extract all files
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let name = file.name().to_string();
        if name.ends_with('/') {
            continue;
        }
        let dest = dir.join(&name);
        if let Some(parent) = dest.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let mut data = Vec::new();
        file.read_to_end(&mut data).map_err(|e| e.to_string())?;
        std::fs::write(&dest, &data).map_err(|e| e.to_string())?;
    }

    Ok(atlas.name)
}

pub fn crop_atlas_image(
    data_dir: &Path,
    atlas_name: &str,
    source_image: &str,
    x: u32,
    y: u32,
    w: u32,
    h: u32,
) -> Result<String, String> {
    let images_dir = atlas_dir(data_dir, atlas_name).join("images");
    let source_path = images_dir.join(source_image);

    let img = image::open(&source_path).map_err(|e| format!("Failed to open image: {}", e))?;
    let cropped = img.crop_imm(x, y, w, h);

    let filename = format!("crop_{}.png", uuid::Uuid::new_v4());
    let dest = images_dir.join(&filename);
    cropped
        .save(&dest)
        .map_err(|e| format!("Failed to save cropped image: {}", e))?;

    Ok(filename)
}
