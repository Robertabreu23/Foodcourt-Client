import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CartBar } from "@/components/cart-bar";
import { StoreCover } from "@/components/store-cover";
import { getStoreMenu, imagenUri } from "@/lib/api";
import { colors } from "@/theme";
import type { MenuItem, StoreMenu } from "@/types";

/**
 * LA CARTA DE UN LOCAL (pantallas 03-05)
 *
 * Una sola llamada — GET /stores/:storeId/menu — trae la cabecera y todas las
 * secciones con sus platos. El color y la portada llegan por params desde
 * Inicio (ese endpoint no los devuelve); si entras por deep link se usan los
 * valores por defecto de la marca.
 */
export default function StoreMenuScreen() {
  const params = useLocalSearchParams<{
    id: string;
    colorMarca?: string;
    portadaUrl?: string;
  }>();
  const storeId = Number(params.id);
  const insets = useSafeAreaInsets();

  const [menu, setMenu] = useState<StoreMenu | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoriaActiva, setCategoriaActiva] = useState<number | null>(null);

  const listaRef = useRef<SectionList<MenuItem, { id: number; nombre: string }>>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const datos = await getStoreMenu(storeId);
      setMenu(datos);
      setCategoriaActiva(datos.categorias[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la carta.");
    } finally {
      setCargando(false);
    }
  }, [storeId]);

  useEffect(() => {
    if (Number.isFinite(storeId)) cargar();
    else setError("Local no válido.");
  }, [cargar, storeId]);

  const colorMarca = params.colorMarca ?? colors.fc;
  const portada = {
    nombre: menu?.nombre ?? "",
    colorMarca,
    portadaUrl: params.portadaUrl ?? null,
  };

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color={colors.fc} />
        <Text style={styles.cargandoText}>Cargando la carta…</Text>
      </View>
    );
  }

  if (error || !menu) {
    return (
      <View style={styles.centrado}>
        <Ionicons name="restaurant-outline" size={44} color={colors.faint} />
        <Text style={styles.errorTitulo}>No pudimos abrir este local</Text>
        <Text style={styles.errorMsg}>{error}</Text>
        <View style={styles.errorBotones}>
          <TouchableOpacity style={styles.btnSecundario} onPress={() => router.back()}>
            <Text style={styles.btnSecundarioText}>Volver</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnPrimario} onPress={cargar}>
            <Text style={styles.btnPrimarioText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Solo las secciones con platos; una sección vacía no aporta nada al cliente.
  const secciones = menu.categorias
    .filter((c) => c.items.length > 0)
    .map((c) => ({ id: c.id, nombre: c.nombre, data: c.items }));

  const irASeccion = (categoryId: number) => {
    setCategoriaActiva(categoryId);
    const indice = secciones.findIndex((s) => s.id === categoryId);
    if (indice < 0) return;
    listaRef.current?.scrollToLocation({
      sectionIndex: indice,
      itemIndex: 0,
      viewOffset: 56, // para que el título no quede debajo de los chips
      animated: true,
    });
  };

  const abierto = menu.estadoOperacion === "abierto";

  return (
    <View style={styles.pantalla}>
      <SectionList
        ref={listaRef}
        sections={secciones}
        keyExtractor={(item) => String(item.id)}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        // Si el salto falla (secciones aún no medidas) no pasa nada: se queda donde está.
        onScrollToIndexFailed={() => {}}
        ListHeaderComponent={
          <>
            <StoreCover store={portada} height={210}>
              <LinearGradient
                colors={["rgba(0,0,0,0.45)", "transparent", "rgba(0,0,0,0.55)"]}
                locations={[0, 0.45, 1]}
                style={StyleSheet.absoluteFill}
              />
              <TouchableOpacity
                style={[styles.backBtn, { top: insets.top + 8 }]}
                onPress={() => router.back()}
                hitSlop={8}
              >
                <Ionicons name="chevron-back" size={22} color={colors.ink} />
              </TouchableOpacity>
              <View style={styles.heroInfo}>
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: abierto ? "rgba(30,168,102,0.95)" : "rgba(36,27,25,0.8)" },
                  ]}
                >
                  <Text style={styles.badgeText}>{abierto ? "Abierto" : "Cerrado"}</Text>
                </View>
                <Text style={styles.heroNombre} numberOfLines={2}>
                  {menu.nombre}
                </Text>
                <Text style={styles.heroMeta}>
                  {menu.categoria ?? "Variado"} · Envío RD${menu.envioBase}
                </Text>
              </View>
            </StoreCover>

            {!abierto && (
              <View style={styles.avisoCerrado}>
                <Ionicons name="moon-outline" size={16} color={colors.fcDeep} />
                <Text style={styles.avisoCerradoText}>
                  Ahora mismo está cerrado. Puedes ver la carta, pero no recibirán tu pedido.
                </Text>
              </View>
            )}

            {secciones.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsRow}
              >
                {secciones.map((s) => {
                  const activa = s.id === categoriaActiva;
                  return (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.chip, activa && { backgroundColor: colorMarca, borderColor: colorMarca }]}
                      onPress={() => irASeccion(s.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.chipText, activa && styles.chipTextActivo]}>
                        {s.nombre}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </>
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.seccionHeader}>
            <Text style={styles.seccionTitulo}>{section.nombre}</Text>
            <Text style={styles.seccionCuenta}>{section.data.length}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <PlatoRow
            item={item}
            colorMarca={colorMarca}
            onPress={() =>
              router.push({
                pathname: "/item/[id]",
                params: {
                  id: String(item.id),
                  storeNombre: menu.nombre,
                  envioBase: String(menu.envioBase),
                  colorMarca,
                },
              })
            }
          />
        )}
        ListEmptyComponent={
          <View style={styles.vacio}>
            <Ionicons name="fast-food-outline" size={40} color={colors.faint} />
            <Text style={styles.vacioTitulo}>Este local aún no publicó su carta</Text>
            <Text style={styles.errorMsg}>Vuelve más tarde: están cocinando el menú.</Text>
          </View>
        }
      />

      <CartBar />
    </View>
  );
}

