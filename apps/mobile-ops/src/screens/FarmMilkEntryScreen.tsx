import { useEffect, useState } from "react";
import { Alert, Button, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { api, ApiError } from "../api/client";
import { useLanguage } from "../i18n/LanguageContext";

interface Farm {
  id: string;
  name: string;
}

export function FarmMilkEntryScreen() {
  const { t } = useLanguage();
  const [farms, setFarms] = useState<Farm[]>([]);
  const [farmId, setFarmId] = useState<string | null>(null);
  const [litres, setLitres] = useState("");
  const [fat, setFat] = useState("");
  const [snf, setSnf] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get<Farm[]>("/farms").then(setFarms).catch(() => {});
  }, []);

  async function handleSubmit() {
    if (!farmId) {
      Alert.alert("Farm select karein");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/farm-milk-entries", {
        farmId,
        litres: Number(litres),
        fat: Number(fat),
        snf: Number(snf),
      });
      Alert.alert(t("success"));
      setLitres("");
      setFat("");
      setSnf("");
    } catch (err) {
      Alert.alert(err instanceof ApiError ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>{t("farm")}</Text>
      {farms.map((farm) => (
        <View
          key={farm.id}
          style={[styles.farmRow, farmId === farm.id && styles.farmRowSelected]}
          onTouchEnd={() => setFarmId(farm.id)}
        >
          <Text>{farm.name}</Text>
        </View>
      ))}

      <Text style={styles.label}>{t("litres")}</Text>
      <TextInput style={styles.input} keyboardType="numeric" value={litres} onChangeText={setLitres} />

      <Text style={styles.label}>{t("fat")}</Text>
      <TextInput style={styles.input} keyboardType="numeric" value={fat} onChangeText={setFat} />

      <Text style={styles.label}>{t("snf")}</Text>
      <TextInput style={styles.input} keyboardType="numeric" value={snf} onChangeText={setSnf} />

      <Button title={submitting ? "..." : t("submit")} onPress={handleSubmit} disabled={submitting} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 8 },
  label: { fontWeight: "600", marginTop: 8 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10 },
  farmRow: { padding: 10, borderRadius: 8, backgroundColor: "#f5f5f5", marginBottom: 4 },
  farmRowSelected: { backgroundColor: "#c8e6c9" },
});
