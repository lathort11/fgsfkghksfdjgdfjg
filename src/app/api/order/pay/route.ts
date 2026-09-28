// Direct transaction hashes never constitute proof of payment.
// All new purchases must use the authenticated balance checkout endpoint.
export async function POST() {
  return Response.json({ error: "BALANCE_PAYMENT_REQUIRED", message: "Сначала пополните баланс, затем подтвердите покупку." }, { status: 410 });
}
