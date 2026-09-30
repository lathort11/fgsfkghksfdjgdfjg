import {
  adminCreateNews,
  adminDeleteNews,
  adminToggleNewsPublish,
  adminUpdateNews,
  listAllNews,
} from "@/lib/news";
import { adminEnsure, adminFailure, requireAdmin } from "@/lib/admin-auth";
import { readBody } from "@/lib/wallet-security";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireAdmin(req, false);
    const data = await listAllNews();
    return Response.json({ ok: true, news: data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return adminFailure(error);
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin(req, true);
    const raw = await readBody(req);
    const action = String(raw.action ?? "");
    let result: unknown;

    switch (action) {
      case "create": {
        const title = String(raw.title ?? "").trim();
        const content = String(raw.content ?? "").trim();
        const tag = typeof raw.tag === "string" ? raw.tag.trim() : "Обновление";
        const isPinned = Boolean(raw.isPinned);
        const isPublished = Boolean(raw.isPublished);
        const authorName = typeof raw.authorName === "string" ? raw.authorName.trim() : "Администрация";
        result = await adminCreateNews(admin, { title, content, tag, isPinned, isPublished, authorName });
        break;
      }

      case "update": {
        const id = String(raw.id ?? "").trim();
        adminEnsure(id.length > 0, "ID_REQUIRED");
        const title = String(raw.title ?? "").trim();
        const content = String(raw.content ?? "").trim();
        const tag = typeof raw.tag === "string" ? raw.tag.trim() : "Обновление";
        const isPinned = Boolean(raw.isPinned);
        const isPublished = Boolean(raw.isPublished);
        const authorName = typeof raw.authorName === "string" ? raw.authorName.trim() : "Администрация";
        result = await adminUpdateNews(admin, { id, title, content, tag, isPinned, isPublished, authorName });
        break;
      }

      case "toggle-publish": {
        const id = String(raw.id ?? "").trim();
        adminEnsure(id.length > 0, "ID_REQUIRED");
        const isPublished = Boolean(raw.isPublished);
        result = await adminToggleNewsPublish(admin, id, isPublished);
        break;
      }

      case "delete": {
        const id = String(raw.id ?? "").trim();
        adminEnsure(id.length > 0, "ID_REQUIRED");
        result = await adminDeleteNews(admin, id);
        break;
      }

      default:
        adminEnsure(false, "INVALID_ACTION");
    }

    return Response.json({ ok: true, result });
  } catch (error) {
    return adminFailure(error);
  }
}
