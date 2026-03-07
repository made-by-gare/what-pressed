use super::types::RawInputEvent;
use gilrs::{Event, EventType, Gilrs};
use std::sync::mpsc::Sender;

pub fn start_gamepad_listener(tx: Sender<RawInputEvent>) {
    std::thread::spawn(move || {
        let mut gilrs = match Gilrs::new() {
            Ok(g) => g,
            Err(e) => {
                eprintln!("Failed to init gilrs: {:?}", e);
                return;
            }
        };

        loop {
            while let Some(Event { event, .. }) = gilrs.next_event() {
                match event {
                    EventType::ButtonPressed(btn, _) => {
                        let _ = tx.send(RawInputEvent::GamepadPress(format!("{:?}", btn)));
                    }
                    EventType::ButtonReleased(btn, _) => {
                        let _ = tx.send(RawInputEvent::GamepadRelease(format!("{:?}", btn)));
                    }
                    EventType::AxisChanged(axis, value, _) => {
                        let _ = tx.send(RawInputEvent::GamepadAxis(format!("{:?}", axis), value));
                    }
                    _ => {}
                }
            }
            std::thread::sleep(std::time::Duration::from_millis(8)); // ~120Hz
        }
    });
}
