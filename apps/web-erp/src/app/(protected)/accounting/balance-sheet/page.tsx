"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { DataTable, formatMoney, Section } from "@/components/DataTable";

interface Row {
  code: string;
  name: string;
  balance: number;
}

interface BalanceSheet {
  assets: Row[];
  liabilities: Row[];
  equity: Row[];
  retainedEarnings: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  balanced: boolean;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function BalanceSheetPage() {
  const [asOfDate, setAsOfDate] = useState(today());
  const [data, setData] = useState<BalanceSheet | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<BalanceSheet>(`/accounting/balance-sheet?asOfDate=${asOfDate}`)
      .then(setData)
      .catch((err) => setError(String(err)));
  }, [asOfDate]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Balance Sheet</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div>
        <label className="block text-xs text-gray-500">As of</label>
        <input
          type="date"
          value={asOfDate}
          onChange={(e) => setAsOfDate(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm"
        />
      </div>

      {data && (
        <>
          <p className={`text-sm font-medium ${data.balanced ? "text-green-700" : "text-red-700"}`}>
            {data.balanced ? "Balanced ✓" : "NOT balanced — investigate"}
          </p>

          <Section title={`Assets (Total: ${formatMoney(data.totalAssets)})`}>
            <DataTable
              headers={["Code", "Account", "Balance"]}
              rows={data.assets.map((a) => [a.code, a.name, formatMoney(a.balance)])}
            />
          </Section>

          <Section title={`Liabilities (Total: ${formatMoney(data.totalLiabilities)})`}>
            <DataTable
              headers={["Code", "Account", "Balance"]}
              rows={data.liabilities.map((a) => [a.code, a.name, formatMoney(a.balance)])}
            />
          </Section>

          <Section title={`Equity (Total: ${formatMoney(data.totalEquity)})`}>
            <DataTable
              headers={["Code", "Account", "Balance"]}
              rows={[
                ...data.equity.map((a): [string, string, string] => [a.code, a.name, formatMoney(a.balance)]),
                ["—", "Retained Earnings (computed)", formatMoney(data.retainedEarnings)],
              ]}
            />
          </Section>
        </>
      )}
    </div>
  );
}
