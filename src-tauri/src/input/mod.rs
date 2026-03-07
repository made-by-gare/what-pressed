pub mod gamepad;
pub mod keyboard_mouse;
pub mod manager;
pub mod types;

use manager::InputManager;
use tokio::sync::watch;
use types::{InputState, RawInputEvent};

/// Start the input capture system.
/// Returns (watch receiver for InputState, sender for injecting events from the webview).
pub fn start_input_system() -> (
    watch::Receiver<InputState>,
    std::sync::mpsc::Sender<RawInputEvent>,
) {
    let (watch_tx, watch_rx) = watch::channel(InputState::default());
    let (raw_tx, raw_rx) = std::sync::mpsc::channel();

    // Clone a sender for the webview to inject keyboard events
    // (rdev can't see keyboard events when the Tauri window has focus on Windows)
    let inject_tx = raw_tx.clone();

    // Start keyboard/mouse listener on OS thread
    keyboard_mouse::start_keyboard_mouse_listener(raw_tx.clone());

    // Start gamepad listener on OS thread
    gamepad::start_gamepad_listener(raw_tx);

    // Start input manager on OS thread
    let manager = InputManager::new(raw_rx, watch_tx);
    std::thread::spawn(move || manager.run());

    (watch_rx, inject_tx)
}
