pub mod web_server;

use crate::input::types::InputState;
use crate::state::LayoutVersion;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::{oneshot, watch};
use web_server::{create_router, ServerState};

pub async fn start_server(
    port: u16,
    input_rx: watch::Receiver<InputState>,
    data_dir: PathBuf,
    active_layout: Arc<std::sync::Mutex<Option<String>>>,
    layout_version_rx: watch::Receiver<LayoutVersion>,
) -> Result<oneshot::Sender<()>, String> {
    let (shutdown_tx, shutdown_rx) = oneshot::channel();

    let state = ServerState {
        input_rx,
        data_dir,
        active_layout,
        layout_version_rx,
    };

    let router = create_router(state);
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port))
        .await
        .map_err(|e| format!("Failed to bind port {}: {}", port, e))?;

    tokio::spawn(async move {
        axum::serve(listener, router)
            .with_graceful_shutdown(async {
                let _ = shutdown_rx.await;
            })
            .await
            .ok();
    });

    Ok(shutdown_tx)
}
