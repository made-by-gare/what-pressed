use super::types::RawInputEvent;
use std::sync::mpsc::Sender;

pub fn start_keyboard_mouse_listener(tx: Sender<RawInputEvent>) {
    std::thread::spawn(move || {
        if let Err(e) = rdev::listen(move |event| {
            let raw = match event.event_type {
                rdev::EventType::KeyPress(key) => {
                    Some(RawInputEvent::KeyPress(format!("{:?}", key)))
                }
                rdev::EventType::KeyRelease(key) => {
                    Some(RawInputEvent::KeyRelease(format!("{:?}", key)))
                }
                rdev::EventType::ButtonPress(btn) => {
                    Some(RawInputEvent::MousePress(format!("{:?}", btn)))
                }
                rdev::EventType::ButtonRelease(btn) => {
                    Some(RawInputEvent::MouseRelease(format!("{:?}", btn)))
                }
                _ => None,
            };
            if let Some(raw) = raw {
                let _ = tx.send(raw);
            }
        }) {
            eprintln!("rdev listen error: {:?}", e);
        }
    });
}
