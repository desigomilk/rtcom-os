import { prisma } from "@rtcom/db";
import type { MessageChannel } from "@rtcom/shared-types";

// Records the outbound side of a conversation and is the single place that
// would call the WhatsApp Cloud API / telephony provider's send endpoint once
// real credentials (WHATSAPP_ACCESS_TOKEN, etc.) are configured. Until then it
// logs, so the confirmation flow is fully exercisable in dev without live
// WhatsApp/voice credentials.
export async function sendCustomerMessage(
  customerId: string,
  channel: MessageChannel,
  body: string,
) {
  await prisma.customerMessage.create({
    data: { customerId, channel, direction: "OUT", body },
  });

  if (!process.env.WHATSAPP_ACCESS_TOKEN) {
    console.log(`[stub outbound ${channel}] -> customer ${customerId}: ${body}`);
    return;
  }

  // TODO: call the WhatsApp Cloud API / telephony provider's send endpoint here
  // once WHATSAPP_ACCESS_TOKEN / voice provider credentials are configured.
}
