"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { DataTable, formatMoney } from "@/components/DataTable";

interface Invoice {
  id: string;
  periodStart: string;
  periodEnd: string;
  totalAmount: string;
  status: string;
  customer: { name: string };
  payments: { amount: string; method: string }[];
}

interface Customer {
  id: string;
  name: string;
}

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  ISSUED: "bg-blue-100 text-blue-800",
  PARTIALLY_PAID: "bg-yellow-100 text-yellow-800",
  PAID: "bg-green-100 text-green-800",
};

export default function BillingPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ customerId: "", periodStart: "", periodEnd: "" });
  const [payForm, setPayForm] = useState<Record<string, { amount: string; method: string }>>({});

  function refresh() {
    api.get<Invoice[]>("/billing/invoices").then(setInvoices).catch((err) => setError(String(err)));
  }

  useEffect(() => {
    refresh();
    api.get<Customer[]>("/customers").then(setCustomers).catch(() => {});
  }, []);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/billing/invoices", form);
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to generate invoice");
    }
  }

  async function handleIssue(id: string) {
    setError(null);
    try {
      await api.post(`/billing/invoices/${id}/issue`);
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to issue invoice");
    }
  }

  async function handlePay(id: string) {
    setError(null);
    const entry = payForm[id];
    if (!entry?.amount) return;
    try {
      await api.post(`/billing/invoices/${id}/payments`, {
        amount: Number(entry.amount),
        method: entry.method || "CASH",
      });
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to record payment");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Billing</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <form onSubmit={handleGenerate} className="flex flex-wrap items-end gap-2 rounded-xl border border-gray-200 bg-white p-4">
        <div>
          <label className="block text-xs text-gray-500">Customer</label>
          <select
            required
            value={form.customerId}
            onChange={(e) => setForm((s) => ({ ...s, customerId: e.target.value }))}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="">Select...</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500">Period start</label>
          <input
            type="date"
            required
            value={form.periodStart}
            onChange={(e) => setForm((s) => ({ ...s, periodStart: e.target.value }))}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500">Period end</label>
          <input
            type="date"
            required
            value={form.periodEnd}
            onChange={(e) => setForm((s) => ({ ...s, periodEnd: e.target.value }))}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm"
          />
        </div>
        <button type="submit" className="rounded-md bg-gray-900 px-3 py-1.5 text-sm text-white">
          Generate invoice
        </button>
      </form>

      <div className="space-y-3">
        {invoices.map((invoice) => (
          <div key={invoice.id} className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">{invoice.customer.name}</p>
                <p className="text-xs text-gray-500">
                  {new Date(invoice.periodStart).toLocaleDateString()} –{" "}
                  {new Date(invoice.periodEnd).toLocaleDateString()} · {formatMoney(invoice.totalAmount)}
                </p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLOR[invoice.status]}`}>
                {invoice.status}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              {invoice.status === "DRAFT" && (
                <button
                  onClick={() => handleIssue(invoice.id)}
                  className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white"
                >
                  Issue
                </button>
              )}
              {invoice.status !== "DRAFT" && invoice.status !== "PAID" && (
                <>
                  <input
                    type="number"
                    placeholder="Amount"
                    className="w-24 rounded-md border border-gray-300 px-2 py-1 text-xs"
                    value={payForm[invoice.id]?.amount ?? ""}
                    onChange={(e) =>
                      setPayForm((s) => ({
                        ...s,
                        [invoice.id]: { amount: e.target.value, method: s[invoice.id]?.method ?? "CASH" },
                      }))
                    }
                  />
                  <select
                    className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                    value={payForm[invoice.id]?.method ?? "CASH"}
                    onChange={(e) =>
                      setPayForm((s) => ({
                        ...s,
                        [invoice.id]: { amount: s[invoice.id]?.amount ?? "", method: e.target.value },
                      }))
                    }
                  >
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="QR">QR</option>
                    <option value="BANK">Bank</option>
                  </select>
                  <button
                    onClick={() => handlePay(invoice.id)}
                    className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white"
                  >
                    Record payment
                  </button>
                </>
              )}
            </div>
            {invoice.payments.length > 0 && (
              <div className="mt-2">
                <DataTable
                  headers={["Amount", "Method"]}
                  rows={invoice.payments.map((p) => [formatMoney(p.amount), p.method])}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
