import { useEffect, useState } from "react";
import { Alert, Button, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, ApiError } from "../api/client";
import { useLanguage } from "../i18n/LanguageContext";

interface Chiller {
  id: string;
  name: string;
}
interface Batch {
  id: string;
  qrCode: string;
  status: string;
}

export function ChillerBlendScreen() {
  const { t } = useLanguage();
  const [chillers, setChillers] = useState<Chiller[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [chillerId, setChillerId] = useState<string | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);

  useEffect(() => {
    api.get<Chiller[]>("/chillers").then(setChillers).catch(() => {});
    api
      .get<Batch[]>("/batches?status=AT_PLANT")
      .then(setBatches)
      .catch(() => {});
  }, []);

  async function handleBlend() {
    if (!chillerId || !batchId) {
      Alert.alert("Chiller aur batch dono select karein");
      return;
    }
    try {
      await api.post(`/chillers/${chillerId}/blend`, { batchId });
      Alert.alert(t("success"));
      setBatchId(null);
    } catch (err) {
      Alert.alert(err instanceof ApiError ? err.message : "Failed to blend");
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

      <Text style={styles.label}>{t("selectBatch")}</Text>
      {batches.map((b) => (
        <View
          key={b.id}
          style={[styles.row, batchId === b.id && styles.rowSelected]}
          onTouchEnd={() => setBatchId(b.id)}
        >
          <Text>{b.qrCode}</Text>
        </View>
      ))}

      <Button title={t("blend")} onPress={handleBlend} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 8 },
  label: { fontWeight: "600", marginTop: 8 },
  row: { padding: 10, borderRadius: 8, backgroundColor: "#f5f5f5", marginBottom: 4 },
  rowSelected: { backgroundColor: "#c8e6c9" },
});
