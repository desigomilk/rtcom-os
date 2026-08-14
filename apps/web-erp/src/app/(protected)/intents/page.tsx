"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";

interface ParsedIntent {
  id: string;
  intentType: string;
  payload: Record<string, unknown>;
  status: string;
  createdAt: string;
  message: { id: string; body: string; channel: string; customerId: string };
}

export default function IntentsPage() {
  const [intents, setIntents] = useState<ParsedIntent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("PENDING_CONFIRMATION");

  function refresh() {
    api
      .get<ParsedIntent[]>(`/intents?status=${statusFilter}`)
      .then(setIntents)
      .catch((err) => setError(String(err)));
  }

  useEffect(refresh, [statusFilter]);

  async function handleDecision(id: string, confirmed: boolean) {
    setError(null);
    try {
      const result = await api.post<{ applied: boolean; error?: string }>(`/intents/${id}/confirm`, {
        confirmed,
        confirmationChannel: "WHATSAPP",
      });
      if (result.error) setError(result.error);
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to process");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Order Change Requests</h1>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm"
        >
          <option value="PENDING_CONFIRMATION">Pending</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="space-y-3">
        {intents.length === 0 && <p className="text-sm text-gray-400">Nothing here.</p>}
        {intents.map((intent) => (
          <div key={intent.id} className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold">{intent.intentType}</p>
                <p className="text-xs text-gray-500">
                  via {intent.message.channel} · &ldquo;{intent.message.body}&rdquo;
                </p>
                <pre className="mt-2 rounded-md bg-gray-50 p-2 text-xs text-gray-600">
                  {JSON.stringify(intent.payload, null, 2)}
                </pre>
              </div>
              {intent.status === "PENDING_CONFIRMATION" && (
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => handleDecision(intent.id, true)}
                    className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleDecision(intent.id, false)}
                    className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
