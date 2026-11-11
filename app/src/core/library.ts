// The template library: every preset, sorted by scene type, then by style
// (exterior), room and style (interior) or development type (aerial).
// Presets are built from parts: a building type or room says WHAT is in the
// picture, a style says HOW it is finished. Ids are stable
// ("int-kitchen-japandi") so history, ratings and locks keep pointing at them.

import { BUILT_IN_PRESETS } from "./presets";
import type { Preset, ProjectType } from "./types";

export interface LibStyle {
  id: string;
  label: string;
  /** materials, colours and forms, in builder's words */
  text: string;
  /** card colours: background, then material blocks */
  colors: string[];
}

// ---------- Exterior ----------

export const EXT_STYLES: LibStyle[] = [
  { id: "modern", label: "Modern", text: "clean modern lines, smooth white and warm grey render, large low-iron glass panels with slim dark aluminium frames, flat roof with thin projecting slabs, timber soffits", colors: ["#e9e6e0", "#3a3d42", "#a9784b"] },
  { id: "minimal", label: "Minimal", text: "minimal pure volumes, seamless off-white render, almost no trims, frameless glazing, hidden gutters, one warm timber accent, gravel and single specimen trees", colors: ["#f2f0ea", "#d8d3c8", "#8a6a4a"] },
  { id: "tropical", label: "Tropical modern", text: "tropical modern design, deep roof overhangs, timber vertical louvers on the west, breeze-block screens, board-formed concrete, shaded verandas, lush planting on terraces", colors: ["#6f8b5a", "#a19e98", "#9a6b3f"] },
  { id: "new-khmer", label: "New Khmer", text: "New Khmer Architecture in the spirit of Vann Molyvann: raw board-formed concrete, folded and sloping roofs, brise-soleil fins, raised ground floor on pilotis, laterite and water features", colors: ["#9d9a93", "#a5513a", "#c9b48a"] },
  { id: "neoclassical", label: "Neoclassical", text: "neoclassical facade, symmetrical composition, white and cream render with moulded cornices, columns with capitals, arched windows with keystones, balustrades, dark grey slate-look roof", colors: ["#efe7d8", "#c8b89a", "#3c4048"] },
  { id: "french-colonial", label: "French colonial", text: "French colonial style as in old Phnom Penh: ochre-yellow lime render, tall timber louvered shutters in green, wrought-iron balconies, terracotta tile roof, arched ground-floor arcade", colors: ["#d9b25c", "#4f6b4a", "#b5603a"] },
  { id: "indochine", label: "Indochine", text: "Indochine style, warm white render, dark timber shutters and screens, encaustic cement tiles on verandas, hip roofs with terracotta tiles, rattan and lantern details", colors: ["#efe6d6", "#4a3426", "#b56a42"] },
  { id: "mediterranean", label: "Mediterranean", text: "Mediterranean villa, warm white textured render, terracotta barrel roof tiles, arched openings, travertine terraces, olive and bougainvillea planting", colors: ["#f1ece2", "#c0673f", "#cfc1a6"] },
  { id: "industrial", label: "Industrial", text: "industrial style, dark steel frame, red-brown face brick, black steel windows with thin mullions, corrugated metal roof, exposed concrete", colors: ["#2d2f33", "#8b4a35", "#a19e98"] },
  { id: "japanese", label: "Japanese", text: "contemporary Japanese style, charred timber cladding, low pitched dark metal roofs, sliding timber screens, gravel garden with stones and maple", colors: ["#2b2622", "#c9b48a", "#6f7a5a"] },
  { id: "brutalist", label: "Brutalist", text: "brutalist architecture, heavy raw concrete volumes with visible formwork, deep-set windows, strong shadows, planted terraces softening the mass", colors: ["#8f8c86", "#5e5b56", "#6f8b5a"] },
  { id: "art-deco", label: "Art Deco", text: "Art Deco facade, stepped massing, vertical fluted pilasters, cream render with bronze metal trims, geometric relief panels, rounded corner balconies", colors: ["#ece2cc", "#9c7a3c", "#2f3a3f"] },
];

