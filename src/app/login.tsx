import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError, login, olvidePassword, register } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { colors } from "@/theme";

type Campo = "nombre" | "telefono" | "email" | "password" | null;

export default function LoginScreen() {
  const { iniciarSesion } = useAuth();
  const insets = useSafeAreaInsets();

  const [modo, setModo] = useState<"login" | "registro">("login");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verPass, setVerPass] = useState(false);
  const [foco, setFoco] = useState<Campo>("email");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [olvide, setOlvide] = useState(false);

  const esRegistro = modo === "registro";

  const cambiarModo = (m: "login" | "registro") => {
    setModo(m);
    setError(null);
  };

  const entrar = async () => {
    if (!email.trim() || !password) {
      setError("Escribe tu correo y tu contraseña.");
      return;
    }
    if (esRegistro) {
      if (!nombre.trim() || !telefono.trim()) {
        setError("Completa tu nombre y tu teléfono.");
        return;
      }
      if (password.length < 8) {
        setError("La contraseña debe tener al menos 8 caracteres.");
        return;
      }
    }
    setEnviando(true);
    setError(null);
    try {
      const respuesta = esRegistro
        ? await register({
            nombre: nombre.trim(),
            email: email.trim(),
            telefono: telefono.trim(),
            password,
          })
        : await login(email.trim(), password);
      // Guardar sesión → el guard del layout raíz nos lleva a los tabs solo.
      await iniciarSesion(respuesta.token, respuesta.user);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setError("Correo o contraseña incorrectos.");
      } else if (e instanceof ApiError && e.status === 409) {
        setError("Ese correo ya está registrado. Prueba iniciar sesión.");
      } else {
        setError(e instanceof Error ? e.message : "No se pudo conectar con el servidor.");
      }
      setEnviando(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ===== Hero coral con círculos decorativos ===== */}
        <LinearGradient
          colors={[colors.fc, "#FF8347"]}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + 36 }]}
        >
          <View style={styles.circuloArriba} />
          <View style={styles.circuloAbajo} />
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>F</Text>
          </View>
          <Text style={styles.title}>Foodclub</Text>
          <Text style={styles.sub}>
            Pide de tus locales favoritos,{"\n"}cada uno con su propio sabor.
          </Text>
        </LinearGradient>

        {/* ===== Tarjeta blanca ===== */}
        <View style={styles.card}>
          <View style={styles.segment}>
            <TouchableOpacity
              style={[styles.segmentItem, !esRegistro && styles.segmentActive]}
              onPress={() => cambiarModo("login")}
            >
              <Text style={!esRegistro ? styles.segmentActiveText : styles.segmentText}>
                Iniciar sesión
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segmentItem, esRegistro && styles.segmentActive]}
              onPress={() => cambiarModo("registro")}
            >
              <Text style={esRegistro ? styles.segmentActiveText : styles.segmentText}>
                Crear cuenta
              </Text>
            </TouchableOpacity>
          </View>

          {esRegistro && (
            <>
              <Text style={styles.inputLabel}>Nombre</Text>
              <CampoInput activo={foco === "nombre"} icono="person-outline">
                <TextInput
                  style={styles.input}
                  value={nombre}
                  onChangeText={setNombre}
                  onFocus={() => setFoco("nombre")}
                  placeholder="Ej: María Díaz"
                  placeholderTextColor={colors.faint}
                  autoComplete="name"
                />
              </CampoInput>

              <Text style={styles.inputLabel}>Teléfono</Text>
              <CampoInput activo={foco === "telefono"} icono="call-outline">
                <TextInput
                  style={styles.input}
                  value={telefono}
                  onChangeText={setTelefono}
                  onFocus={() => setFoco("telefono")}
                  placeholder="809-555-0000"
                  placeholderTextColor={colors.faint}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                />
              </CampoInput>
            </>
          )}

          <Text style={styles.inputLabel}>Correo o teléfono</Text>
          <CampoInput activo={foco === "email"} icono="mail-outline">
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              onFocus={() => setFoco("email")}
              placeholder="maria.diaz@gmail.com"
              placeholderTextColor={colors.faint}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
          </CampoInput>

          <Text style={styles.inputLabel}>Contraseña</Text>
          <CampoInput activo={foco === "password"} icono="lock-closed-outline">
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              onFocus={() => setFoco("password")}
              placeholder="••••••••"
              placeholderTextColor={colors.faint}
              secureTextEntry={!verPass}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setVerPass((v) => !v)} hitSlop={10}>
              <Ionicons name={verPass ? "eye-off-outline" : "eye-outline"} size={19} color="#9A8D86" />
            </TouchableOpacity>
          </CampoInput>

          {!esRegistro && (
            <TouchableOpacity style={styles.olvidaste} onPress={() => setOlvide(true)}>
              <Text style={styles.olvidasteText}>¿Olvidaste tu contraseña?</Text>
            </TouchableOpacity>
          )}

          {error && <Text style={styles.formError}>{error}</Text>}

          <TouchableOpacity
            style={[styles.cta, enviando && styles.ctaDisabled]}
            onPress={entrar}
            disabled={enviando}
            activeOpacity={0.85}
          >
            {enviando ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.ctaText}>{esRegistro ? "Crear cuenta" : "Entrar"}</Text>
            )}
          </TouchableOpacity>

          {/* ===== o continúa con ===== */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>o continúa con</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.socialRow}>
            <TouchableOpacity style={styles.socialBtn} activeOpacity={0.8}>
              <Text style={styles.googleG}>G</Text>
              <Text style={styles.socialText}>Google</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialBtn} activeOpacity={0.8}>
              <Ionicons name="logo-apple" size={18} color="#111" />
              <Text style={styles.socialText}>Apple</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.legal}>
            Al continuar aceptas los Términos{"\n"}y la Política de privacidad.
          </Text>
        </View>
      </ScrollView>

      {olvide && (
        <ModalOlvide emailInicial={email} onCerrar={() => setOlvide(false)} />
      )}
    </KeyboardAvoidingView>
  );
}

