"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { DataTable, formatMoney, Section } from "@/components/DataTable";

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

interface DeviceReading {
  recordedAt: string;
  payload: { temperatureCelsius?: number; [k: string]: unknown };
}
interface Device {
  status: string;
  readings: DeviceReading[];
}
interface Chiller {
  id: string;
  name: string;
  farm: { name: string } | null;
  device: Device | null;
}
interface Barrel {
  id: string;
  qrCode: string;
  status: string;
  currentFarm: { name: string } | null;
  device: Device | null;
}
interface QualityReport {
  date: string;
  mismatchCount: number;
  farmEntries: {
    id: string;
    farm: { name: string };
    litres: string;
    fat: string;
    snf: string;
    timestamp: string;
  }[];
  plantReceipts: {
    id: string;
    batch: { qrCode: string };
    fat: string;
    snf: string;
    mismatchFlag: boolean;
    mismatchNotes: string | null;
    receivedAt: string;
  }[];
}
interface DeliveriesReport {
  totalDelivered: number;
  totalReturned: number;
  statusCounts: { PENDING: number; COMPLETE: number; PARTIAL: number; ISSUE: number };
  routes: { routeName: string; delivered: number; returned: number; complete: number; partial: number; issue: number }[];
}
interface RevenueReport {
  cashCollectedToday: number;
  paymentCount: number;
  milkValueDeliveredToday: number;
}

const SAFE_TEMP_MIN = 2;
const SAFE_TEMP_MAX = 8;

function TempBadge({ device }: { device: Device | null }) {
  if (!device || device.readings.length === 0) {
    return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">No data</span>;
  }
  const reading = device.readings[0];
  const temp = reading.payload.temperatureCelsius;
  if (typeof temp !== "number") {
    return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">No temp</span>;
  }
  const safe = temp >= SAFE_TEMP_MIN && temp <= SAFE_TEMP_MAX;
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        safe ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
      }`}
    >
      {temp}°C
    </span>
  );
}

const REFRESH_INTERVAL_MS = 30_000;

export default function DashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [intents, setIntents] = useState<ParsedIntent[]>([]);
  const [chillers, setChillers] = useState<Chiller[]>([]);
  const [barrels, setBarrels] = useState<Barrel[]>([]);
  const [quality, setQuality] = useState<QualityReport | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveriesReport | null>(null);
  const [revenue, setRevenue] = useState<RevenueReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const refresh = useCallback(() => {
    Promise.all([
      api.get<Lead[]>("/leads"),
      api.get<Customer[]>("/customers"),
      api.get<ParsedIntent[]>("/intents?status=PENDING_CONFIRMATION"),
      api.get<Chiller[]>("/chillers"),
      api.get<Barrel[]>("/barrels"),
      api.get<QualityReport>("/reports/quality-today"),
      api.get<DeliveriesReport>("/reports/deliveries-today"),
      api.get<RevenueReport>("/reports/revenue-today"),
    ])
      .then(([l, c, i, ch, b, q, d, r]) => {
        setLeads(l);
        setCustomers(c);
        setIntents(i);
        setChillers(ch);
        setBarrels(b);
        setQuality(q);
        setDeliveries(d);
        setRevenue(r);
        setLastRefreshed(new Date());
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  const newLeads = leads.filter((l) => l.status === "NEW").length;
  const farmChillers = chillers.filter((c) => c.farm);
  const plantChillers = chillers.filter((c) => !c.farm);

  const cards = [
    {
      label: "Today's Revenue (cash collected)",
      value: revenue ? formatMoney(revenue.cashCollectedToday) : "—",
      href: "/accounting/ledger",
    },
    {
      label: "Milk Value Delivered Today (est.)",
      value: revenue ? formatMoney(revenue.milkValueDeliveredToday) : "—",
      href: "/billing",
    },
    {
      label: "Bottles Delivered / Returned Today",
      value: deliveries ? `${deliveries.totalDelivered} / ${deliveries.totalReturned}` : "—",
      href: "/deliveries",
    },
    { label: "New Leads", value: newLeads, href: "/leads" },
    { label: "Total Customers", value: customers.length, href: "/customers" },
    { label: "Pending Order Requests", value: intents.length, href: "/intents" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Live Ops Dashboard</h1>
        <p className="text-xs text-gray-400">
          {lastRefreshed ? `Updated ${lastRefreshed.toLocaleTimeString()}` : "Loading..."} · auto-refreshes every 30s
        </p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md"
          >
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold">{card.value}</p>
          </Link>
        ))}
      </div>

      <Section title={`Farm Chillers — live temperature (${farmChillers.length})`}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {farmChillers.map((c) => (
            <div key={c.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-sm font-medium">{c.name}</p>
              <p className="text-xs text-gray-500">{c.farm?.name}</p>
              <div className="mt-2">
                <TempBadge device={c.device} />
              </div>
            </div>
          ))}
          {farmChillers.length === 0 && <p className="text-sm text-gray-400">No farm chillers registered yet.</p>}
        </div>
      </Section>

      <Section title={`Plant Chillers — live temperature (${plantChillers.length})`}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {plantChillers.map((c) => (
            <div key={c.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-sm font-medium">{c.name}</p>
              <div className="mt-2">
                <TempBadge device={c.device} />
              </div>
            </div>
          ))}
          {plantChillers.length === 0 && <p className="text-sm text-gray-400">No plant chillers registered yet.</p>}
        </div>
      </Section>

      <Section title={`Barrels — live status, temperature & location (${barrels.length})`}>
        <DataTable
          headers={["QR", "Status", "Current Farm", "Temp", "GPS"]}
          rows={barrels.map((b) => {
            const reading = b.device?.readings[0];
            const temp = reading?.payload.temperatureCelsius;
            const lat = reading?.payload.lat as number | undefined;
            const lng = reading?.payload.lng as number | undefined;
            return [
              b.qrCode,
              b.status.replaceAll("_", " "),
              b.currentFarm?.name ?? "—",
              typeof temp === "number" ? `${temp}°C` : "—",
              lat && lng ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : "—",
            ];
          })}
        />
      </Section>

      <Section title={`Today's Quality Tests${quality && quality.mismatchCount > 0 ? ` — ⚠ ${quality.mismatchCount} mismatch(es)` : ""}`}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Farm Entries</p>
            <DataTable
              headers={["Farm", "Litres", "Fat", "SNF", "Time"]}
              rows={
                quality?.farmEntries.map((e) => [
                  e.farm.name,
                  e.litres,
                  e.fat,
                  e.snf,
                  new Date(e.timestamp).toLocaleTimeString(),
                ]) ?? []
              }
            />
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Plant Receipts</p>
            <DataTable
              headers={["Batch", "Fat", "SNF", "Status", "Time"]}
              rows={
                quality?.plantReceipts.map((r) => [
                  r.batch.qrCode,
                  r.fat,
                  r.snf,
                  r.mismatchFlag ? `⚠ ${r.mismatchNotes ?? "Mismatch"}` : "OK",
                  new Date(r.receivedAt).toLocaleTimeString(),
                ]) ?? []
              }
            />
          </div>
        </div>
      </Section>

      {deliveries && deliveries.routes.length > 0 && (
        <Section title="Deliveries Today by Route">
          <DataTable
            headers={["Route", "Delivered", "Returned", "Complete", "Partial", "Issue"]}
            rows={deliveries.routes.map((r) => [
              r.routeName,
              r.delivered,
              r.returned,
              r.complete,
              r.partial,
              r.issue,
            ])}
          />
        </Section>
      )}
    </div>
  );
}
