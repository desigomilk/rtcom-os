"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface DeliveryLog {
  id: string;
  status: string;
  emptyContainersReturned: number;
  isManualOverride: boolean;
  overrideReason: string | null;
  scannedAt: string | null;
  routeStop: { customer: { name: string; address: string } };
  deliveryBoy: { name: string };
  containerScans: { container: { qrCode: string; variant: string } }[];
}

const STATUS_COLOR: Record<string, string> = {
  COMPLETE: "bg-green-100 text-green-800",
  PARTIAL: "bg-blue-100 text-blue-800",
  ISSUE: "bg-red-100 text-red-800",
  PENDING: "bg-gray-100 text-gray-600",
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function DeliveriesPage() {
  const [date, setDate] = useState(todayIso());
  const [logs, setLogs] = useState<DeliveryLog[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<DeliveryLog[]>(`/delivery/logs?date=${date}`)
      .then(setLogs)
      .catch((err) => setError(String(err)));
  }, [date]);

  const summary = {
    complete: logs.filter((l) => l.status === "COMPLETE").length,
    partial: logs.filter((l) => l.status === "PARTIAL").length,
    issue: logs.filter((l) => l.status === "ISSUE").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Deliveries</h1>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-4 text-sm">
        <span className="rounded-full bg-green-100 px-3 py-1 text-green-800">{summary.complete} complete</span>
        <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-800">{summary.partial} partial</span>
        <span className="rounded-full bg-red-100 px-3 py-1 text-red-800">{summary.issue} issue</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">Customer</th>
              <th className="px-4 py-2">Delivery Boy</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Containers</th>
              <th className="px-4 py-2">Empty Returned</th>
              <th className="px-4 py-2">Notes</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t border-gray-100">
                <td className="px-4 py-2 font-medium">{log.routeStop.customer.name}</td>
                <td className="px-4 py-2">{log.deliveryBoy.name}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLOR[log.status] ?? ""}`}>
                    {log.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-gray-500">
                  {log.containerScans.map((s) => s.container.qrCode).join(", ") || "—"}
                </td>
                <td className="px-4 py-2">{log.emptyContainersReturned}</td>
                <td className="px-4 py-2 text-gray-500">
                  {log.isManualOverride ? `Override: ${log.overrideReason}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
