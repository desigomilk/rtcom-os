"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { DataTable, formatMoney } from "@/components/DataTable";

interface TrialBalanceRow {
  code: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
}

interface TrialBalance {
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
}

export default function TrialBalancePage() {
  const [data, setData] = useState<TrialBalance | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<TrialBalance>("/accounting/trial-balance").then(setData).catch((err) => setError(String(err)));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Trial Balance</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {data && (
        <>
          <p className={`text-sm font-medium ${data.balanced ? "text-green-700" : "text-red-700"}`}>
            {data.balanced ? "Balanced ✓" : "NOT balanced — investigate"}
          </p>
          <DataTable
            headers={["Code", "Account", "Type", "Debit", "Credit"]}
            rows={data.rows
              .filter((r) => r.debit !== 0 || r.credit !== 0)
              .map((r) => [r.code, r.name, r.type, r.debit ? formatMoney(r.debit) : "", r.credit ? formatMoney(r.credit) : ""])}
          />
          <p className="text-sm font-semibold">
            Total: {formatMoney(data.totalDebit)} / {formatMoney(data.totalCredit)}
          </p>
        </>
      )}
    </div>
  );
}
