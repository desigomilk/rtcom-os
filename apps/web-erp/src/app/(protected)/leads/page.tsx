"use client";

import { Fragment, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";

interface Lead {
  id: string;
  name: string;
  phone: string;
  source: string;
  status: string;
  notes: string | null;
  createdAt: string;
}

interface Route {
  id: string;
  name: string;
}

const STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "LOST"];

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const [newLead, setNewLead] = useState({ name: "", phone: "", source: "OTHER" });

  function refresh() {
    api.get<Lead[]>("/leads").then(setLeads).catch((err) => setError(String(err)));
  }

  useEffect(() => {
    refresh();
    api.get<Route[]>("/routes").then(setRoutes).catch(() => {});
  }, []);

  async function handleCreateLead(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/leads", newLead);
      setNewLead({ name: "", phone: "", source: "OTHER" });
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create lead");
    }
  }

  async function handleStatusChange(id: string, status: string) {
    try {
      await api.patch(`/leads/${id}/status`, { status });
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update status");
    }
  }

  async function handleConvert(id: string, form: FormData) {
    setError(null);
    try {
      await api.post(`/leads/${id}/convert`, {
        address: form.get("address"),
        dailyQuantityLitres: Number(form.get("dailyQuantityLitres")),
        ratePerLitre: Number(form.get("ratePerLitre") || 0),
        effectiveFrom: new Date(String(form.get("effectiveFrom"))).toISOString(),
        routeId: form.get("routeId") || undefined,
      });
      setConvertingId(null);
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to convert lead");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Leads</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <form onSubmit={handleCreateLead} className="flex flex-wrap items-end gap-2 rounded-xl border border-gray-200 bg-white p-4">
        <div>
          <label className="block text-xs text-gray-500">Name</label>
          <input
            required
            className="rounded-md border border-gray-300 px-2 py-1 text-sm"
            value={newLead.name}
            onChange={(e) => setNewLead((s) => ({ ...s, name: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500">Phone</label>
          <input
            required
            className="rounded-md border border-gray-300 px-2 py-1 text-sm"
            value={newLead.phone}
            onChange={(e) => setNewLead((s) => ({ ...s, phone: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500">Source</label>
          <select
            className="rounded-md border border-gray-300 px-2 py-1 text-sm"
            value={newLead.source}
            onChange={(e) => setNewLead((s) => ({ ...s, source: e.target.value }))}
          >
            <option value="WHATSAPP">WhatsApp</option>
            <option value="CALL">Call</option>
            <option value="REFERRAL">Referral</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <button type="submit" className="rounded-md bg-gray-900 px-3 py-1.5 text-sm text-white">
          Add lead
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Phone</th>
              <th className="px-4 py-2">Source</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Notes</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <Fragment key={lead.id}>
                <tr className="border-t border-gray-100">
                  <td className="px-4 py-2 font-medium">{lead.name}</td>
                  <td className="px-4 py-2">{lead.phone}</td>
                  <td className="px-4 py-2">{lead.source}</td>
                  <td className="px-4 py-2">
                    <select
                      value={lead.status}
                      disabled={lead.status === "CONVERTED"}
                      onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                      className="rounded-md border border-gray-300 px-1 py-0.5 text-xs"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2 text-gray-500">{lead.notes}</td>
                  <td className="px-4 py-2">
                    {lead.status !== "CONVERTED" && (
                      <button
                        onClick={() => setConvertingId(convertingId === lead.id ? null : lead.id)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Convert
                      </button>
                    )}
                  </td>
                </tr>
                {convertingId === lead.id && (
                  <tr className="border-t border-gray-100 bg-gray-50">
                    <td colSpan={6} className="px-4 py-3">
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleConvert(lead.id, new FormData(e.currentTarget));
                        }}
                        className="flex flex-wrap items-end gap-2"
                      >
                        <div>
                          <label className="block text-xs text-gray-500">Address</label>
                          <input name="address" required className="rounded-md border border-gray-300 px-2 py-1 text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500">Daily litres</label>
                          <input
                            name="dailyQuantityLitres"
                            type="number"
                            step="0.5"
                            required
                            className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500">Rate per litre (₹)</label>
                          <input
                            name="ratePerLitre"
                            type="number"
                            step="0.5"
                            required
                            className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500">Effective from</label>
                          <input
                            name="effectiveFrom"
                            type="date"
                            required
                            className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500">Route</label>
                          <select name="routeId" className="rounded-md border border-gray-300 px-2 py-1 text-sm">
                            <option value="">Unassigned</option>
                            {routes.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <button type="submit" className="rounded-md bg-gray-900 px-3 py-1.5 text-sm text-white">
                          Confirm conversion
                        </button>
                      </form>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
