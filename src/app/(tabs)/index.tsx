import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DeliveryIllustration } from "@/components/delivery-illustration";
import { StoreCover } from "@/components/store-cover";
import { getStores } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { colors } from "@/theme";
import type { Store } from "@/types";

const CATEGORIAS = [
  { nombre: "Pizza", color: colors.fc },
  { nombre: "Sushi", color: "#FF6F91" },
  { nombre: "Criollo", color: "#1FA45F" },
  { nombre: "Café", color: "#C0392B" },
  { nombre: "Postres", color: "#F6B11F" },
];

export default function HomeScreen() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    setError(null);
    try {
      setStores(await getStores());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo conectar con el servidor");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Header />
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.fc} />
          <Text style={styles.loadingText}>Buscando locales cerca de ti…</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={44} color={colors.faint} />
          <Text style={styles.errorTitle}>Algo salió mal</Text>
          <Text style={styles.errorMsg}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => cargar()}>
            <Text style={styles.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={stores}
          keyExtractor={(s) => String(s.id)}
          renderItem={({ item }) => <StoreCard store={item} />}
          ListHeaderComponent={<ListaHeader />}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Todavía no hay locales aprobados por aquí.</Text>
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={colors.fc}
              onRefresh={() => {
                setRefreshing(true);
                cargar(true);
              }}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

/* ---------- Header: ubicación + búsqueda ---------- */

function Header() {
  const { user } = useAuth();
  const inicial = user?.nombre?.trim()?.[0]?.toUpperCase() ?? "F";
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.entregarEn}>ENTREGAR EN</Text>
          <View style={styles.ubicacionRow}>
            <Ionicons name="location-sharp" size={16} color={colors.fc} />
            <Text style={styles.ubicacion}>Piantini, SD</Text>
            <Ionicons name="chevron-down" size={16} color={colors.ink} />
          </View>
        </View>
        <View style={styles.headerIcons}>
          <View style={styles.iconBtn}>
            <Ionicons name="notifications-outline" size={19} color={colors.ink} />
            <View style={styles.dot} />
          </View>
          <LinearGradient
            colors={[colors.mango, "#FF7A45"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatar}
          >
            <Text style={styles.avatarText}>{inicial}</Text>
          </LinearGradient>
        </View>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.faint} />
          <Text style={styles.searchPlaceholder}>Busca comida, locales o platos</Text>
        </View>
        <View style={styles.filterBtn}>
          <Ionicons name="options-outline" size={20} color={colors.fc} />
        </View>
      </View>
    </View>
  );
}

/* ---------- Chips + banner + título de sección ---------- */

function ListaHeader() {
  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
        {CATEGORIAS.map((c, i) => (
          <View key={c.nombre} style={[styles.chip, i === 0 && styles.chipActive]}>
            <View style={[styles.chipDot, { backgroundColor: i === 0 ? "#FFF" : c.color }]} />
            <Text style={[styles.chipText, i === 0 && styles.chipTextActive]}>{c.nombre}</Text>
          </View>
        ))}
      </ScrollView>

      <LinearGradient
        colors={[colors.fc, "#FF8347"]}
        start={{ x: 0, y: 0.4 }}
        end={{ x: 1, y: 0.6 }}
        style={styles.banner}
      >
        <View style={styles.bannerCirculo} />
        <View style={styles.bannerIlustracion}>
          <DeliveryIllustration width={150} height={144} />
        </View>
        <View style={{ paddingRight: 128 }}>
          <Text style={styles.bannerKicker}>PRIMER PEDIDO</Text>
          <Text style={styles.bannerTitle}>Envío gratis</Text>
          <Text style={styles.bannerSub}>Usa el código BIENVENIDO</Text>
          <View style={styles.bannerBtn}>
            <Text style={styles.bannerBtnText}>Reclamar</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Cerca de ti</Text>
        <Text style={styles.sectionLink}>Ver todos</Text>
      </View>
    </View>
  );
}

/* ---------- Tarjeta de local ---------- */

