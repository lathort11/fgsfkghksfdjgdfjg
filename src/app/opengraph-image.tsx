import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          background: "#070708",
          color: "#f4f1ea",
          padding: "72px",
        }}
      >
        <div style={{ display: "flex", fontSize: 22, letterSpacing: 8, color: "#a39cf0" }}>LIVKAMARKET</div>
        <div style={{ display: "flex", marginTop: 18, fontSize: 64, lineHeight: 1.05, maxWidth: 860 }}>
          Доступ к моделям. Оплата криптой.
        </div>
        <div style={{ display: "flex", marginTop: 22, fontSize: 24, color: "#b7b1a6" }}>
          Gemini · ChatGPT · Grok · API
        </div>
      </div>
    ),
    size
  );
}
