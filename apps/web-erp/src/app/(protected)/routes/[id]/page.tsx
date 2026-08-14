"use client";

import { use, useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";

interface RouteDetail {
  id: string;
  name: string;
  code: string;
  stops: { id: string; sequence: number; customer: { id: string; name: string; address: string } }[];
}

interface Customer {
  id: string;
  name: string;
}

interface DeliveryBoy {
  id: string;
  name: string;
  phone: string;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function RouteDetailPage(props: PageProps<"/routes/[id]">) {
  const { id } = use(props.params);
  const [route, setRoute] = useState<RouteDetail | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [deliveryBoys, setDeliveryBoys] = useState<DeliveryBoy[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [assignDate, setAssignDate] = useState(todayIso());
  const [assignedBoyId, setAssignedBoyId] = useState("");

  const refresh = useCallback(() => {
    api.get<RouteDetail>(`/routes/${id}`).then(setRoute).catch((err) => setError(String(err)));
  }, [id]);

  useEffect(() => {
    refresh();
    api.get<Customer[]>("/customers").then(setCustomers).catch(() => {});
    api.get<DeliveryBoy[]>("/delivery-boys").then(setDeliveryBoys).catch(() => {});
  }, [refresh]);

  async function handleAddStop(form: FormData) {
    setError(null);
    try {
      await api.post(`/routes/${id}/stops`, {
        customerId: form.get("customerId"),
        sequence: Number(form.get("sequence")),
      });
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add stop");
    }
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/delivery/route-assignments", {
        routeId: id,
        deliveryBoyId: assignedBoyId,
        date: assignDate,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to assign delivery boy");
    }
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!route) return <p className="text-sm text-gray-500">Loading...</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{route.name} ({route.code})</h1>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Assign delivery boy for a date</h2>
        <form onSubmit={handleAssign} className="flex items-end gap-2 rounded-xl border border-gray-200 bg-white p-4">
          <div>
            <label className="block text-xs text-gray-500">Date</label>
            <input
              type="date"
              value={assignDate}
              onChange={(e) => setAssignDate(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Delivery boy</label>
            <select
              required
              value={assignedBoyId}
              onChange={(e) => setAssignedBoyId(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1 text-sm"
            >
              <option value="">Select...</option>
              {deliveryBoys.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.phone})
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="rounded-md bg-gray-900 px-3 py-1.5 text-sm text-white">
            Assign
          </button>
        </form>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Add customer to route</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAddStop(new FormData(e.currentTarget));
          }}
          className="flex items-end gap-2 rounded-xl border border-gray-200 bg-white p-4"
        >
          <div>
            <label className="block text-xs text-gray-500">Customer</label>
            <select name="customerId" required className="rounded-md border border-gray-300 px-2 py-1 text-sm">
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500">Sequence</label>
            <input
              name="sequence"
              type="number"
              defaultValue={route.stops.length + 1}
              className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm"
            />
          </div>
          <button type="submit" className="rounded-md bg-gray-900 px-3 py-1.5 text-sm text-white">
            Add stop
          </button>
        </form>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">Seq</th>
              <th className="px-4 py-2">Customer</th>
              <th className="px-4 py-2">Address</th>
            </tr>
          </thead>
          <tbody>
            {route.stops.map((s) => (
              <tr key={s.id} className="border-t border-gray-100">
                <td className="px-4 py-2">{s.sequence}</td>
                <td className="px-4 py-2 font-medium">{s.customer.name}</td>
                <td className="px-4 py-2 text-gray-500">{s.customer.address}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
