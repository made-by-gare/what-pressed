use super::{save_atlas, Atlas, AtlasEntry};
use crate::input::types::InputId;
use ab_glyph::{Font, FontArc, PxScale, ScaleFont};
use image::{Rgba, RgbaImage};
use std::path::Path;

struct KeyDef {
    rdev_name: &'static str,
    label: &'static str,
    width: u32,
    height: u32,
}

const S: u32 = 64;

fn key(rdev_name: &'static str, label: &'static str, w: u32) -> KeyDef {
    KeyDef {
        rdev_name,
        label,
        width: w,
        height: S,
    }
}

fn all_keys() -> Vec<KeyDef> {
    vec![
        // Row 1: Escape + F-keys
        key("Escape", "ESC", 64),
        key("F1", "F1", 64),
        key("F2", "F2", 64),
        key("F3", "F3", 64),
        key("F4", "F4", 64),
        key("F5", "F5", 64),
        key("F6", "F6", 64),
        key("F7", "F7", 64),
        key("F8", "F8", 64),
        key("F9", "F9", 64),
        key("F10", "F10", 64),
        key("F11", "F11", 64),
        key("F12", "F12", 64),
        // Row 2: Number row
        key("BackQuote", "`", 64),
        key("Num1", "1", 64),
        key("Num2", "2", 64),
        key("Num3", "3", 64),
        key("Num4", "4", 64),
        key("Num5", "5", 64),
        key("Num6", "6", 64),
        key("Num7", "7", 64),
        key("Num8", "8", 64),
        key("Num9", "9", 64),
        key("Num0", "0", 64),
        key("Minus", "-", 64),
        key("Equal", "=", 64),
        key("Backspace", "BKSP", 128),
        // Row 3: QWERTY
        key("Tab", "TAB", 96),
        key("KeyQ", "Q", 64),
        key("KeyW", "W", 64),
        key("KeyE", "E", 64),
        key("KeyR", "R", 64),
        key("KeyT", "T", 64),
        key("KeyY", "Y", 64),
        key("KeyU", "U", 64),
        key("KeyI", "I", 64),
        key("KeyO", "O", 64),
        key("KeyP", "P", 64),
        key("LeftBracket", "[", 64),
        key("RightBracket", "]", 64),
        key("BackSlash", "\\", 64),
        // Row 4: Home row
        key("CapsLock", "CAPS", 112),
        key("KeyA", "A", 64),
        key("KeyS", "S", 64),
        key("KeyD", "D", 64),
        key("KeyF", "F", 64),
        key("KeyG", "G", 64),
        key("KeyH", "H", 64),
        key("KeyJ", "J", 64),
        key("KeyK", "K", 64),
        key("KeyL", "L", 64),
        key("SemiColon", ";", 64),
        key("Quote", "'", 64),
        key("Return", "ENTER", 128),
        // Row 5: Bottom row
        key("ShiftLeft", "SHIFT", 144),
        key("KeyZ", "Z", 64),
        key("KeyX", "X", 64),
        key("KeyC", "C", 64),
        key("KeyV", "V", 64),
        key("KeyB", "B", 64),
        key("KeyN", "N", 64),
        key("KeyM", "M", 64),
        key("Comma", ",", 64),
        key("Dot", ".", 64),
        key("Slash", "/", 64),
        key("ShiftRight", "SHIFT", 144),
        // Row 6: Bottom modifiers
        key("ControlLeft", "CTRL", 96),
        key("MetaLeft", "WIN", 64),
        key("Alt", "ALT", 64),
        key("Space", "SPACE", 320),
        key("AltGr", "ALTGR", 64),
        key("MetaRight", "WIN", 64),
        key("ControlRight", "CTRL", 96),
        // Navigation cluster
        key("PrintScreen", "PRTSC", 64),
        key("ScrollLock", "SCRLK", 64),
        key("Pause", "PAUSE", 64),
        key("Insert", "INS", 64),
        key("Home", "HOME", 64),
        key("PageUp", "PGUP", 64),
        key("Delete", "DEL", 64),
        key("End", "END", 64),
        key("PageDown", "PGDN", 64),
        // Arrow keys
        key("UpArrow", "UP", 64),
        key("DownArrow", "DOWN", 64),
        key("LeftArrow", "LEFT", 64),
        key("RightArrow", "RIGHT", 64),
        // Numpad
        key("NumLock", "NUMLK", 64),
        key("KpDivide", "N/", 64),
        key("KpMultiply", "N*", 64),
        key("KpMinus", "N-", 64),
        key("Kp7", "N7", 64),
        key("Kp8", "N8", 64),
        key("Kp9", "N9", 64),
        key("KpPlus", "N+", 64),
        key("Kp4", "N4", 64),
        key("Kp5", "N5", 64),
        key("Kp6", "N6", 64),
        key("Kp1", "N1", 64),
        key("Kp2", "N2", 64),
        key("Kp3", "N3", 64),
        key("KpReturn", "NENT", 64),
        key("Kp0", "N0", 128),
        key("KpDelete", "N.", 64),
    ]
}

