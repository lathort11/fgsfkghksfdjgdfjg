import { NextResponse } from "next/server";
import { getPublishedNews } from "@/lib/news";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const list = await getPublishedNews();
    return NextResponse.json({ ok: true, news: list }, { headers: { "Cache-Control": "public, s-maxage=30" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: "NEWS_FETCH_FAILED" }, { status: 500 });
  }
}
