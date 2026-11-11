// Named render presets. Built-in ones ship with the app; user presets are
// saved through the host (browser storage or SketchUp preferences).

import type { Preset } from "./types";

export const BUILT_IN_PRESETS: Preset[] = [
  {
    id: "borey-villa-dusk",
    name: "Borey villa, blue hour",
    projectType: "exterior",
    lighting: "blue-hour",
    environment: "borey",
    style:
      "two-storey reinforced concrete villa, smooth white render, dark grey aluminium window frames, clear glass, flat concrete roof with deep overhangs, timber vertical louvers on the west side, concrete paver driveway",
  },
  {
    id: "shophouse-row-day",
    name: "Shophouse row, morning",
    projectType: "exterior",
    lighting: "morning",
    environment: "pp-street",
    style:
      "row of four-storey shophouses, painted render facades in muted colours, steel roller shutters at ground floor, balconies with simple steel railings, air-conditioning units, signage boards left blank",
  },
  {
    id: "new-khmer-civic",
    name: "New Khmer civic building",
    projectType: "exterior",
    lighting: "afternoon",
    environment: "tropical-garden",
    style:
      "board-formed exposed concrete, deep sun-shading fins, raised ground floor on pilotis, large sheltered verandas, laterite stone plinth, reflecting pool in front",
  },
  {
    id: "condo-tower-noon",
    name: "Condo tower, midday",
    projectType: "exterior",
    lighting: "noon",
    environment: "pp-street",
    style:
      "high-rise residential tower, low-iron glass with light grey tint, white aluminium fins, recessed balconies with planters, podium with retail at street level",
  },
  {
    id: "resort-pavilion",
    name: "Resort pavilion, coast",
    projectType: "exterior",
    lighting: "afternoon",
    environment: "beach",
    style:
      "open-sided timber pavilion, tropical hardwood columns and beams, steep clay tile roof, polished concrete floor, rattan furniture, linen curtains",
  },
  {
    id: "masterplan-aerial",
    name: "Masterplan aerial",
    projectType: "aerial",
    lighting: "morning",
    environment: "keep",
    style:
      "landscaped masterplan, asphalt roads with white markings, concrete footpaths, street trees along every road, retention pond with planted edges, low-rise housing with grey and terracotta roofs",
  },
  {
    id: "living-room-warm",
    name: "Living room, warm timber",
    projectType: "interior",
    lighting: "interior-day",
    environment: "keep",
    style:
      "light oak timber floor, off-white painted walls, walnut joinery with flush handles, linen sofa, terrazzo coffee table, ceiling fan, sheer curtains",
  },
  {
    id: "condo-lobby-evening",
    name: "Condo lobby, evening",
    projectType: "interior",
    lighting: "interior-evening",
    environment: "keep",
    style:
      "double-height lobby, honed travertine floor, fluted timber wall panels, brushed brass details, cove lighting at 2700K, large indoor plants",
  },
  {
    id: "cafe-industrial",
    name: "Cafe, concrete and timber",
    projectType: "interior",
    lighting: "interior-day",
    environment: "keep",
    style:
      "polished concrete floor, exposed concrete ceiling with black steel trusses, recycled timber counter, cement tiles behind the bar, pendant lights, rattan chairs",
  },
  {
    id: "sketch-to-photo",
    name: "iPad sketch to photo",
    projectType: "sketch",
    lighting: "morning",
    environment: "tropical-garden",
    style:
      "materials as suggested by the sketch: white render, timber, glass and local stone; keep every line of the sketch as a real built edge",
  },
  {
    id: "twin-villa-golden",
    name: "Twin villa, golden hour",
    projectType: "exterior",
    lighting: "time:17:30",
    environment: "borey",
    style:
      "pair of mirrored two-storey twin villas sharing a party wall, white and warm grey render, dark grey concrete roof tiles, aluminium windows with clear glass, small front lawn, steel sliding gate",
  },
  {
    id: "link-house-overcast",
    name: "Link houses, overcast",
    projectType: "exterior",
    lighting: "overcast",
    environment: "borey",
    style:
      "row of three-storey link houses, ground-floor carports with steel roller gates, balconies with glass balustrades, light grey render with timber-look aluminium battens, flat roof with parapet",
  },
  {
    id: "office-blue-hour",
    name: "Office tower, blue hour",
    projectType: "exterior",
    lighting: "blue-hour",
    environment: "boulevard",
    style:
      "mid-rise office building, unitised curtain wall in low-iron glass with grey aluminium mullions, vertical sun fins on the west facade, lit office floors, granite-clad lobby at ground floor",
  },
  {
    id: "boutique-hotel-night",
    name: "Boutique hotel, night",
    projectType: "exterior",
    lighting: "night",
    environment: "bkk1",
    style:
      "five-storey boutique hotel, white concrete breeze block screen facade, warm 2700K uplights washing the screen, timber-framed entrance canopy, planted balconies",
  },
  {
    id: "warehouse-noon",
    name: "Warehouse, midday",
    projectType: "exterior",
    lighting: "noon",
    environment: "mp-suburb",
    style:
      "single-storey steel portal frame warehouse, profiled metal cladding in light grey, translucent roof sheets, loading docks with roller doors, concrete hardstand with painted line markings",
  },
  {
    id: "bedroom-soft",
    name: "Master bedroom, daylight",
    projectType: "interior",
    lighting: "interior-day",
    environment: "view-garden",
    style:
      "light oak floor, upholstered bed with white linen, walnut bedside tables, full-height sheer curtains, ceiling fan, warm 3000K wall lights",
  },
  {
    id: "kitchen-white-oak",
    name: "Kitchen, white and oak",
    projectType: "interior",
    lighting: "interior-day",
    environment: "view-garden",
    style:
      "white matte flat-panel cabinets, light oak open shelves, white quartz worktop, terrazzo floor tiles, brushed steel tapware, three pendant lights over the island",
  },
  {
    id: "bathroom-stone",
    name: "Bathroom, stone and teak",
    projectType: "interior",
    lighting: "interior-evening",
    environment: "keep",
    style:
      "large-format grey stone tiles, teak vanity with a white vessel basin, frameless glass shower screen, matte black tapware, backlit mirror at 3000K",
  },
  {
    id: "office-open-plan",
    name: "Open-plan office",
    projectType: "interior",
    lighting: "interior-day",
    environment: "view-city",
    style:
      "grey carpet tiles, white workstations with oak edges, acoustic felt ceiling baffles, glass-walled meeting rooms, indoor plants, linear LED lights at 4000K",
  },
  {
    id: "restaurant-khmer",
    name: "Restaurant, Khmer modern",
    projectType: "interior",
    lighting: "interior-evening",
    environment: "keep",
    style:
      "dark hardwood screens with Khmer pattern cut-outs, rattan pendant lamps, laterite feature wall, polished concrete floor, silk cushions in deep red and gold",
  },
  {
    id: "hotel-suite",
    name: "Hotel suite, evening",
    projectType: "interior",
    lighting: "interior-evening",
    environment: "view-city",
    style:
      "herringbone oak floor, marble-topped desk, fluted timber headboard wall, velvet armchair, brass reading lamps, city view through floor-to-ceiling glass",
  },
  {
    id: "showroom-retail",
    name: "Retail showroom",
    projectType: "interior",
    lighting: "interior-day",
    environment: "pp-street",
    style:
      "white walls, polished concrete floor, black steel display shelving, track spotlights at 3500K, full-height shopfront glazing",
  },
  {
    id: "borey-masterplan",
    name: "Borey masterplan, morning",
    projectType: "aerial",
    lighting: "morning",
    environment: "mp-suburb",
    style:
      "gated borey layout: grid of concrete roads, rows of link houses and villas with dark grey roofs, central park and clubhouse, retention pond, perimeter wall with a main gate",
  },
  {
    id: "mixed-use-district",
    name: "Mixed-use district, midday",
    projectType: "aerial",
    lighting: "noon",
    environment: "mp-city",
    style:
      "mixed-use district: retail podiums, residential towers, landscaped plaza, tree-lined boulevards, basement car park ramps",
  },
  {
    id: "resort-masterplan",
    name: "Resort masterplan, coast",
    projectType: "aerial",
    lighting: "afternoon",
    environment: "beach",
    style:
      "beachfront resort: pool villas with clay tile roofs, central lagoon pool, timber boardwalks, coconut palms, beach club pavilion",
  },
  {
    id: "industrial-park",
    name: "Industrial park",
    projectType: "aerial",
    lighting: "noon",
    environment: "mp-farmland",
    style:
      "industrial park: large steel-roofed factory sheds, wide service roads, truck parking, drainage canals, worker housing blocks",
  },
  {
    id: "riverside-development",
    name: "Riverside development, golden hour",
    projectType: "aerial",
    lighting: "time:17:30",
    environment: "mp-river",
    style:
      "riverside development: public promenade, mid-rise apartments stepping down to the river, small marina, green buffer along the bank",
  },
  {
    id: "site-plan-top",
    name: "Satellite plan view",
    projectType: "aerial",
    lighting: "noon",
    environment: "keep",
    style:
      "straight-down plan view like a satellite photo: crisp roads, roofs, trees and shadows, no perspective, north at the top",
  },
  {
    id: "township-blue-hour",
    name: "Township, blue hour",
    projectType: "aerial",
    lighting: "blue-hour",
    environment: "mp-suburb",
    style:
      "new township at dusk: street lights on, lit windows, main avenue with warm street lighting, landscaped roundabouts",
  },
  {
    id: "school-campus",
    name: "School campus",
    projectType: "aerial",
    lighting: "morning",
    environment: "newdistrict",
    style:
      "school campus: two- and three-storey classroom blocks around shaded courtyards, sports field, covered walkways, large rain trees",
  },
  {
    id: "eco-village",
    name: "Eco village, rice fields",
    projectType: "aerial",
    lighting: "morning",
    environment: "rural",
    style:
      "low-density eco village: timber houses on stilts with clay tile roofs, rice paddies, sugar palms, raised timber walkways",
  },
  {
    id: "sketch-villa-dusk",
    name: "Villa sketch, blue hour",
    projectType: "sketch",
    lighting: "blue-hour",
    environment: "borey",
    style:
      "villa drawn in the sketch: white render, dark aluminium windows, timber front door, warm lights on inside, every sketched line kept as a built edge",
  },
  {
    id: "sketch-interior",
    name: "Interior sketch to photo",
    projectType: "sketch",
    lighting: "interior-day",
    environment: "keep",
    style:
      "the room drawn in the sketch: light timber floor, white walls, simple modern furniture placed where it is drawn",
  },
  {
    id: "sketch-watercolour",
    name: "Watercolour to photo",
    projectType: "sketch",
    lighting: "morning",
    environment: "tropical-garden",
    style:
      "a loose watercolour sketch: turn the colours into real materials, keep the composition and every building edge",
  },
  {
    id: "massing-to-photo",
    name: "Massing model to photo",
    projectType: "sketch",
    lighting: "afternoon",
    environment: "pp-street",
    style:
      "a white massing model: give it real materials, fair-faced concrete, glass and grey metal panels, windows where the model has openings",
  },
  {
    id: "elevation-to-photo",
    name: "Elevation to photo",
    projectType: "sketch",
    lighting: "noon",
    environment: "keep",
    style:
      "a flat elevation drawing: render it as a straight-on photograph of the facade, no perspective, materials as drawn",
  },
  {
    id: "sketch-kitchen",
    name: "Kitchen sketch to photo",
    projectType: "sketch",
    lighting: "interior-day",
    environment: "keep",
    style:
      "the kitchen drawn in the sketch: oak and white cabinets, stone worktop, pendant lights, appliances where they are drawn",
  },
  {
    id: "sketch-shophouse",
    name: "Shophouse sketch to photo",
    projectType: "sketch",
    lighting: "morning",
    environment: "pp-street",
    style:
      "the shophouse drawn in the sketch: painted render, steel shutters at ground floor, balconies with simple railings",
  },
  {
    id: "sketch-landscape",
    name: "Garden sketch to photo",
    projectType: "sketch",
    lighting: "afternoon",
    environment: "tropical-garden",
    style:
      "the garden drawn in the sketch: lawn, stepping stones, tropical planting and trees exactly where they are drawn",
  },
  {
    id: "sketch-new-khmer",
    name: "New Khmer marker sketch",
    projectType: "sketch",
    lighting: "afternoon",
    environment: "tropical-garden",
    style:
      "a marker sketch in the New Khmer style: board-formed concrete, deep sun-shading fins, raised floor on pilotis, verandas",
  },
];

export function newPresetId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${slug || "preset"}-${Date.now().toString(36)}`;
}

/** Checks an imported JSON value and returns the presets that are valid. */
export function parsePresetFile(value: unknown): Preset[] {
  const list = Array.isArray(value)
    ? value
    : value && typeof value === "object" && Array.isArray((value as { presets?: unknown }).presets)
      ? (value as { presets: unknown[] }).presets
      : [];
  const types = ["exterior", "interior", "aerial", "sketch"];
  const out: Preset[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const p = raw as Record<string, unknown>;
    if (typeof p.name !== "string" || !types.includes(p.projectType as string)) continue;
    out.push({
      id: typeof p.id === "string" ? p.id : newPresetId(p.name),
      name: p.name,
      projectType: p.projectType as Preset["projectType"],
      lighting: typeof p.lighting === "string" ? p.lighting : "morning",
      environment: typeof p.environment === "string" ? p.environment : "keep",
      style: typeof p.style === "string" ? p.style : "",
    });
  }
  return out;
}
