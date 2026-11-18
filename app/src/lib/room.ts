// Guesses the room from an image file name, so a bathroom screenshot starts on a
// bathroom look instead of the living room. Only used when no look was chosen before.

const ROOMS: Array<[RegExp, string]> = [
  [/(?<![a-z])(bath|bathroom|shower|toilet|wc|vanity)(?![a-z])/i, "int-bathroom-minimal"],
  [/(?<![a-z])(bed|bedroom)(?![a-z])/i, "int-bedroom-tropical"],
  [/(?<![a-z])(kitchen|pantry)(?![a-z])/i, "int-kitchen-japandi"],
  [/(?<![a-z])dining(?![a-z])/i, "int-dining-indochine"],
  [/(?<![a-z])(living|lounge|family)(?![a-z])/i, "int-living-modern"],
];

/** Interior look id that matches the file name, or null when it says nothing about the room. */
export function roomStarter(name: string): string | null {
  const n = name.replace(/\.[a-z0-9]{2,4}$/i, "");
  for (const [re, id] of ROOMS) if (re.test(n)) return id;
  return null;
}

/** File name without its extension, for naming saved prompts after the image. */
export function baseName(name: string): string {
  return name.replace(/\.[a-z0-9]{2,4}$/i, "").trim();
}
