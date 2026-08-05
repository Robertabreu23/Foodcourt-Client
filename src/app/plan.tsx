import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError, crearCheckout, getSuscripcion } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { colors } from "@/theme";
import type { EstadoSuscripcion, Suscripcion } from "@/types";

const BENEFICIOS = [
  { icono: "storefront-outline", texto: "Publica hasta 3 locales" },
  { icono: "restaurant-outline", texto: "Carta completa con fotos y opciones" },
  { icono: "receipt-outline", texto: "Panel de pedidos en vivo" },
  { icono: "trending-up-outline", texto: "Aparece en el Inicio de todos los clientes" },
] as const;

const PINTA: Record<EstadoSuscripcion, { etiqueta: string; color: string; fondo: string }> = {
  sin_suscripcion: { etiqueta: "Sin plan", color: colors.muted, fondo: colors.paper },
  pendiente: { etiqueta: "Procesando el pago", color: "#B26A00", fondo: "#FFF3DC" },
  activa: { etiqueta: "Plan activo", color: "#177449", fondo: "#E9F6EF" },
  vencida: { etiqueta: "Plan vencido", color: colors.fcDeep, fondo: colors.fcSoft },
  cancelada: { etiqueta: "Plan cancelado", color: colors.muted, fondo: colors.paper },
};

/**
 * PLAN DE COMERCIOS
 *
 * El pago ocurre en una página de Stripe, fuera de la app: aquí nunca se toca
 * un número de tarjeta.
 *
 * Lo importante: **volver de Stripe no significa que pagó**. Esa URL la abre el
 * navegador y cualquiera podría escribirla. Quien asciende al usuario es el
 * webhook que Stripe le manda al backend, así que al volver hay que preguntar
 * por `GET /suscripcion` y fiarse solo de `alDia`. Como el webhook puede tardar
 * un segundo o dos, se reintenta unas cuantas veces antes de dar por fallido.
 */
