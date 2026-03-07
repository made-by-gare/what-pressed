use serde::{Deserialize, Serialize};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayoutEntry {
    pub id: String,
    pub atlas_entry_id: String,
    pub x: f64,
    pub y: f64,
    pub scale: f64,
    pub rotation: f64,
    pub z_index: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Layout {
    pub name: String,
    pub version: u32,
    pub atlas_name: String,
    pub canvas_width: u32,
    pub canvas_height: u32,
    pub entries: Vec<LayoutEntry>,
}

fn layouts_dir(data_dir: &Path) -> PathBuf {
    data_dir.join("layouts")
}

fn layout_dir(data_dir: &Path, name: &str) -> PathBuf {
    layouts_dir(data_dir).join(name)
}

pub fn list_layouts(data_dir: &Path) -> Result<Vec<String>, String> {
    let dir = layouts_dir(data_dir);
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

pub fn load_layout(data_dir: &Path, name: &str) -> Result<Layout, String> {
    let path = layout_dir(data_dir, name).join("layout.json");
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

pub fn save_layout(data_dir: &Path, layout: &Layout) -> Result<(), String> {
    let dir = layout_dir(data_dir, &layout.name);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join("layout.json");
    let content = serde_json::to_string_pretty(layout).map_err(|e| e.to_string())?;
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

pub fn delete_layout(data_dir: &Path, name: &str) -> Result<(), String> {
    let dir = layout_dir(data_dir, name);
    if dir.exists() {
        std::fs::remove_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn export_layout_zip(data_dir: &Path, name: &str, dest_path: &str) -> Result<(), String> {
    let layout = load_layout(data_dir, name)?;
    let file = std::fs::File::create(dest_path).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    // Add layout.json
    let layout_json = serde_json::to_string_pretty(&layout).map_err(|e| e.to_string())?;
    zip.start_file("layout.json", options)
        .map_err(|e| e.to_string())?;
    zip.write_all(layout_json.as_bytes())
        .map_err(|e| e.to_string())?;

    // Bundle the referenced atlas
    let atlas_dir = data_dir.join("atlases").join(&layout.atlas_name);
    if atlas_dir.exists() {
        // Add atlas.json
        let atlas_json_path = atlas_dir.join("atlas.json");
        if atlas_json_path.exists() {
            let data = std::fs::read(&atlas_json_path).map_err(|e| e.to_string())?;
            zip.start_file(format!("atlas/{}/atlas.json", layout.atlas_name), options)
                .map_err(|e| e.to_string())?;
            zip.write_all(&data).map_err(|e| e.to_string())?;
        }

        // Add atlas images
        let images_dir = atlas_dir.join("images");
        if images_dir.exists() {
            for entry in std::fs::read_dir(&images_dir).map_err(|e| e.to_string())? {
                let entry = entry.map_err(|e| e.to_string())?;
                if entry.path().is_file() {
                    let fname = entry.file_name();
                    let fname_str = fname.to_str().ok_or("Invalid filename")?;
                    let data = std::fs::read(entry.path()).map_err(|e| e.to_string())?;
                    zip.start_file(
                        format!("atlas/{}/images/{}", layout.atlas_name, fname_str),
                        options,
                    )
                    .map_err(|e| e.to_string())?;
                    zip.write_all(&data).map_err(|e| e.to_string())?;
                }
            }
        }
    }

    zip.finish().map_err(|e| e.to_string())?;
    Ok(())
}

pub fn import_layout_zip(data_dir: &Path, zip_path: &str) -> Result<String, String> {
    let file = std::fs::File::open(zip_path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;

    // Read layout.json first
    let layout: Layout = {
        let mut layout_file = archive.by_name("layout.json").map_err(|e| e.to_string())?;
        let mut content = String::new();
        layout_file
            .read_to_string(&mut content)
            .map_err(|e| e.to_string())?;
        serde_json::from_str(&content).map_err(|e| e.to_string())?
    };

    let layout_dest = layout_dir(data_dir, &layout.name);
    std::fs::create_dir_all(&layout_dest).map_err(|e| e.to_string())?;

    // Extract all files
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let name = file.name().to_string();
        if name.ends_with('/') {
            continue;
        }

        let dest = if name.starts_with("atlas/") {
            // Atlas files go to the atlases directory
            let rel = name.strip_prefix("atlas/").unwrap();
            data_dir.join("atlases").join(rel)
        } else {
            layout_dest.join(&name)
        };

        if let Some(parent) = dest.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let mut data = Vec::new();
        file.read_to_end(&mut data).map_err(|e| e.to_string())?;
        std::fs::write(&dest, &data).map_err(|e| e.to_string())?;
    }

    Ok(layout.name)
}
