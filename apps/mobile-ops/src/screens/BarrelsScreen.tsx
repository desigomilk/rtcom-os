import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Alert, Button, FlatList, Modal, Text, View, StyleSheet } from "react-native";
import { api, ApiError } from "../api/client";
import { QrScanner } from "../components/QrScanner";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../i18n/LanguageContext";

interface Farm {
  id: string;
  name: string;
}
interface Barrel {
  id: string;
  qrCode: string;
  status: string;
  currentFarm: { name: string } | null;
}

const STATUS_LABEL_COLOR: Record<string, string> = {
  AT_FARM_EMPTY: "#999",
  AT_FARM_FILLED: "#f9a825",
  IN_TRANSIT_TO_PLANT: "#1565c0",
  AT_PLANT_EMPTIED: "#6a1b9a",
  IN_TRANSIT_TO_FARM: "#ef6c00",
};

export function BarrelsScreen() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [barrels, setBarrels] = useState<Barrel[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [scannerMode, setScannerMode] = useState<"DISPATCH" | "ARRIVE" | null>(null);
  const [pendingBarrelQr, setPendingBarrelQr] = useState<string | null>(null);
  const [farmPickerOpen, setFarmPickerOpen] = useState(false);

  const canDispatch = user?.role === "PLANT_STAFF" || user?.role === "ERP_ADMIN";
  const canReceive = user?.role === "FARM_STAFF" || user?.role === "ERP_ADMIN";

  const refresh = useCallback(() => {
    api.get<Barrel[]>("/barrels").then(setBarrels).catch(() => {});
    api.get<Farm[]>("/farms").then(setFarms).catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  async function findBarrelIdByQr(qrCode: string): Promise<string | null> {
    const list = await api.get<Barrel[]>("/barrels");
    return list.find((b) => b.qrCode === qrCode)?.id ?? null;
  }

  async function handleDispatchScan(qrCode: string) {
    setScannerMode(null);
    const barrelId = await findBarrelIdByQr(qrCode);
    if (!barrelId) {
      Alert.alert("Barrel not found");
      return;
    }
    try {
      await api.post(`/barrels/${barrelId}/dispatch-to-farm`);
      Alert.alert(t("success"));
      refresh();
    } catch (err) {
      Alert.alert(err instanceof ApiError ? err.message : "Failed");
    }
  }

  async function handleArriveScan(qrCode: string) {
    setScannerMode(null);
    setPendingBarrelQr(qrCode);
    setFarmPickerOpen(true);
  }

  async function confirmArrival(farmId: string) {
    setFarmPickerOpen(false);
    if (!pendingBarrelQr) return;
    const barrelId = await findBarrelIdByQr(pendingBarrelQr);
    if (!barrelId) {
      Alert.alert("Barrel not found");
      return;
    }
    try {
      await api.post(`/barrels/${barrelId}/arrive-at-farm`, { farmId });
      Alert.alert(t("success"));
      refresh();
    } catch (err) {
      Alert.alert(err instanceof ApiError ? err.message : "Failed");
    } finally {
      setPendingBarrelQr(null);
    }
  }

  return (
    <View style={styles.container}>
      {canDispatch && (
        <Button title={t("barrelDispatchToFarm")} onPress={() => setScannerMode("DISPATCH")} />
      )}
      {canReceive && <Button title={t("barrelArriveAtFarm")} onPress={() => setScannerMode("ARRIVE")} />}

      <FlatList
        data={barrels}
        keyExtractor={(b) => b.id}
        renderItem={({ item }) => (
          <View style={[styles.row, { borderLeftColor: STATUS_LABEL_COLOR[item.status] ?? "#999" }]}>
            <Text style={styles.qr}>{item.qrCode}</Text>
            <Text style={{ color: STATUS_LABEL_COLOR[item.status] ?? "#999" }}>
              {item.status.replaceAll("_", " ")}
            </Text>
            {item.currentFarm && <Text style={styles.farm}>{item.currentFarm.name}</Text>}
          </View>
        )}
      />

      <Modal visible={scannerMode !== null} animationType="slide">
        <QrScanner
          prompt={t("scanBarrel")}
          onScanned={scannerMode === "DISPATCH" ? handleDispatchScan : handleArriveScan}
        />
        <Button title="Cancel" onPress={() => setScannerMode(null)} />
      </Modal>

      <Modal visible={farmPickerOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.label}>{t("farm")}</Text>
            {farms.map((farm) => (
              <View key={farm.id} style={styles.farmRow} onTouchEnd={() => confirmArrival(farm.id)}>
                <Text>{farm.name}</Text>
              </View>
            ))}
            <Button title="Cancel" onPress={() => setFarmPickerOpen(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8 },
  row: { borderLeftWidth: 6, padding: 12, marginVertical: 4, backgroundColor: "#f5f5f5", borderRadius: 8 },
  qr: { fontWeight: "700" },
  farm: { color: "#555", fontSize: 12 },
  label: { fontWeight: "600", marginTop: 8 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 24 },
  modalCard: { backgroundColor: "white", borderRadius: 12, padding: 16, gap: 8 },
  farmRow: { padding: 10, borderRadius: 8, backgroundColor: "#f0f0f0", marginBottom: 4 },
});
