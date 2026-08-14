// Dev-only helper: simulates what parseCustomerMessage() would have produced,
// so the confirm-and-apply pipeline can be exercised without a live
// ANTHROPIC_API_KEY. Not part of the app; run manually via tsx.
import { prisma } from "@rtcom/db";

async function main() {
  const phone = process.argv[2];
  const intentType = process.argv[3];
  const payloadJson = process.argv[4];
  if (!phone || !intentType || !payloadJson) {
    console.error(
      "Usage: tsx dev-insert-test-intent.ts <phone> <intentType> <payloadJson>",
    );
    process.exit(1);
  }

  const customer = await prisma.customer.findFirstOrThrow({
    where: { phone },
    orderBy: { createdAt: "desc" },
  });
  const message = await prisma.customerMessage.create({
    data: {
      customerId: customer.id,
      channel: "WHATSAPP",
      direction: "IN",
      body: "(dev-simulated message)",
    },
  });
  const intent = await prisma.parsedIntent.create({
    data: {
      messageId: message.id,
      intentType,
      payload: JSON.parse(payloadJson),
      status: "PENDING_CONFIRMATION",
    },
  });
  console.log(JSON.stringify({ parsedIntentId: intent.id, customerId: customer.id }));
}

main().finally(() => prisma.$disconnect());
