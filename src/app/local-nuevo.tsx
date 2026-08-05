import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError, crearLocal } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { colors } from "@/theme";

/**
 * CREAR UN LOCAL
 *
 * Nace `pendiente` (no sale en el Inicio hasta que un admin lo apruebe) y
 * `cerrado` con envío 0. Eso hay que decírselo al dueño aquí mismo, o va a
 * creer que algo falló cuando no vea su local en la app.
 */
export default function NuevoLocalScreen() {
  const { token, cerrarSesion } = useAuth();
  const insets = useSafeAreaInsets();

  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token) return null;

  const guardar = async () => {
    if (!nombre.trim()) {
      setError("El local necesita un nombre.");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const local = await crearLocal(token, {
        nombre: nombre.trim(),
        categoria: categoria.trim() || undefined,
        telefono: telefono.trim() || undefined,
        direccion: direccion.trim() || undefined,
      });
      Alert.alert(
        "Local creado",
        `${local.nombre} está en revisión. Mientras tanto puedes montar su carta y su portada; cuando lo aprueben saldrá publicado.`,
        [{ text: "Entendido", onPress: () => router.back() }],
      );
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        cerrarSesion();
        return;
      }
      // 403 = sin plan al día · 409 = llegó al tope. Los dos traen su mensaje.
      if (e instanceof ApiError && e.status === 403) {
        Alert.alert("Necesitas el plan", e.message, [
          { text: "Ahora no", style: "cancel" },
          { text: "Ver el plan", onPress: () => router.replace("/plan") },
        ]);
      } else if (e instanceof ApiError && e.status === 409) {
        Alert.alert("Llegaste al tope", e.message);
      } else {
        setError(e instanceof Error ? e.message : "No se pudo crear el local.");
      }
      setGuardando(false);
    }
  };

  return (
    <View style={styles.pantalla}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.titulo}>Nuevo local</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 40 }}
        >
          <View style={styles.aviso}>
            <Ionicons name="information-circle-outline" size={18} color={colors.fc} />
            <Text style={styles.avisoText}>
              Tu local entra en revisión. No aparecerá en el Inicio hasta que lo aprueben, pero ya
              podrás montar la carta y subir la portada.
            </Text>
          </View>

          <Text style={styles.label}>Nombre del local *</Text>
          <View style={styles.inputRow}>
            <Ionicons name="storefront-outline" size={18} color="#9A8D86" />
            <TextInput
              style={styles.input}
              value={nombre}
              onChangeText={setNombre}
              placeholder="Pizzería Napolitana"
              placeholderTextColor={colors.faint}
              autoFocus
            />
          </View>

          <Text style={styles.label}>Categoría</Text>
          <View style={styles.inputRow}>
            <Ionicons name="pricetag-outline" size={18} color="#9A8D86" />
            <TextInput
              style={styles.input}
              value={categoria}
              onChangeText={setCategoria}
              placeholder="Pizzería · Italiana"
              placeholderTextColor={colors.faint}
            />
          </View>

          <Text style={styles.label}>Teléfono</Text>
          <View style={styles.inputRow}>
            <Ionicons name="call-outline" size={18} color="#9A8D86" />
            <TextInput
              style={styles.input}
              value={telefono}
              onChangeText={setTelefono}
              placeholder="809-555-0000"
              placeholderTextColor={colors.faint}
              keyboardType="phone-pad"
            />
          </View>

          <Text style={styles.label}>Dirección</Text>
          <View style={styles.inputRow}>
            <Ionicons name="location-outline" size={18} color="#9A8D86" />
            <TextInput
              style={styles.input}
              value={direccion}
              onChangeText={setDireccion}
              placeholder="Av. Lincoln 1002"
              placeholderTextColor={colors.faint}
            />
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.cta, guardando && styles.apagado]}
            onPress={guardar}
            disabled={guardando}
            activeOpacity={0.9}
          >
            {guardando ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.ctaText}>Crear local</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.nota}>
            El envío, los tiempos de entrega y el horario se configuran después, al editar el local.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  titulo: { flex: 1, fontSize: 21, fontWeight: "800", color: colors.ink, letterSpacing: -0.3 },

  aviso: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    backgroundColor: colors.fcSoft,
    borderRadius: 16,
    padding: 14,
  },
  avisoText: { flex: 1, color: colors.fcDeep, fontSize: 12.5, fontWeight: "600", lineHeight: 18 },

  label: { fontSize: 13, fontWeight: "700", color: colors.ink, marginBottom: 6, marginTop: 16 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 52,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
  },
  input: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.ink, paddingVertical: 0 },
  error: { color: colors.fcDeep, fontSize: 13, fontWeight: "700", marginTop: 14 },

  cta: {
    height: 54,
    borderRadius: 15,
    backgroundColor: colors.fc,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  ctaText: { color: "#FFF", fontSize: 16, fontWeight: "800" },
  apagado: { opacity: 0.7 },
  nota: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.muted,
    textAlign: "center",
    lineHeight: 18,
    marginTop: 16,
  },
});
