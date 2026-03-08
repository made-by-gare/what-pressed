import { useState, useEffect, useRef } from "react";
import type { InputId } from "../../types/input";
import { inputIdToString } from "../../types/input";

interface Props {
  inputId: InputId;
  currentInput: InputId | null;
  onAssign: (id: InputId) => void;
}

type ListenPhase = "idle" | "waitForRelease" | "waitForInput";

export function InputAssign({ inputId, currentInput, onAssign }: Props) {
  const [listenPhase, setListenPhase] = useState<ListenPhase>("idle");

  const onAssignRef = useRef(onAssign);
  onAssignRef.current = onAssign;

  useEffect(() => {
    if (listenPhase === "idle") return;

    if (listenPhase === "waitForRelease") {
      if (!currentInput) {
        setListenPhase("waitForInput");
      }
      return;
    }

    if (!currentInput) return;

    onAssignRef.current(currentInput);
    setListenPhase("idle");
  }, [listenPhase, currentInput]);

  return (
    <div className="input-assign">
      <span className="input-assign-badge">{inputIdToString(inputId)}</span>
      {listenPhase !== "idle" ? (
        <>
          <span className="input-assign-listening">
            {listenPhase === "waitForRelease" ? "Release all..." : "Press a key..."}
          </span>
          <button className="btn btn-sm" onClick={() => setListenPhase("idle")}>Cancel</button>
        </>
      ) : (
        <button className="btn btn-sm" onClick={() => setListenPhase("waitForRelease")}>Assign</button>
      )}

      <style>{`
        .input-assign {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .input-assign-badge {
          font-family: monospace;
          font-size: 12px;
          color: #ccc;
          background: rgba(255,255,255,0.06);
          padding: 2px 8px;
          border-radius: 4px;
        }
        .input-assign-listening {
          font-size: 11px;
          color: #e8730c;
          animation: pulse 1s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
