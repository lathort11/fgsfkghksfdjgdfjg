import {
  adminDeleteTokenAccount,
  adminIssueTokenKey,
  adminRegenerateTokenKey,
  adminReplenishTokenBank,
  adminToggleTokenAccount,
  adminUpdateTokenBalance,
  adminUpdateTokenModelRate,
  getAdminClaudeData,
} from "@/lib/admin";
import { adminEnsure, adminFailure, requireAdmin } from "@/lib/admin-auth";
import { readBody } from "@/lib/wallet-security";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireAdmin(req, false);
    const data = await getAdminClaudeData();
    return Response.json({ ok: true, data }, { headers: { "Cache-Control": "no-store" } });
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
      case "issue-key": {
        const userId = String(raw.userId ?? "").trim();
        adminEnsure(userId.length > 0, "USER_REQUIRED");
        const initialTokens = typeof raw.initialTokens === "number" ? Math.max(0, Math.trunc(raw.initialTokens)) : 0;
        const label = typeof raw.label === "string" ? raw.label.trim().slice(0, 80) : undefined;
        const note = typeof raw.note === "string" ? raw.note.trim() : undefined;
        const balanceMode = raw.balanceMode === "add" ? "add" : "replace";
        result = await adminIssueTokenKey(admin, { userId, initialTokens, label, note, balanceMode });
        break;
      }

      case "update-balance": {
        const accountId = String(raw.accountId ?? "").trim();
        adminEnsure(accountId.length > 0, "ACCOUNT_REQUIRED");
        const rawMode = String(raw.mode ?? "");
        adminEnsure(rawMode === "set" || rawMode === "add" || rawMode === "subtract", "INVALID_MODE");
        const mode = rawMode as "set" | "add" | "subtract";
        const amountTokens = Math.max(0, Math.trunc(Number(raw.amountTokens ?? 0)));
        const note = typeof raw.note === "string" ? raw.note.trim() : undefined;
        result = await adminUpdateTokenBalance(admin, { accountId, mode, amountTokens, note });
        break;
      }

      case "regenerate-key": {
        const accountId = String(raw.accountId ?? "").trim();
        adminEnsure(accountId.length > 0, "ACCOUNT_REQUIRED");
        const note = typeof raw.note === "string" ? raw.note.trim() : undefined;
        result = await adminRegenerateTokenKey(admin, accountId, note);
        break;
      }

      case "toggle-active": {
        const accountId = String(raw.accountId ?? "").trim();
        adminEnsure(accountId.length > 0, "ACCOUNT_REQUIRED");
        const isActive = Boolean(raw.isActive);
        const note = typeof raw.note === "string" ? raw.note.trim() : undefined;
        result = await adminToggleTokenAccount(admin, accountId, isActive, note);
        break;
      }

      case "delete-key": {
        const accountId = String(raw.accountId ?? "").trim();
        adminEnsure(accountId.length > 0, "ACCOUNT_REQUIRED");
        const note = typeof raw.note === "string" ? raw.note.trim() : undefined;
        const resetBalance = Boolean(raw.resetBalance);
        result = await adminDeleteTokenAccount(admin, accountId, note, resetBalance);
        break;
      }

      case "update-model": {
        const modelId = String(raw.modelId ?? "").trim();
        adminEnsure(modelId.length > 0, "MODEL_REQUIRED");
        const inputRateCents = Math.max(1, Math.min(100_000, Math.trunc(Number(raw.inputRateCents ?? 30))));
        const outputRateCents = Math.max(1, Math.min(100_000, Math.trunc(Number(raw.outputRateCents ?? 30))));
        const isActive = Boolean(raw.isActive);
        const note = typeof raw.note === "string" ? raw.note.trim() : undefined;
        result = await adminUpdateTokenModelRate(admin, {
          modelId,
          inputRateCents,
          outputRateCents,
          isActive,
          note,
        });
        break;
      }

      case "replenish-bank": {
        const addTokens = Math.max(1, Math.trunc(Number(raw.addTokens ?? 0)));
        const note = typeof raw.note === "string" ? raw.note.trim() : undefined;
        result = await adminReplenishTokenBank(admin, addTokens, note);
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
