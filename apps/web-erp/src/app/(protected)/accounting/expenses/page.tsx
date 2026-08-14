"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { DataTable, formatMoney } from "@/components/DataTable";

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface Expense {
  id: string;
  date: string;
  amount: string;
  description: string;
  vendorName: string | null;
  account: Account;
  paidFromAccount: Account;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function ExpensesPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    date: today(),
    accountId: "",
    paidFromAccountId: "",
    amount: "",
    description: "",
    vendorName: "",
  });

  function refresh() {
    api.get<Expense[]>("/accounting/expenses").then(setExpenses).catch((err) => setError(String(err)));
  }

  useEffect(() => {
    refresh();
    api.get<Account[]>("/accounting/chart-of-accounts").then(setAccounts).catch(() => {});
  }, []);

  const expenseAccounts = accounts.filter((a) => a.type === "EXPENSE");
  const paymentAccounts = accounts.filter((a) => ["1000", "1010"].includes(a.code));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/accounting/expenses", { ...form, amount: Number(form.amount) });
      setForm((s) => ({ ...s, amount: "", description: "", vendorName: "" }));
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to record expense");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Expenses</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 rounded-xl border border-gray-200 bg-white p-4">
        <div>
          <label className="block text-xs text-gray-500">Date</label>
          <input
            type="date"
            required
            value={form.date}
            onChange={(e) => setForm((s) => ({ ...s, date: e.target.value }))}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500">Category</label>
          <select
            required
            value={form.accountId}
            onChange={(e) => setForm((s) => ({ ...s, accountId: e.target.value }))}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="">Select...</option>
            {expenseAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500">Paid from</label>
          <select
            required
            value={form.paidFromAccountId}
            onChange={(e) => setForm((s) => ({ ...s, paidFromAccountId: e.target.value }))}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="">Select...</option>
            {paymentAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500">Amount</label>
          <input
            type="number"
            required
            step="0.01"
            value={form.amount}
            onChange={(e) => setForm((s) => ({ ...s, amount: e.target.value }))}
            className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500">Description</label>
          <input
            required
            value={form.description}
            onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500">Vendor (optional)</label>
          <input
            value={form.vendorName}
            onChange={(e) => setForm((s) => ({ ...s, vendorName: e.target.value }))}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm"
          />
        </div>
        <button type="submit" className="rounded-md bg-gray-900 px-3 py-1.5 text-sm text-white">
          Record expense
        </button>
      </form>

      <DataTable
        headers={["Date", "Category", "Amount", "Paid From", "Description", "Vendor"]}
        rows={expenses.map((e) => [
          new Date(e.date).toLocaleDateString(),
          e.account.name,
          formatMoney(e.amount),
          e.paidFromAccount.name,
          e.description,
          e.vendorName ?? "",
        ])}
      />
    </div>
  );
}
