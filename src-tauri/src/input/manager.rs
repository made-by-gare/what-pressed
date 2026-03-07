use super::types::{InputId, InputState, RawInputEvent};
use std::sync::mpsc;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::watch;

pub struct InputManager {
    rx: mpsc::Receiver<RawInputEvent>,
    watch_tx: watch::Sender<InputState>,
}

impl InputManager {
    pub fn new(rx: mpsc::Receiver<RawInputEvent>, watch_tx: watch::Sender<InputState>) -> Self {
        Self { rx, watch_tx }
    }

    /// Run the input manager on a dedicated thread (blocking).
    pub fn run(self) {
        let mut state = InputState::default();

        loop {
            match self.rx.recv() {
                Ok(event) => {
                    let now = SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_millis() as u64;

                    match event {
                        RawInputEvent::KeyPress(key) => {
                            state.pressed.insert(InputId::Key(key));
                        }
                        RawInputEvent::KeyRelease(key) => {
                            state.pressed.remove(&InputId::Key(key));
                        }
                        RawInputEvent::MousePress(btn) => {
                            state.pressed.insert(InputId::MouseButton(btn));
                        }
                        RawInputEvent::MouseRelease(btn) => {
                            state.pressed.remove(&InputId::MouseButton(btn));
                        }
                        RawInputEvent::GamepadPress(btn) => {
                            state.pressed.insert(InputId::GamepadButton(btn));
                        }
                        RawInputEvent::GamepadRelease(btn) => {
                            state.pressed.remove(&InputId::GamepadButton(btn));
                        }
                        RawInputEvent::GamepadAxis(axis, value) => {
                            state.axes.insert(axis, value);
                        }
                    }

                    state.timestamp = now;
                    let _ = self.watch_tx.send(state.clone());
                }
                Err(_) => break, // All senders dropped
            }
        }
    }
}
