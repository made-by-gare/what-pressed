use crate::input::types::InputState;
use crate::state::LayoutVersion;
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, State,
    },
    http::{header, StatusCode},
    response::{Html, IntoResponse},
    routing::get,
    Router,
};
use futures_util::{SinkExt, StreamExt};
use include_dir::{include_dir, Dir};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::watch;
use tower_http::cors::CorsLayer;

static OBS_SOURCE_DIR: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/../obs-source");

#[derive(Clone)]
pub struct ServerState {
    pub input_rx: watch::Receiver<InputState>,
    pub data_dir: PathBuf,
    pub active_layout: Arc<std::sync::Mutex<Option<String>>>,
    pub layout_version_rx: watch::Receiver<LayoutVersion>,
}

pub fn create_router(state: ServerState) -> Router {
    Router::new()
        .route("/", get(index_handler))
        .route("/ws/input", get(ws_handler))
        .route("/api/active-layout", get(active_layout_handler))
        .route("/api/atlas/{name}", get(atlas_handler))
        .route(
            "/api/atlas/{name}/images/{filename}",
            get(atlas_image_handler),
        )
        .route(
            "/api/layout/{name}/images/{filename}",
            get(layout_image_handler),
        )
        .route("/{*path}", get(static_handler))
        .layer(CorsLayer::permissive())
        .with_state(state)
}

async fn index_handler() -> Html<String> {
    let content = OBS_SOURCE_DIR
        .get_file("display.html")
        .map(|f| f.contents_utf8().unwrap_or(""))
        .unwrap_or("<html><body>display.html not found</body></html>");
    Html(content.to_string())
}

async fn ws_handler(ws: WebSocketUpgrade, State(state): State<ServerState>) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_ws(socket, state.input_rx, state.layout_version_rx))
}

async fn handle_ws(
    socket: WebSocket,
    mut input_rx: watch::Receiver<InputState>,
    mut layout_rx: watch::Receiver<LayoutVersion>,
) {
    let (mut sender, mut receiver) = socket.split();
    let mut heartbeat = tokio::time::interval(std::time::Duration::from_secs(15));

    loop {
        tokio::select! {
            _ = input_rx.changed() => {
                let state = input_rx.borrow_and_update().clone();
                if let Ok(json) = serde_json::to_string(&state) {
                    if sender.send(Message::Text(json.into())).await.is_err() {
                        break;
                    }
                }
            }
            _ = layout_rx.changed() => {
                layout_rx.borrow_and_update();
                if sender.send(Message::Text("{\"reload\":true}".into())).await.is_err() {
                    break;
                }
            }
            _ = heartbeat.tick() => {
                if sender.send(Message::Ping(vec![].into())).await.is_err() {
                    break;
                }
            }
            msg = receiver.next() => {
                match msg {
                    Some(Ok(Message::Close(_))) | None => break,
                    _ => {}
                }
            }
        }
    }
}

async fn active_layout_handler(State(state): State<ServerState>) -> impl IntoResponse {
    let name = state.active_layout.lock().unwrap().clone();
    match name {
        Some(name) => {
            let path = state
                .data_dir
                .join("layouts")
                .join(&name)
                .join("layout.json");
            match tokio::fs::read_to_string(&path).await {
                Ok(content) => (
                    StatusCode::OK,
                    [(header::CONTENT_TYPE, "application/json")],
                    content,
                )
                    .into_response(),
                Err(_) => StatusCode::NOT_FOUND.into_response(),
            }
        }
        None => StatusCode::NOT_FOUND.into_response(),
    }
}

async fn atlas_handler(
    State(state): State<ServerState>,
    Path(name): Path<String>,
) -> impl IntoResponse {
    // Check local first, then community
    let local_path = state.data_dir.join("atlases").join(&name).join("atlas.json");
    let community_path = state
        .data_dir
        .join("community-atlases")
        .join(&name)
        .join("atlas.json");
    let path = if local_path.exists() {
        local_path
    } else {
        community_path
    };
    match tokio::fs::read_to_string(&path).await {
        Ok(content) => (
            StatusCode::OK,
            [(header::CONTENT_TYPE, "application/json")],
            content,
        )
            .into_response(),
        Err(_) => StatusCode::NOT_FOUND.into_response(),
    }
}

async fn atlas_image_handler(
    State(state): State<ServerState>,
    Path((name, filename)): Path<(String, String)>,
) -> impl IntoResponse {
    // Check local first, then community
    let local_path = state
        .data_dir
        .join("atlases")
        .join(&name)
        .join("images")
        .join(&filename);
    let community_path = state
        .data_dir
        .join("community-atlases")
        .join(&name)
        .join("images")
        .join(&filename);
    let path = if local_path.exists() {
        local_path
    } else {
        community_path
    };
    match tokio::fs::read(&path).await {
        Ok(data) => {
            let mime = mime_guess::from_path(&filename)
                .first_or_octet_stream()
                .to_string();
            (
                StatusCode::OK,
                [
                    (header::CONTENT_TYPE, mime),
                    (header::CACHE_CONTROL, "public, max-age=3600".to_string()),
                ],
                data,
            )
                .into_response()
        }
        Err(_) => StatusCode::NOT_FOUND.into_response(),
    }
}

async fn layout_image_handler(
    State(state): State<ServerState>,
    Path((name, filename)): Path<(String, String)>,
) -> impl IntoResponse {
    let path = state
        .data_dir
        .join("layouts")
        .join(&name)
        .join("images")
        .join(&filename);
    match tokio::fs::read(&path).await {
        Ok(data) => {
            let mime = mime_guess::from_path(&filename)
                .first_or_octet_stream()
                .to_string();
            (
                StatusCode::OK,
                [
                    (header::CONTENT_TYPE, mime),
                    (header::CACHE_CONTROL, "public, max-age=3600".to_string()),
                ],
                data,
            )
                .into_response()
        }
        Err(_) => StatusCode::NOT_FOUND.into_response(),
    }
}

async fn static_handler(Path(path): Path<String>) -> impl IntoResponse {
    match OBS_SOURCE_DIR.get_file(&path) {
        Some(file) => {
            let mime = mime_guess::from_path(&path)
                .first_or_octet_stream()
                .to_string();
            (
                StatusCode::OK,
                [(header::CONTENT_TYPE, mime)],
                file.contents().to_vec(),
            )
                .into_response()
        }
        None => StatusCode::NOT_FOUND.into_response(),
    }
}
