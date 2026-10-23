// Site contexts for the Surroundings picker, grouped by category. A preset
// stores its picks as a comma-separated list of ids in `environment`; a pick
// starting with "custom:" is the user's own words.

export interface SiteContext {
  id: string;
  label: string;
  /** one line under the label */
  sub: string;
  /** words that go into the prompt */
  text: string;
}

export interface ContextGroup {
  id: string;
  label: string;
  tag: string;
  /** banner colours, top-left to bottom-right */
  colors: [string, string, string];
  items: SiteContext[];
}

function ctx(id: string, label: string, sub: string, text: string): SiteContext {
  return { id, label, sub, text };
}

export const CONTEXT_GROUPS: ContextGroup[] = [
  {
    id: "city",
    label: "Cambodian city",
    tag: "Street life",
    colors: ["#3b2a1d", "#a8693a", "#e7b77a"],
    items: [
      ctx("pp-street", "Phnom Penh street", "Footpath, street trees, shophouses", "a Phnom Penh street setting: paved footpath, street trees, parked motorbikes, a few pedestrians, neighbouring shophouses"),
      ctx("bkk1", "Inner-city side street", "Narrow street, overhead cables", "a narrow inner Phnom Penh side street: overhead power and telecom cables on concrete poles, parked motorbikes, mixed old and new shophouses, potted plants at doorsteps"),
      ctx("boulevard", "Main boulevard", "Wide road, median planting", "a wide Phnom Penh boulevard with a planted median, traffic lanes, broad footpaths and mid-rise commercial buildings"),
      ctx("market", "Near a local market", "Stalls, awnings, busy footpath", "next to a local Cambodian market: fabric awnings, fruit and vegetable stalls, busy footpath, motorbikes parked along the edge"),
      ctx("newdistrict", "New city district", "Sen Sok, Chroy Changvar style", "a newly built outer Phnom Penh district: wide new roads, young trees, new condominiums and villas, some empty plots under construction"),
    ],
  },
  {
    id: "borey",
    label: "Borey and gated estates",
    tag: "Residential",
    colors: ["#1f2b22", "#5f7f4b", "#d9c79a"],
    items: [
      ctx("borey", "Borey estate street", "Concrete road, kerbs, young trees", "inside a gated borey residential estate: concrete road, kerbs, young street trees, low boundary walls, neighbouring houses"),
      ctx("borey-gate", "Borey main gate", "Gatehouse, signage left blank", "near the main gate of a borey: gatehouse with guard booth, decorative entrance arch with the sign left blank, planted roundabout"),
      ctx("villa-row", "Row of villas", "Matching neighbours, low walls", "a row of matching neighbouring villas with low rendered boundary walls, steel gates and small front gardens"),
      ctx("borey-park", "Estate park", "Lawn, playground, walking path", "beside a borey community park: lawn, palms, a children's playground and a concrete walking path"),
    ],
  },
  {
    id: "nature",
    label: "Natural landscape",
    tag: "Landscape",
    colors: ["#18301f", "#3f6b3a", "#b6c98a"],
    items: [
      ctx("tropical-garden", "Tropical garden", "Frangipani, palms, lawn", "a mature tropical garden: frangipani, palms, banana plants, lawn and stepping stones"),
      ctx("rural", "Rice fields", "Sugar palms, laterite road", "a rural Cambodian setting: rice fields, sugar palms, red laterite road, distant tree line"),
      ctx("riverside", "Riverside", "Wide river, promenade", "a riverside setting with a wide brown river, a promenade, and distant low-rise city skyline"),
      ctx("lake", "Lakeside", "Calm water with reflections", "on the edge of a calm lake with reflections of the building, reeds and lotus plants along the bank"),
      ctx("hills", "Forest hills", "Cardamom or Bokor style", "a green forested hillside in the Cambodian countryside, misty hills in the distance"),
      ctx("beach", "Coast", "Kep or Sihanoukville", "a coastal resort setting near Kep or Sihanoukville: sand, coconut palms, calm sea in the distance"),
    ],
  },
  {
    id: "landmarks",
    label: "Cambodian places",
    tag: "Place",
    colors: ["#2a1d14", "#8a5a33", "#d9a86b"],
    items: [
      ctx("quay", "Sisowath Quay", "Phnom Penh riverfront", "near Sisowath Quay in Phnom Penh: riverfront promenade, flag poles, the Tonle Sap river and low-rise colonial-era buildings"),
      ctx("koh-pich", "Koh Pich", "Diamond Island, Phnom Penh", "on Koh Pich (Diamond Island) in Phnom Penh: new high-rise towers, wide roads and the river nearby"),
      ctx("siem-reap", "Siem Reap", "Laterite, sugar palms, temples far off", "in Siem Reap: red laterite paths, sugar palms, large old trees, a calm low-rise town setting"),
      ctx("kampot", "Kampot riverside", "Bokor mountain behind", "on the Kampot riverside with Bokor mountain in the distance and old shophouses nearby"),
    ],
  },
  {
    id: "interior",
    label: "Interior context",
    tag: "Indoor",
    colors: ["#2a221b", "#7a5d43", "#e4cfae"],
    items: [
      ctx("view-garden", "Garden view", "Planting outside the windows", "through the windows: a lush tropical garden with palms and frangipani"),
      ctx("view-city", "City view", "Skyline outside the windows", "through the windows: the Phnom Penh skyline at a mid-level height"),
      ctx("view-river", "River view", "Water outside the windows", "through the windows: a wide river and the far bank"),
      ctx("view-pool", "Pool terrace", "Pool deck outside", "through the glazing: a pool terrace with timber deck and loungers"),
    ],
  },
  {
    id: "masterplan",
    label: "Masterplan view",
    tag: "Aerial",
    colors: ["#1a2430", "#4f6b82", "#c6d3dc"],
    items: [
      ctx("mp-farmland", "Edge of farmland", "Paddy fields around the site", "the site surrounded by rice paddies, irrigation canals and scattered village houses under trees"),
      ctx("mp-suburb", "Suburban fringe", "Mixed new and old housing", "the site on the suburban fringe of Phnom Penh: new boreys next to older villages, empty plots and main roads"),
      ctx("mp-river", "Mekong bank", "Wide river along one side", "the site along the bank of the Mekong river, wide brown water and a sandbank"),
      ctx("mp-city", "Dense city", "Built-up blocks all round", "the site in a dense built-up city area, mid-rise blocks and busy roads on all sides"),
    ],
  },
];

const ALL: SiteContext[] = CONTEXT_GROUPS.flatMap((g) => g.items);

export function parseContexts(environment: string): string[] {
  return environment
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && s !== "keep");
}

export function joinContexts(ids: string[]): string {
  return ids.length ? ids.join(",") : "keep";
}

export function contextLabel(id: string): string {
  if (id.startsWith("custom:")) return id.slice(7);
  return ALL.find((c) => c.id === id)?.label ?? id;
}

/** Prompt text for the chosen contexts, or null to keep the model's surroundings. */
export function contextText(environment: string): string | null {
  const texts = parseContexts(environment)
    .map((id) => (id.startsWith("custom:") ? id.slice(7).trim() : ALL.find((c) => c.id === id)?.text))
    .filter((t): t is string => Boolean(t));
  return texts.length ? texts.join("; ") : null;
}
