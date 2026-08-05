import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { StoreCover } from "@/components/store-cover";
import { ApiError, getLocalesParaRevisar, verificarLocal } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { colors } from "@/theme";
import type { Store } from "@/types";

type Filtro = Store["estadoVerificacion"];

const FILTROS: { clave: Filtro; texto: string }[] = [
  { clave: "pendiente", texto: "En revisión" },
  { clave: "aprobado", texto: "Aprobados" },
  { clave: "rechazado", texto: "Rechazados" },
];

const PINTA: Record<Filtro, { color: string; fondo: string; etiqueta: string }> = {
  pendiente: { color: "#B26A00", fondo: "#FFF3DC", etiqueta: "En revisión" },
  aprobado: { color: "#177449", fondo: "#E9F6EF", etiqueta: "Aprobado" },
  rechazado: { color: colors.fcDeep, fondo: colors.fcSoft, etiqueta: "Rechazado" },
};

/**
 * ADMIN — cola de aprobación de locales
 *
 * Un local creado por un comercio nace `pendiente` y no sale en el Inicio hasta
 * que se apruebe aquí. Un rechazado se puede aprobar después y un aprobado se
 * puede retirar; lo único que no se puede es devolverlo a `pendiente`.
 */
export default function AdminLocalesScreen() {
  const { token, user, cerrarSesion } = useAuth();
  const insets = useSafeAreaInsets();

  const [filtro, setFiltro] = useState<Filtro>("pendiente");
  const [locales, setLocales] = useState<Store[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moviendo, setMoviendo] = useState<number | null>(null);

  const cargar = useCallback(
    async (silencioso = false) => {
      if (!token) return;
      if (!silencioso) setCargando(true);
      setError(null);
      try {
        setLocales(await getLocalesParaRevisar(token, filtro));
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          cerrarSesion();
          return;
        }
        setError(
          e instanceof ApiError && e.status === 403
            ? "Esta sección es solo para administradores."
            : e instanceof Error
              ? e.message
              : "No se pudieron cargar los locales.",
        );
      } finally {
        if (!silencioso) setCargando(false);
        setRefrescando(false);
      }
    },
    [token, filtro, cerrarSesion],
  );

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  if (!token) return null;

  const decidir = async (local: Store, estado: "aprobado" | "rechazado") => {
    setMoviendo(local.id);
    try {
      await verificarLocal(token, local.id, estado);
      // Sale de esta lista, porque ya no cumple el filtro actual.
      setLocales((previos) => previos.filter((l) => l.id !== local.id));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        cerrarSesion();
        return;
      }
      Alert.alert("No se pudo", e instanceof Error ? e.message : "Intenta de nuevo.");
      cargar(true);
    } finally {
      setMoviendo(null);
    }
  };

  const confirmarRechazo = (local: Store) =>
    Alert.alert(
      "Rechazar local",
      `${local.nombre} dejará de estar visible. Se puede aprobar más adelante.`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Rechazar", style: "destructive", onPress: () => decidir(local, "rechazado") },
      ],
    );

  // El rol de admin no cambia con el plan, así que aquí sí sirve el del token.
  const esAdmin = user?.rol === "admin";

  return (
    <View style={styles.pantalla}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={colors.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.titulo}>Revisión de locales</Text>
          <Text style={styles.subtitulo}>
            {filtro === "pendiente" && locales.length > 0
              ? `${locales.length} esperando`
              : "Panel de administración"}
          </Text>
        </View>
      </View>

      {!esAdmin ? (
        <View style={styles.centrado}>
          <Ionicons name="lock-closed-outline" size={46} color={colors.faint} />
          <Text style={styles.vacioTitulo}>Solo para administradores</Text>
          <Text style={styles.vacioSub}>Tu cuenta no tiene permiso para revisar locales.</Text>
        </View>
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtrosRow}
            style={{ flexGrow: 0 }}
          >
            {FILTROS.map((f) => {
              const activo = f.clave === filtro;
              return (
                <TouchableOpacity
                  key={f.clave}
                  style={[styles.chip, activo && styles.chipActivo]}
                  onPress={() => setFiltro(f.clave)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chipText, activo && styles.chipTextActivo]}>{f.texto}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {cargando ? (
            <View style={styles.centrado}>
              <ActivityIndicator size="large" color={colors.fc} />
            </View>
          ) : error ? (
            <View style={styles.centrado}>
              <Ionicons name="cloud-offline-outline" size={44} color={colors.faint} />
              <Text style={styles.vacioSub}>{error}</Text>
              <TouchableOpacity style={styles.btnPrimario} onPress={() => cargar()}>
                <Text style={styles.btnPrimarioText}>Reintentar</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={locales}
              keyExtractor={(l) => String(l.id)}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                padding: 18,
                paddingTop: 8,
                paddingBottom: insets.bottom + 28,
              }}
              refreshControl={
                <RefreshControl
                  refreshing={refrescando}
                  tintColor={colors.fc}
                  onRefresh={() => {
                    setRefrescando(true);
                    cargar(true);
                  }}
                />
              }
              renderItem={({ item }) => (
                <TarjetaRevision
                  local={item}
                  ocupado={moviendo === item.id}
                  onAprobar={() => decidir(item, "aprobado")}
                  onRechazar={() => confirmarRechazo(item)}
                  onVerCarta={() =>
                    router.push({
                      pathname: "/store/[id]",
                      params: {
                        id: String(item.id),
                        colorMarca: item.colorMarca,
                        ...(item.portadaUrl ? { portadaUrl: item.portadaUrl } : {}),
                      },
                    })
                  }
                />
              )}
              ListEmptyComponent={
                <View style={styles.vacio}>
                  <Ionicons name="checkmark-done-outline" size={50} color={colors.faint} />
                  <Text style={styles.vacioTitulo}>
                    {filtro === "pendiente" ? "Nada por revisar" : "No hay locales aquí"}
                  </Text>
                  <Text style={styles.vacioSub}>
                    {filtro === "pendiente"
                      ? "Cuando un comercio publique un local nuevo aparecerá en esta lista."
                      : "Prueba con otro filtro."}
                  </Text>
                </View>
              }
            />
          )}
        </>
      )}
    </View>
  );
}

