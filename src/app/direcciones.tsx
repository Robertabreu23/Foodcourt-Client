import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ApiError,
  actualizarDireccion,
  borrarDireccion,
  crearDireccion,
  getDirecciones,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { colors } from "@/theme";
import type { Address } from "@/types";

/**
 * DIRECCIONES DE ENTREGA
 *
 * Solo administra: crear, editar, borrar y elegir la principal. La selección
 * para un pedido se hace dentro del checkout, que refresca esta lista al volver.
 */
export default function DireccionesScreen() {
  const { token, cerrarSesion } = useAuth();
  const insets = useSafeAreaInsets();

  const [direcciones, setDirecciones] = useState<Address[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  // null = modal cerrado; { direccion: null } = crear una nueva
  const [editando, setEditando] = useState<{ direccion: Address | null } | null>(null);

  const manejarError = useCallback(
    (e: unknown, porDefecto: string) => {
      if (e instanceof ApiError && e.status === 401) {
        Alert.alert("Sesión expirada", "Vuelve a iniciar sesión.");
        cerrarSesion();
        return;
      }
      Alert.alert("No se pudo", e instanceof Error ? e.message : porDefecto);
    },
    [cerrarSesion],
  );

  const cargar = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      setDirecciones(await getDirecciones(token));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar tus direcciones.");
    } finally {
      setCargando(false);
    }
  }, [token]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (!token) return null;

  const guardar = async (datos: {
    etiqueta: string | null;
    calle: string;
    referencia: string | null;
    sector: string;
    ciudad: string | null;
    esPrincipal: boolean;
  }) => {
    setGuardando(true);
    try {
      const enEdicion = editando?.direccion;
      if (enEdicion) await actualizarDireccion(token, enEdicion.id, datos);
      else await crearDireccion(token, datos);
      setEditando(null);
      await cargar();
    } catch (e) {
      manejarError(e, "No se pudo guardar la dirección.");
    } finally {
      setGuardando(false);
    }
  };

  const hacerPrincipal = async (direccion: Address) => {
    if (direccion.esPrincipal) return;
    try {
      await actualizarDireccion(token, direccion.id, { esPrincipal: true });
      await cargar();
    } catch (e) {
      manejarError(e, "No se pudo cambiar la principal.");
    }
  };

  const confirmarBorrar = (direccion: Address) => {
    Alert.alert(
      "Borrar dirección",
      `¿Borrar "${direccion.etiqueta ?? direccion.calle}"? Tus pedidos anteriores no se ven afectados.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Borrar",
          style: "destructive",
          onPress: async () => {
            try {
              await borrarDireccion(token, direccion.id);
              await cargar();
            } catch (e) {
              manejarError(e, "No se pudo borrar la dirección.");
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.pantalla}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={colors.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.titulo}>Mis direcciones</Text>
          <Text style={styles.subtitulo}>Dónde recibes tus pedidos</Text>
        </View>
        <TouchableOpacity
          style={styles.nuevaBtn}
          onPress={() => setEditando({ direccion: null })}
          hitSlop={6}
        >
          <Ionicons name="add" size={17} color="#FFF" />
          <Text style={styles.nuevaText}>Nueva</Text>
        </TouchableOpacity>
      </View>

      {cargando ? (
        <View style={styles.centrado}>
          <ActivityIndicator size="large" color={colors.fc} />
        </View>
      ) : error ? (
        <View style={styles.centrado}>
          <Ionicons name="cloud-offline-outline" size={44} color={colors.faint} />
          <Text style={styles.vacioSub}>{error}</Text>
          <TouchableOpacity style={styles.btnPrimario} onPress={cargar}>
            <Text style={styles.btnPrimarioText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : direcciones.length === 0 ? (
        <View style={styles.centrado}>
          <Ionicons name="map-outline" size={48} color={colors.faint} />
          <Text style={styles.vacioTitulo}>Todavía no tienes direcciones</Text>
          <Text style={styles.vacioSub}>
            Agrega dónde quieres recibir tus pedidos. La primera queda como principal.
          </Text>
          <TouchableOpacity
            style={styles.btnPrimario}
            onPress={() => setEditando({ direccion: null })}
          >
            <Text style={styles.btnPrimarioText}>Agregar dirección</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 32 }}
        >
          {direcciones.map((d) => (
            <TouchableOpacity
              key={d.id}
              style={[styles.tarjeta, d.esPrincipal && styles.tarjetaPrincipal]}
              onPress={() => setEditando({ direccion: d })}
              activeOpacity={0.85}
            >
              <View style={[styles.icono, d.esPrincipal && styles.iconoPrincipal]}>
                <Ionicons
                  name={iconoDeEtiqueta(d.etiqueta)}
                  size={19}
                  color={d.esPrincipal ? colors.fc : colors.muted}
                />
              </View>

              <View style={{ flex: 1 }}>
                <View style={styles.tarjetaTituloRow}>
                  <Text style={styles.tarjetaEtiqueta} numberOfLines={1}>
                    {d.etiqueta ?? "Dirección"}
                  </Text>
                  {d.esPrincipal && (
                    <View style={styles.pillPrincipal}>
                      <Text style={styles.pillPrincipalText}>Principal</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.tarjetaCalle} numberOfLines={2}>
                  {d.calle}
                </Text>
                <Text style={styles.tarjetaSector} numberOfLines={1}>
                  {[d.sector, d.ciudad].filter(Boolean).join(", ")}
                </Text>
                {d.referencia ? (
                  <Text style={styles.tarjetaReferencia} numberOfLines={1}>
                    {d.referencia}
                  </Text>
                ) : null}

                <View style={styles.acciones}>
                  {!d.esPrincipal && (
                    <TouchableOpacity style={styles.accion} onPress={() => hacerPrincipal(d)}>
                      <Ionicons name="star-outline" size={13} color={colors.fc} />
                      <Text style={styles.accionText}>Hacer principal</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.accion}
                    onPress={() => setEditando({ direccion: d })}
                  >
                    <Ionicons name="pencil" size={13} color={colors.muted} />
                    <Text style={[styles.accionText, { color: colors.muted }]}>Editar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.accion} onPress={() => confirmarBorrar(d)}>
                    <Ionicons name="trash-outline" size={13} color={colors.fcDeep} />
                    <Text style={[styles.accionText, { color: colors.fcDeep }]}>Borrar</Text>
                  </TouchableOpacity>
                </View>
              </View>

            </TouchableOpacity>
          ))}

          <Text style={styles.nota}>
            La principal es la que se preselecciona al hacer un pedido. Para cambiarla, marca otra.
          </Text>
        </ScrollView>
      )}

      {editando && (
        <ModalDireccion
          direccion={editando.direccion}
          guardando={guardando}
          onCancelar={() => setEditando(null)}
          onGuardar={guardar}
        />
      )}
    </View>
  );
}

function iconoDeEtiqueta(etiqueta: string | null): keyof typeof Ionicons.glyphMap {
  const e = (etiqueta ?? "").toLowerCase();
  if (e.includes("casa") || e.includes("hogar")) return "home-outline";
  if (e.includes("trabajo") || e.includes("oficina")) return "briefcase-outline";
  return "location-outline";
}

/* ---------- modal de dirección ---------- */

const ETIQUETAS_RAPIDAS = ["Casa", "Trabajo", "Otra"];

function ModalDireccion({
  direccion,
  guardando,
  onCancelar,
  onGuardar,
}: {
  direccion: Address | null;
  guardando: boolean;
  onCancelar: () => void;
  onGuardar: (datos: {
    etiqueta: string | null;
    calle: string;
    referencia: string | null;
    sector: string;
    ciudad: string | null;
    esPrincipal: boolean;
  }) => void;
}) {
  const [etiqueta, setEtiqueta] = useState(direccion?.etiqueta ?? "Casa");
  const [calle, setCalle] = useState(direccion?.calle ?? "");
  const [referencia, setReferencia] = useState(direccion?.referencia ?? "");
  const [sector, setSector] = useState(direccion?.sector ?? "");
  const [ciudad, setCiudad] = useState(direccion?.ciudad ?? "Santo Domingo");
  const [principal, setPrincipal] = useState(direccion?.esPrincipal ?? false);
  const [error, setError] = useState<string | null>(null);

  // El backend no deja desmarcar la principal: para cambiarla hay que marcar otra.
  const bloquearPrincipal = direccion?.esPrincipal === true;

  const guardar = () => {
    if (!calle.trim()) return setError("Escribe la calle y el número.");
    if (!sector.trim()) return setError("Escribe el sector.");
    setError(null);
    onGuardar({
      etiqueta: etiqueta.trim() || null,
      calle: calle.trim(),
      referencia: referencia.trim() || null,
      sector: sector.trim(),
      ciudad: ciudad.trim() || null,
      esPrincipal: principal,
    });
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onCancelar}>
      <KeyboardAvoidingView
        style={styles.modalFondo}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.modalCaja}>
          <View style={styles.modalAsa} />
          <Text style={styles.modalTitulo}>
            {direccion ? "Editar dirección" : "Nueva dirección"}
          </Text>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>¿Cómo la llamamos?</Text>
            <View style={styles.chipsRow}>
              {ETIQUETAS_RAPIDAS.map((e) => (
                <TouchableOpacity
                  key={e}
                  style={[styles.chip, etiqueta === e && styles.chipActivo]}
                  onPress={() => setEtiqueta(e)}
                >
                  <Ionicons
                    name={iconoDeEtiqueta(e)}
                    size={14}
                    color={etiqueta === e ? "#FFF" : colors.muted}
                  />
                  <Text style={[styles.chipText, etiqueta === e && styles.chipTextActivo]}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Calle y número *</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={calle}
                onChangeText={setCalle}
                placeholder="Av. Abraham Lincoln 1002, Apto 4B"
                placeholderTextColor={colors.faint}
              />
            </View>

            <Text style={styles.label}>Sector *</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={sector}
                onChangeText={setSector}
                placeholder="Piantini"
                placeholderTextColor={colors.faint}
              />
            </View>

            <Text style={styles.label}>Ciudad</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={ciudad}
                onChangeText={setCiudad}
                placeholder="Santo Domingo"
                placeholderTextColor={colors.faint}
              />
            </View>

            <Text style={styles.label}>Referencia</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={referencia}
                onChangeText={setReferencia}
                placeholder="Edificio azul, timbre 4B"
                placeholderTextColor={colors.faint}
              />
            </View>
            <Text style={styles.ayuda}>
              Lo que le dirías al motorista para que no se pierda.
            </Text>

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchLabel}>Usar como principal</Text>
                <Text style={styles.switchAyuda}>
                  {bloquearPrincipal
                    ? "Ya es la principal. Para cambiarla, marca otra."
                    : "Se preselecciona al hacer un pedido."}
                </Text>
              </View>
              <Switch
                value={principal}
                onValueChange={setPrincipal}
                disabled={bloquearPrincipal}
                trackColor={{ false: colors.line, true: "#FFD4C7" }}
                thumbColor={principal ? colors.fc : "#F4F0EC"}
              />
            </View>

            {error && <Text style={styles.formError}>{error}</Text>}
          </ScrollView>

          <View style={styles.modalBotones}>
            <TouchableOpacity style={styles.btnSecundario} onPress={onCancelar}>
              <Text style={styles.btnSecundarioText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnPrimarioAncho, guardando && styles.apagado]}
              onPress={guardar}
              disabled={guardando}
            >
              {guardando ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.btnPrimarioText}>Guardar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ---------- estilos ---------- */

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.bg },
  centrado: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 10 },

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
  titulo: { fontSize: 21, fontWeight: "800", color: colors.ink, letterSpacing: -0.3 },
  subtitulo: { fontSize: 12.5, fontWeight: "600", color: colors.muted, marginTop: 1 },
  nuevaBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.fc,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 999,
  },
  nuevaText: { color: "#FFF", fontSize: 12.5, fontWeight: "800" },

  vacioTitulo: { fontSize: 18, fontWeight: "800", color: colors.ink, textAlign: "center" },
  vacioSub: { fontSize: 13.5, color: colors.muted, textAlign: "center", lineHeight: 20 },
  btnPrimario: {
    marginTop: 8,
    backgroundColor: colors.fc,
    paddingHorizontal: 26,
    paddingVertical: 13,
    borderRadius: 999,
  },
  btnPrimarioText: { color: "#FFF", fontWeight: "800", fontSize: 15 },

  tarjeta: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    alignItems: "flex-start",
  },
  tarjetaPrincipal: { borderColor: colors.fc, borderWidth: 1.5 },
  icono: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  iconoPrincipal: { backgroundColor: colors.fcSoft },
  tarjetaTituloRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  tarjetaEtiqueta: { fontSize: 15.5, fontWeight: "800", color: colors.ink },
  pillPrincipal: {
    backgroundColor: colors.fcSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  pillPrincipalText: { fontSize: 10.5, fontWeight: "800", color: colors.fcDeep },
  tarjetaCalle: { fontSize: 13.5, fontWeight: "600", color: colors.ink, marginTop: 3, lineHeight: 19 },
  tarjetaSector: { fontSize: 12.5, fontWeight: "500", color: colors.muted, marginTop: 2 },
  tarjetaReferencia: { fontSize: 12, fontWeight: "500", color: colors.faint, marginTop: 2 },

  acciones: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 10 },
  accion: { flexDirection: "row", alignItems: "center", gap: 4 },
  accionText: { fontSize: 12, fontWeight: "700", color: colors.fc },

  nota: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.muted,
    lineHeight: 18,
    textAlign: "center",
    paddingHorizontal: 14,
    marginTop: 4,
  },

  modalFondo: { flex: 1, backgroundColor: "rgba(36,27,25,0.45)", justifyContent: "flex-end" },
  modalCaja: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 20,
    paddingTop: 10,
    maxHeight: "88%",
  },
  modalAsa: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.line,
    marginBottom: 14,
  },
  modalTitulo: { fontSize: 20, fontWeight: "800", color: colors.ink, marginBottom: 10 },

  label: { fontSize: 13, fontWeight: "700", color: colors.ink, marginBottom: 6, marginTop: 12 },
  inputRow: {
    minHeight: 50,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    justifyContent: "center",
  },
  input: { fontSize: 15, fontWeight: "600", color: colors.ink, paddingVertical: 0 },
  ayuda: { fontSize: 12, fontWeight: "500", color: colors.muted, marginTop: 6 },
  formError: { color: colors.fcDeep, fontSize: 13, fontWeight: "700", marginTop: 12 },

  chipsRow: { flexDirection: "row", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipActivo: { backgroundColor: colors.fc, borderColor: colors.fc },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.ink },
  chipTextActivo: { color: "#FFF", fontWeight: "700" },

  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.paper,
    borderRadius: 16,
    padding: 14,
    marginTop: 16,
  },
  switchLabel: { fontSize: 15, fontWeight: "700", color: colors.ink },
  switchAyuda: { fontSize: 12, fontWeight: "500", color: colors.muted, marginTop: 2, lineHeight: 17 },

  modalBotones: { flexDirection: "row", gap: 10, marginTop: 16 },
  btnPrimarioAncho: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.fc,
    alignItems: "center",
    justifyContent: "center",
  },
  btnSecundario: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  btnSecundarioText: { color: colors.ink, fontWeight: "700", fontSize: 15 },
  apagado: { opacity: 0.7 },
});
