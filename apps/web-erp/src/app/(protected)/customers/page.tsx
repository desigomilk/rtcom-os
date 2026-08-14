"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  route: { id: string; name: string } | null;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Customer[]>("/customers").then(setCustomers).catch((err) => setError(String(err)));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Customers</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Phone</th>
              <th className="px-4 py-2">Address</th>
              <th className="px-4 py-2">Route</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="border-t border-gray-100">
                <td className="px-4 py-2 font-medium">
                  <Link href={`/customers/${c.id}`} className="text-blue-600 hover:underline">
                    {c.name}
                  </Link>
                </td>
                <td className="px-4 py-2">{c.phone}</td>
                <td className="px-4 py-2 text-gray-500">{c.address}</td>
                <td className="px-4 py-2">{c.route?.name ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
