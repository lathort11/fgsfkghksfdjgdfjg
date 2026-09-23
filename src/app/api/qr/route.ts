import QRCode from "qrcode";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const text = new URL(req.url).searchParams.get("text") ?? "";
  if (!text || text.length > 300) {
    return new Response("bad request", { status: 400 });
  }

  const svg = await QRCode.toString(text, {
    type: "svg",
    margin: 1,
    width: 320,
    errorCorrectionLevel: "M",
    color: { dark: "#ffffffff", light: "#00000000" },
  });

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
