import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../i18n/LanguageContext";
import { BatchesScreen } from "../screens/BatchesScreen";
import { BottlingRunScreen } from "../screens/BottlingRunScreen";
import { ChillerBlendScreen } from "../screens/ChillerBlendScreen";
import { FarmMilkEntryScreen } from "../screens/FarmMilkEntryScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { LoginScreen } from "../screens/LoginScreen";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { user, loading } = useAuth();
  const { t } = useLanguage();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? (
        <Stack.Navigator>
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: t("home") }} />
          <Stack.Screen
            name="FarmMilkEntry"
            component={FarmMilkEntryScreen}
            options={{ title: t("farmMilkEntry") }}
          />
          <Stack.Screen name="Batches" component={BatchesScreen} options={{ title: t("batches") }} />
          <Stack.Screen
            name="ChillerBlend"
            component={ChillerBlendScreen}
            options={{ title: t("chillerBlend") }}
          />
          <Stack.Screen
            name="BottlingRun"
            component={BottlingRunScreen}
            options={{ title: t("bottlingRun") }}
          />
        </Stack.Navigator>
      ) : (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Home" component={LoginScreen} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}