interface Subject {
  id: string;
  label: string;
  text: string;
  lighting: string;
  environment: string;
  group?: string;
}

export const EXT_TYPES: Subject[] = [
  { id: "villa", group: "Residential", label: "Villa", text: "two-storey detached villa with a front garden and gated driveway", lighting: "afternoon", environment: "borey" },
  { id: "twin-villa", group: "Residential", label: "Twin villa", text: "pair of mirrored two-storey twin villas sharing a party wall, each with its own gate and carport", lighting: "time:17:30", environment: "borey" },
  { id: "mansion", group: "Residential", label: "Mansion", text: "large three-storey mansion on a wide plot, grand entrance, landscaped front court with fountain", lighting: "time:17:30", environment: "tropical-garden" },
  { id: "shophouse", group: "Residential", label: "Shophouse", text: "row of four-storey shophouses with shops at ground floor, balconies above and signage boards left blank", lighting: "morning", environment: "pp-street" },
  { id: "link-house", group: "Residential", label: "Link house", text: "row of two-storey link houses with small front yards, carports and low boundary walls", lighting: "morning", environment: "borey" },
  { id: "condo", group: "Residential", label: "Condo tower", text: "25-storey residential condominium tower on a landscaped podium with balconies on every floor", lighting: "blue-hour", environment: "bkk1" },
  { id: "office", group: "Work and Public", label: "Office tower", text: "20-storey office tower with a double-height glazed lobby and shaded facade", lighting: "noon", environment: "boulevard" },
  { id: "mixed-use", group: "Work and Public", label: "Mixed-use", text: "mixed-use building with a retail podium, office floors and a residential tower above", lighting: "blue-hour", environment: "newdistrict" },
  { id: "hotel", group: "Hospitality", label: "Boutique hotel", text: "five-storey boutique hotel with a lit entrance canopy, ground-floor cafe and rooftop bar", lighting: "night", environment: "pp-street" },
  { id: "resort", group: "Hospitality", label: "Resort", text: "low-rise resort pavilions around an infinity pool, timber decks and palms", lighting: "afternoon", environment: "beach" },
  { id: "restaurant", group: "Hospitality", label: "Restaurant / cafe", text: "freestanding restaurant and cafe with an open terrace, outdoor seating and festoon lights", lighting: "blue-hour", environment: "tropical-garden" },
  { id: "retail", group: "Work and Public", label: "Retail / showroom", text: "two-storey retail showroom with a full-height glass shopfront and parking forecourt", lighting: "afternoon", environment: "boulevard" },
  { id: "civic", group: "Work and Public", label: "Civic / school", text: "public building or school with shaded walkways, a courtyard and a raised entrance", lighting: "morning", environment: "tropical-garden" },
  { id: "warehouse", group: "Work and Public", label: "Warehouse / factory", text: "single-storey warehouse and factory with loading bays, office block at the front and truck yard", lighting: "noon", environment: "rural" },
];

// ---------- Interior ----------

