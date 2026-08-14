import {
  addExtraPayloadSchema,
  changeQuantityPayloadSchema,
  pauseSubscriptionPayloadSchema,
  resumeSubscriptionPayloadSchema,
  type IntentType,
} from "@rtcom/shared-types";
import {
  applyAddExtra,
  applyPauseDelivery,
  applyResumeDelivery,
} from "./delivery-exceptions";
import { BusinessRuleError } from "./errors";
import { applyChangeQuantity } from "./subscription";

// The single entry point the confirmation endpoint calls once a customer has
// confirmed an AI-parsed intent. This is the only place a ParsedIntent.payload
// (AI output) is trusted to mutate anything — and even here, every payload is
// re-validated against the same Zod schema the AI was asked to produce, and
// every date is re-checked against the cutoff. The AI proposes; this decides.
export async function applyConfirmedIntent(
  intentType: IntentType,
  rawPayload: unknown,
  requestedAt: Date,
) {
  switch (intentType) {
    case "PAUSE_SUBSCRIPTION":
      return applyPauseDelivery(
        pauseSubscriptionPayloadSchema.parse(rawPayload),
        requestedAt,
      );
    case "RESUME_SUBSCRIPTION":
      return applyResumeDelivery(
        resumeSubscriptionPayloadSchema.parse(rawPayload),
        requestedAt,
      );
    case "CHANGE_QUANTITY":
      return applyChangeQuantity(
        changeQuantityPayloadSchema.parse(rawPayload),
        requestedAt,
      );
    case "ADD_EXTRA":
      return applyAddExtra(
        addExtraPayloadSchema.parse(rawPayload),
        requestedAt,
      );
    default:
      throw new BusinessRuleError(
        `Intent type "${intentType}" has no automated handling and needs manual ERP action`,
      );
  }
}
