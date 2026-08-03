import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ApiError, getPedidos } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  PINTA_ESTADO,
  esFinal,
  haceCuanto,
  resumenItems,
  textoTiempo,
} from "@/lib/pedidos";
import { colors } from "@/theme";
import type { Order } from "@/types";

type Pestana = "activos" | "historial";

/** Mientras haya un pedido en curso, la lista se refresca sola. */
const INTERVALO_MS = 8000;

export default function PedidosScreen() {
  const { token, cerrarSesion } = useAuth();
  const [pestana, setPestana] = useState<Pestana>("activos");
  const [pedidos, setPedidos] = useState<Order[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(
    async (silencioso = false) => {
      if (!token) return;
      if (!silencioso) setCargando(true);
      setError(null);
      try {
        setPedidos(await getPedidos(token, pestana));
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          cerrarSesion();
          return;
        }
        if (!silencioso) {
          setError(e instanceof Error ? e.message : "No se pudieron cargar tus pedidos.");
        }
      } finally {
        if (!silencioso) setCargando(false);
        setRefrescando(false);
      }
    },
    [token, pestana, cerrarSesion],
  );

  // Al volver a la pestaña (ej. después de hacer un pedido) se refresca.
  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  // Refresco de fondo mientras haya algo en curso.
  const hayEnCurso = pedidos.some((p) => !esFinal(p.estado));
  useEffect(() => {
    if (pestana !== "activos" || !hayEnCurso) return;
    const t = setInterval(() => cargar(true), INTERVALO_MS);
    return () => clearInterval(t);
  }, [pestana, hayEnCurso, cargar]);

  if (!token) return null;

  return (
    <SafeAreaView style={styles.pantalla} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.titulo}>Mis pedidos</Text>
        <View style={styles.segmento}>
          {(["activos", "historial"] as Pestana[]).map((p) => {
            const activa = p === pestana;
            return (
              <TouchableOpacity
                key={p}
                style={[styles.segmentoItem, activa && styles.segmentoActivo]}
                onPress={() => setPestana(p)}
                activeOpacity={0.8}
              >
                <Text style={activa ? styles.segmentoTextActivo : styles.segmentoText}>
                  {p === "activos" ? "En curso" : "Historial"}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

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
          data={pedidos}
          keyExtractor={(p) => String(p.id)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 18, paddingTop: 8, paddingBottom: 28 }}
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
            <TarjetaPedido
              pedido={item}
              onPress={() =>
                router.push({ pathname: "/pedido/[id]", params: { id: String(item.id) } })
              }
            />
          )}
          ListEmptyComponent={<Vacio pestana={pestana} />}
        />
      )}
    </SafeAreaView>
  );
}

/* ---------- tarjeta ---------- */