export const INT_STYLES: LibStyle[] = [
  { id: "modern", label: "Modern", text: "modern interior, clean lines, warm white walls, large-format light grey porcelain floor, walnut veneer joinery, black metal details, linear LED lighting", colors: ["#ece8df", "#7a5233", "#2d2f33"] },
  { id: "minimal", label: "Minimal", text: "minimal interior, white and soft greige surfaces, handleless joinery, hidden storage, microcement floor, very few objects, soft diffuse light", colors: ["#f2f0ea", "#d8d3c8", "#bfb8ab"] },
  { id: "contemporary", label: "Contemporary", text: "contemporary interior, layered neutral palette, oak floor, fluted panels, boucle and linen upholstery, brushed brass accents", colors: ["#e8e0d2", "#b9905e", "#c5b8a0"] },
  { id: "japandi", label: "Japandi", text: "Japandi interior, light oak and ash timber, paper and linen textures, low furniture, warm off-white walls, black accents, ceramics and dried branches", colors: ["#efe7da", "#c9a77a", "#2b2622"] },
  { id: "scandinavian", label: "Scandinavian", text: "Scandinavian interior, white walls, pale birch floor, light wood furniture, wool textiles in soft grey and sage, simple pendant lamps", colors: ["#f6f4ef", "#d9c3a0", "#9fae9a"] },
  { id: "neoclassical", label: "Neoclassical", text: "neoclassical interior, white wall panelling with mouldings, marble floor, crystal chandelier, curved upholstered furniture in cream and gold", colors: ["#f2ede3", "#d9d2c6", "#b49650"] },
  { id: "luxury", label: "Modern luxury", text: "modern luxury interior, book-matched marble, dark smoked oak, bronze and champagne metal, velvet upholstery, cove lighting", colors: ["#2c2622", "#d9d2c6", "#a3824a"] },
  { id: "industrial", label: "Industrial", text: "industrial interior, exposed brick and concrete, black steel frames, polished concrete floor, leather and reclaimed timber, exposed ducts", colors: ["#8b4a35", "#8f8c86", "#2d2f33"] },
  { id: "tropical", label: "Tropical", text: "tropical interior, teak and rattan, terrazzo floor, linen in sand tones, big indoor plants, ceiling fans, open to the garden", colors: ["#d9c7a4", "#8a5a35", "#5f7f4f"] },
  { id: "indochine", label: "Indochine", text: "Indochine interior, encaustic cement tiles, dark timber screens and fretwork, rattan chairs, lantern pendants, cream walls", colors: ["#efe6d6", "#4a3426", "#3f6f73"] },
  { id: "khmer", label: "Khmer contemporary", text: "Khmer contemporary interior, carved teak and sandstone details, silk in muted gold and indigo, woven mats, laterite accent wall, warm lamps", colors: ["#a5513a", "#c9a24a", "#2e3a5c"] },
  { id: "retro", label: "Retro mid-century", text: "retro mid-century interior, walnut furniture on tapered legs, mustard, teal and burnt orange accents, terrazzo, globe lamps", colors: ["#7a5233", "#d3a13a", "#2f6f6f"] },
  { id: "wabi-sabi", label: "Wabi-sabi", text: "wabi-sabi interior, lime plaster walls, raw timber, stone, handmade ceramics, earthy muted tones, imperfect natural textures", colors: ["#d8cdbb", "#8d7b66", "#6b6257"] },
  { id: "art-deco", label: "Art Deco", text: "Art Deco interior, geometric patterns, emerald and black, polished brass, fluted glass, curved velvet seating, marble", colors: ["#1f4a3c", "#a3824a", "#1b1b1b"] },
  { id: "boho", label: "Bohemian", text: "bohemian interior, layered rugs and textiles, rattan and macrame, warm terracotta and ochre, lots of plants, relaxed mix of furniture", colors: ["#c0673f", "#d3a13a", "#6f8b5a"] },
  { id: "coastal", label: "Coastal", text: "coastal interior, white-washed timber, linen in sand and soft blue, woven textures, light airy feel, sea views", colors: ["#f2efe8", "#a9c3cf", "#d9c7a4"] },
];

const day = "interior-day";
const eve = "interior-evening";
const garden = "view-garden";
const city = "view-city";

