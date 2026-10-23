// Interface language. Prompts sent to the AI always stay in English; only
// the panel's own labels change. The Khmer wording should be checked by a
// native speaker before release.

export type Lang = "en" | "km";

let lang: Lang = "en";

export function setLang(l: Lang): void {
  lang = l;
  document.documentElement.lang = l === "km" ? "km" : "en";
}

export function getLang(): Lang {
  return lang;
}

const KM: Record<string, string> = {
  Render: "រេនឌ័រ",
  Edit: "កែសម្រួល",
  Lights: "ភ្លើង",
  Mirror: "កញ្ចក់",
  History: "ប្រវត្តិ",
  Settings: "ការកំណត់",
  Customise: "ប្ដូរតាមចិត្ត",
  Frame: "ស៊ុមរូប",
  Scene: "ប្រភេទទិដ្ឋភាព",
  Exterior: "ខាងក្រៅ",
  Interior: "ខាងក្នុង",
  Aerial: "ពីលើអាកាស",
  Sketch: "គំនូរព្រាង",
  Geometry: "ធរណីមាត្រ",
  Environment: "បរិយាកាស",
  Surroundings: "ទីតាំងជុំវិញ",
  "Dynamic prompts": "Prompt ថាមវន្ត",
  "Style preset": "គំរូរចនាបថ",
  "Materials and style": "សម្ភារៈ និងរចនាបថ",
  "Notes for this view": "កំណត់ចំណាំសម្រាប់ទិដ្ឋភាពនេះ",
  Advanced: "កម្រិតខ្ពស់",
  "Render again": "រេនឌ័រម្ដងទៀត",
  "Rendering...": "កំពុងរេនឌ័រ...",
  "Capture view": "ថតទិដ្ឋភាព",
  Recapture: "ថតម្ដងទៀត",
  Upload: "ផ្ទុកឡើង",
  "Save to model folder": "រក្សាទុកក្នុងថតម៉ូដែល",
  Download: "ទាញយក",
  "Show in SketchUp": "បង្ហាញក្នុង SketchUp",
  "Send line drawing to hold geometry": "ផ្ញើគំនូរបន្ទាត់ ដើម្បីរក្សាធរណីមាត្រ",
  "Match to line drawing": "កម្រិតតាមគំនូរបន្ទាត់",
  "Choose site context": "ជ្រើសទីតាំងជុំវិញ",
  "Site context": "ទីតាំងជុំវិញ",
  "Keep as modelled": "រក្សាដូចម៉ូដែល",
  "Apply and close": "អនុវត្ត និងបិទ",
  Apply: "អនុវត្ត",
  Reset: "កំណត់ឡើងវិញ",
  Done: "រួចរាល់",
  Add: "បន្ថែម",
  "Clear all": "សម្អាតទាំងអស់",
  "Bring result back": "យកលទ្ធផលមកវិញ",
  "AI backend": "ម៉ាស៊ីន AI",
  Theme: "រូបរាង",
  Dark: "ងងឹត",
  Light: "ភ្លឺ",
  "Accent colour": "ពណ៌សំខាន់",
  Font: "ពុម្ពអក្សរ",
  Language: "ភាសា",
  "Place spotlights": "ដាក់ភ្លើងស្ប៉ត",
  "Add LED to selected edges": "ដាក់ LED លើគែមដែលបានជ្រើស",
  Spotlight: "ភ្លើងស្ប៉ត",
  "LED strip": "ខ្សែ LED",
  Intensity: "កម្លាំងពន្លឺ",
  "Change lighting": "ប្ដូរពន្លឺ",
  "Spot edit": "កែតំបន់",
};

/** The label in the current language, falling back to English. */
export function t(en: string): string {
  return lang === "km" ? KM[en] ?? en : en;
}
