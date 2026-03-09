use crate::atlas;
use crate::input::types::InputId;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

/// Records the original atlas source when an entry is flattened during export.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntryOrigin {
    pub atlas_name: String,
    pub entry_id: String,
    /// "local" or "community"
    pub atlas_source: String,
}

/// How a layout entry gets its display configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum EntrySource {
    /// References an atlas entry (read-only display config).
    #[serde(rename = "atlas")]
    Atlas {
        atlas_name: String,
        entry_id: String,
    },
    /// Inline entry owned by this layout (editable).
    #[serde(rename = "inline")]
    Inline {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        input_id: Option<InputId>,
        label: String,
        #[serde(default)]
        pressed_image: atlas::ImageRef,
        #[serde(default)]
        unpressed_image: atlas::ImageRef,
        width: u32,
        height: u32,
        /// Breadcrumb recording which atlas this was flattened from (if any).
        #[serde(default, skip_serializing_if = "Option::is_none")]
        origin: Option<EntryOrigin>,
    },
    /// A simple shape (no images needed).
    #[serde(rename = "shape")]
    Shape {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        input_id: Option<InputId>,
        label: String,
        shape: ShapeType,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        shape_style_id: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        pressed_shape_style_id: Option<String>,
        color: String,
        #[serde(default = "default_true", skip_serializing_if = "is_true")]
        fill: bool,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        stroke_color: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        stroke_width: Option<f64>,
        pressed_color: String,
        #[serde(default = "default_true", skip_serializing_if = "is_true")]
        pressed_fill: bool,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        pressed_stroke_color: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        pressed_stroke_width: Option<f64>,
        width: u32,
        height: u32,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ShapeType {
    Rect,
    Circle,
}

/// Text label overlay configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LabelConfig {
    pub text: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text_style_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pressed_text_style_id: Option<String>,
    #[serde(default = "default_font_family", skip_serializing_if = "is_default_font")]
    pub font_family: String,
    #[serde(default = "default_font_size", skip_serializing_if = "is_default_font_size")]
    pub font_size: f64,
    pub color: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pressed_color: Option<String>,
    #[serde(default = "default_align", skip_serializing_if = "is_default_align")]
    pub align: String,
    #[serde(default = "default_valign", skip_serializing_if = "is_default_valign")]
    pub vertical_align: String,
    #[serde(default, skip_serializing_if = "is_false")]
    pub bold: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pressed_bold: Option<bool>,
    #[serde(default, skip_serializing_if = "is_false")]
    pub italic: bool,
    #[serde(default = "default_text_direction", skip_serializing_if = "is_default_text_direction")]
    pub text_direction: String,
}

fn default_text_direction() -> String { "horizontal".into() }
fn is_default_text_direction(s: &String) -> bool { s == "horizontal" }
fn default_font_family() -> String { "sans-serif".into() }
fn default_font_size() -> f64 { 14.0 }
fn default_align() -> String { "center".into() }
fn default_valign() -> String { "center".into() }
fn is_default_font(s: &String) -> bool { s == "sans-serif" }
fn is_default_font_size(v: &f64) -> bool { *v == 14.0 }
fn is_default_align(s: &String) -> bool { s == "center" }
fn is_default_valign(s: &String) -> bool { s == "center" }
fn is_false(b: &bool) -> bool { !b }
fn default_true() -> bool { true }
fn is_true(b: &bool) -> bool { *b }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayoutEntry {
    pub id: String,
    pub x: f64,
    pub y: f64,
    pub scale: f64,
    pub rotation: f64,
    pub z_index: i32,
    pub source: EntrySource,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<LabelConfig>,
}

/// Reusable shape visual style (single state - use one for unpressed, one for pressed).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShapeStyle {
    pub id: String,
    pub name: String,
    pub color: String,
    #[serde(default = "default_true", skip_serializing_if = "is_true")]
    pub fill: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stroke_color: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stroke_width: Option<f64>,
}

/// Reusable text visual style (single state - use one for unpressed, one for pressed).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextStyle {
    pub id: String,
    pub name: String,
    pub color: String,
    #[serde(default, skip_serializing_if = "is_false")]
    pub bold: bool,
    #[serde(default, skip_serializing_if = "is_false")]
    pub italic: bool,
    #[serde(default = "default_font_family", skip_serializing_if = "is_default_font")]
    pub font_family: String,
    #[serde(default = "default_font_size", skip_serializing_if = "is_default_font_size")]
    pub font_size: f64,
}