function StoreCard({ store }: { store: Store }) {
  const abierto = store.estadoOperacion === "abierto";
  const tiempo =
    store.tiempoEstimadoMin != null && store.tiempoEstimadoMax != null
      ? `${store.tiempoEstimadoMin}-${store.tiempoEstimadoMax} min`
      : "Tiempo por confirmar";

  return (
    <TouchableOpacity activeOpacity={0.85} style={styles.card}>
      <StoreCover store={store}>
        {/* pill con nombre + color de marca */}
        <View style={styles.coverNamePill}>
          <View style={[styles.chipDot, { backgroundColor: store.colorMarca }]} />
          <Text style={[styles.coverNameText, { color: store.colorMarca }]} numberOfLines={1}>
            {store.nombre}
          </Text>
        </View>
        <View style={styles.heartBtn}>
          <Ionicons name="heart-outline" size={16} color={store.colorMarca} />
        </View>
        <View style={styles.coverBadges}>
          <View style={[styles.badge, { backgroundColor: abierto ? "rgba(30,168,102,0.95)" : "rgba(36,27,25,0.75)" }]}>
            <Text style={styles.badgeText}>{abierto ? "Abierto" : "Cerrado"}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: "rgba(0,0,0,0.55)" }]}>
            <Text style={styles.badgeText}>Envío RD${store.envioBase}</Text>
          </View>
        </View>
      </StoreCover>

      <View style={styles.cardBody}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {store.nombre}
          </Text>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={14} color={colors.mango} />
            <Text style={styles.ratingText}>{store.ratingPromedio.toFixed(1)}</Text>
          </View>
        </View>
        <Text style={styles.cardCategoria}>{store.categoria ?? "Variado"}</Text>
        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={13} color={colors.muted} />
          <Text style={styles.metaText}>{tiempo}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

/* ---------- Estilos ---------- */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 10 },
  loadingText: { color: colors.muted, fontSize: 14, fontWeight: "600" },
  errorTitle: { color: colors.ink, fontSize: 18, fontWeight: "800" },
  errorMsg: { color: colors.muted, fontSize: 13.5, textAlign: "center", lineHeight: 20 },
  retryBtn: {
    marginTop: 8,
    backgroundColor: colors.fc,
    paddingHorizontal: 26,
    paddingVertical: 12,
    borderRadius: 999,
  },
  retryText: { color: "#FFF", fontWeight: "800", fontSize: 14 },
  emptyText: { textAlign: "center", color: colors.muted, marginTop: 40, fontSize: 14 },

  header: { paddingHorizontal: 18, paddingTop: 8 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  entregarEn: { fontSize: 11, fontWeight: "600", color: colors.muted, letterSpacing: 0.6 },
  ubicacionRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  ubicacion: { fontSize: 17, fontWeight: "800", color: colors.ink, letterSpacing: -0.2 },
  headerIcons: { flexDirection: "row", gap: 10, alignItems: "center" },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    position: "absolute",
    top: 7,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.fc,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  avatar: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#FFF", fontWeight: "800", fontSize: 15 },

  searchRow: { flexDirection: "row", gap: 10, alignItems: "center", marginTop: 12 },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 48,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  searchPlaceholder: { color: colors.faint, fontSize: 14, fontWeight: "500" },
  filterBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.fcSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  chipsRow: { gap: 9, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 6 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipActive: { backgroundColor: colors.fc, borderColor: colors.fc },
  chipDot: { width: 7, height: 7, borderRadius: 4 },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.ink },
  chipTextActive: { color: "#FFF", fontWeight: "700" },

  banner: {
    marginHorizontal: 18,
    marginTop: 10,
    borderRadius: 20,
    padding: 20,
    overflow: "hidden",
  },
  bannerCirculo: {
    position: "absolute",
    right: -26,
    top: -26,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  bannerIlustracion: {
    position: "absolute",
    right: 4,
    bottom: -6,
  },
  bannerKicker: { color: "rgba(255,255,255,0.92)", fontSize: 12, fontWeight: "600", letterSpacing: 1 },
  bannerTitle: { color: "#FFF", fontSize: 24, fontWeight: "800", letterSpacing: -0.4, marginTop: 4 },
  bannerSub: { color: "rgba(255,255,255,0.92)", fontSize: 13, fontWeight: "600", marginTop: 2 },
  bannerBtn: {
    alignSelf: "flex-start",
    marginTop: 12,
    backgroundColor: "#FFF",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  bannerBtnText: { color: colors.fc, fontWeight: "800", fontSize: 13 },

  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 10,
  },
  sectionTitle: { fontSize: 19, fontWeight: "800", color: colors.ink, letterSpacing: -0.3 },
  sectionLink: { fontSize: 13, fontWeight: "700", color: colors.fc },

  listContent: { paddingBottom: 24 },
  card: {
    marginHorizontal: 18,
    marginBottom: 16,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden",
    shadowColor: "#28140A",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  coverNamePill: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.95)",
    maxWidth: "70%",
  },
  coverNameText: { fontSize: 11, fontWeight: "800" },
  heartBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
  },
  coverBadges: { position: "absolute", bottom: 12, left: 12, flexDirection: "row", gap: 7 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  badgeText: { color: "#FFF", fontSize: 11, fontWeight: "700" },

  cardBody: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 },
  cardTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { flex: 1, fontSize: 18, fontWeight: "800", color: colors.ink, letterSpacing: -0.3 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  ratingText: { fontSize: 13, fontWeight: "700", color: colors.ink },
  cardCategoria: { fontSize: 13, fontWeight: "500", color: colors.muted, marginTop: 3 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 9 },
  metaText: { fontSize: 12.5, fontWeight: "600", color: colors.muted },
});
