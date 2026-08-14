"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Lead {
  id: string;
  status: string;
}
interface Customer {
  id: string;
}
interface ParsedIntent {
  id: string;
  status: string;
}

export default function DashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [intents, setIntents] = useState<ParsedIntent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<Lead[]>("/leads"),
      api.get<Customer[]>("/customers"),
      api.get<ParsedIntent[]>("/intents?status=PENDING_CONFIRMATION"),
    ])
      .then(([l, c, i]) => {
        setLeads(l);
        setCustomers(c);
        setIntents(i);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  const newLeads = leads.filter((l) => l.status === "NEW").length;

  const cards = [
    { label: "New Leads", value: newLeads, href: "/leads" },
    { label: "Total Customers", value: customers.length, href: "/customers" },
    { label: "Pending Order Requests", value: intents.length, href: "/intents" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md"
          >
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className="mt-2 text-3xl font-semibold">{card.value}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
