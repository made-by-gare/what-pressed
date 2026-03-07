use crate::input::types::{InputState, RawInputEvent};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tokio::sync::watch;

/// A monotonically increasing version number that bumps whenever the active
/// layout or its content changes, telling the OBS display to reload.
pub type LayoutVersion = u64;

pub struct AppState {
    pub input_rx: watch::Receiver<InputState>,
    pub input_tx: std::sync::mpsc::Sender<RawInputEvent>,
    pub data_dir: PathBuf,
    pub server_handle: Mutex<Option<ServerHandle>>,
    pub active_layout: Arc<Mutex<Option<String>>>,
    pub layout_version_tx: watch::Sender<LayoutVersion>,
    pub layout_version_rx: watch::Receiver<LayoutVersion>,
}

pub struct ServerHandle {
    pub port: u16,
    pub shutdown_tx: tokio::sync::oneshot::Sender<()>,
}