function TarjetaRevision({
  local,
  ocupado,
  onAprobar,
  onRechazar,
  onVerCarta,
}: {
  local: Store;
  ocupado: boolean;
  onAprobar: () => void;
  onRechazar: () => void;
  onVerCarta: () => void;
}) {
  const pinta = PINTA[local.estadoVerificacion];

  return (
    <View style={styles.tarjeta}>
      <TouchableOpacity onPress={onVerCarta} activeOpacity={0.85}>
        <StoreCover store={local} height={110} />
      </TouchableOpacity>

      <View style={styles.tarjetaCuerpo}>
        <View style={styles.tarjetaTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.tarjetaNombre} numberOfLines={1}>
              {local.nombre}
            </Text>
            <Text style={styles.tarjetaMeta} numberOfLines={1}>
              {local.categoria ?? "Sin categoría"} · dueño #{local.ownerUserId}
            </Text>
          </View>
          <View style={[styles.estadoPill, { backgroundColor: pinta.fondo }]}>
            <Text style={[styles.estadoText, { color: pinta.color }]}>{pinta.etiqueta}</Text>
          </View>
        </View>

        {local.direccion ? (
          <View style={styles.datoRow}>
            <Ionicons name="location-outline" size={13} color={colors.muted} />
            <Text style={styles.datoText} numberOfLines={1}>
              {local.direccion}
            </Text>
          </View>
        ) : null}
        {local.telefono ? (
          <View style={styles.datoRow}>
            <Ionicons name="call-outline" size={13} color={colors.muted} />
            <Text style={styles.datoText}>{local.telefono}</Text>
          </View>
        ) : null}

        <TouchableOpacity style={styles.verCarta} onPress={onVerCarta}>
          <Ionicons name="restaurant-outline" size={14} color={colors.fc} />
          <Text style={styles.verCartaText}>Ver su carta antes de decidir</Text>
        </TouchableOpacity>

        <View style={styles.acciones}>
          {local.estadoVerificacion !== "rechazado" && (
            <TouchableOpacity
              style={styles.rechazar}
              onPress={onRechazar}
              disabled={ocupado}
            >
              <Text style={styles.rechazarText}>Rechazar</Text>
            </TouchableOpacity>
          )}
          {local.estadoVerificacion !== "aprobado" && (
            <TouchableOpacity
              style={[styles.aprobar, ocupado && styles.apagado]}
              onPress={onAprobar}
              disabled={ocupado}
              activeOpacity={0.9}
            >
              {ocupado ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.aprobarText}>Aprobar</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

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

  filtrosRow: { gap: 8, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 4 },
  chip: {
    paddingHorizontal: 14,
    height: 36,
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipActivo: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.ink },
  chipTextActivo: { color: "#FFF", fontWeight: "700" },

  tarjeta: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 14,
  },
  tarjetaCuerpo: { padding: 14 },
  tarjetaTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  tarjetaNombre: { fontSize: 16.5, fontWeight: "800", color: colors.ink, letterSpacing: -0.2 },
  tarjetaMeta: { fontSize: 12, fontWeight: "500", color: colors.muted, marginTop: 2 },
  estadoPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  estadoText: { fontSize: 11, fontWeight: "800" },

  datoRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  datoText: { flex: 1, fontSize: 12.5, fontWeight: "500", color: colors.muted },

  verCarta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 },
  verCartaText: { color: colors.fc, fontSize: 13, fontWeight: "700" },

  acciones: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 12,
  },
  rechazar: {
    flex: 1,
    height: 46,
    borderRadius: 13,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  rechazarText: { color: colors.fcDeep, fontSize: 14, fontWeight: "800" },
  aprobar: {
    flex: 1,
    height: 46,
    borderRadius: 13,
    backgroundColor: colors.leaf,
    alignItems: "center",
    justifyContent: "center",
  },
  aprobarText: { color: "#FFF", fontSize: 14.5, fontWeight: "800" },
  apagado: { opacity: 0.6 },

  vacio: { alignItems: "center", gap: 9, paddingTop: 60, paddingHorizontal: 30 },
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
});
