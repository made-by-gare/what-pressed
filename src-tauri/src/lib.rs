mod atlas;
mod community;
mod input;
mod layout;
mod server;
mod state;

use state::{AppState, ServerHandle};
use std::sync::{Arc, Mutex};
use tauri::ipc::Channel;
use tauri::{Emitter, Manager};

#[derive(serde::Serialize)]
struct AtlasInfo {
    name: String,
    source: String,
}

// ── Input ──

#[tauri::command]
fn subscribe_input(state: tauri::State<'_, AppState>, channel: Channel<input::types::InputState>) {
    let mut rx = state.input_rx.clone();
    tauri::async_runtime::spawn(async move {
        // Send current state immediately so the UI doesn't start empty
        {
            let current = rx.borrow_and_update().clone();
            if channel.send(current).is_err() {
                return;
            }
        }
        // Then stream updates as they arrive
        loop {
            if rx.changed().await.is_err() {
                break;
            }
            let current = rx.borrow_and_update().clone();
            if channel.send(current).is_err() {
                break;
            }
        }
    });
}

#[tauri::command]
fn get_input_state(state: tauri::State<'_, AppState>) -> input::types::InputState {
    state.input_rx.borrow().clone()
}

/// Inject a keyboard event from the webview.
/// On Windows, rdev can't see keyboard events when the Tauri window has focus,
/// so the frontend captures them via JS keydown/keyup and sends them here.
#[tauri::command]
fn inject_key_event(state: tauri::State<'_, AppState>, key: String, pressed: bool) {
    let event = if pressed {
        input::types::RawInputEvent::KeyPress(key)
    } else {
        input::types::RawInputEvent::KeyRelease(key)
    };
    let _ = state.input_tx.send(event);
}

// ── Atlas ──

#[tauri::command]
fn list_atlases(state: tauri::State<'_, AppState>) -> Result<Vec<AtlasInfo>, String> {
    let local = atlas::list_atlases(&state.data_dir)?;
    let community_names = community::list_community_atlases(&state.data_dir).unwrap_or_default();
    let local_set: std::collections::HashSet<String> = local.iter().cloned().collect();

    let mut result: Vec<AtlasInfo> = local
        .into_iter()
        .map(|name| AtlasInfo {
            name,
            source: "local".into(),
        })
        .collect();

    for cn in community_names {
        if !local_set.contains(&cn) {
            result.push(AtlasInfo {
                name: cn,
                source: "community".into(),
            });
        }
    }

    result.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(result)
}

#[tauri::command]
fn load_atlas(state: tauri::State<'_, AppState>, name: String) -> Result<atlas::Atlas, String> {
    // Try local first, fall back to community
    match atlas::load_atlas(&state.data_dir, &name) {
        Ok(a) => Ok(a),
        Err(_) => community::load_community_atlas(&state.data_dir, &name),
    }
}

#[tauri::command]
fn save_atlas(state: tauri::State<'_, AppState>, atlas: atlas::Atlas) -> Result<(), String> {
    atlas::save_atlas(&state.data_dir, &atlas)?;
    bump_layout_version(&state);
    Ok(())
}

#[tauri::command]
fn delete_atlas(state: tauri::State<'_, AppState>, name: String) -> Result<(), String> {
    atlas::delete_atlas(&state.data_dir, &name)
}

#[tauri::command]
fn import_atlas_image(
    state: tauri::State<'_, AppState>,
    atlas_name: String,
    source_path: String,
) -> Result<String, String> {
    atlas::import_atlas_image(&state.data_dir, &atlas_name, &source_path)
}

#[tauri::command]
fn export_atlas_zip(
    state: tauri::State<'_, AppState>,
    name: String,
    dest_path: String,
) -> Result<(), String> {
    atlas::export_atlas_zip(&state.data_dir, &name, &dest_path)
}

#[tauri::command]
fn import_atlas_zip(
    state: tauri::State<'_, AppState>,
    zip_path: String,
) -> Result<String, String> {
    atlas::import_atlas_zip(&state.data_dir, &zip_path)
}


// ── Layout ──

#[tauri::command]
fn list_layouts(state: tauri::State<'_, AppState>) -> Result<Vec<String>, String> {
    layout::list_layouts(&state.data_dir)
}

#[tauri::command]
fn load_layout(
    state: tauri::State<'_, AppState>,
    name: String,
) -> Result<layout::Layout, String> {
    layout::load_layout(&state.data_dir, &name)
}

#[tauri::command]
fn save_layout(state: tauri::State<'_, AppState>, layout: layout::Layout) -> Result<(), String> {
    layout::save_layout(&state.data_dir, &layout)?;
    bump_layout_version(&state);
    Ok(())
}

#[tauri::command]
fn delete_layout(state: tauri::State<'_, AppState>, name: String) -> Result<(), String> {
    layout::delete_layout(&state.data_dir, &name)?;
    bump_layout_version(&state);
    Ok(())
}

#[tauri::command]
fn export_layout_zip(
    state: tauri::State<'_, AppState>,
    name: String,
    dest_path: String,
) -> Result<(), String> {
    layout::export_layout_zip(&state.data_dir, &name, &dest_path)
}

