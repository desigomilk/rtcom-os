import * as SQLite from "expo-sqlite";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

// Everything the app needs to work fully offline lives here: the cached
// morning manifest (manifest_stops) and an append-only outbox of scan events
// (sync_queue) that a sync pass flushes to POST /delivery/sync whenever
// connectivity returns. A scan is always written here first — the network
// call is a background concern, never on the critical path of recording it.
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync("rtcom_delivery.db").then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS manifest_stops (
          routeStopId TEXT PRIMARY KEY,
          date TEXT NOT NULL,
          sequence INTEGER NOT NULL,
          customerName TEXT NOT NULL,
          address TEXT NOT NULL,
          plannedLat REAL,
          plannedLng REAL,
          expectedQuantityLitres REAL NOT NULL,
          expectedEmptyContainers INTEGER NOT NULL,
          localStatus TEXT NOT NULL DEFAULT 'PENDING'
        );
        CREATE TABLE IF NOT EXISTS sync_queue (
          clientEventId TEXT PRIMARY KEY,
          payload TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          syncedAt TEXT
        );
      `);
      return db;
    });
  }
  return dbPromise;
}

export interface LocalManifestStop {
  routeStopId: string;
  date: string;
  sequence: number;
  customerName: string;
  address: string;
  plannedLat: number | null;
  plannedLng: number | null;
  expectedQuantityLitres: number;
  expectedEmptyContainers: number;
  localStatus: "PENDING" | "COMPLETE" | "PARTIAL" | "ISSUE";
}

export async function saveManifestStops(stops: LocalManifestStop[]) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const stop of stops) {
      await db.runAsync(
        `INSERT INTO manifest_stops
          (routeStopId, date, sequence, customerName, address, plannedLat, plannedLng, expectedQuantityLitres, expectedEmptyContainers, localStatus)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT localStatus FROM manifest_stops WHERE routeStopId = ?), 'PENDING'))
         ON CONFLICT(routeStopId) DO UPDATE SET
           date=excluded.date, sequence=excluded.sequence, customerName=excluded.customerName,
           address=excluded.address, plannedLat=excluded.plannedLat, plannedLng=excluded.plannedLng,
           expectedQuantityLitres=excluded.expectedQuantityLitres, expectedEmptyContainers=excluded.expectedEmptyContainers`,
        [
          stop.routeStopId,
          stop.date,
          stop.sequence,
          stop.customerName,
          stop.address,
          stop.plannedLat,
          stop.plannedLng,
          stop.expectedQuantityLitres,
          stop.expectedEmptyContainers,
          stop.routeStopId,
        ],
      );
    }
  });
}

export async function getManifestStopsForDate(date: string) {
  const db = await getDb();
  return db.getAllAsync<LocalManifestStop>(
    "SELECT * FROM manifest_stops WHERE date = ? ORDER BY sequence ASC",
    [date],
  );
}

export async function setLocalStopStatus(
  routeStopId: string,
  status: LocalManifestStop["localStatus"],
) {
  const db = await getDb();
  await db.runAsync("UPDATE manifest_stops SET localStatus = ? WHERE routeStopId = ?", [
    status,
    routeStopId,
  ]);
}

export async function enqueueSyncEvent(clientEventId: string, payload: unknown) {
  const db = await getDb();
  await db.runAsync(
    "INSERT INTO sync_queue (clientEventId, payload, createdAt) VALUES (?, ?, ?)",
    [clientEventId, JSON.stringify(payload), new Date().toISOString()],
  );
}

export async function getPendingSyncEvents() {
  const db = await getDb();
  const rows = await db.getAllAsync<{ clientEventId: string; payload: string }>(
    "SELECT clientEventId, payload FROM sync_queue WHERE syncedAt IS NULL",
  );
  return rows.map((row) => JSON.parse(row.payload));
}

export async function markSynced(clientEventId: string) {
  const db = await getDb();
  await db.runAsync("UPDATE sync_queue SET syncedAt = ? WHERE clientEventId = ?", [
    new Date().toISOString(),
    clientEventId,
  ]);
}
