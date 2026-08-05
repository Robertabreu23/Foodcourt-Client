import { Ionicons } from "@expo/vector-icons";
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
  const [foco, setFoco] = useState<Campo>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [olvide, setOlvide] = useState(false);

  const esRegistro = modo === "registro";

  const cambiarModo = () => {
    setModo(esRegistro ? "login" : "registro");
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
    <KeyboardAvoidingView
      style={styles.pantalla}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.contenido,
          { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ===== Marca ===== */}
        <View style={styles.marca}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>F</Text>
          </View>
          <Text style={styles.wordmark}>Foodclub</Text>
        </View>

        {/* ===== Campos ===== */}
        {esRegistro && (
          <>
            <CampoInput activo={foco === "nombre"} icono="person-outline">
              <TextInput
                style={styles.input}
                value={nombre}
                onChangeText={setNombre}
                onFocus={() => setFoco("nombre")}
                onBlur={() => setFoco(null)}
                placeholder="Nombre"
                placeholderTextColor={colors.faint}
                autoComplete="name"
              />
            </CampoInput>

            <CampoInput activo={foco === "telefono"} icono="call-outline">
              <TextInput
                style={styles.input}
                value={telefono}
                onChangeText={setTelefono}
                onFocus={() => setFoco("telefono")}
                onBlur={() => setFoco(null)}
                placeholder="Teléfono"
                placeholderTextColor={colors.faint}
                keyboardType="phone-pad"
                autoComplete="tel"
              />
            </CampoInput>
          </>
        )}

        <CampoInput activo={foco === "email"} icono="person-outline">
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            onFocus={() => setFoco("email")}
            onBlur={() => setFoco(null)}
            placeholder="Correo"
            placeholderTextColor={colors.faint}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
        </CampoInput>

        <CampoInput activo={foco === "password"} icono="lock-closed-outline">
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            onFocus={() => setFoco("password")}
            onBlur={() => setFoco(null)}
            placeholder="Contraseña"
            placeholderTextColor={colors.faint}
            secureTextEntry={!verPass}
            autoCapitalize="none"
          />
          <TouchableOpacity onPress={() => setVerPass((v) => !v)} hitSlop={10}>
            <Ionicons
              name={verPass ? "eye-off-outline" : "eye-outline"}
              size={19}
              color="#9A8D86"
            />
          </TouchableOpacity>
        </CampoInput>

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
            <Text style={styles.ctaText}>{esRegistro ? "Crear cuenta" : "Iniciar sesión"}</Text>
          )}
        </TouchableOpacity>

        {/* ===== o ===== */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>o</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* ===== Cambiar de modo · olvidé ===== */}
        <View style={styles.pieRow}>
          <Text style={styles.pieTexto}>
            {esRegistro ? "¿Ya tienes cuenta?" : "¿No tienes cuenta?"}
          </Text>
          <TouchableOpacity onPress={cambiarModo} hitSlop={8}>
            <Text style={styles.pieEnlace}>
              {esRegistro ? "Inicia sesión" : "Crear una"}
            </Text>
          </TouchableOpacity>
        </View>

        {!esRegistro && (
          <TouchableOpacity style={styles.olvidaste} onPress={() => setOlvide(true)} hitSlop={8}>
            <Text style={styles.olvidasteText}>¿Olvidaste tu contraseña?</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.legal}>
          Al continuar aceptas los Términos{"\n"}y la Política de privacidad.
        </Text>
      </ScrollView>

      {olvide && <ModalOlvide emailInicial={email} onCerrar={() => setOlvide(false)} />}
    </KeyboardAvoidingView>
  );
}

/** Campo con borde coral y halo suave cuando está enfocado. */
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

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.surface },
  contenido: { paddingHorizontal: 28, flexGrow: 1 },

  marca: { alignItems: "center", marginBottom: 38 },
  logoBox: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: colors.fc,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.fc,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  logoText: { color: "#FFF", fontSize: 30, fontWeight: "800" },
  wordmark: {
    color: colors.ink,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.6,
    marginTop: 14,
  },

  // halo exterior (siempre presente para que el layout no salte al enfocar)
  campoHalo: { borderRadius: 18, padding: 4, marginBottom: 8, backgroundColor: "transparent" },
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

  formError: { color: colors.fcDeep, fontSize: 13, fontWeight: "700", marginTop: 6, marginLeft: 4 },

  cta: {
    height: 54,
    borderRadius: 14,
    backgroundColor: colors.fc,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
    shadowColor: colors.fc,
    shadowOpacity: 0.32,
    shadowRadius: 11,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  ctaDisabled: { opacity: 0.7 },
  ctaText: { color: "#FFF", fontSize: 16, fontWeight: "800" },

  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 22 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.line },
  dividerText: { fontSize: 12.5, fontWeight: "600", color: colors.faint },

  pieRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 },
  pieTexto: { fontSize: 14, fontWeight: "500", color: colors.muted },
  pieEnlace: { fontSize: 14, fontWeight: "800", color: colors.fc },

  olvidaste: { alignSelf: "center", marginTop: 16 },
  olvidasteText: { color: colors.muted, fontSize: 13.5, fontWeight: "600" },

  legal: {
    textAlign: "center",
    fontSize: 11.5,
    fontWeight: "500",
    color: colors.faint,
    lineHeight: 17,
    marginTop: "auto",
    paddingTop: 32,
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
