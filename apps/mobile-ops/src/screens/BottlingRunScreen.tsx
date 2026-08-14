import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api, ApiError } from "../api/client";
import { QrScanner } from "../components/QrScanner";
import { useLanguage } from "../i18n/LanguageContext";

interface Chiller {
  id: string;
  name: string;
}

export function BottlingRunScreen() {
  const { t } = useLanguage();
  const [chillers, setChillers] = useState<Chiller[]>([]);
  const [chillerId, setChillerId] = useState<string | null>(null);
  const [variant, setVariant] = useState("Full Cream 500ml");
  const [containerType, setContainerType] = useState<"BOTTLE" | "BARREL" | "JAR">("BOTTLE");
  const [manualCount, setManualCount] = useState("");
  const [cameraCount, setCameraCount] = useState("");
  const [scannedQrs, setScannedQrs] = useState<string[]>([]);
  const [scannerOpen, setScannerOpen] = useState(false);

  useEffect(() => {
    api.get<Chiller[]>("/chillers").then(setChillers).catch(() => {});
  }, []);

  async function handleSubmit() {
    if (!chillerId || scannedQrs.length === 0) {
      Alert.alert("Chiller select karein aur kam se kam ek container scan karein");
      return;
    }
    try {
      const run = await api.post<{ mismatchFlag: boolean }>("/bottling-runs", {
        chillerId,
        manualCount: Number(manualCount) || scannedQrs.length,
        cameraCount: cameraCount ? Number(cameraCount) : undefined,
        containers: scannedQrs.map((qrCode) => ({ qrCode, containerType, variant })),
      });
      if (run.mismatchFlag) Alert.alert(t("bottleMismatch"));
      else Alert.alert(t("success"));
      setScannedQrs([]);
      setManualCount("");
      setCameraCount("");
    } catch (err) {
      Alert.alert(err instanceof ApiError ? err.message : "Failed to submit run");
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>{t("chiller")}</Text>
      {chillers.map((c) => (
        <View
          key={c.id}
          style={[styles.row, chillerId === c.id && styles.rowSelected]}
          onTouchEnd={() => setChillerId(c.id)}
        >
          <Text>{c.name}</Text>
        </View>
      ))}

      <Text style={styles.label}>{t("variant")}</Text>
      <TextInput style={styles.input} value={variant} onChangeText={setVariant} />

      <Text style={styles.label}>{t("manualCount")}</Text>
      <TextInput style={styles.input} keyboardType="numeric" value={manualCount} onChangeText={setManualCount} />

      <Text style={styles.label}>{t("cameraCount")}</Text>
      <TextInput style={styles.input} keyboardType="numeric" value={cameraCount} onChangeText={setCameraCount} />

      <Text style={styles.label}>
        {t("containersScanned")} ({scannedQrs.length})
      </Text>
      {scannedQrs.map((qr) => (
        <Text key={qr}>• {qr}</Text>
      ))}
      <Button title={t("scanContainer")} onPress={() => setScannerOpen(true)} />

      <Button title={t("submit")} onPress={handleSubmit} />

      <Modal visible={scannerOpen} animationType="slide">
        <QrScanner
          prompt={t("scanContainer")}
          onScanned={(data) => {
            setScannedQrs((prev) => (prev.includes(data) ? prev : [...prev, data]));
            setScannerOpen(false);
          }}
        />
        <Button title="Cancel" onPress={() => setScannerOpen(false)} />
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 8 },
  label: { fontWeight: "600", marginTop: 8 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10 },
  row: { padding: 10, borderRadius: 8, backgroundColor: "#f5f5f5", marginBottom: 4 },
  rowSelected: { backgroundColor: "#c8e6c9" },
});
