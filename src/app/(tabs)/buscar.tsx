import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/theme";

export default function BuscarScreen() {
  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.centered}>
        <Ionicons name="search-outline" size={44} color={colors.faint} />
        <Text style={styles.title}>Buscar</Text>
        <Text style={styles.sub}>Muy pronto podrás buscar comida, locales y platos.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 8 },
  title: { fontSize: 20, fontWeight: "800", color: colors.ink },
  sub: { fontSize: 13.5, color: colors.muted, textAlign: "center", lineHeight: 20 },
});
