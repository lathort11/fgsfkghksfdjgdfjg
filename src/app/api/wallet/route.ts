import { getCurrentUser } from "@/lib/session";
import { walletSnapshot, createDeposit, confirmDeposit, requestWithdrawal, cancelOperation } from "@/lib/wallet";
import { walletUser, readBody, walletFailure, ensure, validId } from "@/lib/wallet-security";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const user = await getCurrentUser();
    ensure(user, "AUTH", 401);
    return Response.json(await walletSnapshot(user.id), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return walletFailure(error); }
}
export async function POST(req: Request) {
  try {
    const user = await walletUser(req);
    const body = await readBody(req);
    let operation;
    switch (body.action) {
      case "deposit": operation = await createDeposit(user.id, body); break;
      case "confirm-deposit":
        ensure(validId(body.operationId), "INVALID_REQUEST");
        operation = await confirmDeposit(body.operationId, user.id); break;
      case "withdraw": operation = await requestWithdrawal(user.id, body); break;
      case "cancel":
        ensure(validId(body.operationId), "INVALID_REQUEST");
        operation = await cancelOperation(user.id, body.operationId); break;
      default: ensure(false, "INVALID_REQUEST");
    }
    return Response.json({ ok: true, operation, wallet: await walletSnapshot(user.id) });
  } catch (error) { return walletFailure(error); }
}
