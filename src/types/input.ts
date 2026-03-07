export type InputId =
  | { type: "Key"; value: string }
  | { type: "MouseButton"; value: string }
  | { type: "GamepadButton"; value: string }
  | { type: "GamepadAxis"; value: string };

export interface InputState {
  pressed: InputId[];
  axes: Record<string, number>;
  timestamp: number;
}

export function inputIdToString(id: InputId): string {
  return `${id.type}:${id.value}`;
}

export function inputIdEquals(a: InputId, b: InputId): boolean {
  return a.type === b.type && a.value === b.value;
}
