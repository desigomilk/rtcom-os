import * as Crypto from "expo-crypto";
import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  Alert,
  Button,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api, ApiError } from "../api/client";
import { QrScanner } from "../components/QrScanner";
import { useLanguage } from "../i18n/LanguageContext";

interface Batch {
  id: string;
  qrCode: string;
  status: "AT_FARM" | "IN_TRANSIT" | "AT_PLANT";
}

const STATUS_COLOR: Record<Batch["status"], string> = {
  AT_FARM: "#999",
  IN_TRANSIT: "#1565c0",
  AT_PLANT: "#2e7d32",
};

export function BatchesScreen() {
  const { t } = useLanguage();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [receivingBatch, setReceivingBatch] = useState<Batch | null>(null);
  const [fat, setFat] = useState("");
  const [snf, setSnf] = useState("");

  const refresh = useCallback(() => {
    api.get<Batch[]>("/batches").then(setBatches).catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  async function createBatch(qrCode: string) {
    setScannerOpen(false);
    try {
      await api.post("/batches", { qrCode });
      refresh();
    } catch (err) {
      Alert.alert(err instanceof ApiError ? err.message : "Failed to create batch");
    }
  }

  async function handleDispatch(batch: Batch) {
    try {
      await api.post(`/batches/${batch.id}/dispatch`);
      refresh();
    } catch (err) {
      Alert.alert(err instanceof ApiError ? err.message : "Failed to dispatch");
    }
  }

  async function handleReceive() {
    if (!receivingBatch) return;
    try {
      const receipt = await api.post<{ mismatchFlag: boolean }>(
        `/batches/${receivingBatch.id}/receive`,
        { fat: Number(fat), snf: Number(snf) },
      );
      if (receipt.mismatchFlag) Alert.alert(t("mismatchAlert"));
      else Alert.alert(t("success"));
      setReceivingBatch(null);
      setFat("");
      setSnf("");
      refresh();
    } catch (err) {
      Alert.alert(err instanceof ApiError ? err.message : "Failed to receive");
    }
  }

  return (
    <View style={styles.container}>
      <Button
        title={t("createBatch")}
        onPress={() => {
          const qrCode = `BATCH-${Crypto.randomUUID().slice(0, 8).toUpperCase()}`;
          createBatch(qrCode);
        }}
      />
      <Button title={`${t("batchQr")} (scan)`} onPress={() => setScannerOpen(true)} />

      <FlatList
        data={batches}
        keyExtractor={(b) => b.id}
        renderItem={({ item }) => (
          <View style={[styles.row, { borderLeftColor: STATUS_COLOR[item.status] }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.qr}>{item.qrCode}</Text>
              <Text style={{ color: STATUS_COLOR[item.status] }}>{item.status}</Text>
            </View>
            {item.status === "AT_FARM" && <Button title={t("dispatch")} onPress={() => handleDispatch(item)} />}
            {item.status === "IN_TRANSIT" && (
              <Button title={t("receiveAtPlant")} onPress={() => setReceivingBatch(item)} />
            )}
          </View>
        )}
      />

      <Modal visible={scannerOpen} animationType="slide">
        <QrScanner prompt={t("batchQr")} onScanned={createBatch} />
        <Button title="Cancel" onPress={() => setScannerOpen(false)} />
      </Modal>

      <Modal visible={!!receivingBatch} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.label}>{t("fat")}</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={fat} onChangeText={setFat} />
            <Text style={styles.label}>{t("snf")}</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={snf} onChangeText={setSnf} />
            <Button title={t("submit")} onPress={handleReceive} />
            <Button title="Cancel" onPress={() => setReceivingBatch(null)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderLeftWidth: 6,
    padding: 12,
    marginVertical: 4,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
  },
  qr: { fontWeight: "700" },
  label: { fontWeight: "600", marginTop: 8 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 24 },
  modalCard: { backgroundColor: "white", borderRadius: 12, padding: 16, gap: 8 },
});