fn default_grid_size() -> u32 { 20 }
fn is_default_grid_size(v: &u32) -> bool { *v == 20 }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Layout {
    pub name: String,
    pub version: u32,
    pub canvas_width: u32,
    pub canvas_height: u32,
    #[serde(default = "default_grid_size", skip_serializing_if = "is_default_grid_size")]
    pub grid_size: u32,
    pub entries: Vec<LayoutEntry>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub shape_styles: Vec<ShapeStyle>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub text_styles: Vec<TextStyle>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub source_images: Vec<atlas::SourceImage>,
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
    std::fs::create_dir_all(dir.join("images")).map_err(|e| e.to_string())?;
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

pub fn rename_layout(data_dir: &Path, old_name: &str, new_name: &str) -> Result<(), String> {
    let old_dir = layout_dir(data_dir, old_name);
    let new_dir = layout_dir(data_dir, new_name);
    if !old_dir.exists() {
        return Err(format!("Layout '{}' not found", old_name));
    }
    if new_name.is_empty() {
        return Err("Name cannot be empty".into());
    }
    if new_dir.exists() {
        return Err(format!("Layout '{}' already exists", new_name));
    }
    // Rename the directory
    std::fs::rename(&old_dir, &new_dir).map_err(|e| e.to_string())?;
    // Update the name inside layout.json
    let mut layout = load_layout(data_dir, new_name)?;
    layout.name = new_name.to_string();
    save_layout(data_dir, &layout)?;
    Ok(())
}

pub fn import_layout_image(
    data_dir: &Path,
    layout_name: &str,
    source_path: &str,
) -> Result<String, String> {
    let images_dir = layout_dir(data_dir, layout_name).join("images");
    std::fs::create_dir_all(&images_dir).map_err(|e| e.to_string())?;

    let source = Path::new(source_path);
    let filename = source
        .file_name()
        .ok_or("Invalid filename")?
        .to_str()
        .ok_or("Invalid filename encoding")?;

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

/// Flatten atlas references into inline entries for export.
/// Copies referenced atlas images into the layout's images/ dir within the zip.
fn flatten_for_export(
    data_dir: &Path,
    layout: &Layout,
) -> Result<(Layout, Vec<(String, Vec<u8>)>), String> {
    let mut flat = layout.clone();
    let mut images_to_bundle: Vec<(String, Vec<u8>)> = Vec::new();
    let mut seen_files: HashSet<String> = HashSet::new();

    // Collect layout's own images
    let layout_images_dir = layout_dir(data_dir, &layout.name).join("images");
    if layout_images_dir.exists() {
        for entry in std::fs::read_dir(&layout_images_dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            if entry.path().is_file() {
                let fname = entry.file_name().to_str().unwrap_or("").to_string();
                if !fname.is_empty() && !seen_files.contains(&fname) {
                    let data = std::fs::read(entry.path()).map_err(|e| e.to_string())?;
                    images_to_bundle.push((fname.clone(), data));
                    seen_files.insert(fname);
                }
            }
        }
    }

    for entry in &mut flat.entries {
        if let EntrySource::Atlas { atlas_name, entry_id } = &entry.source {
            // Load the atlas to get the entry config, tracking which source it came from
            let (atlas, atlas_source) = match atlas::load_atlas(data_dir, atlas_name) {
                Ok(a) => (a, "local"),
                Err(_) => {
                    let community_path = data_dir.join("community-atlases");
                    let atlas_path = community_path.join(atlas_name).join("atlas.json");
                    let content = std::fs::read_to_string(&atlas_path).map_err(|e| e.to_string())?;
                    let a = serde_json::from_str(&content).map_err(|e| e.to_string())?;
                    (a, "community")
                }
            };

            let atlas_entry = atlas.entries.iter()
                .find(|e| e.id == *entry_id)
                .ok_or_else(|| format!("Atlas entry '{}' not found in '{}'", entry_id, atlas_name))?;

            // Copy referenced image files
            let mut copy_image = |img_ref: &atlas::ImageRef| -> Result<atlas::ImageRef, String> {
                let filename = img_ref.filename();
                if filename.is_empty() {
                    return Ok(img_ref.clone());
                }
                if !seen_files.contains(filename) {
                    // Try to find the image file
                    let local_path = data_dir.join("atlases").join(atlas_name).join("images").join(filename);
                    let community_path = data_dir.join("community-atlases").join(atlas_name).join("images").join(filename);
                    let path = if local_path.exists() { local_path } else { community_path };
                    if path.exists() {
                        let data = std::fs::read(&path).map_err(|e| e.to_string())?;
                        images_to_bundle.push((filename.to_string(), data));
                        seen_files.insert(filename.to_string());
                    }
                }
                Ok(img_ref.clone())
            };

            let pressed = copy_image(&atlas_entry.pressed_image)?;
            let unpressed = copy_image(&atlas_entry.unpressed_image)?;

            entry.source = EntrySource::Inline {
                input_id: Some(atlas_entry.input_id.clone()),
                label: atlas_entry.label.clone(),
                pressed_image: pressed,
                unpressed_image: unpressed,
                width: atlas_entry.width,
                height: atlas_entry.height,
                origin: Some(EntryOrigin {
                    atlas_name: atlas_name.clone(),
                    entry_id: entry_id.clone(),
                    atlas_source: atlas_source.to_string(),
                }),
            };
        }
    }

    Ok((flat, images_to_bundle))
}

pub fn export_layout_zip(data_dir: &Path, name: &str, dest_path: &str) -> Result<(), String> {
    let layout = load_layout(data_dir, name)?;
    let (flat_layout, images) = flatten_for_export(data_dir, &layout)?;

    let file = std::fs::File::create(dest_path).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    // Add layout.json (flattened)
    let layout_json = serde_json::to_string_pretty(&flat_layout).map_err(|e| e.to_string())?;
    zip.start_file("layout.json", options)
        .map_err(|e| e.to_string())?;
    zip.write_all(layout_json.as_bytes())
        .map_err(|e| e.to_string())?;

    // Add images
    for (filename, data) in &images {
        zip.start_file(format!("images/{}", filename), options)
            .map_err(|e| e.to_string())?;
        zip.write_all(data).map_err(|e| e.to_string())?;
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

    let dir = layout_dir(data_dir, &layout.name);
    std::fs::create_dir_all(dir.join("images")).map_err(|e| e.to_string())?;

    // Extract all files into the layout directory
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

    Ok(layout.name)
}
