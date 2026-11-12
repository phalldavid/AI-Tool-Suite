// Khmer for the interface. Prompts sent to the AI always stay in English; only what
// people read on screen changes. Text is swapped where it is shown (text, placeholders,
// tooltips, labels), so every screen is covered without changing each component.
// Exact matches first, then a few patterns for text with numbers in it.
// The Khmer wording should be checked by a native speaker; edit KM below to fix it.

export type Lang = "en" | "km";

export const KM: Record<string, string> = {
  // header, tabs
  Render: "រេនឌ័រ",
  Edit: "កែសម្រួល",
  History: "ប្រវត្តិ",
  Settings: "ការកំណត់",
  Customise: "ប្ដូរតាមចិត្ត",
  "Search 932 styles, light, places, actions": "ស្វែងរករចនាបថ ពន្លឺ ទីកន្លែង និងសកម្មភាព",
  "Search looks, light, places, actions": "ស្វែងរករចនាបថ ពន្លឺ ទីកន្លែង សកម្មភាព",
  "Switch to night mode": "ប្ដូរទៅរបៀបយប់",
  "Switch to day mode": "ប្ដូរទៅរបៀបថ្ងៃ",
  "Night mode": "របៀបយប់",
  "Day mode": "របៀបថ្ងៃ",
  "Test mode": "របៀបសាកល្បង",
  // render tab
  "Make it real.": "ធ្វើឲ្យដូចពិត",
  "Pick a look. Your design stays exactly as modelled.": "ជ្រើសរចនាបថ។ ការរចនារបស់អ្នកនៅដដែលដូចក្នុងម៉ូដែល។",
  Scene: "ប្រភេទទិដ្ឋភាព",
  Exterior: "ខាងក្រៅ",
  Interior: "ខាងក្នុង",
  Aerial: "ពីលើអាកាស",
  Sketch: "គំនូរព្រាង",
  Look: "រចនាបថ",
  Light: "ពន្លឺ",
  Environment: "បរិយាកាស",
  "Additional Notes": "កំណត់ចំណាំបន្ថែម",
  Advanced: "កម្រិតខ្ពស់",
  "Browse all": "មើលទាំងអស់",
  "As modelled": "ដូចក្នុងម៉ូដែល",
  "Geometry locked": "ទម្រង់អគារត្រូវបានចាក់សោ",
  "Your view": "ទិដ្ឋភាពរបស់អ្នក",
  "Drop, paste or capture your view": "ទម្លាក់ បិទភ្ជាប់ ឬថតទិដ្ឋភាពរបស់អ្នក",
  "Paste from clipboard": "បិទភ្ជាប់ពីក្ដារតម្បៀត",
  "Upload file": "ផ្ទុកឯកសារឡើង",
  Paste: "បិទភ្ជាប់",
  Clear: "សម្អាត",
  Upload: "ផ្ទុកឡើង",
  Replace: "ជំនួស",
  View: "ទិដ្ឋភាព",
  "Recent renders": "រូបរេនឌ័រថ្មីៗ",
  "See all": "មើលទាំងអស់",
  Hide: "លាក់",
  "Set exact direction": "កំណត់ទិសពិតប្រាកដ",
  "Exact direction on": "ទិសពិតប្រាកដ បើក",
  Morning: "ព្រឹក",
  Midday: "ថ្ងៃត្រង់",
  Afternoon: "រសៀល",
  "Blue hour": "ម៉ោងខៀវ",
  Monsoon: "រដូវវស្សា",
  Night: "យប់",
  "Lights only": "តែភ្លើងប៉ុណ្ណោះ",
  "Overcast, wet": "មេឃស្រទុំ សើម",
  "Interior lighting": "ពន្លឺខាងក្នុង",
  "Exterior lighting": "ពន្លឺខាងក្រៅ",
  "Window light, ceiling, cove and pendant fittings, indoor and outdoor exposure balanced.": "ពន្លឺបង្អួច ភ្លើងពិដាន ភ្លើងកូវ និងភ្លើងព្យួរ ពន្លឺក្នុងក្រៅមានតុល្យភាព។",
  "Sun and sky, facade and glass reflections, landscape and path lights.": "ព្រះអាទិត្យ និងមេឃ ការឆ្លុះលើជញ្ជាំង និងកញ្ចក់ ភ្លើងសួន និងផ្លូវដើរ។",
  "Interior fittings": "ភ្លើងខាងក្នុង",
  "Exterior fittings": "ភ្លើងខាងក្រៅ",
  On: "បើក",
  Off: "បិទ",
  "Ceiling light": "ភ្លើងពិដាន",
  "Cabinet light": "ភ្លើងទូ",
  "LED strip": "ខ្សែភ្លើង LED",
  "Cove light": "ភ្លើងកូវ",
  Pendant: "ភ្លើងព្យួរ",
  "Wall light": "ភ្លើងជញ្ជាំង",
  "Facade wash": "ភ្លើងបំភ្លឺជញ្ជាំងខាងមុខ",
  "Soffit downlights": "ភ្លើងក្រោមចំណាំងដំបូល",
  "Landscape uplights": "ភ្លើងបំភ្លឺដើមឈើ",
  "Pathway lights": "ភ្លើងផ្លូវដើរ",
  "Wall lights": "ភ្លើងជញ្ជាំង",
  "Pool and water": "អាងទឹក និងទឹក",
  "Warm white": "ពណ៌សក្ដៅ",
  "Soft white": "ពណ៌សទន់",
  "Neutral white": "ពណ៌សធម្មតា",
  "Cool white": "ពណ៌សត្រជាក់",
  Daylight: "ពន្លឺថ្ងៃ",
  Brightness: "ពន្លឺខ្លាំងខ្សោយ",
  Subtle: "ស្រាល",
  Medium: "មធ្យម",
  Bright: "ខ្លាំង",
  "Other light, e.g. lanterns on the terrace": "ភ្លើងផ្សេងទៀត ឧ. គោមនៅរានហាល",
  "Change": "ប្ដូរ",
  "to glass": "ទៅជាកញ្ចក់",
  "Cambodian plates": "ស្លាកលេខខ្មែរ",
  "Ground mist": "អ័ព្ទលើដី",
  "Orange to LED": "ពណ៌ទឹកក្រូចទៅជា LED",
  "Blue to water": "ពណ៌ខៀវទៅជាទឹក",
  "Clean site": "ការដ្ឋានស្អាត",
  "Add trees": "បន្ថែមដើមឈើ",
  "Add shrubs": "បន្ថែមគុម្ពោត",
  "Add ground cover": "បន្ថែមស្មៅគ្របដី",
  "Anything else, in English or Khmer, e.g. two motorbikes by the gate": "អ្វីផ្សេងទៀត ជាភាសាខ្មែរ ឬអង់គ្លេស ឧ. ម៉ូតូពីរនៅមាត់របង",
  "Save button": "រក្សាទុកប៊ូតុង",
  Cancel: "បោះបង់",
  "Clear all dynamic prompts": "សម្អាត Prompt ថាមវន្តទាំងអស់",
  "Use the exact sun direction from the Sun screen": "ប្រើទិសព្រះអាទិត្យពិតប្រាកដពីអេក្រង់ព្រះអាទិត្យ",
  Photo: "រូបថត",
  "3D render": "រេនឌ័រ 3D",
  "You'll review the prompt and cost first": "អ្នកនឹងពិនិត្យ Prompt និងតម្លៃជាមុនសិន",
  // model picker
  Recommended: "ណែនាំ",
  "Best quality": "គុណភាពល្អបំផុត",
  "Fast and low cost": "លឿន និងថោក",
  "Signs and lettering": "ស្លាកសញ្ញា និងអក្សរ",
  "Other models": "ម៉ូដែលផ្សេងទៀត",
  "Prompt Copy": "ចម្លង Prompt",
  "Get the prompt, render in Gemini or ChatGPT yourself": "យក Prompt ទៅរេនឌ័រក្នុង Gemini ឬ ChatGPT ដោយខ្លួនឯង",
  "Sample image, no AI, nothing spent": "រូបគំរូ គ្មាន AI មិនចំណាយអ្វីទេ",
  "No AI, free": "គ្មាន AI ឥតគិតថ្លៃ",
  "Free, paste into Gemini or ChatGPT": "ឥតគិតថ្លៃ បិទភ្ជាប់ក្នុង Gemini ឬ ChatGPT",
  Free: "ឥតគិតថ្លៃ",
  Default: "លំនាំដើម",
  "Get prompt · free": "យក Prompt · ឥតគិតថ្លៃ",
  // edit tab
  Compare: "ប្រៀបធៀប",
  "Spot edit": "កែតំបន់",
  Relight: "ប្ដូរពន្លឺ",
  "Multi-View": "ទិដ្ឋភាពច្រើន",
  "Style copy": "ចម្លងរចនាបថ",
  "Try again": "សាកម្ដងទៀត",
  Download: "ទាញយក",
  Versions: "កំណែ",
  Views: "ទិដ្ឋភាព",
  Before: "មុន",
  After: "ក្រោយ",
  "Drag to compare": "អូសដើម្បីប្រៀបធៀប",
  "Drop or paste a render to edit": "ទម្លាក់ ឬបិទភ្ជាប់រូបរេនឌ័រដើម្បីកែ",
  "Upload a render": "ផ្ទុករូបរេនឌ័រឡើង",
  "Master prompt": "Prompt មេ",
  Copy: "ចម្លង",
  Brush: "ជក់",
  Rectangle: "ចតុកោណ",
  Lasso: "ខ្សែគូរ",
  Eraser: "ជ័រលុប",
  "Add zone": "បន្ថែមតំបន់",
  painted: "បានគូរ",
  "not painted": "មិនទាន់គូរ",
  "Tap a quick action below, or type": "ចុចសកម្មភាពរហ័សខាងក្រោម ឬវាយបញ្ចូល",
  Lighting: "ពន្លឺ",
  Decor: "តុបតែង",
  Material: "សម្ភារៈ",
  "Add LED": "បន្ថែម LED",
  "Remove LED": "ដក LED",
  "Add LED strip": "បន្ថែមខ្សែ LED",
  "Remove LED strip": "ដកខ្សែ LED",
  "Add cove light": "បន្ថែមភ្លើងកូវ",
  "Remove cove light": "ដកភ្លើងកូវ",
  "Lights on": "បើកភ្លើង",
  "Lights off": "បិទភ្លើង",
  "Restore original": "ស្ដារដើមវិញ",
  "Add decorations": "បន្ថែមគ្រឿងតុបតែង",
  "Remove decorations": "ដកគ្រឿងតុបតែង",
  "Add furniture": "បន្ថែមគ្រឿងសង្ហារឹម",
  "Remove furniture": "ដកគ្រឿងសង្ហារឹម",
  "Add plants": "បន្ថែមរុក្ខជាតិ",
  "Remove plants": "ដករុក្ខជាតិ",
  "Add people": "បន្ថែមមនុស្ស",
  "Remove people": "ដកមនុស្ស",
  "Selected area": "តំបន់ដែលបានជ្រើស",
  Wall: "ជញ្ជាំង",
  Floor: "កម្រាល",
  Ceiling: "ពិដាន",
  Add: "បន្ថែម",
  "Day to night": "ថ្ងៃទៅយប់",
  "Night to day": "យប់ទៅថ្ងៃ",
  "Better lighting": "ពន្លឺល្អជាងមុន",
  "More realism": "ដូចពិតជាងមុន",
  "Better materials": "សម្ភារៈល្អជាងមុន",
  "Better landscaping": "សួនច្បារល្អជាងមុន",
  "Monsoon rain": "ភ្លៀងរដូវវស្សា",
  Overcast: "មេឃស្រទុំ",
  "Warm and inviting": "កក់ក្ដៅ និងទាក់ទាញ",
  "Calm and serene": "ស្ងប់ស្ងាត់",
  Undo: "មិនធ្វើវិញ",
  "Clear all": "សម្អាតទាំងអស់",
  "Get edit prompt + painted image": "យក Prompt កែ + រូបដែលបានគូរ",
  "Same building and camera, new time of day.": "អគារ និងកាមេរ៉ាដដែល ម៉ោងថ្មី។",
  "Reference Style Copy": "ចម្លងរចនាបថពីរូបគំរូ",
  "Base architecture": "ស្ថាបត្យកម្មមូលដ្ឋាន",
  "Style reference": "រូបគំរូរចនាបថ",
  "Look source": "ប្រភពរចនាបថ",
  "New view": "ទិដ្ឋភាពថ្មី",
  "My view": "ទិដ្ឋភាពរបស់ខ្ញុំ",
  "Move camera": "ផ្លាស់កាមេរ៉ា",
  "Lighting for": "ពន្លឺសម្រាប់",
  "Time of day and sun": "ម៉ោង និងព្រះអាទិត្យ",
  "From the reference": "ពីរូបគំរូ",
  "My sun dial": "នាឡិកាព្រះអាទិត្យរបស់ខ្ញុំ",
  "Eye level": "កម្ពស់ភ្នែក",
  "Wide angle": "មុំធំ",
  "Two-point": "ពីរចំណុច",
  "Low angle": "មុំទាប",
  Orbit: "បង្វិល",
  Tilt: "ទំនោរ",
  Lens: "កែវថត",
  Distance: "ចម្ងាយ",
  // sheets
  Done: "រួចរាល់",
  Use: "ប្រើ",
  Back: "ថយក្រោយ",
  Close: "បិទ",
  Search: "ស្វែងរក",
  Featured: "ពិសេស",
  Starred: "បានដាក់ផ្កាយ",
  Pictures: "រូបភាព",
  "Your own words (optional), e.g. darker timber, more glass": "ពាក្យរបស់អ្នក (បើចង់) ឧ. ឈើពណ៌ចាស់ កញ្ចក់ច្រើន",
  "Your own words (optional), e.g. next to a pagoda": "ពាក្យរបស់អ្នក (បើចង់) ឧ. ក្បែរវត្ត",
  "Search, e.g. river, rice field, Kampot": "ស្វែងរក ឧ. ទន្លេ វាលស្រែ កំពត",
  "Search, e.g. kitchen, shophouse, Khmer": "ស្វែងរក ឧ. ផ្ទះបាយ ផ្ទះល្វែង ខ្មែរ",
  "Cambodian city": "ទីក្រុងកម្ពុជា",
  "Borey and gated estates": "បុរី",
  "Natural landscape": "ទេសភាពធម្មជាតិ",
  "Cambodian places": "ទីកន្លែងនៅកម្ពុជា",
  "Interior context": "ទិដ្ឋភាពពីខាងក្នុង",
  "Aerial view": "ទិដ្ឋភាពពីលើអាកាស",
  "Final prompt": "Prompt ចុងក្រោយ",
  Cost: "តម្លៃ",
  "How renders are made": "របៀបរេនឌ័រ",
  "Kie.ai API key": "សោ API Kie.ai",
  "Get a key": "យកសោ",
  Developer: "អ្នកអភិវឌ្ឍ",
  Unlock: "ដោះសោ",
  Accent: "ពណ៌សំខាន់",
  Font: "ពុម្ពអក្សរ",
  Theme: "ផ្ទៃ",
  Language: "ភាសា",
  Motion: "ចលនា",
  Background: "ផ្ទៃខាងក្រោយ",
  Moving: "មានចលនា",
  Still: "នៅស្ងៀម",
  Plain: "ធម្មតា",
  Full: "ពេញ",
  Reduced: "តិច",
  Day: "ថ្ងៃ",
  Auto: "ស្វ័យប្រវត្តិ",
  Help: "ជំនួយ",
  "Show the tutorial again": "បង្ហាញការណែនាំម្ដងទៀត",
  Tutorial: "ការណែនាំ",
  "The one-minute tour of the app": "ការណែនាំកម្មវិធីរយៈពេលមួយនាទី",
  "Video tutorials on YouTube": "វីដេអូណែនាំនៅលើ YouTube",
  "Sign up on Kie.ai and get an API key": "ចុះឈ្មោះ Kie.ai និងយកសោ API",
  "Account, credit, API Keys page": "គណនី ទឹកប្រាក់ ទំព័រ API Keys",
  "Export a clean view from SketchUp": "នាំចេញទិដ្ឋភាពស្អាតពី SketchUp",
  "Styles, shadows, Export 2D Graphic": "Styles ស្រមោល Export 2D Graphic",
  "Edit an image in Gemini (for Prompt Copy)": "កែរូបក្នុង Gemini (សម្រាប់ចម្លង Prompt)",
  "Paste the image, paste the prompt, download": "បិទភ្ជាប់រូប បិទភ្ជាប់ Prompt ហើយទាញយក",
  "Write better render prompts": "សរសេរ Prompt រេនឌ័រឲ្យល្អជាងមុន",
  "Materials, light and camera words": "ពាក្យសម្រាប់សម្ភារៈ ពន្លឺ និងកាមេរ៉ា",
  "David's portfolio on Behance": "ស្នាដៃរបស់ David នៅលើ Behance",
  // messages
  "Image added. Pick a look and render.": "បានបញ្ចូលរូប។ ជ្រើសរចនាបថ ហើយរេនឌ័រ។",
  "Render ready": "រេនឌ័ររួចរាល់",
  "Prompt copied": "បានចម្លង Prompt",
  "Image ready to edit": "រូបរួចរាល់សម្រាប់កែ",
  "Image replaced": "បានជំនួសរូប",
  "Style reference added": "បានបញ្ចូលរូបគំរូរចនាបថ",
  "Render cancelled.": "បានបោះបង់ការរេនឌ័រ។",
  "Result saved to History": "បានរក្សាទុកលទ្ធផលក្នុងប្រវត្តិ",
  "Edit cleared. Your renders are still in History.": "បានសម្អាត។ រូបរេនឌ័ររបស់អ្នកនៅក្នុងប្រវត្តិនៅឡើយ។",
  "Developer mode on": "បានបើករបៀបអ្នកអភិវឌ្ឍ",
  // places
  "Tropical garden": "សួនត្រូពិច",
  "Phnom Penh street": "ផ្លូវភ្នំពេញ",
  "Inner-city side street": "ផ្លូវតូចក្នុងក្រុង",
  "Main boulevard": "មហាវិថី",
  "Near a local market": "ក្បែរផ្សារ",
  "New city district": "តំបន់ក្រុងថ្មី",
  "Borey estate street": "ផ្លូវក្នុងបុរី",
  "Borey main gate": "ខ្លោងទ្វារបុរី",
  "Row of villas": "ជួរវីឡា",
  "Estate park": "សួនក្នុងបុរី",
  "Rice fields": "វាលស្រែ",
  Riverside: "មាត់ទន្លេ",
  Lakeside: "មាត់បឹង",
  "Forest hills": "ភ្នំព្រៃ",
  Coast: "ឆ្នេរសមុទ្រ",
  "Khmer village": "ភូមិខ្មែរ",
  Courtyard: "ទីធ្លាកណ្ដាល",
  "Minimal landscape": "សួនបែបសាមញ្ញ",
  "Near a pagoda": "ក្បែរវត្ត",
  Mountain: "ភ្នំ",
  "Sisowath Quay": "មាត់ទន្លេស៊ីសុវត្ថិ",
  "Koh Pich": "កោះពេជ្រ",
  "Siem Reap": "សៀមរាប",
  "Kampot riverside": "មាត់ទន្លេកំពត",
  "Siem Reap Angkor": "អង្គរ សៀមរាប",
  "Sihanoukville coast": "ឆ្នេរក្រុងព្រះសីហនុ",
  "Phnom Penh metropolis": "រាជធានីភ្នំពេញ",
  "Mondulkiri highlands": "ខ្ពង់រាបមណ្ឌលគិរី",
  "Garden view": "ទិដ្ឋភាពសួន",
  "City view": "ទិដ្ឋភាពក្រុង",
  "River view": "ទិដ្ឋភាពទន្លេ",
  "Pool terrace": "រានអាងហែលទឹក",
  "Edge of farmland": "ជាប់វាលស្រែ",
  "Suburban fringe": "ជាយក្រុង",
  "Mekong bank": "មាត់ទន្លេមេគង្គ",
  "Dense city": "ក្រុងចង្អៀត",
  // tour
  Next: "បន្ទាប់",
  Skip: "រំលង",
  "Don't show this again": "កុំបង្ហាញម្ដងទៀត",
  "Choose your language": "ជ្រើសរើសភាសា",
};

