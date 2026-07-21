import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useState } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";

import { StoreCover } from "@/components/store-cover";
import { ApiError, getMisLocales, updateStore } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { colors, initials } from "@/theme";
import type { Store } from "@/types";

export default function PerfilScreen() {
  const { token, user, cerrarSesion } = useAuth();

  // La ruta está protegida: si no hay token, el guard ya nos sacó al login.
  if (!token) return null;

  return <OwnerPanel token={token} nombreUsuario={user?.nombre ?? "Usuario"} onCerrarSesion={cerrarSesion} />;
}

/* ================= PANEL DEL DUEÑO ================= */

interface OwnerProps {
  token: string;
  nombreUsuario: string;
  onCerrarSesion: () => void;
}

function OwnerPanel({ token, nombreUsuario, onCerrarSesion }: OwnerProps) {
  const [locales, setLocales] = useState<Store[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seleccionado, setSeleccionado] = useState<Store | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setLocales(await getMisLocales(token));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        Alert.alert("Sesión expirada", "Vuelve a iniciar sesión.");
        onCerrarSesion();
        return;
      }
      setError(e instanceof Error ? e.message : "No se pudieron cargar tus locales.");
    } finally {
      setCargando(false);
    }
  }, [token, onCerrarSesion]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (seleccionado) {
    return (
      <EditarLocal
        token={token}
        store={seleccionado}
        onBack={() => setSeleccionado(null)}
        onSaved={(actualizado) => {
          setLocales((prev) => prev.map((s) => (s.id === actualizado.id ? actualizado : s)));
          setSeleccionado(actualizado);
        }}
        onSessionExpired={onCerrarSesion}
      />
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      {/* Tarjeta del usuario logueado */}
      <View style={styles.userCard}>
        <LinearGradient
          colors={[colors.mango, "#FF7A45"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.userAvatar}
        >
          <Text style={styles.userAvatarText}>{initials(nombreUsuario)}</Text>
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={styles.userHola}>Hola,</Text>
          <Text style={styles.userNombre} numberOfLines={1}>
            {nombreUsuario}
          </Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={onCerrarSesion}>
          <Ionicons name="log-out-outline" size={16} color={colors.fcDeep} />
          <Text style={styles.logoutText}>Salir</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>Mi local</Text>
      </View>

      {cargando ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.fc} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorMsg}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={cargar}>
            <Text style={styles.ctaText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 6, gap: 14 }}>
          {locales.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="storefront-outline" size={38} color={colors.faint} />
              <Text style={styles.emptyTitle}>No tienes locales todavía</Text>
              <Text style={styles.errorMsg}>
                Esta sección es para dueños de comercio. Tu cuenta es de cliente, así que aquí no
                hay nada que editar… ¡pero ya puedes pedir desde el Inicio!
              </Text>
            </View>
          ) : (
            <Text style={styles.panelSub}>Elige el local que quieres editar:</Text>
          )}
          {locales.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={styles.localItem}
              activeOpacity={0.8}
              onPress={() => setSeleccionado(s)}
            >
              <StoreCover store={s} height={56} style={styles.localThumb} />
              <View style={{ flex: 1 }}>
                <Text style={styles.localNombre} numberOfLines={1}>
                  {s.nombre}
                </Text>
                <Text style={styles.localMeta}>
                  {s.categoria ?? "Sin categoría"} · {s.estadoVerificacion}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.faint} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/* ================= EDITAR LOCAL ================= */

interface EditarProps {
  token: string;
  store: Store;
  onBack: () => void;
  onSaved: (s: Store) => void;
  onSessionExpired: () => void;
}

