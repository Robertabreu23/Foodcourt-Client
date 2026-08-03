import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
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

import { ApiError, crearPedido, getDirecciones, validarPedido } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";
import { ICONO_PAGO, NOMBRE_PAGO } from "@/lib/pedidos";
import { colors } from "@/theme";
import type { Address, MetodoPago, ProblemaPedido, ValidacionPedido } from "@/types";

const METODOS: MetodoPago[] = ["efectivo", "tarjeta_entrega"];

/**
 * CONFIRMAR EL PEDIDO
 *
 * Antes de dejar confirmar, le pregunta al backend con `POST /orders/validar`
 * si el carrito sigue siendo válido: que el local esté abierto, que nada se
 * haya agotado y que los precios no hayan cambiado mientras el usuario decidía.
 * Los totales que se muestran son SIEMPRE los del servidor cuando los tenemos.
 */
export default function CheckoutScreen() {
  const { token, cerrarSesion } = useAuth();
  const carrito = useCart();
  const insets = useSafeAreaInsets();

  const [direcciones, setDirecciones] = useState<Address[]>([]);
  const [addressId, setAddressId] = useState<number | null>(null);
  const [cargandoDir, setCargandoDir] = useState(true);

  const [metodoPago, setMetodoPago] = useState<MetodoPago>("efectivo");
  const [pagaCon, setPagaCon] = useState("");
  const [notas, setNotas] = useState("");

  const [validacion, setValidacion] = useState<ValidacionPedido | null>(null);
  const [validando, setValidando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  // Al crear el pedido se vacía el carrito; sin esto la pantalla parpadearía
  // un instante con el estado "carrito vacío" justo antes de navegar.
  const [pedidoHecho, setPedidoHecho] = useState(false);

  /** Las líneas en la forma que espera el API. */
  const items = useMemo(
    () =>
      carrito.lineas.map((l) => ({
        itemId: l.itemId,
        cantidad: l.cantidad,
        opciones: l.opcionesElegidas.map((o) => o.id),
        // Solo lo lee /validar: sirve para que avise si el precio cambió.
        precioUnitario: l.precioUnitario,
      })),
    [carrito.lineas],
  );

  const manejarError = useCallback(
    (e: unknown, porDefecto: string) => {
      if (e instanceof ApiError && e.status === 401) {
        Alert.alert("Sesión expirada", "Vuelve a iniciar sesión.");
        cerrarSesion();
        return true;
      }
      setErrorGeneral(e instanceof Error ? e.message : porDefecto);
      return false;
    },
    [cerrarSesion],
  );

  /* ---------- direcciones ---------- */

  const cargarDirecciones = useCallback(async () => {
    if (!token) return;
    try {
      const lista = await getDirecciones(token);
      setDirecciones(lista);
      // La principal viene primero; se preselecciona si no había ninguna elegida.
      setAddressId((previa) =>
        previa && lista.some((d) => d.id === previa) ? previa : (lista[0]?.id ?? null),
      );
    } catch (e) {
      manejarError(e, "No se pudieron cargar tus direcciones.");
    } finally {
      setCargandoDir(false);
    }
  }, [token, manejarError]);

  // Al volver de la pantalla de direcciones, refrescar por si creó una nueva.
  useFocusEffect(
    useCallback(() => {
      cargarDirecciones();
    }, [cargarDirecciones]),
  );

  /* ---------- validación ---------- */

  const revisar = useCallback(async () => {
    if (!token || !carrito.storeId || items.length === 0 || !addressId) return;
    setValidando(true);
    setErrorGeneral(null);
    try {
      setValidacion(
        await validarPedido(token, { storeId: carrito.storeId, addressId, items }),
      );
    } catch (e) {
      manejarError(e, "No se pudo revisar el pedido.");
    } finally {
      setValidando(false);
    }
  }, [token, carrito.storeId, addressId, items, manejarError]);

  useEffect(() => {
    revisar();
  }, [revisar]);

  if (!token) return null;

  /* ---------- carrito vacío ---------- */

  // Pedido creado: el carrito ya está vacío y estamos navegando al seguimiento.
  if (pedidoHecho) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color={colors.fc} />
        <Text style={styles.vacioTitulo}>¡Pedido enviado!</Text>
      </View>
    );
  }

  if (carrito.lineas.length === 0 || !carrito.storeId) {
    return (
      <View style={styles.pantalla}>
        <Cabecera titulo="Confirmar pedido" />
        <View style={styles.centrado}>
          <Ionicons name="basket-outline" size={48} color={colors.faint} />
          <Text style={styles.vacioTitulo}>Tu carrito está vacío</Text>
          <TouchableOpacity style={styles.btnPrimario} onPress={() => router.replace("/")}>
            <Text style={styles.btnPrimarioText}>Ver locales</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  /* ---------- confirmar ---------- */

  const vuelto = Number(pagaCon);
  const totalMostrado = validacion?.total ?? carrito.total;
  const vueltoInsuficiente =
    metodoPago === "efectivo" && pagaCon.trim() !== "" && vuelto > 0 && vuelto < totalMostrado;

  const bloqueado =
    !addressId ||
    enviando ||
    validando ||
    // Si el backend ya dijo que hay problemas, no dejamos ni intentarlo.
    validacion?.ok === false ||
    vueltoInsuficiente;

  const confirmar = async () => {
    if (!addressId) {
      setErrorGeneral("Elige dónde quieres recibir el pedido.");
      return;
    }
    setEnviando(true);
    setErrorGeneral(null);
    try {
      const pedido = await crearPedido(token, {
        storeId: carrito.storeId!,
        addressId,
        metodoPago,
        pagaCon: metodoPago === "efectivo" && vuelto > 0 ? vuelto : null,
        notas: notas.trim() || null,
        // Sin `precioUnitario`: el backend calcula los precios.
        items: items.map(({ itemId, cantidad, opciones }) => ({ itemId, cantidad, opciones })),
      });
      setPedidoHecho(true);
      carrito.vaciar();
      // `replace` para que el botón atrás no devuelva al checkout de un pedido ya hecho.
      router.replace({ pathname: "/pedido/[id]", params: { id: String(pedido.id) } });
    } catch (e) {
      const salio = manejarError(e, "No se pudo crear el pedido.");
      if (!salio) {
        // Un 409 aquí casi siempre significa que algo cambió: vuelve a revisar.
        revisar();
      }
      setEnviando(false);
    }
  };

  const direccionElegida = direcciones.find((d) => d.id === addressId);

  return (
    <View style={styles.pantalla}>
      <Cabecera titulo="Confirmar pedido" subtitulo={carrito.storeNombre ?? undefined} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 18, paddingBottom: 40 }}
        >
          {/* ===== Problemas detectados ===== */}
          {validacion && validacion.problemas.length > 0 && (
            <View style={styles.avisos}>
              {validacion.problemas.map((p, i) => (
                <AvisoProblema key={`${p.tipo}-${p.itemId ?? i}`} problema={p} />
              ))}
              <TouchableOpacity style={styles.avisoBoton} onPress={() => router.back()}>
                <Ionicons name="arrow-back" size={14} color={colors.fcDeep} />
                <Text style={styles.avisoBotonText}>Volver al carrito para arreglarlo</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ===== Dirección ===== */}
          <Seccion icono="location-outline" titulo="Entregar en" />
          {cargandoDir ? (
            <View style={styles.cajaCargando}>
              <ActivityIndicator color={colors.fc} />
            </View>
          ) : direcciones.length === 0 ? (
            <TouchableOpacity
              style={styles.cajaVacia}
              onPress={() => router.push("/direcciones")}
              activeOpacity={0.85}
            >
              <Ionicons name="add-circle-outline" size={22} color={colors.fc} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cajaVaciaTitulo}>Agrega una dirección</Text>
                <Text style={styles.cajaVaciaSub}>Necesitamos saber dónde llevarlo.</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.faint} />
            </TouchableOpacity>
          ) : (
            <>
              {direcciones.map((d) => {
                const activa = d.id === addressId;
                return (
                  <TouchableOpacity
                    key={d.id}
                    style={[styles.opcionCaja, activa && styles.opcionCajaActiva]}
                    onPress={() => setAddressId(d.id)}
                    activeOpacity={0.8}
                  >
                    <Radio activo={activa} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.opcionTitulo}>
                        {d.etiqueta ?? "Dirección"}
                        {d.esPrincipal ? "  ·  Principal" : ""}
                      </Text>
                      <Text style={styles.opcionSub} numberOfLines={2}>
                        {d.calle}
                        {d.sector ? `, ${d.sector}` : ""}
                      </Text>
                      {d.referencia ? (
                        <Text style={styles.opcionNota} numberOfLines={1}>
                          {d.referencia}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity style={styles.enlace} onPress={() => router.push("/direcciones")}>
                <Ionicons name="settings-outline" size={14} color={colors.fc} />
                <Text style={styles.enlaceText}>Administrar mis direcciones</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ===== Pago ===== */}
          <Seccion icono="wallet-outline" titulo="Cómo pagas" />
          {METODOS.map((m) => {
            const activo = m === metodoPago;
            return (
              <TouchableOpacity
                key={m}
                style={[styles.opcionCaja, activo && styles.opcionCajaActiva]}
                onPress={() => setMetodoPago(m)}
                activeOpacity={0.8}
              >
                <Radio activo={activo} />
                <Ionicons name={ICONO_PAGO[m]} size={19} color={activo ? colors.fc : colors.muted} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.opcionTitulo}>{NOMBRE_PAGO[m]}</Text>
                  <Text style={styles.opcionSub}>
                    {m === "efectivo"
                      ? "Pagas al recibir el pedido"
                      : "El repartidor lleva el datáfono"}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}

          {metodoPago === "efectivo" && (
            <View style={styles.vueltoCaja}>
              <Text style={styles.label}>¿Con cuánto vas a pagar?</Text>
              <View style={[styles.inputRow, vueltoInsuficiente && styles.inputRowError]}>
                <Text style={styles.prefijo}>RD$</Text>
                <TextInput
                  style={styles.input}
                  value={pagaCon}
                  onChangeText={setPagaCon}
                  placeholder="2000"
                  placeholderTextColor={colors.faint}
                  keyboardType="number-pad"
                />
              </View>
              {vueltoInsuficiente ? (
                <Text style={styles.errorInline}>
                  Con RD${vuelto} no alcanza: el pedido cuesta RD${totalMostrado}.
                </Text>
              ) : vuelto > 0 ? (
                <Text style={styles.ayudaOk}>
                  Te llevan RD${vuelto - totalMostrado} de vuelto.
                </Text>
              ) : (
                <Text style={styles.ayuda}>Opcional — para que lleven tu vuelto listo.</Text>
              )}
            </View>
          )}

          {/* ===== Notas ===== */}
          <Seccion icono="chatbubble-ellipses-outline" titulo="Notas para el local" />
          <View style={[styles.inputRow, styles.inputMulti]}>
            <TextInput
              style={[styles.input, { height: 70, textAlignVertical: "top" }]}
              value={notas}
              onChangeText={setNotas}
              placeholder="Sin picante, tocar el timbre dos veces…"
              placeholderTextColor={colors.faint}
              multiline
            />
          </View>

          {/* ===== Resumen ===== */}
          <Seccion icono="receipt-outline" titulo="Resumen" />
          <View style={styles.resumen}>
            {carrito.lineas.map((l) => (
              <View key={l.clave} style={styles.resumenLinea}>
                <Text style={styles.resumenCantidad}>{l.cantidad}×</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.resumenNombre} numberOfLines={1}>
                    {l.nombre}
                  </Text>
                  {l.opcionesElegidas.length > 0 && (
                    <Text style={styles.resumenOpciones} numberOfLines={2}>
                      {l.opcionesElegidas.map((o) => o.nombre).join(" · ")}
                    </Text>
                  )}
                </View>
                <Text style={styles.resumenPrecio}>RD${l.precioUnitario * l.cantidad}</Text>
              </View>
            ))}

            <View style={styles.separador} />
            <FilaTotal etiqueta="Subtotal" valor={validacion?.subtotal ?? carrito.subtotal} />
            <FilaTotal etiqueta="Envío" valor={validacion?.envio ?? carrito.envioBase} />
            <View style={styles.separador} />
            <FilaTotal etiqueta="Total" valor={totalMostrado} destacada />
            {validacion && (
              <Text style={styles.notaTotales}>Totales confirmados por el servidor.</Text>
            )}
          </View>

          {errorGeneral && <Text style={styles.errorGeneral}>{errorGeneral}</Text>}
        </ScrollView>

        {/* ===== Confirmar ===== */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            style={[styles.btnConfirmar, bloqueado && styles.apagado]}
            onPress={confirmar}
            disabled={bloqueado}
            activeOpacity={0.9}
          >
            {enviando ? (
              <ActivityIndicator color="#FFF" />
            ) : validando ? (
              <Text style={styles.btnConfirmarText}>Revisando…</Text>
            ) : (
              <>
                <Text style={styles.btnConfirmarText}>Hacer el pedido</Text>
                <Text style={styles.btnConfirmarText}>RD${totalMostrado}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

/* ---------- piezas ---------- */

function Cabecera({ titulo, subtitulo }: { titulo: string; subtitulo?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
        <Ionicons name="chevron-back" size={20} color={colors.ink} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={styles.titulo}>{titulo}</Text>
        {subtitulo ? (
          <Text style={styles.subtitulo} numberOfLines={1}>
            {subtitulo}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function Seccion({
  icono,
  titulo,
}: {
  icono: keyof typeof Ionicons.glyphMap;
  titulo: string;
}) {
  return (
    <View style={styles.seccionRow}>
      <Ionicons name={icono} size={17} color={colors.fc} />
      <Text style={styles.seccionTitulo}>{titulo}</Text>
    </View>
  );
}

function Radio({ activo }: { activo: boolean }) {
  return (
    <View style={[styles.radio, activo && { borderColor: colors.fc, backgroundColor: colors.fc }]}>
      {activo && <View style={styles.radioPunto} />}
    </View>
  );
}

/** Un problema devuelto por /orders/validar, con su mensaje ya redactado. */
function AvisoProblema({ problema }: { problema: ProblemaPedido }) {
  const grave = problema.tipo !== "precio_cambio";
  return (
    <View style={[styles.aviso, !grave && styles.avisoLeve]}>
      <Ionicons
        name={grave ? "alert-circle" : "information-circle"}
        size={17}
        color={grave ? colors.fcDeep : "#B26A00"}
      />
      <Text style={[styles.avisoTexto, !grave && { color: "#7A5200" }]}>{problema.mensaje}</Text>
    </View>
  );
}

function FilaTotal({
  etiqueta,
  valor,
  destacada,
}: {
  etiqueta: string;
  valor: number;
  destacada?: boolean;
}) {
  return (
    <View style={styles.filaTotal}>
      <Text style={destacada ? styles.totalLabel : styles.subLabel}>{etiqueta}</Text>
      <Text style={destacada ? styles.totalValor : styles.subValor}>RD${valor}</Text>
    </View>
  );
}

/* ---------- estilos ---------- */

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.bg },
  centrado: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 10 },
  vacioTitulo: { fontSize: 19, fontWeight: "800", color: colors.ink },

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

  avisos: { gap: 8, marginBottom: 18 },
  aviso: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    backgroundColor: colors.fcSoft,
    borderRadius: 14,
    padding: 13,
  },
  avisoLeve: { backgroundColor: "#FFF3DC" },
  avisoTexto: { flex: 1, color: colors.fcDeep, fontSize: 13, fontWeight: "700", lineHeight: 19 },
  avisoBoton: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "center", paddingVertical: 4 },
  avisoBotonText: { color: colors.fcDeep, fontSize: 13, fontWeight: "800" },

  seccionRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 22, marginBottom: 10 },
  seccionTitulo: { fontSize: 16.5, fontWeight: "800", color: colors.ink, letterSpacing: -0.2 },

  cajaCargando: {
    height: 70,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
  },
  cajaVacia: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.fcSoft,
    borderRadius: 16,
    padding: 16,
  },
  cajaVaciaTitulo: { fontSize: 15, fontWeight: "800", color: colors.ink },
  cajaVaciaSub: { fontSize: 12.5, fontWeight: "500", color: colors.muted, marginTop: 2 },

  opcionCaja: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 16,
    padding: 14,
    marginBottom: 9,
  },
  opcionCajaActiva: { borderColor: colors.fc, backgroundColor: "#FFFBF9" },
  opcionTitulo: { fontSize: 14.5, fontWeight: "800", color: colors.ink },
  opcionSub: { fontSize: 12.5, fontWeight: "500", color: colors.muted, marginTop: 2, lineHeight: 18 },
  opcionNota: { fontSize: 11.5, fontWeight: "500", color: colors.faint, marginTop: 1 },

  radio: {
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  radioPunto: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#FFF" },

  enlace: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingVertical: 4 },
  enlaceText: { color: colors.fc, fontSize: 13, fontWeight: "700" },

  vueltoCaja: { marginTop: 6 },
  label: { fontSize: 13, fontWeight: "700", color: colors.ink, marginBottom: 6 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 50,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
  },
  inputRowError: { borderColor: colors.fc },
  inputMulti: { paddingVertical: 10, alignItems: "flex-start" },
  prefijo: { fontSize: 15, fontWeight: "800", color: colors.muted },
  input: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.ink, paddingVertical: 0 },
  ayuda: { fontSize: 12, fontWeight: "500", color: colors.muted, marginTop: 6 },
  ayudaOk: { fontSize: 12.5, fontWeight: "700", color: colors.leaf, marginTop: 6 },
  errorInline: { fontSize: 12.5, fontWeight: "700", color: colors.fcDeep, marginTop: 6 },

  resumen: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    padding: 16,
  },
  resumenLinea: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  resumenCantidad: { fontSize: 13.5, fontWeight: "800", color: colors.fc, minWidth: 24 },
  resumenNombre: { fontSize: 14, fontWeight: "700", color: colors.ink },
  resumenOpciones: { fontSize: 11.5, fontWeight: "500", color: colors.muted, marginTop: 2, lineHeight: 16 },
  resumenPrecio: { fontSize: 14, fontWeight: "700", color: colors.ink },
  separador: { height: 1, backgroundColor: colors.line, marginVertical: 8 },
  filaTotal: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  subLabel: { fontSize: 14, fontWeight: "600", color: colors.muted },
  subValor: { fontSize: 14, fontWeight: "700", color: colors.ink },
  totalLabel: { fontSize: 16.5, fontWeight: "800", color: colors.ink },
  totalValor: { fontSize: 18, fontWeight: "800", color: colors.fc },
  notaTotales: { fontSize: 11, fontWeight: "500", color: colors.faint, textAlign: "center", marginTop: 8 },

  errorGeneral: { color: colors.fcDeep, fontSize: 13, fontWeight: "700", marginTop: 16, textAlign: "center" },

  footer: {
    paddingHorizontal: 18,
    paddingTop: 12,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  btnConfirmar: {
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.fc,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  btnConfirmarText: { color: "#FFF", fontSize: 16, fontWeight: "800" },
  apagado: { opacity: 0.5 },
  btnPrimario: {
    marginTop: 8,
    backgroundColor: colors.fc,
    paddingHorizontal: 26,
    paddingVertical: 13,
    borderRadius: 999,
  },
  btnPrimarioText: { color: "#FFF", fontWeight: "800", fontSize: 15 },
});