/* ---------- Fila de un plato ---------- */

function PlatoRow({
  item,
  colorMarca,
  onPress,
}: {
  item: MenuItem;
  colorMarca: string;
  onPress: () => void;
}) {
  const foto = imagenUri(item.imagenUrl);
  const agotado = !item.disponible;

  return (
    <TouchableOpacity
      style={[styles.plato, agotado && styles.platoAgotado]}
      onPress={onPress}
      // Los agotados se muestran (el usuario ve que existe) pero no se abren.
      disabled={agotado}
      activeOpacity={0.85}
    >
      <View style={{ flex: 1 }}>
        <View style={styles.platoTituloRow}>
          <Text style={styles.platoNombre} numberOfLines={1}>
            {item.nombre}
          </Text>
          {item.esVegetariano && (
            <View style={styles.vegBadge}>
              <Ionicons name="leaf" size={10} color={colors.leaf} />
              <Text style={styles.vegText}>Veg</Text>
            </View>
          )}
        </View>
        {item.descripcion ? (
          <Text style={styles.platoDesc} numberOfLines={2}>
            {item.descripcion}
          </Text>
        ) : null}
        <View style={styles.platoPrecioRow}>
          <Text style={[styles.platoPrecio, { color: colorMarca }]}>RD${item.precioBase}</Text>
          {agotado && <Text style={styles.agotadoText}>Agotado</Text>}
        </View>
      </View>

      <View style={styles.platoFotoWrap}>
        {foto ? (
          <Image source={{ uri: foto }} style={styles.platoFoto} resizeMode="cover" />
        ) : (
          <View style={[styles.platoFoto, styles.platoFotoVacia]}>
            <Ionicons name="fast-food-outline" size={22} color={colors.faint} />
          </View>
        )}
        {!agotado && (
          <View style={[styles.masBtn, { backgroundColor: colorMarca }]}>
            <Ionicons name="add" size={16} color="#FFF" />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

/* ---------- Estilos ---------- */

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
  errorBotones: { flexDirection: "row", gap: 10, marginTop: 8 },
  btnPrimario: {
    backgroundColor: colors.fc,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  btnPrimarioText: { color: "#FFF", fontWeight: "800", fontSize: 14 },
  btnSecundario: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  btnSecundarioText: { color: colors.ink, fontWeight: "700", fontSize: 14 },

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
  heroInfo: { position: "absolute", left: 18, right: 18, bottom: 16, gap: 6 },
  badge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { color: "#FFF", fontSize: 11, fontWeight: "700" },
  heroNombre: { color: "#FFF", fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  heroMeta: { color: "rgba(255,255,255,0.92)", fontSize: 13, fontWeight: "600" },

  avisoCerrado: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.fcSoft,
    marginHorizontal: 18,
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
  },
  avisoCerradoText: { flex: 1, color: colors.fcDeep, fontSize: 12.5, fontWeight: "600", lineHeight: 18 },

  chipsRow: { gap: 9, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 2 },
  chip: {
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.ink },
  chipTextActivo: { color: "#FFF", fontWeight: "700" },

  seccionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 8,
  },
  seccionTitulo: { fontSize: 19, fontWeight: "800", color: colors.ink, letterSpacing: -0.3 },
  seccionCuenta: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.muted,
    backgroundColor: colors.paper,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: "hidden",
  },

  plato: {
    flexDirection: "row",
    gap: 12,
    marginHorizontal: 18,
    marginBottom: 12,
    padding: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
  },
  platoAgotado: { opacity: 0.55 },
  platoTituloRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  platoNombre: { flexShrink: 1, fontSize: 15.5, fontWeight: "800", color: colors.ink },
  vegBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#E9F6EF",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  vegText: { fontSize: 10, fontWeight: "700", color: colors.leaf },
  platoDesc: { fontSize: 12.5, color: colors.muted, lineHeight: 18, marginTop: 4 },
  platoPrecioRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
  platoPrecio: { fontSize: 15, fontWeight: "800" },
  agotadoText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.muted,
    backgroundColor: colors.paper,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: "hidden",
  },

  platoFotoWrap: { width: 88, height: 88 },
  platoFoto: { width: 88, height: 88, borderRadius: 14, backgroundColor: colors.paper },
  platoFotoVacia: { alignItems: "center", justifyContent: "center" },
  masBtn: {
    position: "absolute",
    right: -6,
    bottom: -6,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.surface,
  },

  vacio: { alignItems: "center", gap: 8, paddingHorizontal: 32, paddingTop: 50 },
  vacioTitulo: { fontSize: 17, fontWeight: "800", color: colors.ink, textAlign: "center" },
});
