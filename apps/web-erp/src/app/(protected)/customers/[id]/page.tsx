"use client";

import { use, useEffect, useState } from "react";
import { api } from "@/lib/api";

interface CustomerDetail {
  id: string;
  name: string;
  phone: string;
  address: string;
  route: { id: string; name: string } | null;
  subscriptions: { id: string; dailyQuantityLitres: string; status: string; effectiveFrom: string }[];
  currentContainers: { id: string; qrCode: string; containerType: string; variant: string; status: string }[];
  penaltyCharges: { id: string; type: string; amount: string; appliedAt: string; notes: string | null }[];
  invoices: { id: string; periodStart: string; periodEnd: string; totalAmount: string; status: string }[];
}

export default function CustomerDetailPage(props: PageProps<"/customers/[id]">) {
  const { id } = use(props.params);
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<CustomerDetail>(`/customers/${id}`).then(setCustomer).catch((err) => setError(String(err)));
  }, [id]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!customer) return <p className="text-sm text-gray-500">Loading...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{customer.name}</h1>
        <p className="text-sm text-gray-500">
          {customer.phone} · {customer.address} · Route: {customer.route?.name ?? "Unassigned"}
        </p>
      </div>

      <Section title="Subscription history">
        <Table
          headers={["Daily Litres", "Status", "Effective From"]}
          rows={customer.subscriptions.map((s) => [
            s.dailyQuantityLitres,
            s.status,
            new Date(s.effectiveFrom).toLocaleDateString(),
          ])}
        />
      </Section>

      <Section title="Containers currently with customer">
        <Table
          headers={["QR", "Type", "Variant", "Status"]}
          rows={customer.currentContainers.map((c) => [c.qrCode, c.containerType, c.variant, c.status])}
        />
      </Section>

      <Section title="Penalty charges">
        <Table
          headers={["Type", "Amount", "Applied At", "Notes"]}
          rows={customer.penaltyCharges.map((p) => [
            p.type,
            `₹${p.amount}`,
            new Date(p.appliedAt).toLocaleDateString(),
            p.notes ?? "",
          ])}
        />
      </Section>

      <Section title="Invoices">
        <Table
          headers={["Period", "Amount", "Status"]}
          rows={customer.invoices.map((i) => [
            `${new Date(i.periodStart).toLocaleDateString()} – ${new Date(i.periodEnd).toLocaleDateString()}`,
            `₹${i.totalAmount}`,
            i.status,
          ])}
        />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-gray-700">{title}</h2>
      {children}
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-gray-400">Nothing yet.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-2">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-gray-100">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