/**
 * "Olvidé mi contraseña".
 *
 * El backend responde `200` exista o no el correo, a propósito: si
 * distinguiera, cualquiera podría averiguar quién tiene cuenta aquí probando
 * emails. Por eso el mensaje de éxito es siempre el mismo y no intentamos
 * deducir nada.
 */
function ModalOlvide({
  emailInicial,
  onCerrar,
}: {
  emailInicial: string;
  onCerrar: () => void;
}) {
  const [correo, setCorreo] = useState(emailInicial);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enviar = async () => {
    if (!correo.trim()) {
      setError("Escribe tu correo.");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      await olvidePassword(correo.trim());
      setEnviado(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={onCerrar}>
      <View style={styles.modalFondo}>
        <View style={styles.modalCaja}>
          {enviado ? (
            <>
              <View style={styles.modalIcono}>
                <Ionicons name="mail-outline" size={26} color={colors.fc} />
              </View>
              <Text style={styles.modalTitulo}>Revisa tu correo</Text>
              <Text style={styles.modalTexto}>
                Si ese correo tiene una cuenta, te enviamos un enlace para restablecer tu
                contraseña. Vence en una hora.
              </Text>
              <TouchableOpacity style={styles.modalCta} onPress={onCerrar}>
                <Text style={styles.modalCtaText}>Entendido</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.modalTitulo}>¿Olvidaste tu contraseña?</Text>
              <Text style={styles.modalTexto}>
                Escribe tu correo y te mandamos un enlace para ponerte una nueva.
              </Text>

              <View style={[styles.inputRow, { marginTop: 16 }]}>
                <Ionicons name="mail-outline" size={18} color="#9A8D86" />
                <TextInput
                  style={styles.input}
                  value={correo}
                  onChangeText={setCorreo}
                  placeholder="maria.diaz@gmail.com"
                  placeholderTextColor={colors.faint}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoFocus
                />
              </View>

              {error && <Text style={styles.formError}>{error}</Text>}

              <View style={styles.modalBotones}>
                <TouchableOpacity style={styles.modalSecundario} onPress={onCerrar}>
                  <Text style={styles.modalSecundarioText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalCtaAncho, enviando && styles.ctaDisabled]}
                  onPress={enviar}
                  disabled={enviando}
                >
                  {enviando ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.modalCtaText}>Enviar enlace</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

/**
 * Campo con el estado activo del diseño: borde coral + halo suave
 * (equivalente al box-shadow 0 0 0 4px #FFE7DF del mockup).
 */
function CampoInput({
  activo,
  icono,
  children,
}: {
  activo: boolean;
  icono: keyof typeof Ionicons.glyphMap;
  children: ReactNode;
}) {
  return (
    <View style={[styles.campoHalo, activo && styles.campoHaloActivo]}>
      <View style={[styles.inputRow, activo && styles.inputRowActivo]}>
        <Ionicons name={icono} size={18} color="#9A8D86" />
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },

  hero: {
    alignItems: "center",
    paddingBottom: 56,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: "hidden",
  },
  circuloArriba: {
    position: "absolute",
    right: -40,
    top: -30,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  circuloAbajo: {
    position: "absolute",
    left: -30,
    bottom: -50,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  logoBox: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  logoText: { color: colors.fc, fontSize: 30, fontWeight: "800" },
  title: { color: "#FFF", fontSize: 30, fontWeight: "800", letterSpacing: -0.6, marginTop: 14 },
  sub: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 20,
    marginTop: 6,
  },

  card: {
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

  segment: {
    flexDirection: "row",
    backgroundColor: colors.paper,
    borderRadius: 14,
    padding: 5,
    marginBottom: 22,
  },
  segmentItem: { flex: 1, alignItems: "center", paddingVertical: 11, borderRadius: 10 },
  segmentActive: {
    backgroundColor: colors.surface,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segmentActiveText: { color: colors.fc, fontSize: 14, fontWeight: "700" },
  segmentText: { color: colors.muted, fontSize: 14, fontWeight: "600" },

  inputLabel: { fontSize: 13, fontWeight: "700", color: colors.ink, marginBottom: 4 },
  // halo exterior (siempre presente para que el layout no salte al enfocar)
  campoHalo: { borderRadius: 18, padding: 4, marginBottom: 10, backgroundColor: "transparent" },
  campoHaloActivo: { backgroundColor: colors.fcSoft },
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
  inputRowActivo: { borderColor: colors.fc },
  input: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.ink, paddingVertical: 0 },

  olvidaste: { alignSelf: "flex-end", marginTop: 2, marginBottom: 16, marginRight: 4 },
  olvidasteText: { color: colors.fc, fontSize: 13, fontWeight: "700" },
  formError: { color: colors.fcDeep, fontSize: 13, fontWeight: "600", marginBottom: 10, marginLeft: 4 },

  cta: {
    height: 54,
    borderRadius: 15,
    backgroundColor: colors.fc,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.fc,
    shadowOpacity: 0.36,
    shadowRadius: 11,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  ctaDisabled: { opacity: 0.7 },
  ctaText: { color: "#FFF", fontSize: 16, fontWeight: "800" },

  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.line },
  dividerText: { fontSize: 12, fontWeight: "600", color: colors.faint },

  socialRow: { flexDirection: "row", gap: 12 },
  socialBtn: {
    flex: 1,
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  googleG: { fontSize: 16, fontWeight: "800", color: "#EA4335" },
  socialText: { fontSize: 14, fontWeight: "700", color: colors.ink },

  legal: {
    textAlign: "center",
    fontSize: 11.5,
    fontWeight: "500",
    color: colors.faint,
    lineHeight: 17,
    marginTop: 20,
  },

  modalFondo: {
    flex: 1,
    backgroundColor: "rgba(36,27,25,0.45)",
    justifyContent: "center",
    padding: 24,
  },
  modalCaja: { backgroundColor: colors.surface, borderRadius: 22, padding: 22 },
  modalIcono: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: colors.fcSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  modalTitulo: { fontSize: 19, fontWeight: "800", color: colors.ink },
  modalTexto: { fontSize: 13.5, color: colors.muted, lineHeight: 20, marginTop: 8 },
  modalBotones: { flexDirection: "row", gap: 10, marginTop: 20 },
  modalCta: {
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.fc,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  modalCtaAncho: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.fc,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCtaText: { color: "#FFF", fontWeight: "800", fontSize: 15 },
  modalSecundario: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  modalSecundarioText: { color: colors.ink, fontWeight: "700", fontSize: 15 },
});
