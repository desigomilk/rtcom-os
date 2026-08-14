"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { DataTable, formatMoney } from "@/components/DataTable";

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface LedgerEntry {
  date: string;
  narration: string;
  debit: number;
  credit: number;
  balance: number;
}

interface LedgerResponse {
  account: Account;
  entries: LedgerEntry[];
  closingBalance: number;
}

export default function LedgerPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState("");
  const [ledger, setLedger] = useState<LedgerResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Account[]>("/accounting/chart-of-accounts").then(setAccounts).catch(() => {});
  }, []);

  useEffect(() => {
    if (!accountId) return;
    api
      .get<LedgerResponse>(`/accounting/ledger/${accountId}`)
      .then(setLedger)
      .catch((err) => setError(String(err)));
  }, [accountId]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Ledger</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm"
        >
          <option value="">Select an account...</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} — {a.name}
            </option>
          ))}
        </select>
        {accounts
          .filter((a) => ["1000", "1010"].includes(a.code))
          .map((a) => (
            <button
              key={a.id}
              onClick={() => setAccountId(a.id)}
              className="rounded-md border border-gray-300 px-3 py-1 text-xs"
            >
              {a.code === "1000" ? "Cash Book" : "Bank Book"}
            </button>
          ))}
      </div>

      {ledger && (
        <>
          <p className="text-sm text-gray-600">
            {ledger.account.code} — {ledger.account.name} · Closing balance:{" "}
            <span className="font-semibold">{formatMoney(ledger.closingBalance)}</span>
          </p>
          <DataTable
            headers={["Date", "Narration", "Debit", "Credit", "Balance"]}
            rows={ledger.entries.map((e) => [
              new Date(e.date).toLocaleDateString(),
              e.narration,
              e.debit ? formatMoney(e.debit) : "",
              e.credit ? formatMoney(e.credit) : "",
              formatMoney(e.balance),
            ])}
          />
        </>
      )}
    </div>
  );
}
