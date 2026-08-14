import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
  Button,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import {
  getManifestStopsForDate,
  getPendingSyncEvents,
  markSynced,
  saveManifestStops,
  type LocalManifestStop,
} from "../db";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Route">;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const STATUS_COLOR: Record<LocalManifestStop["localStatus"], string> = {
  PENDING: "#999",
  COMPLETE: "#2e7d32",
  PARTIAL: "#1565c0",
  ISSUE: "#c62828",
};

export function RouteScreen({ navigation }: Props) {
  const { user, logout } = useAuth();
  const [stops, setStops] = useState<LocalManifestStop[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const date = todayIso();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Try to refresh from the server; if offline, silently fall back to
      // whatever was cached from this morning's last successful pull.
      const manifest = await api.getManifest(date);
      await saveManifestStops(
        manifest.stops.map((stop) => ({
          routeStopId: stop.routeStopId,
          date,
          sequence: stop.sequence,
          customerName: stop.customerName,
          address: stop.address,
          plannedLat: stop.plannedLat ?? null,
          plannedLng: stop.plannedLng ?? null,
          expectedQuantityLitres: stop.expectedQuantityLitres,
          expectedEmptyContainers: stop.expectedEmptyContainers,
          localStatus: "PENDING",
        })),
      );
    } catch {
      // offline — use cache
    }
    setStops(await getManifestStopsForDate(date));
    setLoading(false);
  }, [date]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleSync() {
    setSyncStatus("Syncing...");
    const pending = await getPendingSyncEvents();
    if (pending.length === 0) {
      setSyncStatus("Kuch sync karne ko nahi hai");
      return;
    }
    try {
      const { results } = await api.sync(pending);
      for (const result of results) {
        if (result.status !== "REJECTED") await markSynced(result.clientEventId);
      }
      const rejected = results.filter((r) => r.status === "REJECTED");
      setSyncStatus(
        rejected.length > 0
          ? `${results.length - rejected.length} synced, ${rejected.length} rejected`
          : `${results.length} events synced`,
      );
    } catch (err) {
      setSyncStatus(err instanceof Error ? `Sync failed: ${err.message}` : "Sync failed");
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>{user?.name} — {date}</Text>
        <Button title="Logout" onPress={logout} />
      </View>
      <Button title="Sync now" onPress={handleSync} />
      {syncStatus && <Text style={styles.syncStatus}>{syncStatus}</Text>}
      {stops.length === 0 ? (
        <View style={styles.center}>
          <Text>Aaj ke liye koi route assign nahi hai.</Text>
        </View>
      ) : (
        <FlatList
          data={stops}
          keyExtractor={(item) => item.routeStopId}
          renderItem={({ item }) => (
            <View
              style={[styles.stopRow, { borderLeftColor: STATUS_COLOR[item.localStatus] }]}
              onTouchEnd={() =>
                navigation.navigate("DeliverStop", { routeStopId: item.routeStopId })
              }
            >
              <Text style={styles.stopName}>
                {item.sequence}. {item.customerName}
              </Text>
              <Text>{item.address}</Text>
              <Text>
                {item.expectedQuantityLitres}L · {item.expectedEmptyContainers} empty expected
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerText: { fontWeight: "600" },
  syncStatus: { color: "#555", fontStyle: "italic" },
  stopRow: { borderLeftWidth: 6, padding: 12, marginVertical: 4, backgroundColor: "#f5f5f5", borderRadius: 8 },
  stopName: { fontWeight: "700", fontSize: 16 },
});