export default function PlanScreen() {
  const { token, cerrarSesion } = useAuth();
  const insets = useSafeAreaInsets();

  const [suscripcion, setSuscripcion] = useState<Suscripcion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagando, setPagando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  /** Ya intentó pagar: se le ofrece el botón de volver a comprobar. */
  const [intentoPago, setIntentoPago] = useState(false);

  const cargar = useCallback(async () => {
    if (!token) return null;
    try {
      const datos = await getSuscripcion(token);
      setSuscripcion(datos);
      setError(null);
      return datos;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        cerrarSesion();
        return null;
      }
      setError(e instanceof Error ? e.message : "No se pudo consultar tu plan.");
      return null;
    } finally {
      setCargando(false);
    }
  }, [token, cerrarSesion]);

  // Cada vez que la pantalla vuelve al frente. Hace falta porque al volver de
  // Stripe esta pantalla YA está montada: con un `useEffect` normal se quedaría
  // con el estado de antes de pagar y parecería que no pasó nada.
  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  // Y cuando la app vuelve del segundo plano. Cubre el caso de volver desde
  // Safari sin navegar por dentro (ahí no se dispara el foco de la pantalla).
  useEffect(() => {
    const sub = AppState.addEventListener("change", (estado) => {
      if (estado === "active") cargar();
    });
    return () => sub.remove();
  }, [cargar]);

  if (!token) return null;

  /**
   * Pregunta por el plan varias veces: el webhook de Stripe puede tardar un
   * par de segundos en llegarle al backend.
   *
   * `silencioso` evita el aviso final cuando esto corre solo (al volver del
   * segundo plano), para no molestar a quien ni siquiera estaba pagando.
   */
  const esperarConfirmacion = async (silencioso = false) => {
    setConfirmando(true);
    for (let intento = 0; intento < 8; intento++) {
      const datos = await cargar();
      if (datos?.alDia) {
        setConfirmando(false);
        setIntentoPago(false);
        Alert.alert("¡Listo!", "Tu plan quedó activo. Ya puedes publicar tus locales.");
        return true;
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    setConfirmando(false);
    if (!silencioso) {
      Alert.alert(
        "Todavía no lo vemos",
        "Si completaste el pago, puede tardar unos segundos. Usa “Ya pagué, revisar” para volver a comprobarlo.",
      );
    }
    return false;
  };

  const pagar = async () => {
    setPagando(true);
    setError(null);
    setIntentoPago(true);
    try {
      const { urlDePago } = await crearCheckout(token);
      // `openBrowserAsync` y no `openAuthSessionAsync`: esto no es un login
      // OAuth, es una página de pago. El navegador normal siempre trae su
      // botón de cerrar, así que el usuario nunca se queda encerrado si el
      // regreso automático falla. La promesa resuelve al cerrarlo.
      await WebBrowser.openBrowserAsync(urlDePago, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        showTitle: true,
      });
      await esperarConfirmacion();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        cerrarSesion();
        return;
      }
      if (e instanceof ApiError && e.status === 409) {
        // Ya tenía plan activo: refrescar y ya.
        await cargar();
      } else {
        setError(e instanceof Error ? e.message : "No se pudo abrir el pago.");
      }
    } finally {
      setPagando(false);
    }
  };

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color={colors.fc} />
      </View>
    );
  }

  const pinta = PINTA[suscripcion?.estado ?? "sin_suscripcion"];
  const alDia = suscripcion?.alDia === true;
  const ocupado = pagando || confirmando;

  return (
    <View style={styles.pantalla}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      >
        {/* ===== Cabecera ===== */}
        <LinearGradient
          colors={alDia ? ["#1EA866", "#0E7C4A"] : [colors.fc, "#FF8347"]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + 12 }]}
        >
          <View style={styles.heroCirculo} />
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color="#FFF" />
          </TouchableOpacity>

          <View style={styles.heroIcono}>
            <Ionicons name={alDia ? "checkmark-circle" : "storefront"} size={34} color="#FFF" />
          </View>
          <Text style={styles.heroTitulo}>
            {alDia ? "Eres comercio" : "Vende en Foodclub"}
          </Text>
          <Text style={styles.heroSub}>
            {alDia
              ? "Tu plan está al día y tus locales se están mostrando."
              : "Publica tus locales y recibe pedidos desde la app."}
          </Text>
        </LinearGradient>

        <View style={styles.cuerpo}>
          {/* ===== Estado ===== */}
          {suscripcion && (
            <View style={styles.estadoCaja}>
              <View style={[styles.estadoPill, { backgroundColor: pinta.fondo }]}>
                <Text style={[styles.estadoText, { color: pinta.color }]}>{pinta.etiqueta}</Text>
              </View>
              <View style={styles.estadoDatos}>
                <Dato
                  etiqueta="Locales"
                  valor={`${suscripcion.localesUsados} de ${suscripcion.maxLocales}`}
                />
                {suscripcion.periodoFin && (
                  <Dato
                    etiqueta={alDia ? "Renueva" : "Venció"}
                    valor={formatearFecha(suscripcion.periodoFin)}
                  />
                )}
              </View>
            </View>
          )}

          {/* ===== Aviso de vencido ===== */}
          {suscripcion && !alDia && suscripcion.localesUsados > 0 && (
            <View style={styles.avisoVencido}>
              <Ionicons name="alert-circle" size={18} color={colors.fcDeep} />
              <Text style={styles.avisoVencidoText}>
                Tus {suscripcion.localesUsados} local
                {suscripcion.localesUsados === 1 ? "" : "es"} no se están mostrando en el Inicio.
                Nada se ha borrado: al renovar vuelven con su carta y su historial.
              </Text>
            </View>
          )}

          {/* ===== Precio y beneficios ===== */}
          {!alDia && (
            <View style={styles.precioCaja}>
              <View style={styles.precioRow}>
                <Text style={styles.precio}>US$19.99</Text>
                <Text style={styles.precioMes}>/ mes</Text>
              </View>
              <Text style={styles.precioNota}>Cancela cuando quieras.</Text>

              <View style={styles.beneficios}>
                {BENEFICIOS.map((b) => (
                  <View key={b.texto} style={styles.beneficio}>
                    <View style={styles.beneficioIcono}>
                      <Ionicons name={b.icono} size={16} color={colors.fc} />
                    </View>
                    <Text style={styles.beneficioText}>{b.texto}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {error && <Text style={styles.error}>{error}</Text>}

          {/* ===== Botón ===== */}
          {!alDia ? (
            <TouchableOpacity
              style={[styles.cta, ocupado && styles.apagado]}
              onPress={pagar}
              disabled={ocupado}
              activeOpacity={0.9}
            >
              {ocupado ? (
                <>
                  <ActivityIndicator color="#FFF" />
                  <Text style={styles.ctaText}>
                    {confirmando ? "  Confirmando el pago…" : "  Abriendo el pago…"}
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons name="card-outline" size={19} color="#FFF" />
                  <Text style={styles.ctaText}>
                    {suscripcion?.estado === "vencida" ? "Renovar el plan" : "Hacerme comercio"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          ) : null}

          {/* Salvavidas: si el regreso desde Stripe no funcionó, esto lo
              comprueba a mano. El pago ya está hecho del lado del banco. */}
          {!alDia && intentoPago && !ocupado && (
            <TouchableOpacity
              style={styles.revisarBtn}
              onPress={() => esperarConfirmacion()}
              activeOpacity={0.85}
            >
              <Ionicons name="refresh" size={17} color={colors.fc} />
              <Text style={styles.revisarText}>Ya pagué, revisar</Text>
            </TouchableOpacity>
          )}

          {alDia && (
            <TouchableOpacity
              style={styles.ctaSecundario}
              onPress={() => router.replace("/perfil")}
              activeOpacity={0.9}
            >
              <Text style={styles.ctaSecundarioText}>Ir a mis locales</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.legal}>
            El pago se hace en una página segura de Stripe: la app nunca ve tu número de tarjeta.
            {alDia ? " Para cancelar, entra a tu cuenta de Stripe." : ""}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View>
      <Text style={styles.datoEtiqueta}>{etiqueta}</Text>
      <Text style={styles.datoValor}>{valor}</Text>
    </View>
  );
}

/** "3 sep 2026" — sin traer una librería de fechas. */
function formatearFecha(iso: string): string {
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${meses[d.getMonth()]} ${d.getFullYear()}`;
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.bg },
  centrado: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },

  hero: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 32,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: "hidden",
  },
  heroCirculo: {
    position: "absolute",
    right: -50,
    top: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  backBtn: {
    alignSelf: "flex-start",
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroIcono: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  heroTitulo: {
    color: "#FFF",
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginTop: 14,
    textAlign: "center",
  },
  heroSub: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 20,
    marginTop: 6,
  },

  cuerpo: { padding: 18 },

  estadoCaja: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    padding: 16,
  },
  estadoPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  estadoText: { fontSize: 12.5, fontWeight: "800" },
  estadoDatos: { flexDirection: "row", gap: 32, marginTop: 14 },
  datoEtiqueta: { fontSize: 11.5, fontWeight: "700", color: colors.muted },
  datoValor: { fontSize: 16, fontWeight: "800", color: colors.ink, marginTop: 2 },

  avisoVencido: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    backgroundColor: colors.fcSoft,
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
  },
  avisoVencidoText: {
    flex: 1,
    color: colors.fcDeep,
    fontSize: 12.5,
    fontWeight: "600",
    lineHeight: 18,
  },

  precioCaja: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    padding: 18,
    marginTop: 12,
  },
  precioRow: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  precio: { fontSize: 34, fontWeight: "800", color: colors.ink, letterSpacing: -1 },
  precioMes: { fontSize: 15, fontWeight: "700", color: colors.muted },
  precioNota: { fontSize: 12.5, fontWeight: "500", color: colors.muted, marginTop: 2 },
  beneficios: { gap: 12, marginTop: 18 },
  beneficio: { flexDirection: "row", alignItems: "center", gap: 11 },
  beneficioIcono: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.fcSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  beneficioText: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.ink },

  error: { color: colors.fcDeep, fontSize: 13, fontWeight: "700", marginTop: 14, textAlign: "center" },

  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.fc,
    marginTop: 20,
    shadowColor: colors.fc,
    shadowOpacity: 0.32,
    shadowRadius: 11,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  ctaText: { color: "#FFF", fontSize: 16, fontWeight: "800" },
  apagado: { opacity: 0.7 },
  revisarBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.fcSoft,
    marginTop: 12,
  },
  revisarText: { color: colors.fc, fontSize: 15, fontWeight: "800" },
  ctaSecundario: {
    height: 54,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  ctaSecundarioText: { color: colors.ink, fontSize: 15.5, fontWeight: "800" },

  legal: {
    fontSize: 11.5,
    fontWeight: "500",
    color: colors.faint,
    textAlign: "center",
    lineHeight: 17,
    marginTop: 18,
    paddingHorizontal: 10,
  },
});