/** Text with numbers or names in it. */
const PATTERNS: [RegExp, string][] = [
  [/^Render · (.+)$/, "រេនឌ័រ · $1"],
  [/^(\d+(?:\.\d+)?) credits$/, "$1 ក្រេឌីត"],
  [/^Apply edit · (.+)$/, "អនុវត្តការកែ · $1"],
  [/^Relight to (.+) · (.+)$/, "ប្ដូរពន្លឺទៅ $1 · $2"],
  [/^Copy the style · (.+)$/, "ចម្លងរចនាបថ · $1"],
  [/^Render this view · (.+)$/, "រេនឌ័រទិដ្ឋភាពនេះ · $1"],
  [/^Render (\d+) views · (.+)$/, "រេនឌ័រ $1 ទិដ្ឋភាព · $2"],
  [/^Render new camera · (.+)$/, "រេនឌ័រកាមេរ៉ាថ្មី · $1"],
  [/^Quick actions for Zone ([A-D])$/, "សកម្មភាពរហ័សសម្រាប់តំបន់ $1"],
  [/^Zone ([A-D])$/, "តំបន់ $1"],
  [/^(\d+) places$/, "$1 កន្លែង"],
  [/^(\d+) picked$/, "បានជ្រើស $1"],
  [/^(\d+) picked · (\d+) places$/, "បានជ្រើស $1 · $2 កន្លែង"],
  [/^Step (\d+) of (\d+)$/, "ជំហាន $1 នៃ $2"],
];

