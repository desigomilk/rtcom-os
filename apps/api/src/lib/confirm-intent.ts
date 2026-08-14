import { applyConfirmedIntent, BusinessRuleError } from "@rtcom/business-rules";
import { prisma } from "@rtcom/db";
import type { IntentType, MessageChannel } from "@rtcom/shared-types";

// The one place a confirmed ParsedIntent is actually applied — reused by both
// the auto-detected WhatsApp/voice "yes"/"haan" reply and the manual ERP
// confirm-intent endpoint, so there's exactly one code path that can turn an
// AI-proposed change into a real Subscription/DeliveryDateException write.
export async function confirmParsedIntent(
  parsedIntentId: string,
  confirmed: boolean,
  confirmationChannel: MessageChannel,
) {
  const intent = await prisma.parsedIntent.findUnique({
    where: { id: parsedIntentId },
    include: { message: true },
  });
  if (!intent) throw new Error("ParsedIntent not found");
  if (intent.status !== "PENDING_CONFIRMATION") {
    return {
      intent,
      applied: false,
      error: `Intent already ${intent.status}`,
    };
  }

  if (!confirmed) {
    await prisma.$transaction([
      prisma.parsedIntent.update({
        where: { id: intent.id },
        data: { status: "REJECTED" },
      }),
      prisma.intentConfirmation.create({
        data: { parsedIntentId: intent.id, confirmationChannel },
      }),
    ]);
    return { intent, applied: false };
  }

  const payload = {
    customerId: intent.message.customerId,
    ...(intent.payload as Record<string, unknown>),
  };

  try {
    await applyConfirmedIntent(
      intent.intentType as IntentType,
      payload,
      intent.message.receivedAt,
    );
  } catch (error) {
    if (error instanceof BusinessRuleError) {
      return { intent, applied: false, error: error.message };
    }
    throw error;
  }

  await prisma.$transaction([
    prisma.parsedIntent.update({
      where: { id: intent.id },
      data: { status: "CONFIRMED" },
    }),
    prisma.intentConfirmation.create({
      data: {
        parsedIntentId: intent.id,
        confirmedAt: new Date(),
        confirmationChannel,
      },
    }),
  ]);

  return { intent, applied: true };
}
