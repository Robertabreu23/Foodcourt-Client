import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError, cambiarEstadoPedido, getPedido, imagenUri } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  ACCION_COMERCIO,
  ICONO_PAGO,
  NOMBRE_PAGO,
  PINTA_ESTADO,
  clientePuedeCancelar,
  esFinal,
  pasoDe,
  siguienteEstado,
  textoTiempo,
} from "@/lib/pedidos";
import { colors } from "@/theme";
import { ESTADOS_EN_CURSO, type EstadoPedido, type Order } from "@/types";

/**
 * SEGUIMIENTO DEL PEDIDO
 *
 * Mientras el pedido esté en curso se refresca solo cada 3 s. Ese intervalo
 * corto es a propósito: con el modo demo del backend (§6.5) el pedido avanza
 * hasta "entregado" en 20 segundos y con un polling lento no se vería moverse.
 * Al llegar a un estado final el temporizador se apaga.
 */
const INTERVALO_MS = 3000;

export default function SeguimientoPedidoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const orderId = Number(id);
  const { token, user, cerrarSesion } = useAuth();
  const insets = useSafeAreaInsets();

  const [pedido, setPedido] = useState<Order | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  /** Trae el pedido. `silencioso` = refresco de fondo, sin spinner. */
  const cargar = useCallback(
    async (silencioso = false) => {
      if (!token || !Number.isFinite(orderId)) return null;
      try {
        const datos = await getPedido(token, orderId);
        setPedido(datos);
        setError(null);
        return datos;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          cerrarSesion();
          return null;
        }
        // Un fallo de red en un refresco de fondo no debe borrar lo que ya se ve.
        if (!silencioso) {
          setError(e instanceof Error ? e.message : "No se pudo cargar el pedido.");
        }
        return null;
      } finally {
        if (!silencioso) setCargando(false);
      }
    },
    [token, orderId, cerrarSesion],
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Polling: solo mientras el pedido siga vivo.
  const enCurso = pedido != null && !esFinal(pedido.estado);
  useEffect(() => {
    if (!enCurso) return;
    const t = setInterval(() => cargar(true), INTERVALO_MS);
    return () => clearInterval(t);
  }, [enCurso, cargar]);

  if (!token) return null;

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color={colors.fc} />
        <Text style={styles.cargandoText}>Buscando tu pedido…</Text>
      </View>
    );
  }

  if (error || !pedido) {
    return (
      <View style={styles.centrado}>
        <Ionicons name="receipt-outline" size={46} color={colors.faint} />
        <Text style={styles.errorTitulo}>No pudimos abrir este pedido</Text>
        <Text style={styles.errorMsg}>{error}</Text>
        <TouchableOpacity style={styles.btnPrimario} onPress={() => router.replace("/pedidos")}>
          <Text style={styles.btnPrimarioText}>Ver mis pedidos</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const pinta = PINTA_ESTADO[pedido.estado];
  const soyElComercio = user?.id === pedido.storeOwnerUserId;
  const proximo = siguienteEstado(pedido.estado);

  /* ---------- acciones ---------- */

  const mover = async (estado: EstadoPedido, motivo?: string) => {
    setOcupado(true);
    try {
      setPedido(await cambiarEstadoPedido(token, pedido.id, estado, motivo));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        cerrarSesion();
        return;
      }
      // El 409 trae el motivo ya escrito ("Ya están preparando tu pedido…").
      Alert.alert("No se pudo", e instanceof Error ? e.message : "Intenta de nuevo.");
      cargar(true);
    } finally {
      setOcupado(false);
    }
  };

  const cancelar = () => {
    Alert.alert(
      "Cancelar el pedido",
      "Se le avisará al local. Esto no se puede deshacer.",
      [
        { text: "No, seguir esperando", style: "cancel" },
        {
          text: "Sí, cancelar",
          style: "destructive",
          onPress: () => mover("cancelado", "Cancelado por el cliente"),
        },
      ],
    );
  };

  const llamar = (telefono: string) => Linking.openURL(`tel:${telefono}`);

  return (
    <View style={styles.pantalla}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      >
        {/* ===== Hero con el estado ===== */}
        <LinearGradient
          colors={[pinta.color, mezclarConNegro(pinta.color)]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + 12 }]}
        >
          <View style={styles.heroCirculo} />
          <View style={styles.heroBarra}>
            <TouchableOpacity style={styles.heroBack} onPress={volverAtras} hitSlop={8}>
              <Ionicons name="chevron-back" size={22} color="#FFF" />
            </TouchableOpacity>
            <View style={styles.codigoPill}>
              <Text style={styles.codigoText}>{pedido.codigo}</Text>
            </View>
          </View>

          <IconoLatiendo icono={pinta.icono} animar={!esFinal(pedido.estado)} />

          <Text style={styles.heroEstado}>{pinta.etiqueta}</Text>
          <Text style={styles.heroFrase}>{pinta.frase}</Text>

          {pedido.motivo && esFinal(pedido.estado) && pedido.estado !== "entregado" && (
            <View style={styles.motivoCaja}>
              <Text style={styles.motivoText}>{pedido.motivo}</Text>
            </View>
          )}

          {!esFinal(pedido.estado) && textoTiempo(pedido) && (
            <View style={styles.tiempoPill}>
              <Ionicons name="time-outline" size={14} color="#FFF" />
              <Text style={styles.tiempoText}>Estimado {textoTiempo(pedido)}</Text>
            </View>
          )}
        </LinearGradient>

        <View style={styles.cuerpo}>
          {/* ===== Línea de tiempo ===== */}
          {esFinal(pedido.estado) && pedido.estado !== "entregado" ? (
            <View style={styles.finalCaja}>
              <Ionicons name={pinta.icono} size={22} color={pinta.color} />
              <Text style={[styles.finalTexto, { color: pinta.color }]}>
                {pedido.estado === "cancelado"
                  ? "Este pedido se canceló."
                  : "El local no pudo tomar este pedido."}
              </Text>
            </View>
          ) : (
            <View style={styles.timeline}>
              {ESTADOS_EN_CURSO.map((paso, i) => (
                <PasoTimeline
                  key={paso}
                  estado={paso}
                  indice={i}
                  actual={pasoDe(pedido.estado)}
                  ultimo={i === ESTADOS_EN_CURSO.length - 1}
                />
              ))}
            </View>
          )}

          {/* ===== Repartidor ===== */}
          {pedido.repartidorNombre && (
            <View style={styles.repartidorCaja}>
              <View style={styles.repartidorAvatar}>
                <Ionicons name="person" size={20} color="#FFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.repartidorLabel}>Tu repartidor</Text>
                <Text style={styles.repartidorNombre}>{pedido.repartidorNombre}</Text>
              </View>
              {pedido.repartidorTelefono && (
                <TouchableOpacity
                  style={styles.llamarBtn}
                  onPress={() => llamar(pedido.repartidorTelefono!)}
                >
                  <Ionicons name="call" size={16} color="#FFF" />
                  <Text style={styles.llamarText}>Llamar</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ===== Panel del comercio ===== */}
          {soyElComercio && !esFinal(pedido.estado) && (
            <View style={styles.comercioCaja}>
              <Text style={styles.comercioTitulo}>Panel del local</Text>
              <Text style={styles.comercioCliente}>
                {pedido.clienteNombre} · {pedido.clienteTelefono}
              </Text>
              <View style={styles.comercioBotones}>
                <TouchableOpacity
                  style={styles.comercioLlamar}
                  onPress={() => llamar(pedido.clienteTelefono)}
                >
                  <Ionicons name="call-outline" size={15} color={colors.ink} />
                  <Text style={styles.comercioLlamarText}>Llamar</Text>
                </TouchableOpacity>
                {proximo && (
                  <TouchableOpacity
                    style={[styles.comercioAvanzar, ocupado && styles.apagado]}
                    onPress={() => mover(proximo)}
                    disabled={ocupado}
                  >
                    {ocupado ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <Text style={styles.comercioAvanzarText}>
                        {ACCION_COMERCIO[proximo] ?? "Avanzar"}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
              {pedido.estado === "pendiente" && (
                <TouchableOpacity
                  style={styles.comercioRechazar}
                  onPress={() =>
                    Alert.alert("Rechazar pedido", "¿Seguro que no lo puedes tomar?", [
                      { text: "Cancelar", style: "cancel" },
                      {
                        text: "Rechazar",
                        style: "destructive",
                        onPress: () => mover("rechazado", "El local no puede tomar el pedido"),
                      },
                    ])
                  }
                >
                  <Text style={styles.comercioRechazarText}>Rechazar pedido</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ===== Local ===== */}
          <TouchableOpacity
            style={styles.localCaja}
            activeOpacity={0.85}
            onPress={() =>
              router.push({
                pathname: "/store/[id]",
                params: { id: String(pedido.storeId), colorMarca: pedido.storeColorMarca },
              })
            }
          >
            <View style={[styles.localPunto, { backgroundColor: pedido.storeColorMarca }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.localNombre}>{pedido.storeNombre}</Text>
              <Text style={styles.localSub}>Ver la carta del local</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.faint} />
          </TouchableOpacity>

          {/* ===== Qué pediste ===== */}
          <Text style={styles.seccionTitulo}>Qué pediste</Text>
          <View style={styles.caja}>
            {pedido.items.map((item) => {
              const foto = imagenUri(item.imagenUrl);
              return (
                <View key={item.id} style={styles.itemFila}>
                  {foto ? (
                    <Image source={{ uri: foto }} style={styles.itemFoto} resizeMode="cover" />
                  ) : (
                    <View style={[styles.itemFoto, styles.itemFotoVacia]}>
                      <Text style={styles.itemCantidad}>{item.cantidad}×</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemNombre} numberOfLines={2}>
                      {item.cantidad}× {item.nombre}
                    </Text>
                    {item.opciones.length > 0 && (
                      <Text style={styles.itemOpciones} numberOfLines={3}>
                        {item.opciones.map((o) => o.nombre).join(" · ")}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.itemPrecio}>RD${item.subtotal}</Text>
                </View>
              );
            })}

            <View style={styles.separador} />
            <Fila etiqueta="Subtotal" valor={`RD$${pedido.subtotal}`} />
            <Fila etiqueta="Envío" valor={`RD$${pedido.envio}`} />
            <View style={styles.separador} />
            <Fila etiqueta="Total" valor={`RD$${pedido.total}`} destacada />
          </View>

          {/* ===== Entrega y pago ===== */}
          <Text style={styles.seccionTitulo}>Entrega y pago</Text>
          <View style={styles.caja}>
            <DatoFila icono="location-outline" etiqueta="Dirección" valor={pedido.direccionTexto} />
            <DatoFila
              icono={ICONO_PAGO[pedido.metodoPago]}
              etiqueta="Pago"
              valor={
                pedido.metodoPago === "efectivo" && pedido.pagaCon
                  ? `${NOMBRE_PAGO[pedido.metodoPago]} · paga con RD$${pedido.pagaCon}`
                  : NOMBRE_PAGO[pedido.metodoPago]
              }
            />
            {pedido.notas ? (
              <DatoFila
                icono="chatbubble-ellipses-outline"
                etiqueta="Notas"
                valor={pedido.notas}
              />
            ) : null}
            <DatoFila
              icono="pricetag-outline"
              etiqueta="Código"
              valor={pedido.codigo}
              ultimo
            />
          </View>

          {/* ===== Cancelar ===== */}
          {!soyElComercio && clientePuedeCancelar(pedido.estado) && (
            <TouchableOpacity
              style={[styles.cancelarBtn, ocupado && styles.apagado]}
              onPress={cancelar}
              disabled={ocupado}
            >
              <Ionicons name="close-circle-outline" size={17} color={colors.fcDeep} />
              <Text style={styles.cancelarText}>Cancelar el pedido</Text>
            </TouchableOpacity>
          )}
          {!soyElComercio && pedido.estado === "preparando" && (
            <Text style={styles.notaCancelar}>
              Ya están cocinando: a partir de aquí el pedido no se puede cancelar.
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/** Volver: si llegamos por `replace` desde el checkout no hay a dónde. */
function volverAtras() {
  if (router.canGoBack()) router.back();
  else router.replace("/pedidos");
}

/* ---------- piezas ---------- */

/** El icono del estado, con un latido suave mientras el pedido siga vivo. */
function IconoLatiendo({
  icono,
  animar,
}: {
  icono: keyof typeof Ionicons.glyphMap;
  animar: boolean;
}) {
  const escala = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!animar) {
      escala.setValue(1);
      return;
    }
    const bucle = Animated.loop(
      Animated.sequence([
        Animated.timing(escala, {
          toValue: 1.08,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(escala, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    bucle.start();
    return () => bucle.stop();
  }, [animar, escala]);

  return (
    <Animated.View style={[styles.heroIcono, { transform: [{ scale: escala }] }]}>
      <Ionicons name={icono} size={38} color="#FFF" />
    </Animated.View>
  );
}

/** Un paso de la línea de tiempo: hecho, en curso o pendiente. */
function PasoTimeline({
  estado,
  indice,
  actual,
  ultimo,
}: {
  estado: EstadoPedido;
  indice: number;
  actual: number;
  ultimo: boolean;
}) {
  const pinta = PINTA_ESTADO[estado];
  const hecho = indice < actual;
  const enCurso = indice === actual;
  const activo = hecho || enCurso;

  return (
    <View style={styles.paso}>
      <View style={styles.pasoIzquierda}>
        <View
          style={[
            styles.pasoPunto,
            activo && { backgroundColor: pinta.color, borderColor: pinta.color },
            enCurso && styles.pasoPuntoActual,
          ]}
        >
          {hecho ? (
            <Ionicons name="checkmark" size={13} color="#FFF" />
          ) : enCurso ? (
            <View style={styles.pasoPuntoDentro} />
          ) : null}
        </View>
        {!ultimo && <View style={[styles.pasoLinea, hecho && { backgroundColor: pinta.color }]} />}
      </View>

      <View style={[styles.pasoTexto, ultimo && { paddingBottom: 0 }]}>
        <Text style={[styles.pasoTitulo, !activo && styles.pasoInactivo]}>{pinta.etiqueta}</Text>
        {enCurso && <Text style={[styles.pasoFrase, { color: pinta.color }]}>{pinta.frase}</Text>}
      </View>
    </View>
  );
}

function Fila({
  etiqueta,
  valor,
  destacada,
}: {
  etiqueta: string;
  valor: string;
  destacada?: boolean;
}) {
  return (
    <View style={styles.fila}>
      <Text style={destacada ? styles.filaTotalLabel : styles.filaLabel}>{etiqueta}</Text>
      <Text style={destacada ? styles.filaTotalValor : styles.filaValor}>{valor}</Text>
    </View>
  );
}

function DatoFila({
  icono,
  etiqueta,
  valor,
  ultimo,
}: {
  icono: keyof typeof Ionicons.glyphMap;
  etiqueta: string;
  valor: string;
  ultimo?: boolean;
}) {
  return (
    <View style={[styles.datoFila, ultimo && { borderBottomWidth: 0, paddingBottom: 0 }]}>
      <Ionicons name={icono} size={17} color={colors.muted} />
      <View style={{ flex: 1 }}>
        <Text style={styles.datoEtiqueta}>{etiqueta}</Text>
        <Text style={styles.datoValor}>{valor}</Text>
      </View>
    </View>
  );
}

/** Oscurece un hex para el degradado del hero (los estados traen su color). */
function mezclarConNegro(hex: string): string {
  const limpio = hex.replace("#", "");
  if (limpio.length !== 6) return hex;
  const n = parseInt(limpio, 16);
  const f = (c: number) => Math.max(0, Math.round(c * 0.62));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/* ---------- estilos ---------- */

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.bg },
  centrado: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 10,
  },
  cargandoText: { color: colors.muted, fontSize: 14, fontWeight: "600" },
  errorTitulo: { color: colors.ink, fontSize: 18, fontWeight: "800", textAlign: "center" },
  errorMsg: { color: colors.muted, fontSize: 13.5, textAlign: "center", lineHeight: 20 },
  btnPrimario: {
    marginTop: 8,
    backgroundColor: colors.fc,
    paddingHorizontal: 26,
    paddingVertical: 13,
    borderRadius: 999,
  },
  btnPrimarioText: { color: "#FFF", fontWeight: "800", fontSize: 15 },

  hero: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 30,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: "hidden",
  },
  heroCirculo: {
    position: "absolute",
    right: -50,
    top: -40,
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  heroBarra: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroBack: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  codigoPill: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 999,
  },
  codigoText: { color: "#FFF", fontSize: 12.5, fontWeight: "800", letterSpacing: 0.5 },
  heroIcono: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  heroEstado: {
    color: "#FFF",
    fontSize: 25,
    fontWeight: "800",
    letterSpacing: -0.4,
    marginTop: 14,
    textAlign: "center",
  },
  heroFrase: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 20,
    marginTop: 6,
    paddingHorizontal: 10,
  },
  motivoCaja: {
    backgroundColor: "rgba(0,0,0,0.18)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 12,
  },
  motivoText: { color: "#FFF", fontSize: 13, fontWeight: "600", textAlign: "center" },
  tiempoPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    marginTop: 14,
  },
  tiempoText: { color: "#FFF", fontSize: 13, fontWeight: "700" },

  cuerpo: { padding: 18 },

  timeline: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    padding: 18,
  },
  paso: { flexDirection: "row", gap: 14 },
  pasoIzquierda: { alignItems: "center", width: 24 },
  pasoPunto: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  pasoPuntoActual: { transform: [{ scale: 1.15 }] },
  pasoPuntoDentro: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#FFF" },
  pasoLinea: { flex: 1, width: 2.5, backgroundColor: colors.line, marginVertical: 2 },
  pasoTexto: { flex: 1, paddingBottom: 20 },
  pasoTitulo: { fontSize: 15, fontWeight: "800", color: colors.ink, marginTop: 1 },
  pasoInactivo: { color: colors.faint, fontWeight: "600" },
  pasoFrase: { fontSize: 12.5, fontWeight: "600", marginTop: 3, lineHeight: 18 },

  finalCaja: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    padding: 18,
  },
  finalTexto: { flex: 1, fontSize: 14.5, fontWeight: "700", lineHeight: 20 },

  repartidorCaja: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#E0E9FF",
    borderRadius: 18,
    padding: 14,
    marginTop: 14,
  },
  repartidorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1D4ED8",
    alignItems: "center",
    justifyContent: "center",
  },
  repartidorLabel: { fontSize: 11.5, fontWeight: "700", color: "#3B5BB5" },
  repartidorNombre: { fontSize: 16, fontWeight: "800", color: "#16265E", marginTop: 1 },
  llamarBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1D4ED8",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
  },
  llamarText: { color: "#FFF", fontSize: 13, fontWeight: "800" },

  comercioCaja: {
    backgroundColor: colors.ink,
    borderRadius: 18,
    padding: 16,
    marginTop: 14,
  },
  comercioTitulo: { color: "#FFF", fontSize: 15.5, fontWeight: "800" },
  comercioCliente: { color: "rgba(255,255,255,0.75)", fontSize: 12.5, fontWeight: "600", marginTop: 3 },
  comercioBotones: { flexDirection: "row", gap: 10, marginTop: 14 },
  comercioLlamar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFF",
    paddingHorizontal: 16,
    height: 46,
    borderRadius: 13,
    justifyContent: "center",
  },
  comercioLlamarText: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  comercioAvanzar: {
    flex: 1,
    height: 46,
    borderRadius: 13,
    backgroundColor: colors.fc,
    alignItems: "center",
    justifyContent: "center",
  },
  comercioAvanzarText: { color: "#FFF", fontSize: 14.5, fontWeight: "800" },
  comercioRechazar: { alignSelf: "center", marginTop: 12, paddingVertical: 4 },
  comercioRechazarText: { color: "rgba(255,255,255,0.65)", fontSize: 13, fontWeight: "700" },

  localCaja: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    padding: 14,
    marginTop: 14,
  },
  localPunto: { width: 10, height: 10, borderRadius: 5 },
  localNombre: { fontSize: 15, fontWeight: "800", color: colors.ink },
  localSub: { fontSize: 12, fontWeight: "500", color: colors.muted, marginTop: 2 },

  seccionTitulo: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.3,
    marginTop: 24,
    marginBottom: 10,
  },
  caja: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    padding: 16,
  },

  itemFila: { flexDirection: "row", alignItems: "flex-start", gap: 11, marginBottom: 12 },
  itemFoto: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.paper },
  itemFotoVacia: { alignItems: "center", justifyContent: "center" },
  itemCantidad: { fontSize: 13, fontWeight: "800", color: colors.muted },
  itemNombre: { fontSize: 14, fontWeight: "700", color: colors.ink, lineHeight: 19 },
  itemOpciones: { fontSize: 11.5, fontWeight: "500", color: colors.muted, marginTop: 2, lineHeight: 16 },
  itemPrecio: { fontSize: 14, fontWeight: "700", color: colors.ink },

  separador: { height: 1, backgroundColor: colors.line, marginVertical: 8 },
  fila: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  filaLabel: { fontSize: 14, fontWeight: "600", color: colors.muted },
  filaValor: { fontSize: 14, fontWeight: "700", color: colors.ink },
  filaTotalLabel: { fontSize: 16.5, fontWeight: "800", color: colors.ink },
  filaTotalValor: { fontSize: 18, fontWeight: "800", color: colors.fc },

  datoFila: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    paddingBottom: 13,
    marginBottom: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  datoEtiqueta: { fontSize: 11.5, fontWeight: "700", color: colors.muted },
  datoValor: { fontSize: 14, fontWeight: "600", color: colors.ink, marginTop: 2, lineHeight: 19 },

  cancelarBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: 22,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.fcSoft,
  },
  cancelarText: { color: colors.fcDeep, fontSize: 14.5, fontWeight: "800" },
  notaCancelar: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.muted,
    textAlign: "center",
    marginTop: 20,
    lineHeight: 18,
    paddingHorizontal: 20,
  },
  apagado: { opacity: 0.6 },
});
