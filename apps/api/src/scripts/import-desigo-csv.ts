// One-off (but re-runnable) import of DESIGO_CLAUDE_IMPORT_MASTER.csv into
// RTCOM OS. Every write is upserted by an `externalId` (or phone, for the
// seed admin) so running this again with a corrected CSV updates existing
// rows instead of duplicating them.
//
// Decisions this script encodes (agreed with the business before running):
// - Customer.phone is not unique in this schema — multiple delivery
//   profiles can share a number, confirmed by inspecting real duplicates.
// - Day-by-day (day_01..day_31) history is NOT imported: those columns mix
//   plain quantities with unexplained codes (C1/C2/C3/ND1/D1). Only the
//   modal (most common) numeric value across the row is used as the
//   subscription's base daily quantity.
// - Historical billing_amount is NOT imported as invoices — billing starts
//   fresh from go-live. paid_amount is populated on 1 of 734 rows and isn't
//   usable for payment history regardless.
// - The literal spreadsheet header row that leaked into ORDER_TEMPLATE data
//   (ORDER-0824) is excluded.
// - Delivery boys get placeholder phone numbers (9000000001, 9000000002...)
//   — PATCH /users/:id can correct these once real numbers are known.
//   "Other"/"SELF"/"B2B" are catch-all labels, not real staff, and are not
//   turned into User accounts.
import { readFileSync, writeFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import { prisma } from "@rtcom/db";
import bcrypt from "bcryptjs";

const CSV_PATH =
  process.argv[2] ?? "/Users/surendrabishnoi/Downloads/DESIGO_CLAUDE_IMPORT_MASTER.csv";
const REPORT_PATH = process.argv[3] ?? "/tmp/desigo-import-report.json";

const PSEUDO_DELIVERY_BOYS = new Set(["Other", "SELF", "B2B"]);
const SUBSCRIPTION_CONSUMER_TYPES = new Set(["1 B2C", "2 B2B", "3 GHEE", "1 B2C SPECIAL"]);
const GARBAGE_EXTERNAL_KEYS = new Set(["ORDER-0824"]); // literal header row leaked into data

interface Row {
  [key: string]: string;
}

// csv-parse gives us Record<string,string>, but with noUncheckedIndexedAccess
// every property read on an index-signature type is `string | undefined` —
// this centralizes the "treat a missing/blank cell as empty string" rule
// instead of scattering `?? ""` and non-null assertions through the script.
function field(row: Row, key: string): string {
  return (row[key] ?? "").trim();
}

function num(v: string): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Modal (most frequent) numeric value across day_01..day_31 — robust to a
// mostly-empty row (one filled day) and a fully-uniform row (same value all
// month) alike; non-numeric codes (C1, ND1, ...) are ignored, not guessed at.
function extractDailyQuantity(row: Row): { quantity: number; estimated: boolean } {
  const values: number[] = [];
  for (let i = 1; i <= 31; i++) {
    const raw = field(row, `day_${String(i).padStart(2, "0")}`);
    if (/^\d+(\.\d+)?$/.test(raw)) values.push(Number(raw));
  }
  if (values.length > 0) {
    const freq = new Map<number, number>();
    for (const v of values) freq.set(v, (freq.get(v) ?? 0) + 1);
    let best = values[0]!;
    let bestCount = 0;
    for (const [v, c] of freq) {
      if (c > bestCount) {
        best = v;
        bestCount = c;
      }
    }
    return { quantity: best, estimated: false };
  }
  const monthly = num(field(row, "monthly_total_qty"));
  return { quantity: monthly ?? 0, estimated: true };
}

async function main() {
  const content = readFileSync(CSV_PATH, "utf-8");
  const rows: Row[] = parse(content, { columns: true, skip_empty_lines: true, bom: true });

  const report = {
    products: { created: 0, updated: 0 },
    deliveryBoys: { created: 0, updated: 0, skippedPseudo: [] as string[] },
    customers: {
      created: 0,
      updated: 0,
      skippedNoPhone: [] as string[],
      routesCreated: 0,
    },
    subscriptions: {
      created: 0,
      updated: 0,
      skippedNoCustomer: [] as string[],
      skippedDuplicateKept: [] as { kept: string; skipped: string }[],
      estimatedFromMonthlyTotal: [] as string[],
      excludedGarbage: [...GARBAGE_EXTERNAL_KEYS],
      excludedOneOff: [] as string[], // PURCHASE / RETURN rows, not recurring subscriptions
    },
    specialFirstOrders: {
      total: 0,
      alreadyHasSubscription: 0,
      needsManualFollowUp: [] as { externalKey: string; customerKey: string; note: string }[],
    },
  };

  // ---------- 1. Products ----------
  const productRows = rows.filter((r) => r.record_type === "PRODUCT_MASTER");
  for (const r of productRows) {
    const externalId = field(r, "external_key");
    const existing = await prisma.product.findUnique({ where: { externalId } });
    const data = {
      name: field(r, "product"),
      variant: field(r, "variant"),
      category: field(r, "category"),
      sizeLabel: field(r, "size") || null,
      unitPrice: num(field(r, "unit_price")),
    };
    await prisma.product.upsert({
      where: { externalId },
      create: { externalId, ...data },
      update: data,
    });
    if (existing) report.products.updated++;
    else report.products.created++;
  }

  // ---------- 2. Delivery boys ----------
  const delBoyRows = rows.filter((r) => r.record_type === "DELIVERY_BOY_MASTER");
  let placeholderSeq = 1;
  const defaultPasswordHash = await bcrypt.hash("changeme123", 10);
  for (const r of delBoyRows) {
    const name = field(r, "delivery_boy");
    const externalId = field(r, "external_key");
    if (PSEUDO_DELIVERY_BOYS.has(name)) {
      report.deliveryBoys.skippedPseudo.push(name);
      continue;
    }
    const existing = await prisma.user.findUnique({ where: { externalId } });
    if (existing) {
      await prisma.user.update({ where: { id: existing.id }, data: { name } });
      report.deliveryBoys.updated++;
      continue;
    }
    const placeholderPhone = `900000${String(placeholderSeq++).padStart(4, "0")}`;
    await prisma.user.create({
      data: {
        externalId,
        name,
        phone: placeholderPhone,
        passwordHash: defaultPasswordHash,
        role: "DELIVERY_BOY",
      },
    });
    report.deliveryBoys.created++;
  }

  // ---------- 3. Customers (+ Route/RouteStop) ----------
  const customerRows = rows.filter((r) => r.record_type === "CUSTOMER_MASTER");
  const customerExternalIdToId = new Map<string, string>();
  const routeCodeToId = new Map<string, string>();
  const routeSequenceCounter = new Map<string, number>();

  for (const r of customerRows) {
    const externalId = field(r, "external_key");
    const phone = field(r, "phone_primary");
    if (!phone) {
      report.customers.skippedNoPhone.push(externalId);
      continue;
    }

    let routeId: string | undefined;
    const routeCode = field(r, "route_code");
    if (routeCode) {
      if (!routeCodeToId.has(routeCode)) {
        const route = await prisma.route.upsert({
          where: { code: routeCode },
          create: { name: `Route ${routeCode}`, code: routeCode },
          update: {},
        });
        routeCodeToId.set(routeCode, route.id);
        report.customers.routesCreated++;
      }
      routeId = routeCodeToId.get(routeCode);
    }

    const existing = await prisma.customer.findUnique({ where: { externalId } });
    const data = {
      name: field(r, "customer_name") || phone,
      phone,
      address: field(r, "address") || "Address pending",
      areaLabel: field(r, "area") || null,
      gpsLat: num(field(r, "gps_lat")),
      gpsLng: num(field(r, "gps_lng")),
      routeId,
    };
    const customer = await prisma.customer.upsert({
      where: { externalId },
      create: { externalId, ...data },
      update: data,
    });
    customerExternalIdToId.set(externalId, customer.id);
    if (existing) report.customers.updated++;
    else report.customers.created++;

    if (routeId) {
      const seq = (routeSequenceCounter.get(routeId) ?? 0) + 1;
      routeSequenceCounter.set(routeId, seq);
      await prisma.routeStop.upsert({
        where: { routeId_customerId: { routeId, customerId: customer.id } },
        create: { routeId, customerId: customer.id, sequence: seq },
        update: {},
      });
    }
  }

  // ---------- 4. Subscriptions from ORDER_TEMPLATE ----------
  const orderRows = rows.filter(
    (r) =>
      r.record_type === "ORDER_TEMPLATE" && !GARBAGE_EXTERNAL_KEYS.has(field(r, "external_key")),
  );

  // Keep the highest source_row per dedup_key — the later spreadsheet entry
  // is the more likely correction when a customer+variant appears twice.
  const bestByDedupKey = new Map<string, Row>();
  for (const r of orderRows) {
    const key = field(r, "dedup_key");
    const existingBest = bestByDedupKey.get(key);
    if (!existingBest || Number(field(r, "source_row")) > Number(field(existingBest, "source_row"))) {
      if (existingBest) {
        report.subscriptions.skippedDuplicateKept.push({
          kept: field(r, "external_key"),
          skipped: field(existingBest, "external_key"),
        });
      }
      bestByDedupKey.set(key, r);
    }
  }

  const effectiveFrom = new Date("2026-07-01T00:00:00.000Z");
  for (const r of bestByDedupKey.values()) {
    const externalId = field(r, "external_key");
    const consumerType = field(r, "consumer_type");
    if (!SUBSCRIPTION_CONSUMER_TYPES.has(consumerType)) {
      report.subscriptions.excludedOneOff.push(externalId);
      continue;
    }
    const customerId = customerExternalIdToId.get(field(r, "related_customer_key"));
    if (!customerId) {
      report.subscriptions.skippedNoCustomer.push(externalId);
      continue;
    }

    const { quantity, estimated } = extractDailyQuantity(r);
    if (estimated) report.subscriptions.estimatedFromMonthlyTotal.push(externalId);
    const rate = num(field(r, "unit_price")) ?? 0;
    const status = field(r, "order_status") === "ACTIVE" ? "ACTIVE" : "PAUSED";

    const existing = await prisma.subscription.findUnique({ where: { externalId } });
    const data = {
      customerId,
      dailyQuantityLitres: quantity,
      ratePerLitre: rate,
      status: status as "ACTIVE" | "PAUSED",
      effectiveFrom,
    };
    await prisma.subscription.upsert({
      where: { externalId },
      create: { externalId, ...data },
      update: data,
    });
    if (existing) report.subscriptions.updated++;
    else report.subscriptions.created++;
  }

  // ---------- 5. Special/first-order records (informational only) ----------
  const specialRows = rows.filter((r) => r.record_type === "SPECIAL_NEW_CUSTOMER");
  const orderCustomerKeys = new Set(orderRows.map((r) => field(r, "related_customer_key")));
  report.specialFirstOrders.total = specialRows.length;
  for (const r of specialRows) {
    const customerKey = field(r, "related_customer_key");
    if (orderCustomerKeys.has(customerKey)) {
      report.specialFirstOrders.alreadyHasSubscription++;
      continue;
    }
    report.specialFirstOrders.needsManualFollowUp.push({
      externalKey: field(r, "external_key"),
      customerKey,
      note: `product=${field(r, "product") || "?"} qty=${field(r, "monthly_total_qty") || "?"} date=${field(r, "special_date") || "?"}`,
    });
  }

  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log(`\nFull report written to ${REPORT_PATH}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