export const ROOMS: Subject[] = [
  // Residential
  { id: "living", label: "Living room", group: "Residential", text: "living room with a large sofa, armchairs, coffee table, rug, TV wall and big windows", lighting: day, environment: garden },
  { id: "family", label: "Family room", group: "Residential", text: "relaxed family room with a sectional sofa, play corner, bookshelves and a media unit", lighting: day, environment: garden },
  { id: "dining", label: "Dining room", group: "Residential", text: "dining room with a table for eight, upholstered chairs, pendant lights over the table and a sideboard", lighting: eve, environment: garden },
  { id: "kitchen", label: "Kitchen", group: "Residential", text: "kitchen with an island, full-height cabinets, worktops, built-in appliances, sink under the window and pendant lights", lighting: day, environment: garden },
  { id: "open-kitchen", label: "Open kitchen and dining", group: "Residential", text: "open-plan kitchen and dining area with an island counter, bar stools and a dining table beyond", lighting: day, environment: garden },
  { id: "pantry", label: "Wet kitchen / pantry", group: "Residential", text: "Cambodian wet kitchen and pantry with a gas hob, extractor hood, deep sink, tiled walls and open shelving", lighting: day, environment: "keep" },
  { id: "master-bed", label: "Master bedroom", group: "Residential", text: "master bedroom with a king-size bed, upholstered headboard, bedside tables, lounge chair and curtains", lighting: eve, environment: garden },
  { id: "bedroom", label: "Bedroom", group: "Residential", text: "bedroom with a queen-size bed, wardrobe, desk and window seat", lighting: day, environment: garden },
  { id: "guest-bed", label: "Guest bedroom", group: "Residential", text: "guest bedroom with a double bed, luggage bench, small wardrobe and bedside lamps", lighting: day, environment: garden },
  { id: "kids", label: "Kids' bedroom", group: "Residential", text: "children's bedroom with a single bed, study desk, toy storage and soft rug", lighting: day, environment: garden },
  { id: "nursery", label: "Nursery", group: "Residential", text: "baby nursery with a cot, changing table, nursing chair and soft textiles", lighting: day, environment: garden },
  { id: "master-bath", label: "Master bathroom", group: "Residential", text: "master bathroom with a freestanding bathtub, double vanity, walk-in shower with glass screen and large mirror", lighting: day, environment: garden },
  { id: "bathroom", label: "Bathroom", group: "Residential", text: "bathroom with a vanity basin, wall-hung toilet, walk-in shower and mirror cabinet", lighting: day, environment: "keep" },
  { id: "powder", label: "Powder room / guest WC", group: "Residential", text: "small powder room with a statement basin, toilet, feature wall and decorative mirror", lighting: eve, environment: "keep" },
  { id: "wardrobe", label: "Walk-in wardrobe", group: "Residential", text: "walk-in wardrobe with open hanging, glass-front drawers, island with drawers and a full-length mirror", lighting: eve, environment: "keep" },
  { id: "study", label: "Home office", group: "Residential", text: "home office with a desk, ergonomic chair, bookshelves and a reading chair", lighting: day, environment: garden },
  { id: "library", label: "Library / reading room", group: "Residential", text: "home library with floor-to-ceiling bookshelves, ladder, reading armchairs and floor lamps", lighting: eve, environment: garden },
  { id: "foyer", label: "Entrance foyer", group: "Residential", text: "entrance foyer with a shoe cabinet, console table, mirror and a view through to the living room", lighting: day, environment: "keep" },
  { id: "hallway", label: "Hallway / corridor", group: "Residential", text: "hallway with doors along one side, artwork, wall lights and a runner rug", lighting: eve, environment: "keep" },
  { id: "staircase", label: "Staircase", group: "Residential", text: "staircase hall with a feature stair, handrail, double-height void and pendant light", lighting: day, environment: "keep" },
  { id: "altar", label: "Altar / shrine room", group: "Residential", text: "Cambodian family altar room with a raised shrine cabinet, Buddha statue, offerings, incense and floor mats", lighting: eve, environment: "keep" },
  { id: "cinema", label: "Home cinema", group: "Residential", text: "home cinema with a projection screen, tiered recliner seats, acoustic wall panels and step lights", lighting: "int-night-moody", environment: "keep" },
  { id: "gym-home", label: "Home gym", group: "Residential", text: "home gym with a treadmill, weights rack, mirror wall and rubber floor", lighting: day, environment: garden },
  { id: "laundry", label: "Laundry", group: "Residential", text: "laundry room with stacked washer and dryer, folding counter, sink and hanging rail", lighting: day, environment: "keep" },
  { id: "balcony", label: "Balcony", group: "Residential", text: "covered balcony with outdoor chairs, side table, planters and a view out", lighting: "time:17:30", environment: city },
  { id: "rooftop", label: "Rooftop terrace", group: "Residential", text: "rooftop terrace with a pergola, outdoor lounge, dining table, planters and city view", lighting: "blue-hour", environment: city },
  // Hospitality
  { id: "hotel-lobby", label: "Hotel lobby", group: "Hospitality", text: "hotel lobby with a reception desk, lounge seating groups, feature chandelier and double-height ceiling", lighting: eve, environment: city },
  { id: "hotel-room", label: "Hotel room", group: "Hospitality", text: "hotel guest room with a king bed, desk, lounge chair, minibar unit and full-height window", lighting: eve, environment: city },
  { id: "hotel-suite", label: "Hotel suite", group: "Hospitality", text: "hotel suite with a separate living area, dining table, bedroom beyond and panoramic windows", lighting: eve, environment: city },
  { id: "restaurant", label: "Restaurant", group: "Hospitality", text: "restaurant dining room with booths, tables for two and four, a bar counter and statement lighting", lighting: eve, environment: city },
  { id: "cafe", label: "Cafe", group: "Hospitality", text: "cafe with a coffee bar counter, pastry display, mixed seating and a window bench", lighting: day, environment: city },
  { id: "bar", label: "Bar / lounge", group: "Hospitality", text: "cocktail bar with a back-lit bottle display, bar stools, lounge booths and low lighting", lighting: "int-night-moody", environment: "keep" },
  { id: "spa", label: "Spa", group: "Hospitality", text: "spa treatment room with massage beds, a soaking tub, stone surfaces and candles", lighting: eve, environment: garden },
  { id: "condo-lobby", label: "Condo lobby", group: "Hospitality", text: "residential condo lobby with a concierge desk, mailboxes, lounge seating and lift lobby", lighting: eve, environment: city },
  // Work and Public
  { id: "office-open", label: "Open-plan office", group: "Work and Public", text: "open-plan office with rows of desks, task chairs, phone booths and breakout area", lighting: day, environment: city },
  { id: "meeting", label: "Meeting room", group: "Work and Public", text: "meeting room with a long table for ten, screen wall, acoustic panels and glass partition", lighting: day, environment: city },
  { id: "ceo", label: "Executive office", group: "Work and Public", text: "executive office with a large desk, meeting table, lounge corner and display shelves", lighting: day, environment: city },
  { id: "reception", label: "Reception", group: "Work and Public", text: "company reception with a logo wall left blank, reception counter and waiting sofa", lighting: day, environment: "keep" },
  { id: "retail", label: "Retail shop", group: "Work and Public", text: "retail shop with display tables, wall shelving, fitting rooms and a cash counter", lighting: "int-showroom", environment: city },
  { id: "showroom", label: "Showroom", group: "Work and Public", text: "product showroom with display podiums, spotlights and a consultation table", lighting: "int-showroom", environment: "keep" },
  { id: "clinic", label: "Clinic", group: "Work and Public", text: "medical clinic waiting area and consultation room, easy-clean surfaces and calm colours", lighting: day, environment: "keep" },
  { id: "classroom", label: "Classroom", group: "Work and Public", text: "classroom with student desks, whiteboard wall, storage and big windows", lighting: day, environment: garden },
  { id: "gym", label: "Gym / fitness", group: "Work and Public", text: "commercial gym with cardio machines, weights area, mirrors and rubber flooring", lighting: "int-showroom", environment: city },
];

