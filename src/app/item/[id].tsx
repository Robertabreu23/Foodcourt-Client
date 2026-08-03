import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getMenuItem, getStoreMenu, imagenUri } from "@/lib/api";
import { precioUnitarioDe, useCart } from "@/lib/cart-context";
import { colors } from "@/theme";
import type { MenuItemDetail, MenuOption, OptionGroup } from "@/types";

/** Opciones marcadas por grupo: { [groupId]: [optionId, ...] } */
type Seleccion = Record<number, number[]>;

/**
 * DETALLE DEL PLATO (pantalla 06)
 *
 * Pinta los grupos de opciones según las reglas del backend
 * (maxSel === 1 → radios; maxSel > 1 → checkboxes con tope) y valida
 * minSel/esRequerido antes de dejar agregar al carrito.
 */
export default function MenuItemScreen() {
  const params = useLocalSearchParams<{
    id: string;
    storeNombre?: string;
    envioBase?: string;
    colorMarca?: string;
  }>();
  const itemId = Number(params.id);
  const insets = useSafeAreaInsets();
  const { agregar } = useCart();

  const [item, setItem] = useState<MenuItemDetail | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seleccion, setSeleccion] = useState<Seleccion>({});
  const [cantidad, setCantidad] = useState(1);
  const [intentoAgregar, setIntentoAgregar] = useState(false);
  // Datos del local: llegan por params desde la carta, o se buscan si entras directo.
  const [local, setLocal] = useState<{ nombre: string; envioBase: number } | null>(
    params.storeNombre && params.envioBase
      ? { nombre: params.storeNombre, envioBase: Number(params.envioBase) }
      : null,
  );

  const colorMarca = params.colorMarca ?? colors.fc;

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const detalle = await getMenuItem(itemId);
      setItem(detalle);
      // Los grupos requeridos de una sola opción vienen premarcados: es lo que
      // el usuario elegiría de todas formas y evita un bloqueo tonto del botón.
      setSeleccion(
        Object.fromEntries(
          detalle.grupos.map((g) => [
            g.id,
            g.esRequerido && g.maxSel === 1 && g.opciones[0] ? [g.opciones[0].id] : [],
          ]),
        ),
      );
      return detalle;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el plato.");
      return null;
    } finally {
      setCargando(false);
    }
  }, [itemId]);

  useEffect(() => {
    if (!Number.isFinite(itemId)) {
      setError("Plato no válido.");
      setCargando(false);
      return;
    }
    (async () => {
      const detalle = await cargar();
      // Sin params (deep link) hace falta el nombre y el envío del local.
      if (detalle && !local) {
        try {
          const menu = await getStoreMenu(detalle.storeId);
          setLocal({ nombre: menu.nombre, envioBase: menu.envioBase });
        } catch {
          // Si falla nos quedamos sin envío: el carrito lo mostrará en 0.
          setLocal({ nombre: "", envioBase: 0 });
        }
      }
    })();
    // `local` a propósito fuera: solo se busca la primera vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargar, itemId]);

  /* ---------- selección ---------- */

  const alternar = (grupo: OptionGroup, opcionId: number) => {
    setSeleccion((previa) => {
      const marcadas = previa[grupo.id] ?? [];
      // maxSel === 1 → radio: siempre reemplaza
      if (grupo.maxSel === 1) {
        // En los grupos opcionales se puede desmarcar volviendo a tocar.
        const mismo = marcadas[0] === opcionId;
        return { ...previa, [grupo.id]: mismo && !grupo.esRequerido ? [] : [opcionId] };
      }
      // maxSel > 1 → checkbox con tope
      if (marcadas.includes(opcionId)) {
        return { ...previa, [grupo.id]: marcadas.filter((id) => id !== opcionId) };
      }
      if (marcadas.length >= grupo.maxSel) return previa; // tope alcanzado
      return { ...previa, [grupo.id]: [...marcadas, opcionId] };
    });
  };

  /** Los grupos a los que todavía les falta cumplir su minSel. */
  const gruposIncompletos = useMemo(() => {
    if (!item) return [];
    return item.grupos.filter((g) => {
      const minimo = g.esRequerido ? Math.max(g.minSel, 1) : g.minSel;
      return (seleccion[g.id] ?? []).length < minimo;
    });
  }, [item, seleccion]);

  /** Las opciones marcadas, en objetos (para el precio y para el carrito). */
  const opcionesElegidas: MenuOption[] = useMemo(() => {
    if (!item) return [];
    return item.grupos.flatMap((g) =>
      g.opciones.filter((o) => (seleccion[g.id] ?? []).includes(o.id)),
    );
  }, [item, seleccion]);

  const precioUnitario = item ? precioUnitarioDe(item.precioBase, opcionesElegidas) : 0;
  const precioFinal = precioUnitario * cantidad;

  /* ---------- agregar al carrito ---------- */

  const alAgregar = () => {
    if (!item) return;
    setIntentoAgregar(true);
    if (gruposIncompletos.length > 0) return;

    const nuevoLocal = {
      storeId: item.storeId,
      storeNombre: local?.nombre || "este local",
      envioBase: local?.envioBase ?? 0,
    };
    const linea = {
      itemId: item.id,
      cantidad,
      opcionesElegidas,
      nombre: item.nombre,
      imagenUrl: item.imagenUrl,
      precioBase: item.precioBase,
    };

    const resultado = agregar(nuevoLocal, linea);
    if (resultado.ok) {
      router.back();
      return;
    }
    // El carrito ya tiene platos de otro local: un pedido = un comercio.
    Alert.alert(
      "Tienes un carrito de otro local",
      `Tu carrito tiene platos de ${resultado.localActual}. ¿Lo vaciamos para empezar uno de ${nuevoLocal.storeNombre}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Vaciar y agregar",
          style: "destructive",
          onPress: () => {
            agregar(nuevoLocal, linea, { reemplazar: true });
            router.back();
          },
        },
      ],
    );
  };

  /* ---------- estados de carga ---------- */

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color={colors.fc} />
      </View>
    );
  }

  if (error || !item) {
    return (
      <View style={styles.centrado}>
        <Ionicons name="fast-food-outline" size={44} color={colors.faint} />
        <Text style={styles.errorTitulo}>No pudimos abrir este plato</Text>
        <Text style={styles.errorMsg}>{error}</Text>
        <TouchableOpacity style={styles.btnPrimario} onPress={() => router.back()}>
          <Text style={styles.btnPrimarioText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const foto = imagenUri(item.imagenUrl);
  const faltaAlgo = gruposIncompletos.length > 0;

  return (
    <View style={styles.pantalla}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 130 }}
      >
        {/* ===== Foto ===== */}
        <View style={styles.fotoWrap}>
          {foto ? (
            <Image source={{ uri: foto }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <LinearGradient
              colors={[colorMarca, colors.ink]}
              start={{ x: 0.3, y: 0 }}
              end={{ x: 0.8, y: 1 }}
              style={[StyleSheet.absoluteFill, styles.centrarContenido]}
            >
              <Ionicons name="fast-food-outline" size={64} color="rgba(255,255,255,0.35)" />
            </LinearGradient>
          )}
          <TouchableOpacity
            style={[styles.backBtn, { top: insets.top + 8 }]}
            onPress={() => router.back()}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </TouchableOpacity>
        </View>

        {/* ===== Cabecera del plato ===== */}
        <View style={styles.cabecera}>
          <View style={styles.tituloRow}>
            <Text style={styles.nombre}>{item.nombre}</Text>
            {item.esVegetariano && (
              <View style={styles.vegBadge}>
                <Ionicons name="leaf" size={11} color={colors.leaf} />
                <Text style={styles.vegText}>Vegetariano</Text>
              </View>
            )}
          </View>
          {item.descripcion ? <Text style={styles.descripcion}>{item.descripcion}</Text> : null}
          <Text style={[styles.precioBase, { color: colorMarca }]}>RD${item.precioBase}</Text>

          {!item.disponible && (
            <View style={styles.avisoAgotado}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.fcDeep} />
              <Text style={styles.avisoAgotadoText}>
                Este plato está agotado ahora mismo. No se puede agregar al carrito.
              </Text>
            </View>
          )}
        </View>

        {/* ===== Grupos de opciones ===== */}
        {item.grupos.map((grupo) => {
          const marcadas = seleccion[grupo.id] ?? [];
          const minimo = grupo.esRequerido ? Math.max(grupo.minSel, 1) : grupo.minSel;
          const incompleto = marcadas.length < minimo;
          const topeAlcanzado = grupo.maxSel > 1 && marcadas.length >= grupo.maxSel;

          return (
            <View key={grupo.id} style={styles.grupo}>
              <View style={styles.grupoHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.grupoNombre}>{grupo.nombre}</Text>
                  <Text style={styles.grupoRegla}>{textoRegla(grupo)}</Text>
                </View>
                {grupo.esRequerido ? (
                  <View
                    style={[
                      styles.pill,
                      intentoAgregar && incompleto ? styles.pillError : styles.pillNeutro,
                    ]}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        intentoAgregar && incompleto ? styles.pillTextError : styles.pillTextNeutro,
                      ]}
                    >
                      Obligatorio
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.pill, styles.pillNeutro]}>
                    <Text style={[styles.pillText, styles.pillTextNeutro]}>Opcional</Text>
                  </View>
                )}
              </View>

              {grupo.opciones.map((opcion) => {
                const marcada = marcadas.includes(opcion.id);
                // Al llegar al tope se apagan las que no están marcadas.
                const bloqueada = topeAlcanzado && !marcada;
                return (
                  <TouchableOpacity
                    key={opcion.id}
                    style={[styles.opcion, bloqueada && styles.opcionBloqueada]}
                    onPress={() => alternar(grupo, opcion.id)}
                    disabled={bloqueada}
                    activeOpacity={0.75}
                  >
                    <Marca
                      tipo={grupo.maxSel === 1 ? "radio" : "check"}
                      marcada={marcada}
                      color={colorMarca}
                    />
                    <Text style={styles.opcionNombre}>{opcion.nombre}</Text>
                    {opcion.precioDelta !== 0 && (
                      <Text
                        style={[
                          styles.opcionDelta,
                          { color: opcion.precioDelta > 0 ? colors.ink : colors.leaf },
                        ]}
                      >
                        {opcion.precioDelta > 0 ? "+" : "−"}RD${Math.abs(opcion.precioDelta)}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}

        {/* ===== Cantidad ===== */}
        <View style={styles.cantidadRow}>
          <Text style={styles.cantidadLabel}>Cantidad</Text>
          <View style={styles.stepper}>
            <TouchableOpacity
              style={styles.stepperBtn}
              onPress={() => setCantidad((c) => Math.max(1, c - 1))}
              disabled={cantidad <= 1}
              hitSlop={6}
            >
              <Ionicons
                name="remove"
                size={18}
                color={cantidad <= 1 ? colors.faint : colors.ink}
              />
            </TouchableOpacity>
            <Text style={styles.stepperValor}>{cantidad}</Text>
            <TouchableOpacity
              style={styles.stepperBtn}
              onPress={() => setCantidad((c) => c + 1)}
              hitSlop={6}
            >
              <Ionicons name="add" size={18} color={colors.ink} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* ===== Botón agregar ===== */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {intentoAgregar && faltaAlgo && (
          <Text style={styles.footerError}>
            Falta elegir: {gruposIncompletos.map((g) => g.nombre).join(", ")}.
          </Text>
        )}
        <TouchableOpacity
          style={[
            styles.agregarBtn,
            { backgroundColor: colorMarca },
            (!item.disponible || faltaAlgo) && styles.agregarBtnApagado,
          ]}
          onPress={alAgregar}
          disabled={!item.disponible}
          activeOpacity={0.9}
        >
          <Text style={styles.agregarText}>
            {item.disponible ? "Agregar al carrito" : "No disponible"}
          </Text>
          {item.disponible && <Text style={styles.agregarPrecio}>RD${precioFinal}</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ---------- piezas ---------- */

/** El círculo (radio) o el cuadrito (checkbox) de una opción. */
function Marca({
  tipo,
  marcada,
  color,
}: {
  tipo: "radio" | "check";
  marcada: boolean;
  color: string;
}) {
  const forma = tipo === "radio" ? styles.radio : styles.check;
  return (
    <View style={[forma, marcada && { borderColor: color, backgroundColor: color }]}>
      {marcada &&
        (tipo === "radio" ? (
          <View style={styles.radioPunto} />
        ) : (
          <Ionicons name="checkmark" size={13} color="#FFF" />
        ))}
    </View>
  );
}

/** Explica la regla del grupo en español, sin jerga de API. */
function textoRegla(g: OptionGroup): string {
  if (g.maxSel === 1) return g.esRequerido ? "Elige 1 opción" : "Elige 1 opción (opcional)";
  if (g.minSel > 0) return `Elige entre ${g.minSel} y ${g.maxSel} opciones`;
  return `Elige hasta ${g.maxSel} opciones`;
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
  centrarContenido: { alignItems: "center", justifyContent: "center" },
  errorTitulo: { color: colors.ink, fontSize: 18, fontWeight: "800", textAlign: "center" },
  errorMsg: { color: colors.muted, fontSize: 13.5, textAlign: "center", lineHeight: 20 },
  btnPrimario: {
    marginTop: 8,
    backgroundColor: colors.fc,
    paddingHorizontal: 26,
    paddingVertical: 12,
    borderRadius: 999,
  },
  btnPrimarioText: { color: "#FFF", fontWeight: "800", fontSize: 14 },

  fotoWrap: { height: 260, backgroundColor: colors.paper, overflow: "hidden" },
  backBtn: {
    position: "absolute",
    left: 16,
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.94)",
    alignItems: "center",
    justifyContent: "center",
  },

  cabecera: {
    backgroundColor: colors.surface,
    marginTop: -20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 18,
  },
  tituloRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  nombre: { fontSize: 23, fontWeight: "800", color: colors.ink, letterSpacing: -0.4 },
  vegBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#E9F6EF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
  },
  vegText: { fontSize: 11, fontWeight: "700", color: colors.leaf },
  descripcion: { fontSize: 14, color: colors.muted, lineHeight: 21, marginTop: 8 },
  precioBase: { fontSize: 20, fontWeight: "800", marginTop: 12 },
  avisoAgotado: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.fcSoft,
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
  },
  avisoAgotadoText: { flex: 1, color: colors.fcDeep, fontSize: 12.5, fontWeight: "600", lineHeight: 18 },

  grupo: {
    backgroundColor: colors.surface,
    marginTop: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  grupoHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  grupoNombre: { fontSize: 16.5, fontWeight: "800", color: colors.ink, letterSpacing: -0.2 },
  grupoRegla: { fontSize: 12.5, fontWeight: "600", color: colors.muted, marginTop: 2 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  pillNeutro: { backgroundColor: colors.paper },
  pillError: { backgroundColor: colors.fcSoft },
  pillText: { fontSize: 11, fontWeight: "700" },
  pillTextNeutro: { color: colors.muted },
  pillTextError: { color: colors.fcDeep },

  opcion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  opcionBloqueada: { opacity: 0.4 },
  opcionNombre: { flex: 1, fontSize: 14.5, fontWeight: "600", color: colors.ink },
  opcionDelta: { fontSize: 14, fontWeight: "700" },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  radioPunto: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#FFF" },
  check: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },

  cantidadRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    marginTop: 12,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  cantidadLabel: { fontSize: 16.5, fontWeight: "800", color: colors.ink },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.paper,
    borderRadius: 999,
    padding: 5,
  },
  stepperBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperValor: {
    minWidth: 28,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "800",
    color: colors.ink,
  },

  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingTop: 12,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  footerError: { color: colors.fcDeep, fontSize: 12.5, fontWeight: "700", marginBottom: 8 },
  agregarBtn: {
    height: 56,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  agregarBtnApagado: { opacity: 0.5 },
  agregarText: { color: "#FFF", fontSize: 16, fontWeight: "800" },
  agregarPrecio: { color: "#FFF", fontSize: 16, fontWeight: "800" },
});
