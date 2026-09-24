/** Real studio photographs, not generated images. Pexels license. */
export const PLATES: Record<string, string> = {
  "gemini-pro-18": "/gemini.png",
  "chatgpt-pro": "/chatgpt.png",
  supergrok: "/grok.png",
  "antigravity-api": "/api.png",
};

export function plateFor(slug: string) {
  return PLATES[slug] ?? "/gemini.png";
}

export function plateFocus(_slug: string) {
  return "center";
}
