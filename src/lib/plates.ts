/** Real studio photographs, not generated images. Pexels license. */
export const PLATES: Record<string, string> = {
  "gemini-pro-18": "/images/gemini.jpg",
  "chatgpt-pro": "/images/chatgpt.jpg",
  supergrok: "/images/grok.jpg",
  "antigravity-api": "/images/api.jpg",
};

export function plateFor(slug: string) {
  return PLATES[slug] ?? "/images/gemini.jpg";
}

export function plateFocus(_slug: string) {
  return "center";
}
