use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(tag = "type", content = "value")]
pub enum InputId {
    Key(String),
    MouseButton(String),
    GamepadButton(String),
    GamepadAxis(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InputState {
    pub pressed: HashSet<InputId>,
    pub axes: HashMap<String, f32>,
    pub timestamp: u64,
}

impl Default for InputState {
    fn default() -> Self {
        Self {
            pressed: HashSet::new(),
            axes: HashMap::new(),
            timestamp: 0,
        }
    }
}

#[derive(Debug)]
pub enum RawInputEvent {
    KeyPress(String),
    KeyRelease(String),
    MousePress(String),
    MouseRelease(String),
    GamepadPress(String),
    GamepadRelease(String),
    GamepadAxis(String, f32),
}
