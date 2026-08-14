import Anthropic from "@anthropic-ai/sdk";
import type { IntentType } from "@rtcom/shared-types";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

export interface ParsedIntentDraft {
  intentType: IntentType;
  fromDate?: string;
  toDate?: string;
  date?: string;
  newDailyQuantityLitres?: number;
  extraQuantityLitres?: number;
  confidence: number;
  summaryForCustomer: string;
}

const RECORD_INTENT_TOOL: Anthropic.Tool = {
  name: "record_intent",
  description:
    "Record the customer's requested change to their milk subscription/delivery.",
  input_schema: {
    type: "object",
    properties: {
      intentType: {
        type: "string",
        enum: [
          "PAUSE_SUBSCRIPTION",
          "RESUME_SUBSCRIPTION",
          "CHANGE_QUANTITY",
          "ADD_EXTRA",
          "OTHER",
        ],
        description:
          "PAUSE_SUBSCRIPTION: stop delivery for a date range. RESUME_SUBSCRIPTION: cancel a previously requested pause for a date range. CHANGE_QUANTITY: permanently change the daily litres. ADD_EXTRA: a one-off extra quantity on a single date. OTHER: anything else (complaint, question, unclear) — do not guess.",
      },
      fromDate: {
        type: "string",
        description: "YYYY-MM-DD, for PAUSE_SUBSCRIPTION / RESUME_SUBSCRIPTION",
      },
      toDate: {
        type: "string",
        description:
          "YYYY-MM-DD, for PAUSE_SUBSCRIPTION / RESUME_SUBSCRIPTION. Same as fromDate for a single day.",
      },
      date: { type: "string", description: "YYYY-MM-DD, for ADD_EXTRA" },
      newDailyQuantityLitres: {
        type: "number",
        description: "For CHANGE_QUANTITY",
      },
      extraQuantityLitres: { type: "number", description: "For ADD_EXTRA" },
      confidence: {
        type: "number",
        description: "0 to 1 — how confident this reading is",
      },
      summaryForCustomer: {
        type: "string",
        description:
          "A one-line confirmation message in the customer's own language/style (Hindi/Hinglish is fine), stating exactly what will change, to send back before applying anything.",
      },
    },
    required: ["intentType", "confidence", "summaryForCustomer"],
  },
};

// Extracts a structured, proposed change from a WhatsApp message or voice-call
// transcript. This is the *only* thing the AI is trusted to produce — the
// result is never applied directly. It's stored as a ParsedIntent pending
// confirmation, and packages/business-rules re-validates every field (dates,
// cutoff, quantities) before anything touches the Subscription/DeliveryDateException
// tables. Returns null if the model doesn't call the tool (rare, but handled).
export async function parseCustomerMessage(
  messageBody: string,
  context: { customerName: string; currentDailyQuantityLitres: number },
): Promise<ParsedIntentDraft | null> {
  const today = new Date().toISOString().slice(0, 10);

  const response = await getClient().messages.create({
    model: "claude-sonnet-5",
    max_tokens: 512,
    system: `You are reading a dairy customer's message to Desigo. Today's date is ${today}. The customer's name is ${context.customerName} and their current daily quantity is ${context.currentDailyQuantityLitres} litres. Extract only what the message clearly states — if it's ambiguous or unrelated to their subscription, use intentType OTHER. Never invent dates or quantities the customer didn't mention.`,
    tools: [RECORD_INTENT_TOOL],
    tool_choice: { type: "tool", name: "record_intent" },
    messages: [{ role: "user", content: messageBody }],
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolUse) return null;

  return toolUse.input as ParsedIntentDraft;
}
