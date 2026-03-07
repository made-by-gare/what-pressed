import { useState, useEffect, useRef } from "react";
import type { InputState } from "../types/input";
import { subscribeInput } from "../lib/commands";

export function useInputState(): InputState {
  const [state, setState] = useState<InputState>({
    pressed: [],
    axes: {},
    timestamp: 0,
  });

  // Use a ref for the active flag so the subscription callback
  // can check if the component is still mounted
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;

    subscribeInput((newState) => {
      if (activeRef.current) {
        setState(newState);
      }
    }).catch((err) => {
      console.error("Failed to subscribe to input:", err);
    });

    return () => {
      activeRef.current = false;
    };
  }, []);

  return state;
}
