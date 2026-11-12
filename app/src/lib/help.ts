// Help videos shown in Settings > Help. Each opens YouTube; swap a search link for a
// specific video URL any time (keep the label).

export interface HelpVideo {
  label: string;
  sub: string;
  url: string;
}

const yt = (q: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

export const HELP_VIDEOS: HelpVideo[] = [
  { label: "Sign up on Kie.ai and get an API key", sub: "Account, credit, API Keys page", url: yt("kie.ai how to get api key") },
  { label: "Export a clean view from SketchUp", sub: "Styles, shadows, Export 2D Graphic", url: yt("sketchup export 2d graphic for rendering") },
  { label: "Edit an image in Gemini (for Prompt Copy)", sub: "Paste the image, paste the prompt, download", url: yt("gemini nano banana edit image tutorial") },
  { label: "Write better render prompts", sub: "Materials, light and camera words", url: yt("ai architectural render prompt tips nano banana") },
];
