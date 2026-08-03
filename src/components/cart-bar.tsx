import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useCart } from "@/lib/cart-context";
import { colors } from "@/theme";

/**
 * Barra flotante del carrito. No se pinta si el carrito está vacío, así que
 * se puede dejar puesta en cualquier pantalla sin condicionales.
 */
export function CartBar({ color = colors.fc }: { color?: string }) {
  const { cantidadTotal, subtotal } = useCart();
  const insets = useSafeAreaInsets();

  if (cantidadTotal === 0) return null;

  return (
    <TouchableOpacity
      style={[styles.barra, { backgroundColor: color, bottom: insets.bottom + 16 }]}
      onPress={() => router.push("/carrito")}
      activeOpacity={0.9}
    >
      <View style={styles.contador}>
        <Text style={[styles.contadorText, { color }]}>{cantidadTotal}</Text>
      </View>
      <Text style={styles.texto}>Ver el carrito</Text>
      <Text style={styles.total}>RD${subtotal}</Text>
      <Ionicons name="chevron-forward" size={18} color="#FFF" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  barra: {
    position: "absolute",
    left: 18,
    right: 18,
    height: 58,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    shadowColor: "#28140A",
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  contador: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    paddingHorizontal: 7,
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
  },
  contadorText: { fontSize: 13, fontWeight: "800" },
  texto: { flex: 1, color: "#FFF", fontSize: 15, fontWeight: "800" },
  total: { color: "#FFF", fontSize: 15, fontWeight: "800" },
});
