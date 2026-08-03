import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError, cambiarEstadoPedido, getPedidosDelLocal } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  ACCION_COMERCIO,
  PINTA_ESTADO,
  esFinal,
  haceCuanto,
  resumenItems,
  siguienteEstado,
} from "@/lib/pedidos";
import { colors } from "@/theme";
import type { EstadoPedido, Order } from "@/types";

/** La cola se refresca sola: al local le entran pedidos sin que toque nada. */
const INTERVALO_MS = 10000;

const FILTROS: { clave: EstadoPedido | "todos"; texto: string }[] = [
  { clave: "todos", texto: "Todos" },
  { clave: "pendiente", texto: "Nuevos" },
  { clave: "confirmado", texto: "Confirmados" },
  { clave: "preparando", texto: "En cocina" },
  { clave: "en_camino", texto: "En camino" },
  { clave: "entregado", texto: "Entregados" },
];

/**
 * COLA DE PEDIDOS DEL LOCAL (panel del dueño)
 *
 * Cada tarjeta puede avanzar el pedido sin salir de aquí: es lo que hace un
 * local con la tablet en la cocina. El detalle completo sigue estando en la
 * pantalla de seguimiento.
 */
export default function PedidosDelLocalScreen() {
  const { storeId: storeIdParam } = useLocalSearchParams<{ storeId: string }>();
  const storeId = Number(storeIdParam);
  const { token, cerrarSesion } = useAuth();
  const insets = useSafeAreaInsets();

  const [filtro, setFiltro] = useState<EstadoPedido | "todos">("todos");
  const [pedidos, setPedidos] = useState<Order[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moviendo, setMoviendo] = useState<number | null>(null);

  const cargar = useCallback(
    async (silencioso = false) => {
      if (!token || !Number.isFinite(storeId)) return;
      if (!silencioso) setCargando(true);
      setError(null);
      try {
        setPedidos(
          await getPedidosDelLocal(token, storeId, {
            estado: filtro === "todos" ? undefined : filtro,
          }),
        );
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          cerrarSesion();
          return;
        }
        if (!silencioso) {
          setError(e instanceof Error ? e.message : "No se pudieron cargar los pedidos.");
        }
      } finally {
        if (!silencioso) setCargando(false);
        setRefrescando(false);
      }
    },
    [token, storeId, filtro, cerrarSesion],
  );

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  useEffect(() => {
    const t = setInterval(() => cargar(true), INTERVALO_MS);
    return () => clearInterval(t);
  }, [cargar]);

  if (!token) return null;

  const mover = async (pedido: Order, estado: EstadoPedido, motivo?: string) => {
    setMoviendo(pedido.id);
    try {
      const actualizado = await cambiarEstadoPedido(token, pedido.id, estado, motivo);
      // Se reemplaza en el sitio para que la lista no salte mientras se mira.
      setPedidos((previos) => previos.map((p) => (p.id === actualizado.id ? actualizado : p)));
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

  const rechazar = (pedido: Order) =>
    Alert.alert("Rechazar pedido", `¿Rechazar el pedido ${pedido.codigo}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Rechazar",
        style: "destructive",
        onPress: () => mover(pedido, "rechazado", "El local no puede tomar el pedido"),
      },
    ]);

  const nuevos = pedidos.filter((p) => p.estado === "pendiente").length;

  return (
    <View style={styles.pantalla}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={colors.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.titulo}>Pedidos del local</Text>
          <Text style={styles.subtitulo}>
            {nuevos > 0 ? `${nuevos} esperando confirmación` : "Todo al día"}
          </Text>
        </View>
        {nuevos > 0 && (
          <View style={styles.badgeNuevos}>
            <Text style={styles.badgeNuevosText}>{nuevos}</Text>
          </View>
        )}
      </View>

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
          data={pedidos}
          keyExtractor={(p) => String(p.id)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 18, paddingTop: 8, paddingBottom: insets.bottom + 28 }}
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
            <TarjetaComercio
              pedido={item}
              ocupado={moviendo === item.id}
              onAvanzar={(estado) => mover(item, estado)}
              onRechazar={() => rechazar(item)}
              onAbrir={() =>
                router.push({ pathname: "/pedido/[id]", params: { id: String(item.id) } })
              }
            />
          )}
          ListEmptyComponent={
            <View style={styles.vacio}>
              <Ionicons name="restaurant-outline" size={50} color={colors.faint} />
              <Text style={styles.vacioTitulo}>Sin pedidos aquí</Text>
              <Text style={styles.vacioSub}>
                Cuando entre uno nuevo aparecerá solo, sin que tengas que recargar.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

/* ---------- tarjeta del comercio ---------- */

function TarjetaComercio({
  pedido,
  ocupado,
  onAvanzar,
  onRechazar,
  onAbrir,
}: {
  pedido: Order;
  ocupado: boolean;
  onAvanzar: (estado: EstadoPedido) => void;
  onRechazar: () => void;
  onAbrir: () => void;
}) {
  const pinta = PINTA_ESTADO[pedido.estado];
  const proximo = siguienteEstado(pedido.estado);
  const cerrado = esFinal(pedido.estado);
  const esNuevo = pedido.estado === "pendiente";

  return (
    <View style={[styles.tarjeta, esNuevo && styles.tarjetaNueva]}>
      <TouchableOpacity onPress={onAbrir} activeOpacity={0.85}>
        <View style={styles.tarjetaTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.codigo}>{pedido.codigo}</Text>
            <Text style={styles.cuando}>{haceCuanto(pedido.createdAt)}</Text>
          </View>
          <View style={[styles.estadoPill, { backgroundColor: pinta.fondo }]}>
            <Ionicons name={pinta.icono} size={13} color={pinta.color} />
            <Text style={[styles.estadoText, { color: pinta.color }]}>{pinta.etiqueta}</Text>
          </View>
        </View>

        <Text style={styles.items} numberOfLines={3}>
          {resumenItems(pedido)}
        </Text>

        <View style={styles.datosRow}>
          <Ionicons name="person-outline" size={13} color={colors.muted} />
          <Text style={styles.datoText} numberOfLines={1}>
            {pedido.clienteNombre}
          </Text>
          <Text style={styles.total}>RD${pedido.total}</Text>
        </View>
        <View style={styles.datosRow}>
          <Ionicons name="location-outline" size={13} color={colors.muted} />
          <Text style={styles.datoText} numberOfLines={1}>
            {pedido.direccionTexto}
          </Text>
        </View>
        {pedido.notas ? (
          <View style={styles.notasCaja}>
            <Ionicons name="chatbubble-ellipses-outline" size={13} color="#B26A00" />
            <Text style={styles.notasText}>{pedido.notas}</Text>
          </View>
        ) : null}
      </TouchableOpacity>

      {!cerrado && (
        <View style={styles.acciones}>
          <TouchableOpacity
            style={styles.accionSecundaria}
            onPress={() => Linking.openURL(`tel:${pedido.clienteTelefono}`)}
          >
            <Ionicons name="call-outline" size={15} color={colors.ink} />
          </TouchableOpacity>

          {esNuevo && (
            <TouchableOpacity style={styles.accionSecundaria} onPress={onRechazar}>
              <Ionicons name="close" size={17} color={colors.fcDeep} />
            </TouchableOpacity>
          )}

          {proximo && (
            <TouchableOpacity
              style={[styles.accionPrincipal, ocupado && styles.apagado]}
              onPress={() => onAvanzar(proximo)}
              disabled={ocupado}
              activeOpacity={0.9}
            >
              {ocupado ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.accionPrincipalText}>
                  {ACCION_COMERCIO[proximo] ?? "Avanzar"}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
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
  badgeNuevos: {
    minWidth: 30,
    height: 30,
    paddingHorizontal: 9,
    borderRadius: 15,
    backgroundColor: colors.fc,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeNuevosText: { color: "#FFF", fontSize: 14, fontWeight: "800" },

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
    padding: 14,
    marginBottom: 12,
  },
  tarjetaNueva: { borderColor: colors.fc, borderWidth: 1.5 },
  tarjetaTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  codigo: { fontSize: 15.5, fontWeight: "800", color: colors.ink, letterSpacing: 0.3 },
  cuando: { fontSize: 11.5, fontWeight: "600", color: colors.faint, marginTop: 2 },
  estadoPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  estadoText: { fontSize: 11.5, fontWeight: "800" },

  items: { fontSize: 13.5, fontWeight: "600", color: colors.ink, marginTop: 10, lineHeight: 19 },
  datosRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  datoText: { flex: 1, fontSize: 12.5, fontWeight: "500", color: colors.muted },
  total: { fontSize: 15, fontWeight: "800", color: colors.ink },
  notasCaja: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    backgroundColor: "#FFF3DC",
    borderRadius: 12,
    padding: 10,
    marginTop: 10,
  },
  notasText: { flex: 1, fontSize: 12.5, fontWeight: "600", color: "#7A5200", lineHeight: 18 },

  acciones: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 12,
  },
  accionSecundaria: {
    width: 46,
    height: 46,
    borderRadius: 13,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  accionPrincipal: {
    flex: 1,
    height: 46,
    borderRadius: 13,
    backgroundColor: colors.fc,
    alignItems: "center",
    justifyContent: "center",
  },
  accionPrincipalText: { color: "#FFF", fontSize: 14.5, fontWeight: "800" },
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