function TarjetaPedido({ pedido, onPress }: { pedido: Order; onPress: () => void }) {
  const pinta = PINTA_ESTADO[pedido.estado];
  const enCurso = !esFinal(pedido.estado);
  const tiempo = textoTiempo(pedido);

  return (
    <TouchableOpacity style={styles.tarjeta} onPress={onPress} activeOpacity={0.85}>
      {/* franja del color del local */}
      <View style={[styles.franja, { backgroundColor: pedido.storeColorMarca || colors.fc }]} />

      <View style={styles.tarjetaCuerpo}>
        <View style={styles.tarjetaTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.tarjetaLocal} numberOfLines={1}>
              {pedido.storeNombre}
            </Text>
            <Text style={styles.tarjetaCodigo}>
              {pedido.codigo} · {haceCuanto(pedido.createdAt)}
            </Text>
          </View>
          <View style={[styles.estadoPill, { backgroundColor: pinta.fondo }]}>
            <Ionicons name={pinta.icono} size={13} color={pinta.color} />
            <Text style={[styles.estadoText, { color: pinta.color }]}>{pinta.etiqueta}</Text>
          </View>
        </View>

        <Text style={styles.tarjetaItems} numberOfLines={2}>
          {resumenItems(pedido)}
        </Text>

        <View style={styles.tarjetaPie}>
          <Text style={styles.tarjetaTotal}>RD${pedido.total}</Text>
          {enCurso && tiempo ? (
            <View style={styles.tarjetaTiempo}>
              <Ionicons name="time-outline" size={13} color={colors.muted} />
              <Text style={styles.tarjetaTiempoText}>{tiempo}</Text>
            </View>
          ) : null}
          <View style={{ flex: 1 }} />
          <Text style={[styles.tarjetaVer, { color: pinta.color }]}>
            {enCurso ? "Seguir" : "Ver detalle"}
          </Text>
          <Ionicons name="chevron-forward" size={15} color={pinta.color} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

function Vacio({ pestana }: { pestana: Pestana }) {
  const esActivos = pestana === "activos";
  return (
    <View style={styles.vacio}>
      <Ionicons
        name={esActivos ? "bicycle-outline" : "time-outline"}
        size={50}
        color={colors.faint}
      />
      <Text style={styles.vacioTitulo}>
        {esActivos ? "No tienes pedidos en curso" : "Todavía no hay historial"}
      </Text>
      <Text style={styles.vacioSub}>
        {esActivos
          ? "Cuando hagas un pedido, aquí lo verás avanzar paso a paso."
          : "Aquí quedarán tus pedidos entregados y cancelados."}
      </Text>
      {esActivos && (
        <TouchableOpacity style={styles.btnPrimario} onPress={() => router.push("/")}>
          <Text style={styles.btnPrimarioText}>Ver locales</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/* ---------- estilos ---------- */

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.bg },
  centrado: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 10 },

  header: { paddingHorizontal: 18, paddingTop: 6 },
  titulo: { fontSize: 26, fontWeight: "800", color: colors.ink, letterSpacing: -0.5 },
  segmento: {
    flexDirection: "row",
    backgroundColor: colors.paper,
    borderRadius: 14,
    padding: 5,
    marginTop: 14,
  },
  segmentoItem: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 10 },
  segmentoActivo: {
    backgroundColor: colors.surface,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segmentoText: { color: colors.muted, fontSize: 14, fontWeight: "600" },
  segmentoTextActivo: { color: colors.fc, fontSize: 14, fontWeight: "800" },

  tarjeta: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 12,
    shadowColor: "#28140A",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  franja: { width: 5 },
  tarjetaCuerpo: { flex: 1, padding: 14 },
  tarjetaTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  tarjetaLocal: { fontSize: 16, fontWeight: "800", color: colors.ink, letterSpacing: -0.2 },
  tarjetaCodigo: { fontSize: 11.5, fontWeight: "600", color: colors.faint, marginTop: 2 },
  estadoPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  estadoText: { fontSize: 11.5, fontWeight: "800" },
  tarjetaItems: { fontSize: 13, fontWeight: "500", color: colors.muted, marginTop: 9, lineHeight: 18 },
  tarjetaPie: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
  tarjetaTotal: { fontSize: 16, fontWeight: "800", color: colors.ink },
  tarjetaTiempo: { flexDirection: "row", alignItems: "center", gap: 3 },
  tarjetaTiempoText: { fontSize: 12, fontWeight: "600", color: colors.muted },
  tarjetaVer: { fontSize: 13, fontWeight: "800" },

  vacio: { alignItems: "center", gap: 9, paddingTop: 70, paddingHorizontal: 30 },
  vacioTitulo: { fontSize: 18, fontWeight: "800", color: colors.ink, textAlign: "center" },
  vacioSub: { fontSize: 13.5, color: colors.muted, textAlign: "center", lineHeight: 20 },
  btnPrimario: {
    marginTop: 10,
    backgroundColor: colors.fc,
    paddingHorizontal: 26,
    paddingVertical: 13,
    borderRadius: 999,
  },
  btnPrimarioText: { color: "#FFF", fontWeight: "800", fontSize: 15 },
});
