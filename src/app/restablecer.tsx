import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
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

import { resetPassword } from "@/lib/api";
import { colors } from "@/theme";

/**
 * RESTABLECER LA CONTRASEÑA
 *
 * Se llega aquí desde el enlace del correo, que trae `?token=...`. No lleva
 * sesión: justamente el usuario no puede entrar. Al terminar lo mandamos al
 * login con su contraseña nueva (este endpoint no devuelve token).
 */
export default function RestablecerScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const insets = useSafeAreaInsets();

  const [password, setPassword] = useState("");
  const [repetir, setRepetir] = useState("");
  const [verPass, setVerPass] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  /** El token venció o ya se usó → hay que pedir otro enlace. */
  const [tokenMuerto, setTokenMuerto] = useState(false);

  const enviar = async () => {
    if (!token) return;
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== repetir) {
      setError("Las dos contraseñas no coinciden.");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      await resetPassword(token, password);
      setListo(true);
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : "No se pudo restablecer.";
      setError(mensaje);
      // El backend da el mismo mensaje si el token es inválido, venció o ya se
      // usó (a propósito). Con cualquiera de los tres hay que pedir otro.
      if (/enlace/i.test(mensaje)) setTokenMuerto(true);
      setEnviando(false);
    }
  };

  /* ---------- sin token en la URL ---------- */

  if (!token) {
    return (
      <Marco>
        <Ionicons name="link-outline" size={46} color={colors.faint} />
        <Text style={styles.titulo}>Enlace incompleto</Text>
        <Text style={styles.texto}>
          Abre el enlace tal cual te llegó al correo. Si lo copiaste a mano, puede que se haya
          quedado un pedazo fuera.
        </Text>
        <TouchableOpacity style={styles.cta} onPress={() => router.replace("/login")}>
          <Text style={styles.ctaText}>Ir al inicio de sesión</Text>
        </TouchableOpacity>
      </Marco>
    );
  }

  /* ---------- listo ---------- */

  if (listo) {
    return (
      <Marco>
        <View style={styles.exitoCirculo}>
          <Ionicons name="checkmark" size={40} color="#FFF" />
        </View>
        <Text style={styles.titulo}>¡Contraseña cambiada!</Text>
        <Text style={styles.texto}>
          Ya puedes entrar con tu contraseña nueva.
        </Text>
        <TouchableOpacity style={styles.cta} onPress={() => router.replace("/login")}>
          <Text style={styles.ctaText}>Iniciar sesión</Text>
        </TouchableOpacity>
      </Marco>
    );
  }

  /* ---------- formulario ---------- */

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.pantalla}
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[colors.fc, "#FF8347"]}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + 40 }]}
        >
          <View style={styles.heroIcono}>
            <Ionicons name="lock-open-outline" size={30} color={colors.fc} />
          </View>
          <Text style={styles.heroTitulo}>Nueva contraseña</Text>
          <Text style={styles.heroSub}>Elige una que no uses en otro sitio.</Text>
        </LinearGradient>

        <View style={styles.tarjeta}>
          <Text style={styles.label}>Contraseña nueva</Text>
          <View style={styles.inputRow}>
            <Ionicons name="lock-closed-outline" size={18} color="#9A8D86" />
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Al menos 8 caracteres"
              placeholderTextColor={colors.faint}
              secureTextEntry={!verPass}
              autoCapitalize="none"
              autoFocus
            />
            <TouchableOpacity onPress={() => setVerPass((v) => !v)} hitSlop={10}>
              <Ionicons
                name={verPass ? "eye-off-outline" : "eye-outline"}
                size={19}
                color="#9A8D86"
              />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Repítela</Text>
          <View style={styles.inputRow}>
            <Ionicons name="lock-closed-outline" size={18} color="#9A8D86" />
            <TextInput
              style={styles.input}
              value={repetir}
              onChangeText={setRepetir}
              placeholder="La misma de arriba"
              placeholderTextColor={colors.faint}
              secureTextEntry={!verPass}
              autoCapitalize="none"
            />
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          {tokenMuerto ? (
            <TouchableOpacity style={styles.cta} onPress={() => router.replace("/login")}>
              <Text style={styles.ctaText}>Pedir un enlace nuevo</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.cta, enviando && styles.apagado]}
              onPress={enviar}
              disabled={enviando}
              activeOpacity={0.9}
            >
              {enviando ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.ctaText}>Guardar contraseña</Text>
              )}
            </TouchableOpacity>
          )}

          <Text style={styles.legal}>
            El enlace del correo vence a la hora y solo se puede usar una vez.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Marco centrado para los estados sin formulario. */
function Marco({ children }: { children: React.ReactNode }) {
  return <View style={styles.marco}>{children}</View>;
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.paper },
  marco: {
    flex: 1,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },

  hero: {
    alignItems: "center",
    paddingBottom: 50,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  heroIcono: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitulo: {
    color: "#FFF",
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginTop: 14,
  },
  heroSub: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 6,
  },

  tarjeta: {
    backgroundColor: colors.surface,
    marginHorizontal: 18,
    marginTop: -22,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 26,
    shadowColor: "#28140A",
    shadowOpacity: 0.08,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },

  titulo: { fontSize: 22, fontWeight: "800", color: colors.ink, textAlign: "center" },
  texto: { fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 21 },

  exitoCirculo: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.leaf,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },

  label: { fontSize: 13, fontWeight: "700", color: colors.ink, marginBottom: 6, marginTop: 8 },
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
    marginTop: 22,
    paddingHorizontal: 30,
  },
  ctaText: { color: "#FFF", fontSize: 16, fontWeight: "800" },
  apagado: { opacity: 0.7 },
  legal: {
    textAlign: "center",
    fontSize: 12,
    fontWeight: "500",
    color: colors.faint,
    lineHeight: 17,
    marginTop: 16,
  },
});