let lang: Lang = "en";
const original = new WeakMap<Node, string>();
const originalAttr = new WeakMap<Element, Record<string, string>>();
const ATTRS = ["placeholder", "title", "aria-label"];

export function translate(en: string): string | null {
  const s = en.trim();
  if (!s) return null;
  const hit = KM[s];
  if (hit) return en.replace(s, hit);
  for (const [re, to] of PATTERNS) if (re.test(s)) return en.replace(s, s.replace(re, to));
  return null;
}

/** For text built in code (toasts, tour). */
export function t(en: string): string {
  return lang === "km" ? translate(en) ?? en : en;
}

function doText(n: Text): void {
  const v = n.nodeValue ?? "";
  if (lang === "en") {
    const o = original.get(n);
    if (o !== undefined && v !== o && translate(o) === v) n.nodeValue = o;
    return;
  }
  const km = translate(v);
  if (km && km !== v) {
    original.set(n, v);
    n.nodeValue = km;
  }
}

function doAttrs(el: Element): void {
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (v === null) continue;
    const store = originalAttr.get(el) ?? {};
    if (lang === "en") {
      if (store[a] !== undefined && translate(store[a]) === v) el.setAttribute(a, store[a]);
      continue;
    }
    const km = translate(v);
    if (km && km !== v) {
      store[a] = v;
      originalAttr.set(el, store);
      el.setAttribute(a, km);
    }
  }
}

function walk(root: Node): void {
  if (root.nodeType === Node.TEXT_NODE) return doText(root as Text);
  if (!(root instanceof Element)) return;
  if (root.closest("textarea, .mono, [data-no-translate]")) return;
  doAttrs(root);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n instanceof Element && n.matches("textarea, script, style, .mono, [data-no-translate]") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) doText(n as Text);
    else doAttrs(n as Element);
  }
}

let started = false;

/** Watches the page and keeps every label in the chosen language. */
export function startTranslating(initial: Lang): void {
  lang = initial;
  if (started) return;
  started = true;
  walk(document.body);
  new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === "characterData") doText(m.target as Text);
      else if (m.type === "attributes") doAttrs(m.target as Element);
      else m.addedNodes.forEach(walk);
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}

export function setLanguage(l: Lang): void {
  if (l === lang) return;
  lang = l;
  walk(document.body);
}

export function currentLang(): Lang {
  return lang;
}
