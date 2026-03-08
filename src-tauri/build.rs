fn main() {
    tauri_build::build();

    // Pre-decode icon.png to raw RGBA so we don't need the `image` crate at runtime
    let icon_path = std::path::Path::new("icons/icon.png");
    let out_dir = std::env::var("OUT_DIR").unwrap();

    let file = std::fs::File::open(icon_path).expect("Failed to open icon.png");
    let decoder = png::Decoder::new(file);
    let mut reader = decoder.read_info().expect("Failed to read icon PNG header");
    let mut buf = vec![0u8; reader.output_buffer_size()];
    let info = reader.next_frame(&mut buf).expect("Failed to decode icon PNG");
    buf.truncate(info.buffer_size());

    // Ensure RGBA8
    assert_eq!(info.color_type, png::ColorType::Rgba, "icon.png must be RGBA");
    assert_eq!(info.bit_depth, png::BitDepth::Eight, "icon.png must be 8-bit");

    std::fs::write(format!("{out_dir}/icon_rgba.bin"), &buf).unwrap();
    // Write dimensions as u32 little-endian (8 bytes: width then height)
    let mut dims = Vec::new();
    dims.extend_from_slice(&info.width.to_le_bytes());
    dims.extend_from_slice(&info.height.to_le_bytes());
    std::fs::write(format!("{out_dir}/icon_dims.bin"), &dims).unwrap();

    println!("cargo:rerun-if-changed=icons/icon.png");
}