fn load_font() -> Result<FontArc, String> {
    let paths = [
        "C:/Windows/Fonts/consola.ttf",
        "C:/Windows/Fonts/cour.ttf",
        "C:/Windows/Fonts/arial.ttf",
        "/System/Library/Fonts/Menlo.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
        "/usr/share/fonts/TTF/DejaVuSansMono.ttf",
    ];
    for path in &paths {
        if let Ok(data) = std::fs::read(path) {
            if let Ok(font) = FontArc::try_from_vec(data) {
                return Ok(font);
            }
        }
    }
    Err("No suitable system font found. Tried: consola.ttf, cour.ttf, arial.ttf".to_string())
}

// Check if a pixel is inside a rounded rectangle
fn in_rounded_rect(px: i32, py: i32, w: i32, h: i32, r: i32) -> bool {
    if px < 0 || px >= w || py < 0 || py >= h {
        return false;
    }
    // Corner checks using circle distance
    let check_corner = |cx: i32, cy: i32| -> bool {
        let dx = px - cx;
        let dy = py - cy;
        dx * dx + dy * dy <= r * r
    };
    if px < r && py < r {
        return check_corner(r, r);
    }
    if px >= w - r && py < r {
        return check_corner(w - r - 1, r);
    }
    if px < r && py >= h - r {
        return check_corner(r, h - r - 1);
    }
    if px >= w - r && py >= h - r {
        return check_corner(w - r - 1, h - r - 1);
    }
    true
}

fn fill_rounded_rect(
    img: &mut RgbaImage,
    ox: u32,
    oy: u32,
    w: u32,
    h: u32,
    color: Rgba<u8>,
    r: u32,
) {
    for dy in 0..h {
        for dx in 0..w {
            if in_rounded_rect(dx as i32, dy as i32, w as i32, h as i32, r as i32) {
                img.put_pixel(ox + dx, oy + dy, color);
            }
        }
    }
}

fn stroke_rounded_rect(
    img: &mut RgbaImage,
    ox: u32,
    oy: u32,
    w: u32,
    h: u32,
    color: Rgba<u8>,
    r: u32,
    t: u32,
) {
    for dy in 0..h {
        for dx in 0..w {
            let in_outer = in_rounded_rect(dx as i32, dy as i32, w as i32, h as i32, r as i32);
            let in_inner = dx >= t
                && dx < w - t
                && dy >= t
                && dy < h - t
                && in_rounded_rect(
                    (dx - t) as i32,
                    (dy - t) as i32,
                    (w - 2 * t) as i32,
                    (h - 2 * t) as i32,
                    r.saturating_sub(t) as i32,
                );
            if in_outer && !in_inner {
                img.put_pixel(ox + dx, oy + dy, color);
            }
        }
    }
}

fn text_width(font: &FontArc, text: &str, scale: PxScale) -> f32 {
    let scaled = font.as_scaled(scale);
    text.chars()
        .map(|c| scaled.h_advance(scaled.glyph_id(c)))
        .sum()
}

fn compute_scale(font: &FontArc, label: &str, w: u32, h: u32) -> PxScale {
    let max_h = h as f32 * 0.50;
    let max_w = w as f32 * 0.75;

    let scale = PxScale::from(max_h);
    let tw = text_width(font, label, scale);
    if tw > max_w {
        PxScale::from(max_h * max_w / tw)
    } else {
        scale
    }
}