function EditarLocal({ token, store, onBack, onSaved, onSessionExpired }: EditarProps) {
  const [nombre, setNombre] = useState(store.nombre);
  const [categoria, setCategoria] = useState(store.categoria ?? "");
  const [imagenUri, setImagenUri] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const elegirFoto = async () => {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert("Permiso necesario", "Permite el acceso a tus fotos para cambiar la portada.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setImagenUri(result.assets[0].uri);
      setOk(false);
    }
  };

  const guardar = async () => {
    if (!nombre.trim()) {
      setError("El nombre no puede quedar vacío.");
      return;
    }
    setGuardando(true);
    setError(null);
    setOk(false);
    try {
      const actualizado = await updateStore(token, store.id, {
        nombre: nombre.trim(),
        categoria: categoria.trim() || undefined,
        imagenUri,
      });
      setImagenUri(null); // la portada ya vive en el servidor
      onSaved(actualizado);
      setOk(true);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        Alert.alert("Sesión expirada", "Vuelve a iniciar sesión.");
        onSessionExpired();
        return;
      }
      if (e instanceof ApiError && e.status === 403) {
        setError("No eres el dueño de este local.");
      } else {
        setError(e instanceof Error ? e.message : "No se pudo guardar.");
      }
    } finally {
      setGuardando(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.panelHeader, { flexDirection: "row", alignItems: "center", gap: 12 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={onBack} hitSlop={8}>
            <Ionicons name="chevron-back" size={20} color={colors.ink} />
          </TouchableOpacity>
          <Text style={[styles.panelTitle, { flex: 1 }]} numberOfLines={1}>
            Editar local
          </Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {/* Vista previa de la portada */}
          <View style={styles.previewCard}>
            <StoreCover store={store} height={170} overrideUri={imagenUri} />
            <TouchableOpacity style={styles.fotoBtn} onPress={elegirFoto} activeOpacity={0.85}>
              <Ionicons name="camera-outline" size={16} color="#FFF" />
              <Text style={styles.fotoBtnText}>Cambiar foto</Text>
            </TouchableOpacity>
          </View>
          {imagenUri && (
            <Text style={styles.fotoHint}>Foto nueva seleccionada — guarda para subirla.</Text>
          )}

          <Text style={styles.inputLabel}>Nombre del local</Text>
          <View style={styles.inputRow}>
            <Ionicons name="storefront-outline" size={18} color="#9A8D86" />
            <TextInput
              style={styles.input}
              value={nombre}
              onChangeText={(t) => {
                setNombre(t);
                setOk(false);
              }}
              placeholder="Ej: Forno Rosso"
              placeholderTextColor={colors.faint}
            />
          </View>

          <Text style={styles.inputLabel}>Categoría</Text>
          <View style={styles.inputRow}>
            <Ionicons name="pricetag-outline" size={18} color="#9A8D86" />
            <TextInput
              style={styles.input}
              value={categoria}
              onChangeText={(t) => {
                setCategoria(t);
                setOk(false);
              }}
              placeholder="Ej: Pizzería · Italiana"
              placeholderTextColor={colors.faint}
            />
          </View>

          {error && <Text style={styles.formError}>{error}</Text>}
          {ok && (
            <View style={styles.okBox}>
              <Ionicons name="checkmark-circle" size={16} color={colors.leaf} />
              <Text style={styles.okText}>¡Cambios guardados! La portada ya está actualizada.</Text>
            </View>
          )}

          <TouchableOpacity style={[styles.cta, guardando && styles.ctaDisabled]} onPress={guardar} disabled={guardando}>
            {guardando ? <ActivityIndicator color="#FFF" /> : <Text style={styles.ctaText}>Guardar cambios</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ================= ESTILOS ================= */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },

  userCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 18,
    marginTop: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    padding: 14,
  },
  userAvatar: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  userAvatarText: { color: "#FFF", fontWeight: "800", fontSize: 16 },
  userHola: { fontSize: 12, fontWeight: "600", color: colors.muted },
  userNombre: { fontSize: 16, fontWeight: "800", color: colors.ink, letterSpacing: -0.2 },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.fcSoft,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
  },
  logoutText: { color: colors.fcDeep, fontSize: 12.5, fontWeight: "700" },

  panelHeader: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 6 },
  panelTitle: { fontSize: 24, fontWeight: "800", color: colors.ink, letterSpacing: -0.4 },
  panelSub: { fontSize: 13.5, fontWeight: "600", color: colors.muted, marginBottom: 2 },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  errorMsg: { color: colors.muted, fontSize: 13.5, textAlign: "center", lineHeight: 20 },
  retryBtn: { backgroundColor: colors.fc, paddingHorizontal: 26, paddingVertical: 12, borderRadius: 999 },
  emptyBox: { alignItems: "center", gap: 8, paddingVertical: 30, paddingHorizontal: 12 },
  emptyTitle: { fontSize: 17, fontWeight: "800", color: colors.ink },

  localItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    padding: 12,
  },
  localThumb: { width: 56, borderRadius: 14 },
  localNombre: { fontSize: 16, fontWeight: "800", color: colors.ink },
  localMeta: { fontSize: 12.5, fontWeight: "500", color: colors.muted, marginTop: 2 },

  inputLabel: { fontSize: 13, fontWeight: "700", color: colors.ink, marginBottom: 7, marginTop: 4 },
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
    marginBottom: 14,
  },
  input: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.ink, paddingVertical: 0 },
  formError: { color: colors.fcDeep, fontSize: 13, fontWeight: "600", marginBottom: 10 },
  cta: {
    height: 54,
    borderRadius: 15,
    backgroundColor: colors.fc,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    shadowColor: colors.fc,
    shadowOpacity: 0.36,
    shadowRadius: 11,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  ctaDisabled: { opacity: 0.7 },
  ctaText: { color: "#FFF", fontSize: 16, fontWeight: "800" },

  previewCard: {
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 8,
  },
  fotoBtn: {
    position: "absolute",
    right: 12,
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
  },
  fotoBtnText: { color: "#FFF", fontSize: 12.5, fontWeight: "700" },
  fotoHint: { fontSize: 12.5, fontWeight: "600", color: colors.leaf, marginBottom: 10 },
  okBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#E9F6EF",
    borderRadius: 12,
    padding: 11,
    marginBottom: 10,
  },
  okText: { flex: 1, fontSize: 13, fontWeight: "600", color: "#177449" },
});
