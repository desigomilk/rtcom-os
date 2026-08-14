import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Crypto from "expo-crypto";
import * as Location from "expo-location";
import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { api } from "../api/client";
import { QrScanner } from "../components/QrScanner";
import { useAuth } from "../context/AuthContext";
import {
  enqueueSyncEvent,
  getManifestStopsForDate,
  markSynced,
  setLocalStopStatus,
  type LocalManifestStop,
} from "../db";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "DeliverStop">;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function DeliverStopScreen({ route, navigation }: Props) {
  const { user } = useAuth();
  const { routeStopId } = route.params;
  const [stop, setStop] = useState<LocalManifestStop | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannedContainers, setScannedContainers] = useState<string[]>([]);
  const [emptyReturned, setEmptyReturned] = useState(0);
  const [isManualOverride, setIsManualOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    getManifestStopsForDate(todayIso()).then((stops) => {
      setStop(stops.find((s) => s.routeStopId === routeStopId) ?? null);
      setEmptyReturned(
        stops.find((s) => s.routeStopId === routeStopId)?.expectedEmptyContainers ?? 0,
      );
    });
    fetchLocation();
  }, [routeStopId]);

  async function fetchLocation() {
    setLocationError(null);
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setLocationError("Location permission denied");
      return;
    }
    try {
      const pos = await Location.getCurrentPositionAsync({});
      setLocation(pos);
    } catch {
      setLocationError("Location abhi nahi mili — bina location ke bhi submit ho sakta hai");
    }
  }

  async function handleSubmit() {
    if (!user) return;
    if (!isManualOverride && scannedContainers.length === 0) {
      Alert.alert("Kam se kam ek container scan karein, ya 'Issue' report karein.");
      return;
    }
    if (isManualOverride && overrideReason.trim().length === 0) {
      Alert.alert("Issue ka reason likhna zaroori hai.");
      return;
    }

    const expectedEmpty = stop?.expectedEmptyContainers ?? 0;
    const status = isManualOverride
      ? "ISSUE"
      : emptyReturned >= expectedEmpty
        ? "COMPLETE"
        : "PARTIAL";

    const event = {
      clientEventId: Crypto.randomUUID(),
      routeStopId,
      deliveryBoyId: user.id,
      date: todayIso(),
      status,
      containerScans: scannedContainers.map((qr) => ({
        containerQrCode: qr,
        scannedAt: new Date().toISOString(),
      })),
      emptyContainersReturned: emptyReturned,
      scannedLat: location?.coords.latitude,
      scannedLng: location?.coords.longitude,
      isManualOverride,
      overrideReason: isManualOverride ? overrideReason : undefined,
      scannedAt: new Date().toISOString(),
    };

    await enqueueSyncEvent(event.clientEventId, event);
    await setLocalStopStatus(routeStopId, status);

    // Best-effort immediate sync — if offline this just fails silently and
    // the event stays queued for the "Sync now" button on the route screen.
    try {
      const { results } = await api.sync([event]);
      if (results[0]?.status !== "REJECTED") await markSynced(event.clientEventId);
    } catch {
      // stays queued, that's fine
    }

    navigation.goBack();
  }

  if (!stop) {
    return (
      <View style={styles.center}>
        <Text>Stop not found in cache.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.name}>{stop.customerName}</Text>
      <Text>{stop.address}</Text>
      <Text style={styles.expected}>
        Expected: {stop.expectedQuantityLitres}L, {stop.expectedEmptyContainers} empty containers
      </Text>

      <Text style={styles.sectionTitle}>Location</Text>
      {location ? (
        <Text>
          {location.coords.latitude.toFixed(5)}, {location.coords.longitude.toFixed(5)}
        </Text>
      ) : (
        <View style={styles.row}>
          <Text style={styles.warn}>{locationError ?? "Fetching..."}</Text>
          <Button title="Retry" onPress={fetchLocation} />
        </View>
      )}

      <Text style={styles.sectionTitle}>Filled containers scanned ({scannedContainers.length})</Text>
      {scannedContainers.map((qr) => (
        <Text key={qr}>• {qr}</Text>
      ))}
      <Button title="Scan container QR" onPress={() => setScannerOpen(true)} />

      <Text style={styles.sectionTitle}>Empty containers returned</Text>
      <View style={styles.row}>
        <Button title="-" onPress={() => setEmptyReturned((n) => Math.max(0, n - 1))} />
        <Text style={styles.count}>{emptyReturned}</Text>
        <Button title="+" onPress={() => setEmptyReturned((n) => n + 1)} />
      </View>

      <View style={styles.row}>
        <Text style={styles.sectionTitle}>Issue / damaged QR (manual override)</Text>
        <Switch value={isManualOverride} onValueChange={setIsManualOverride} />
      </View>
      {isManualOverride && (
        <TextInput
          style={styles.input}
          placeholder="Reason (e.g. QR damaged, wrong container)"
          value={overrideReason}
          onChangeText={setOverrideReason}
        />
      )}

      <Button title="Submit delivery" onPress={handleSubmit} />

      <Modal visible={scannerOpen} animationType="slide">
        <QrScanner
          prompt="Container QR scan karein"
          onScanned={(data) => {
            setScannedContainers((prev) => (prev.includes(data) ? prev : [...prev, data]));
            setScannerOpen(false);
          }}
        />
        <Button title="Cancel" onPress={() => setScannerOpen(false)} />
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 10 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  name: { fontSize: 20, fontWeight: "700" },
  expected: { color: "#555" },
  sectionTitle: { fontWeight: "600", marginTop: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  count: { fontSize: 18, minWidth: 32, textAlign: "center" },
  warn: { color: "#c62828", flex: 1 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10 },
});