// ---------- Aerial ----------

export const AERIAL_TYPES: Subject[] = [
  { id: "borey", label: "Borey estate", text: "aerial view of a gated borey estate: rows of link houses, shophouses along the main road, villas, a central park and a clubhouse", lighting: "morning", environment: "mp-suburb" },
  { id: "mixed-use", label: "Mixed-use district", text: "aerial view of a mixed-use district: towers on podiums, a tree-lined boulevard, plazas and green roofs", lighting: "noon", environment: "mp-city" },
  { id: "resort", label: "Resort", text: "aerial view of a coastal resort: villas among palms, central pool, beach club and boardwalks", lighting: "afternoon", environment: "beach" },
  { id: "industrial", label: "Industrial park", text: "aerial view of an industrial park: large warehouse roofs, truck roads, a retention pond and green buffers", lighting: "noon", environment: "mp-farmland" },
  { id: "campus", label: "Campus / school", text: "aerial view of a school or university campus: teaching blocks around courtyards, sports fields and shaded walkways", lighting: "morning", environment: "mp-suburb" },
  { id: "riverside", label: "Riverside", text: "aerial view of a riverside development along the Mekong: promenade, towers set back from the bank and a public park", lighting: "time:17:30", environment: "mp-river" },
  { id: "township", label: "New township", text: "aerial view of a new township: road grid, neighbourhood blocks, a town centre, schools and parks", lighting: "blue-hour", environment: "mp-suburb" },
  { id: "eco", label: "Eco village", text: "aerial view of an eco village among rice fields: clusters of timber houses, ponds, farm plots and palm trees", lighting: "morning", environment: "mp-farmland" },
  { id: "plan", label: "Top-down site plan", text: "straight top-down satellite-style site plan view of the development, true north up, crisp roofs, roads and planting", lighting: "noon", environment: "keep" },
];

