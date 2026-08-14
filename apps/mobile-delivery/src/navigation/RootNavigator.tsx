import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { DeliverStopScreen } from "../screens/DeliverStopScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { RouteScreen } from "../screens/RouteScreen";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { user, loading } = useAuth();

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
          <Stack.Screen name="Route" component={RouteScreen} options={{ title: "Aaj ka Route" }} />
          <Stack.Screen
            name="DeliverStop"
            component={DeliverStopScreen}
            options={{ title: "Deliver" }}
          />
        </Stack.Navigator>
      ) : (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Route" component={LoginScreen} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}