#[tauri::command]
fn import_layout_zip(
    state: tauri::State<'_, AppState>,
    zip_path: String,
) -> Result<String, String> {
    layout::import_layout_zip(&state.data_dir, &zip_path)
}

// ── Server ──

#[tauri::command]
async fn start_server(state: tauri::State<'_, AppState>, port: u16) -> Result<(), String> {
    // Check if already running without holding lock across await
    {
        let handle = state.server_handle.lock().unwrap();
        if handle.is_some() {
            return Err("Server already running".into());
        }
    }

    let input_rx = state.input_rx.clone();
    let data_dir = state.data_dir.clone();
    let active_layout = state.active_layout.clone();
    let layout_version_rx = state.layout_version_rx.clone();

    let shutdown_tx = server::start_server(port, input_rx, data_dir, active_layout, layout_version_rx).await?;

    let mut handle = state.server_handle.lock().unwrap();
    *handle = Some(ServerHandle { port, shutdown_tx });
    Ok(())
}

#[tauri::command]
fn stop_server(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let mut handle = state.server_handle.lock().unwrap();
    if let Some(h) = handle.take() {
        let _ = h.shutdown_tx.send(());
    }
    Ok(())
}

#[tauri::command]
fn get_server_port(state: tauri::State<'_, AppState>) -> Result<Option<u16>, String> {
    let handle = state.server_handle.lock().unwrap();
    Ok(handle.as_ref().map(|h| h.port))
}

fn bump_layout_version(state: &AppState) {
    state.layout_version_tx.send_modify(|v| *v += 1);
}

#[tauri::command]
fn set_active_layout(state: tauri::State<'_, AppState>, name: String) -> Result<(), String> {
    *state.active_layout.lock().unwrap() = Some(name);
    bump_layout_version(&state);
    Ok(())
}

#[tauri::command]
fn get_active_layout(state: tauri::State<'_, AppState>) -> Result<Option<String>, String> {
    Ok(state.active_layout.lock().unwrap().clone())
}

// ── Community ──

#[tauri::command]
async fn fetch_community_index() -> Result<community::CommunityIndex, String> {
    community::fetch_index().await
}

#[tauri::command]
async fn install_community_atlas(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    name: String,
    on_progress: tauri::ipc::Channel<community::InstallProgress>,
) -> Result<(), String> {
    community::install_atlas(&state.data_dir, &name, &on_progress).await?;
    let _ = app.emit("atlases-changed", ());
    Ok(())
}

#[tauri::command]
fn uninstall_community_atlas(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    name: String,
) -> Result<(), String> {
    community::uninstall_atlas(&state.data_dir, &name)?;
    let _ = app.emit("atlases-changed", ());
    Ok(())
}

#[tauri::command]
fn get_community_manifest(
    state: tauri::State<'_, AppState>,
) -> Result<community::CommunityManifest, String> {
    Ok(community::load_manifest(&state.data_dir))
}

#[tauri::command]
fn fork_community_atlas(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    name: String,
    new_name: String,
) -> Result<String, String> {
    let result = community::fork_atlas(&state.data_dir, &name, &new_name)?;
    let _ = app.emit("atlases-changed", ());
    Ok(result)
}

#[tauri::command]
async fn open_community_browser(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::WebviewWindowBuilder;
    if let Some(window) = app.get_webview_window("community") {
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }
    WebviewWindowBuilder::new(
        &app,
        "community",
        tauri::WebviewUrl::App("index.html#/community".into()),
    )
    .title("Community Atlases")
    .inner_size(900.0, 650.0)
    .build()
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn list_community_atlases(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<String>, String> {
    community::list_community_atlases(&state.data_dir)
}

#[tauri::command]
fn load_community_atlas(
    state: tauri::State<'_, AppState>,
    name: String,
) -> Result<atlas::Atlas, String> {
    community::load_community_atlas(&state.data_dir, &name)
}

// ── App ──

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Start the input capture system
    let (input_rx, input_tx) = input::start_input_system();

    tauri::Builder::default()
        .device_event_filter(tauri::DeviceEventFilter::Never)
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir");
            std::fs::create_dir_all(&data_dir).ok();

            let (layout_version_tx, layout_version_rx) = tokio::sync::watch::channel(0u64);

            app.manage(AppState {
                input_rx,
                input_tx,
                data_dir,
                server_handle: Mutex::new(None),
                active_layout: Arc::new(Mutex::new(None)),
                layout_version_tx,
                layout_version_rx,
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            subscribe_input,
            get_input_state,
            inject_key_event,
            list_atlases,
            load_atlas,
            save_atlas,
            delete_atlas,
            import_atlas_image,
            export_atlas_zip,
            import_atlas_zip,
            list_layouts,
            load_layout,
            save_layout,
            delete_layout,
            export_layout_zip,
            import_layout_zip,
            start_server,
            stop_server,
            get_server_port,
            set_active_layout,
            get_active_layout,
            fetch_community_index,
            install_community_atlas,
            uninstall_community_atlas,
            get_community_manifest,
            fork_community_atlas,
            open_community_browser,
            list_community_atlases,
            load_community_atlas,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