/// Renders text glyphs and returns per-pixel coverage [0.0, 1.0]
fn render_text_mask(font: &FontArc, label: &str, scale: PxScale, w: u32, h: u32) -> Vec<Vec<f32>> {
    let scaled = font.as_scaled(scale);
    let tw = text_width(font, label, scale);
    let ascent = scaled.ascent();
    let descent = scaled.descent();
    let th = ascent - descent;

    let x_off = (w as f32 - tw) / 2.0;
    let y_off = (h as f32 - th) / 2.0 + ascent;

    let mut mask = vec![vec![0.0f32; w as usize]; h as usize];

    let mut cursor = x_off;
    for ch in label.chars() {
        let glyph_id = scaled.glyph_id(ch);
        let glyph = glyph_id.with_scale_and_position(scale, ab_glyph::point(cursor, y_off));

        if let Some(outlined) = font.outline_glyph(glyph) {
            let bounds = outlined.px_bounds();
            outlined.draw(|x, y, cov| {
                let px = x as i32 + bounds.min.x as i32;
                let py = y as i32 + bounds.min.y as i32;
                if px >= 0 && px < w as i32 && py >= 0 && py < h as i32 {
                    let v = &mut mask[py as usize][px as usize];
                    *v = (*v + cov).min(1.0);
                }
            });
        }

        cursor += scaled.h_advance(glyph_id);
    }

    mask
}

fn render_unpressed(font: &FontArc, label: &str, w: u32, h: u32) -> RgbaImage {
    let mut img = RgbaImage::new(w, h);
    let white = Rgba([255u8, 255, 255, 255]);
    let margin = 2u32;
    let r = 6u32;
    let thickness = 3u32;

    stroke_rounded_rect(
        &mut img,
        margin,
        margin,
        w - 2 * margin,
        h - 2 * margin,
        white,
        r,
        thickness,
    );

    let scale = compute_scale(font, label, w, h);
    let mask = render_text_mask(font, label, scale, w, h);
    for y in 0..h as usize {
        for x in 0..w as usize {
            let cov = mask[y][x];
            if cov > 0.0 {
                let alpha = (cov * 255.0).min(255.0) as u8;
                let existing = img.get_pixel(x as u32, y as u32);
                let new_alpha = alpha.max(existing[3]);
                img.put_pixel(x as u32, y as u32, Rgba([255, 255, 255, new_alpha]));
            }
        }
    }

    img
}

fn render_pressed(font: &FontArc, label: &str, w: u32, h: u32) -> RgbaImage {
    let mut img = RgbaImage::new(w, h);
    let white = Rgba([255u8, 255, 255, 255]);
    let margin = 2u32;
    let r = 6u32;

    fill_rounded_rect(
        &mut img,
        margin,
        margin,
        w - 2 * margin,
        h - 2 * margin,
        white,
        r,
    );

    // Knock out text (set alpha to 0 where text is)
    let scale = compute_scale(font, label, w, h);
    let mask = render_text_mask(font, label, scale, w, h);
    for y in 0..h as usize {
        for x in 0..w as usize {
            let cov = mask[y][x];
            if cov > 0.0 {
                let existing = img.get_pixel(x as u32, y as u32);
                let new_alpha = ((1.0 - cov) * existing[3] as f32).max(0.0) as u8;
                img.put_pixel(
                    x as u32,
                    y as u32,
                    Rgba([existing[0], existing[1], existing[2], new_alpha]),
                );
            }
        }
    }

    img
}

pub fn create_default_atlas(data_dir: &Path) -> Result<(), String> {
    let font = load_font()?;
    let keys = all_keys();

    let images_dir = super::atlas_dir(data_dir, "default").join("images");
    std::fs::create_dir_all(&images_dir).map_err(|e| e.to_string())?;

    let mut entries = Vec::new();

    for kd in &keys {
        let up_img = render_unpressed(&font, kd.label, kd.width, kd.height);
        let dn_img = render_pressed(&font, kd.label, kd.width, kd.height);

        let up_file = format!("{}_up.png", kd.rdev_name);
        let dn_file = format!("{}_dn.png", kd.rdev_name);

        up_img
            .save(images_dir.join(&up_file))
            .map_err(|e| format!("Failed to save {}: {}", up_file, e))?;
        dn_img
            .save(images_dir.join(&dn_file))
            .map_err(|e| format!("Failed to save {}: {}", dn_file, e))?;

        entries.push(AtlasEntry {
            id: uuid::Uuid::new_v4().to_string(),
            input_id: InputId::Key(kd.rdev_name.to_string()),
            label: kd.label.to_string(),
            pressed_image: dn_file,
            unpressed_image: up_file,
            width: kd.width,
            height: kd.height,
        });
    }

    let atlas = Atlas {
        name: "default".to_string(),
        version: 1,
        entries,
        source_images: vec![],
        semver: None,
        description: None,
        author: None,
        origin: None,
    };

    save_atlas(data_dir, &atlas)?;
    Ok(())
}
