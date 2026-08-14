"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { DataTable, formatMoney } from "@/components/DataTable";

interface PnlRow {
  code: string;
  name: string;
  type: string;
  amount: number;
}

interface Pnl {
  rows: PnlRow[];
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
}

function firstOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function ProfitAndLossPage() {
  const [periodStart, setPeriodStart] = useState(firstOfMonth());
  const [periodEnd, setPeriodEnd] = useState(today());
  const [data, setData] = useState<Pnl | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Pnl>(`/accounting/profit-and-loss?periodStart=${periodStart}&periodEnd=${periodEnd}`)
      .then(setData)
      .catch((err) => setError(String(err)));
  }, [periodStart, periodEnd]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Profit &amp; Loss</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-end gap-2">
        <div>
          <label className="block text-xs text-gray-500">From</label>
          <input
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500">To</label>
          <input
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm"
          />
        </div>
      </div>

      {data && (
        <>
          <DataTable
            headers={["Code", "Account", "Type", "Amount"]}
            rows={data.rows.filter((r) => r.amount !== 0).map((r) => [r.code, r.name, r.type, formatMoney(r.amount)])}
          />
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm">
            <p>Total Income: {formatMoney(data.totalIncome)}</p>
            <p>Total Expense: {formatMoney(data.totalExpense)}</p>
            <p className="mt-2 text-base font-semibold">Net Profit: {formatMoney(data.netProfit)}</p>
          </div>
        </>
      )}
    </div>
  );
}
