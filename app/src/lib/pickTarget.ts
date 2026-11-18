// Lets another screen (the Advanced tab's nodes) use the Browse all sheets for
// looks and surroundings. While a target is set, "Use" hands the pick to it
// instead of changing the Render tab.

import { setState } from "../store";

export interface PickTarget {
  kind: "look" | "env";
  /** Look id, or a surroundings list ("id,id,custom:words") as a look stores it. */
  current: string;
  onPick: (value: string) => void;
}

let target: PickTarget | null = null;

export function openPicker(t: PickTarget): void {
  target = t;
  setState({ libOpen: t.kind });
}

export function pickTarget(kind: PickTarget["kind"]): PickTarget | null {
  return target && target.kind === kind ? target : null;
}

export function clearPicker(): void {
  target = null;
}
