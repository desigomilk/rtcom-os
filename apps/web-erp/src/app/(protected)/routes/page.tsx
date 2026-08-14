"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";

interface RouteItem {
  id: string;
  name: string;
  code: string;
  area: { name: string; city: { name: string } } | null;
  _count: { stops: number };
}

export default function RoutesPage() {
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [form, setForm] = useState({ name: "", code: "" });
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    api.get<RouteItem[]>("/routes").then(setRoutes).catch((err) => setError(String(err)));
  }

  useEffect(refresh, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/routes", form);
      setForm({ name: "", code: "" });
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create route");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Routes</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2 rounded-xl border border-gray-200 bg-white p-4">
        <div>
          <label className="block text-xs text-gray-500">Name</label>
          <input
            required
            className="rounded-md border border-gray-300 px-2 py-1 text-sm"
            value={form.name}
            onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500">Code</label>
          <input
            required
            className="rounded-md border border-gray-300 px-2 py-1 text-sm"
            value={form.code}
            onChange={(e) => setForm((s) => ({ ...s, code: e.target.value }))}
          />
        </div>
        <button type="submit" className="rounded-md bg-gray-900 px-3 py-1.5 text-sm text-white">
          Add route
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Code</th>
              <th className="px-4 py-2">Area</th>
              <th className="px-4 py-2">Stops</th>
            </tr>
          </thead>
          <tbody>
            {routes.map((r) => (
              <tr key={r.id} className="border-t border-gray-100">
                <td className="px-4 py-2 font-medium">
                  <Link href={`/routes/${r.id}`} className="text-blue-600 hover:underline">
                    {r.name}
                  </Link>
                </td>
                <td className="px-4 py-2">{r.code}</td>
                <td className="px-4 py-2 text-gray-500">
                  {r.area ? `${r.area.name}, ${r.area.city.name}` : "—"}
                </td>
                <td className="px-4 py-2">{r._count.stops}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
