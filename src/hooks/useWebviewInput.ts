import { useEffect } from "react";
import { injectKeyEvent } from "../lib/commands";

/**
 * Maps JavaScript KeyboardEvent.code to rdev's Key debug format.
 * rdev uses format!("{:?}", key) which produces names like "KeyA", "Num1", "Return", etc.
 */
function mapCodeToRdev(code: string): string | null {
  // Direct matches (no mapping needed)
  // KeyA-KeyZ, F1-F24, ShiftLeft, ShiftRight, ControlLeft, ControlRight,
  // MetaLeft, MetaRight, Space, Tab, Escape, Delete, Insert, Home, End,
  // PageUp, PageDown, CapsLock, NumLock, ScrollLock, PrintScreen, Pause,
  // Minus, Equal, Comma, Quote, Slash
  const directMatch =
    /^(Key[A-Z]|F\d{1,2}|ShiftLeft|ShiftRight|ControlLeft|ControlRight|MetaLeft|MetaRight|Space|Tab|Escape|Delete|Insert|Home|End|PageUp|PageDown|CapsLock|NumLock|ScrollLock|PrintScreen|Pause|Minus|Equal|Comma|Quote|Slash)$/;
  if (directMatch.test(code)) return code;

  // Digits: Digit0-9 → Num0-9
  const digitMatch = code.match(/^Digit(\d)$/);
  if (digitMatch) return `Num${digitMatch[1]}`;

  // Arrows: ArrowUp → UpArrow, etc.
  const arrowMap: Record<string, string> = {
    ArrowUp: "UpArrow",
    ArrowDown: "DownArrow",
    ArrowLeft: "LeftArrow",
    ArrowRight: "RightArrow",
  };
  if (arrowMap[code]) return arrowMap[code];

  // Keys with different naming
  const remap: Record<string, string> = {
    Enter: "Return",
    Backspace: "BackSpace",
    AltLeft: "Alt",
    AltRight: "AltGr",
    Period: "Dot",
    Semicolon: "SemiColon",
    Backquote: "BackQuote",
    BracketLeft: "LeftBracket",
    BracketRight: "RightBracket",
    Backslash: "BackSlash",
    IntlBackslash: "IntlBackslash",
  };
  if (remap[code]) return remap[code];

  // Numpad: Numpad0-9 → Kp0-9
  const kpDigit = code.match(/^Numpad(\d)$/);
  if (kpDigit) return `Kp${kpDigit[1]}`;

  const kpMap: Record<string, string> = {
    NumpadAdd: "KpPlus",
    NumpadSubtract: "KpMinus",
    NumpadMultiply: "KpMultiply",
    NumpadDivide: "KpDivide",
    NumpadDecimal: "KpDecimal",
    NumpadEnter: "KpReturn",
  };
  if (kpMap[code]) return kpMap[code];

  // Unknown key — skip
  return null;
}

/**
 * Captures keyboard events from the webview and injects them into the Rust input system.
 * This is needed because on Windows, rdev's low-level keyboard hook can't see events
 * when the Tauri/WebView2 window has focus.
 */
export function useWebviewInput() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore repeated events (key held down)
      if (e.repeat) return;
      const key = mapCodeToRdev(e.code);
      if (key) {
        injectKeyEvent(key, true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = mapCodeToRdev(e.code);
      if (key) {
        injectKeyEvent(key, false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);
}