export const AERIAL_LOOKS: { id: string; label: string; lighting?: string }[] = [
  { id: "default", label: "Day" },
  { id: "golden", label: "Golden hour", lighting: "time:17:30" },
  { id: "blue", label: "Blue hour", lighting: "blue-hour" },
  { id: "overcast", label: "Overcast", lighting: "overcast" },
];

// ---------- Build ----------

export interface LibItem extends Preset {
  /** style id, "featured" for the hand-written presets */
  styleId: string;
  /** building type, room or development type */
  subjectId: string;
  group?: string;
  colors: string[];
}

let cache: LibItem[] | null = null;

export function libraryItems(): LibItem[] {
  if (cache) return cache;
  const out: LibItem[] = [];
  for (const p of BUILT_IN_PRESETS) {
    out.push({ ...p, builtIn: true, styleId: "featured", subjectId: p.projectType === "sketch" ? "sketch" : "featured", colors: [] });
  }
  for (const s of EXT_STYLES) {
    for (const b of EXT_TYPES) {
      out.push({
        id: `ext-${b.id}-${s.id}`,
        name: `${s.label} ${b.label.toLowerCase()}`,
        projectType: "exterior",
        lighting: b.lighting,
        environment: b.environment,
        style: `${b.text}, ${s.text}`,
        builtIn: true,
        styleId: s.id,
        subjectId: b.id,
        colors: s.colors,
      });
    }
  }
  for (const r of ROOMS) {
    for (const s of INT_STYLES) {
      out.push({
        id: `int-${r.id}-${s.id}`,
        name: `${r.label}, ${s.label}`,
        projectType: "interior",
        lighting: r.lighting,
        environment: r.environment,
        style: `${r.text}; ${s.text}`,
        builtIn: true,
        styleId: s.id,
        subjectId: r.id,
        group: r.group,
        colors: s.colors,
      });
    }
  }
  for (const a of AERIAL_TYPES) {
    for (const l of AERIAL_LOOKS) {
      out.push({
        id: `air-${a.id}-${l.id}`,
        name: l.id === "default" ? a.label : `${a.label}, ${l.label.toLowerCase()}`,
        projectType: "aerial",
        lighting: l.lighting ?? a.lighting,
        environment: a.environment,
        style: a.text,
        builtIn: true,
        styleId: l.id,
        subjectId: a.id,
        colors: [],
      });
    }
  }
  cache = out;
  return out;
}

export function findLibraryItem(id: string): LibItem | undefined {
  return libraryItems().find((x) => x.id === id);
}

/** Search words, lower case, commas and extra spaces dropped. */
export function searchWords(query: string): string[] {
  return query.toLowerCase().split(/[\s,;/]+/).filter(Boolean);
}

/** True when every word appears somewhere in the text, in any order. */
export function matchesWords(text: string, words: string[]): boolean {
  const t = text.toLowerCase();
  return words.every((w) => t.includes(w));
}

/** Library items for one tab and filter; "all" means no filter. */
export function filterLibrary(type: ProjectType, styleId: string, subjectId: string, query = ""): LibItem[] {
  const words = searchWords(query);
  return libraryItems().filter((x) => {
    if (words.length) return matchesWords(`${x.name} ${x.style}`, words);
    if (x.projectType !== type) return false;
    if (styleId !== "all" && x.styleId !== styleId) return false;
    if (subjectId !== "all" && x.subjectId !== subjectId) return false;
    return true;
  });
}
