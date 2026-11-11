// Camera words for "new view, same look".

export interface CameraMove {
  /** Degrees around the building; + = to the camera's right. */
  orbit: number;
  /** Looking down, 0 = level eye height, 85 = almost top-down. */
  tilt: number;
  lensMm: number;
  distanceM: number;
}

export function fieldOfView(lensMm: number): number {
  return (2 * Math.atan(36 / (2 * lensMm)) * 180) / Math.PI;
}

export function tiltWord(tilt: number): string {
  return tilt <= 5 ? "eye level" : tilt < 20 ? "slightly elevated" : tilt < 45 ? "elevated three-quarter view" : tilt < 75 ? "high aerial view" : "top-down plan view";
}

export function cameraHeight(m: CameraMove): number {
  return 1.6 + m.distanceM * Math.sin((m.tilt * Math.PI) / 180);
}

export function cameraPromptLine(m: CameraMove): string {
  const h = cameraHeight(m);
  const hText = h < 10 ? `${h.toFixed(1)} m` : `${Math.round(h)} m`;
  const side = m.orbit > 0 ? "right" : "left";
  const move = m.orbit === 0 ? "same position as the master view" : `move ${Math.abs(m.orbit)}° to the ${side} around the building`;
  return `Camera: ${move}, ${tiltWord(m.tilt)} (looking down ${m.tilt}°), camera height about ${hText}, about ${m.distanceM} m from the building, ${m.lensMm} mm lens (${Math.round(fieldOfView(m.lensMm))}° field of view), vertical lines kept straight.`;
}
