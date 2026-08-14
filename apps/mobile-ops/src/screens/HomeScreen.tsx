import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Button, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../i18n/LanguageContext";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export function HomeScreen({ navigation }: Props) {
  const { user, logout } = useAuth();
  const { t, toggle, language } = useLanguage();

  const canFarm = user?.role === "FARM_STAFF" || user?.role === "ERP_ADMIN";
  const canPlant = user?.role === "PLANT_STAFF" || user?.role === "ERP_ADMIN";

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("home")}</Text>
      <Text style={styles.subtitle}>{user?.name}</Text>

      {canFarm && (
        <Button title={t("farmMilkEntry")} onPress={() => navigation.navigate("FarmMilkEntry")} />
      )}
      <Button title={t("batches")} onPress={() => navigation.navigate("Batches")} />
      <Button title={t("barrels")} onPress={() => navigation.navigate("Barrels")} />
      {canPlant && (
        <>
          <Button title={t("chillerBlend")} onPress={() => navigation.navigate("ChillerBlend")} />
          <Button title={t("bottlingRun")} onPress={() => navigation.navigate("BottlingRun")} />
        </>
      )}

      <View style={styles.footer}>
        <Button title={language === "hi" ? "English" : "हिन्दी"} onPress={toggle} />
        <Button title={t("logout")} onPress={logout} color="#c62828" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 12 },
  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { color: "#555", marginBottom: 12 },
  footer: { marginTop: "auto", gap: 8 },
});
