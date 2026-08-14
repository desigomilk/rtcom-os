import { CameraView, useCameraPermissions } from "expo-camera";
import { useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";

interface Props {
  onScanned: (data: string) => void;
  prompt: string;
}

export function QrScanner({ onScanned, prompt }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [hasScanned, setHasScanned] = useState(false);

  if (!permission) return <View />;

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Camera access chahiye.</Text>
        <Button title="Allow camera" onPress={requestPermission} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.prompt}>{prompt}</Text>
      <CameraView
        style={styles.camera}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={({ data }) => {
          if (hasScanned) return;
          setHasScanned(true);
          onScanned(data);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  camera: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 12 },
  text: { textAlign: "center" },
  prompt: { textAlign: "center", padding: 12, fontWeight: "600" },
});
