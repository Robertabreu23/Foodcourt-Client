import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { StoreCover } from "@/components/store-cover";
import { getStoreMenu, getStores } from "@/lib/api";
import { colors } from "@/theme";
import type { Store } from "@/types";

/**
 * BUSCAR
 *
 * El backend todavía no tiene `GET /stores?search=&categoria=`, así que el
 * filtrado se hace aquí sobre la lista completa de locales. Los platos se
 * buscan pidiendo las cartas una sola vez (la primera vez que se escribe) y
 * guardándolas en memoria.
 */

/** Un plato encontrado, junto al local al que pertenece. */
interface PlatoEncontrado {
  itemId: number;
  nombre: string;
  precioBase: number;
  disponible: boolean;
  store: Store;
}

export default function BuscarScreen() {
  const [texto, setTexto] = useState("");
  const [categoria, setCategoria] = useState<string | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [platos, setPlatos] = useState<PlatoEncontrado[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [cargandoPlatos, setCargandoPlatos] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargarStores = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setStores(await getStores());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo conectar con el servidor.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarStores();
  }, [cargarStores]);

  // Las cartas se piden una sola vez, cuando el usuario empieza a escribir.
  // El ref evita que cada tecla lance otra tanda mientras la primera va en camino
  // (`platos` todavía es null y el estado no se actualiza al instante).
  const pidiendoCartas = useRef(false);

  useEffect(() => {
    if (texto.trim().length < 2 || platos !== null || stores.length === 0) return;
    if (pidiendoCartas.current) return;
    pidiendoCartas.current = true;
    let cancelado = false;
    (async () => {
      setCargandoPlatos(true);
      const cartas = await Promise.all(
        stores.map(async (store) => {
          try {
            const menu = await getStoreMenu(store.id);
            return menu.categorias.flatMap((c) =>
              c.items.map((i) => ({
                itemId: i.id,
                nombre: i.nombre,
                precioBase: i.precioBase,
                disponible: i.disponible,
                store,
              })),
            );
          } catch {
            return []; // un local sin carta no rompe la búsqueda
          }
        }),
      );
      pidiendoCartas.current = false;
      if (cancelado) return;
      setPlatos(cartas.flat());
      setCargandoPlatos(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [texto, platos, stores]);

  /** Las categorías que existen de verdad en los locales cargados. */
  const categorias = useMemo(() => {
    const vistas = new Set<string>();
    for (const s of stores) if (s.categoria) vistas.add(s.categoria);
    return [...vistas].sort((a, b) => a.localeCompare(b, "es"));
  }, [stores]);

  const consulta = normalizar(texto.trim());

  const localesFiltrados = useMemo(() => {
    return stores.filter((s) => {
      if (categoria && s.categoria !== categoria) return false;
      if (!consulta) return true;
      return (
        normalizar(s.nombre).includes(consulta) || normalizar(s.categoria ?? "").includes(consulta)
      );
    });
  }, [stores, categoria, consulta]);

  const platosFiltrados = useMemo(() => {
    if (consulta.length < 2 || !platos) return [];
    return platos
      .filter((p) => {
        if (categoria && p.store.categoria !== categoria) return false;
        return normalizar(p.nombre).includes(consulta);
      })
      .slice(0, 20);
  }, [platos, consulta, categoria]);

  const abrirLocal = (store: Store) =>
    router.push({
      pathname: "/store/[id]",
      params: {
        id: String(store.id),
        colorMarca: store.colorMarca,
        ...(store.portadaUrl ? { portadaUrl: store.portadaUrl } : {}),
      },
    });

  const sinResultados =
    consulta.length > 0 && localesFiltrados.length === 0 && platosFiltrados.length === 0;

  return (
    <SafeAreaView style={styles.pantalla} edges={["top"]}>
      {/* ===== Buscador ===== */}
      <View style={styles.header}>
        <Text style={styles.titulo}>Buscar</Text>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.faint} />
          <TextInput
            style={styles.searchInput}
            value={texto}
            onChangeText={setTexto}
            placeholder="Busca locales o platos"
            placeholderTextColor={colors.faint}
            autoCorrect={false}
            returnKeyType="search"
          />
          {texto.length > 0 && (
            <TouchableOpacity onPress={() => setTexto("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.faint} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {categorias.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
          style={{ flexGrow: 0 }}
        >
          <TouchableOpacity
            style={[styles.chip, categoria === null && styles.chipActivo]}
            onPress={() => setCategoria(null)}
          >
            <Text style={[styles.chipText, categoria === null && styles.chipTextActivo]}>
              Todos
            </Text>
          </TouchableOpacity>
          {categorias.map((c) => {
            const activa = c === categoria;
            return (
              <TouchableOpacity
                key={c}
                style={[styles.chip, activa && styles.chipActivo]}
                onPress={() => setCategoria(activa ? null : c)}
              >
                <Text style={[styles.chipText, activa && styles.chipTextActivo]}>{c}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {cargando ? (
        <View style={styles.centrado}>
          <ActivityIndicator size="large" color={colors.fc} />
        </View>
      ) : error ? (
        <View style={styles.centrado}>
          <Ionicons name="cloud-offline-outline" size={44} color={colors.faint} />
          <Text style={styles.vacioSub}>{error}</Text>
          <TouchableOpacity style={styles.btnPrimario} onPress={cargarStores}>
            <Text style={styles.btnPrimarioText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={localesFiltrados}
          keyExtractor={(s) => String(s.id)}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 18, paddingTop: 8, paddingBottom: 24 }}
          ListHeaderComponent={
            platosFiltrados.length > 0 || cargandoPlatos ? (
              <View style={{ marginBottom: 18 }}>
                <View style={styles.seccionRow}>
                  <Text style={styles.seccionTitulo}>Platos</Text>
                  {cargandoPlatos && <ActivityIndicator size="small" color={colors.fc} />}
                </View>
                {platosFiltrados.map((p) => (
                  <TouchableOpacity
                    key={`${p.store.id}-${p.itemId}`}
                    style={styles.platoRow}
                    onPress={() =>
                      router.push({
                        pathname: "/item/[id]",
                        params: {
                          id: String(p.itemId),
                          storeNombre: p.store.nombre,
                          envioBase: String(p.store.envioBase),
                          colorMarca: p.store.colorMarca,
                        },
                      })
                    }
                    activeOpacity={0.8}
                  >
                    <View style={[styles.platoPunto, { backgroundColor: p.store.colorMarca }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.platoNombre} numberOfLines={1}>
                        {p.nombre}
                      </Text>
                      <Text style={styles.platoLocal} numberOfLines={1}>
                        {p.store.nombre}
                        {p.disponible ? "" : " · agotado"}
                      </Text>
                    </View>
                    <Text style={styles.platoPrecio}>RD${p.precioBase}</Text>
                  </TouchableOpacity>
                ))}
                {localesFiltrados.length > 0 && (
                  <Text style={[styles.seccionTitulo, { marginTop: 18 }]}>Locales</Text>
                )}
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.localRow}
              onPress={() => abrirLocal(item)}
              activeOpacity={0.8}
            >
              <StoreCover store={item} height={58} style={styles.localThumb} />
              <View style={{ flex: 1 }}>
                <Text style={styles.localNombre} numberOfLines={1}>
                  {item.nombre}
                </Text>
                <Text style={styles.localMeta} numberOfLines={1}>
                  {item.categoria ?? "Variado"} · Envío RD${item.envioBase}
                </Text>
              </View>
              <View
                style={[
                  styles.estadoPunto,
                  {
                    backgroundColor:
                      item.estadoOperacion === "abierto" ? colors.leaf : colors.faint,
                  },
                ]}
              />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            sinResultados ? (
              <View style={styles.vacio}>
                <Ionicons name="search-outline" size={42} color={colors.faint} />
                <Text style={styles.vacioTitulo}>Sin resultados para “{texto.trim()}”</Text>
                <Text style={styles.vacioSub}>Prueba con otra palabra o quita el filtro.</Text>
              </View>
            ) : (
              <View style={styles.vacio}>
                <Ionicons name="storefront-outline" size={42} color={colors.faint} />
                <Text style={styles.vacioSub}>No hay locales con ese filtro.</Text>
              </View>
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

/** Minúsculas y sin tildes, para que "cafe" encuentre "Café". */
function normalizar(texto: string): string {
  // El rango ̀-ͯ son los acentos que NFD separa de la letra.
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.bg },
  centrado: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 10 },

  header: { paddingHorizontal: 18, paddingTop: 6 },
  titulo: { fontSize: 26, fontWeight: "800", color: colors.ink, letterSpacing: -0.5 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 48,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginTop: 12,
  },
  searchInput: { flex: 1, fontSize: 14.5, fontWeight: "600", color: colors.ink, paddingVertical: 0 },

  chipsRow: { gap: 9, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 4 },
  chip: {
    paddingHorizontal: 14,
    height: 36,
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipActivo: { backgroundColor: colors.fc, borderColor: colors.fc },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.ink },
  chipTextActivo: { color: "#FFF", fontWeight: "700" },

  seccionRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  seccionTitulo: { fontSize: 17, fontWeight: "800", color: colors.ink, marginBottom: 10 },

  platoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  platoPunto: { width: 8, height: 8, borderRadius: 4 },
  platoNombre: { fontSize: 14.5, fontWeight: "700", color: colors.ink },
  platoLocal: { fontSize: 12, fontWeight: "500", color: colors.muted, marginTop: 2 },
  platoPrecio: { fontSize: 14, fontWeight: "800", color: colors.ink },

  localRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    padding: 12,
    marginBottom: 10,
  },
  localThumb: { width: 58, borderRadius: 14 },
  localNombre: { fontSize: 15.5, fontWeight: "800", color: colors.ink },
  localMeta: { fontSize: 12.5, fontWeight: "500", color: colors.muted, marginTop: 2 },
  estadoPunto: { width: 9, height: 9, borderRadius: 5 },

  vacio: { alignItems: "center", gap: 8, paddingTop: 50, paddingHorizontal: 24 },
  vacioTitulo: { fontSize: 17, fontWeight: "800", color: colors.ink, textAlign: "center" },
  vacioSub: { fontSize: 13.5, color: colors.muted, textAlign: "center", lineHeight: 20 },
  btnPrimario: {
    marginTop: 8,
    backgroundColor: colors.fc,
    paddingHorizontal: 26,
    paddingVertical: 12,
    borderRadius: 999,
  },
  btnPrimarioText: { color: "#FFF", fontWeight: "800", fontSize: 14 },
});
