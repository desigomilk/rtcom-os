"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { DataTable } from "@/components/DataTable";

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
}

const REPORTS = [
  { href: "/accounting/ledger", label: "Ledger / Cash Book / Bank Book" },
  { href: "/accounting/trial-balance", label: "Trial Balance" },
  { href: "/accounting/profit-and-loss", label: "Profit & Loss" },
  { href: "/accounting/balance-sheet", label: "Balance Sheet" },
  { href: "/accounting/expenses", label: "Expenses" },
];

export default function AccountingPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    api.get<Account[]>("/accounting/chart-of-accounts").then(setAccounts).catch(() => {});
  }

  useEffect(refresh, []);

  async function handleSeed() {
    setError(null);
    try {
      await api.post("/accounting/seed");
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to seed chart of accounts");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Accounting</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {REPORTS.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="rounded-xl border border-gray-200 bg-white p-4 text-sm font-medium hover:shadow-md"
          >
            {r.label}
          </Link>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">Chart of Accounts</h2>
        {accounts.length === 0 && (
          <button onClick={handleSeed} className="rounded-md bg-gray-900 px-3 py-1.5 text-xs text-white">
            Seed default chart of accounts
          </button>
        )}
      </div>
      <DataTable
        headers={["Code", "Name", "Type"]}
        rows={accounts.map((a) => [a.code, a.name, a.type])}
      />
    </div>
  );
}
