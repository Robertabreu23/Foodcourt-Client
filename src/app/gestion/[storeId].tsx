import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ApiError,
  actualizarCategoria,
  actualizarPlato,
  borrarCategoria,
  borrarPlato,
  crearCategoria,
  getStoreMenu,
  imagenUri,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { colors } from "@/theme";
import type { MenuCategoryConItems, MenuItem, StoreMenu } from "@/types";

/**
 * GESTIÓN DE LA CARTA (panel del dueño)
 *
 * Secciones y platos del local. Todo lo que se escribe aquí necesita token y
 * ser el dueño: un 403 significa "este local no es tuyo" y un 401 que la
 * sesión venció.
 */
export default function GestionCartaScreen() {
  const { storeId: storeIdParam } = useLocalSearchParams<{ storeId: string }>();
  const storeId = Number(storeIdParam);
  const { token, cerrarSesion } = useAuth();
  const insets = useSafeAreaInsets();

  const [menu, setMenu] = useState<StoreMenu | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  // Modal de sección: null = cerrado; { categoria: null } = crear una nueva.
  const [editandoCategoria, setEditandoCategoria] = useState<{
    categoria: MenuCategoryConItems | null;
  } | null>(null);

  /** Traduce el error del API a algo que el dueño entienda. */
  const manejarError = useCallback(
    (e: unknown, porDefecto: string) => {
      if (e instanceof ApiError && e.status === 401) {
        Alert.alert("Sesión expirada", "Vuelve a iniciar sesión.");
        cerrarSesion();
        return;
      }
      if (e instanceof ApiError && e.status === 403) {
        Alert.alert("Sin permiso", "Este local no es tuyo.");
        return;
      }
      // El 409 del backend ya viene redactado para el usuario: se muestra tal cual.
      Alert.alert("No se pudo", e instanceof Error ? e.message : porDefecto);
    },
    [cerrarSesion],
  );

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setMenu(await getStoreMenu(storeId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la carta.");
    } finally {
      setCargando(false);
    }
  }, [storeId]);

  // Al volver del editor de un plato hay que refrescar para ver los cambios.
  useFocusEffect(
    useCallback(() => {
      if (Number.isFinite(storeId)) cargar();
      else {
        setError("Local no válido.");
        setCargando(false);
      }
    }, [cargar, storeId]),
  );

  if (!token) return null;

  /* ---------- acciones ---------- */

  const guardarCategoria = async (nombre: string, orden: number) => {
    const enEdicion = editandoCategoria?.categoria;
    setOcupado(true);
    try {
      if (enEdicion) {
        await actualizarCategoria(token, storeId, enEdicion.id, { nombre, orden });
      } else {
        await crearCategoria(token, storeId, { nombre, orden });
      }
      setEditandoCategoria(null);
      await cargar();
    } catch (e) {
      manejarError(e, "No se pudo guardar la sección.");
    } finally {
      setOcupado(false);
    }
  };

  const confirmarBorrarCategoria = (categoria: MenuCategoryConItems) => {
    Alert.alert(
      "Borrar sección",
      `¿Seguro que quieres borrar "${categoria.nombre}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Borrar",
          style: "destructive",
          onPress: async () => {
            setOcupado(true);
            try {
              await borrarCategoria(token, storeId, categoria.id);
              await cargar();
            } catch (e) {
              // 409 → "La categoría tiene N plato(s)…", ya listo para mostrar.
              manejarError(e, "No se pudo borrar la sección.");
            } finally {
              setOcupado(false);
            }
          },
        },
      ],
    );
  };

  const cambiarDisponible = async (item: MenuItem, disponible: boolean) => {
    // Optimista: el switch responde al toque y se revierte si el API falla.
    setMenu((previo) => actualizarItemEnMenu(previo, item.id, { disponible }));
    try {
      await actualizarPlato(token, item.id, { disponible });
    } catch (e) {
      setMenu((previo) => actualizarItemEnMenu(previo, item.id, { disponible: !disponible }));
      manejarError(e, "No se pudo cambiar la disponibilidad.");
    }
  };

  const confirmarBorrarPlato = (item: MenuItem) => {
    Alert.alert("Borrar plato", `¿Seguro que quieres borrar "${item.nombre}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Borrar",
        style: "destructive",
        onPress: async () => {
          setOcupado(true);
          try {
            await borrarPlato(token, item.id);
            await cargar();
          } catch (e) {
            // 409 = el plato ya salió en pedidos: se ofrece marcarlo agotado.
            if (e instanceof ApiError && e.status === 409) {
              Alert.alert("No se puede borrar", e.message, [
                { text: "Entendido", style: "cancel" },
                {
                  text: "Marcar agotado",
                  onPress: () => cambiarDisponible(item, false),
                },
              ]);
            } else {
              manejarError(e, "No se pudo borrar el plato.");
            }
          } finally {
            setOcupado(false);
          }
        },
      },
    ]);
  };

  const irAPlato = (categoryId: number, itemId?: number) =>
    router.push({
      pathname: "/gestion/plato",
      params: {
        storeId: String(storeId),
        categoryId: String(categoryId),
        ...(itemId ? { itemId: String(itemId) } : {}),
      },
    });

  /* ---------- render ---------- */

  return (
    <View style={styles.pantalla}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={colors.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.titulo}>Mi carta</Text>
          {menu ? (
            <Text style={styles.subtitulo} numberOfLines={1}>
              {menu.nombre}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.nuevaBtn}
          onPress={() => setEditandoCategoria({ categoria: null })}
          hitSlop={6}
        >
          <Ionicons name="add" size={17} color="#FFF" />
          <Text style={styles.nuevaText}>Sección</Text>
        </TouchableOpacity>
      </View>

      {cargando ? (
        <View style={styles.centrado}>
          <ActivityIndicator size="large" color={colors.fc} />
        </View>
      ) : error ? (
        <View style={styles.centrado}>
          <Text style={styles.errorMsg}>{error}</Text>
          <TouchableOpacity style={styles.btnPrimario} onPress={cargar}>
            <Text style={styles.btnPrimarioText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 32 }}
        >
          {menu && menu.categorias.length === 0 && (
            <View style={styles.vacio}>
              <Ionicons name="list-outline" size={42} color={colors.faint} />
              <Text style={styles.vacioTitulo}>Tu carta está vacía</Text>
              <Text style={styles.errorMsg}>
                Crea una sección (por ejemplo “Pizzas”) y después agrégale platos.
              </Text>
            </View>
          )}

          {menu?.categorias.map((categoria) => (
            <View key={categoria.id} style={styles.seccion}>
              <View style={styles.seccionHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.seccionNombre}>{categoria.nombre}</Text>
                  <Text style={styles.seccionMeta}>
                    Orden {categoria.orden} · {categoria.items.length} plato
                    {categoria.items.length === 1 ? "" : "s"}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => setEditandoCategoria({ categoria })}
                  hitSlop={6}
                >
                  <Ionicons name="pencil" size={15} color={colors.ink} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => confirmarBorrarCategoria(categoria)}
                  hitSlop={6}
                >
                  <Ionicons name="trash-outline" size={15} color={colors.fcDeep} />
                </TouchableOpacity>
              </View>

              {categoria.items.map((item) => (
                <PlatoAdminRow
                  key={item.id}
                  item={item}
                  onEditar={() => irAPlato(categoria.id, item.id)}
                  onBorrar={() => confirmarBorrarPlato(item)}
                  onDisponible={(valor) => cambiarDisponible(item, valor)}
                />
              ))}

              <TouchableOpacity
                style={styles.agregarPlatoBtn}
                onPress={() => irAPlato(categoria.id)}
                activeOpacity={0.8}
              >
                <Ionicons name="add-circle-outline" size={17} color={colors.fc} />
                <Text style={styles.agregarPlatoText}>Agregar plato a {categoria.nombre}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      {editandoCategoria && (
        <ModalCategoria
          categoria={editandoCategoria.categoria}
          guardando={ocupado}
          onCancelar={() => setEditandoCategoria(null)}
          onGuardar={guardarCategoria}
        />
      )}
    </View>
  );
}

/** Cambia un plato dentro del menú ya cargado, sin volver a pedirlo al API. */
function actualizarItemEnMenu(
  menu: StoreMenu | null,
  itemId: number,
  cambios: Partial<MenuItem>,
): StoreMenu | null {
  if (!menu) return menu;
  return {
    ...menu,
    categorias: menu.categorias.map((c) => ({
      ...c,
      items: c.items.map((i) => (i.id === itemId ? { ...i, ...cambios } : i)),
    })),
  };
}

/* ---------- fila de plato en el panel ---------- */

function PlatoAdminRow({
  item,
  onEditar,
  onBorrar,
  onDisponible,
}: {
  item: MenuItem;
  onEditar: () => void;
  onBorrar: () => void;
  onDisponible: (valor: boolean) => void;
}) {
  const foto = imagenUri(item.imagenUrl);
  return (
    <View style={styles.platoRow}>
      <TouchableOpacity style={styles.platoInfo} onPress={onEditar} activeOpacity={0.75}>
        {foto ? (
          <Image source={{ uri: foto }} style={styles.platoFoto} resizeMode="cover" />
        ) : (
          <View style={[styles.platoFoto, styles.platoFotoVacia]}>
            <Ionicons name="fast-food-outline" size={18} color={colors.faint} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.platoNombre} numberOfLines={1}>
            {item.nombre}
          </Text>
          <Text style={styles.platoPrecio}>
            RD${item.precioBase}
            {item.esVegetariano ? " · Vegetariano" : ""}
          </Text>
        </View>
      </TouchableOpacity>

      <View style={styles.platoAcciones}>
        <Switch
          value={item.disponible}
          onValueChange={onDisponible}
          trackColor={{ false: colors.line, true: "#BDE9D2" }}
          thumbColor={item.disponible ? colors.leaf : "#F4F0EC"}
        />
        <TouchableOpacity style={styles.iconBtn} onPress={onBorrar} hitSlop={6}>
          <Ionicons name="trash-outline" size={15} color={colors.fcDeep} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ---------- modal de sección ---------- */

function ModalCategoria({
  categoria,
  guardando,
  onCancelar,
  onGuardar,
}: {
  categoria: MenuCategoryConItems | null;
  guardando: boolean;
  onCancelar: () => void;
  onGuardar: (nombre: string, orden: number) => void;
}) {
  const [nombre, setNombre] = useState(categoria?.nombre ?? "");
  const [orden, setOrden] = useState(String(categoria?.orden ?? 0));
  const [error, setError] = useState<string | null>(null);

  const guardar = () => {
    if (!nombre.trim()) {
      setError("Ponle un nombre a la sección.");
      return;
    }
    const ordenNum = Number(orden);
    if (!Number.isFinite(ordenNum)) {
      setError("El orden tiene que ser un número.");
      return;
    }
    setError(null);
    onGuardar(nombre.trim(), ordenNum);
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={onCancelar}>
      <View style={styles.modalFondo}>
        <View style={styles.modalCaja}>
          <Text style={styles.modalTitulo}>
            {categoria ? "Editar sección" : "Nueva sección"}
          </Text>

          <Text style={styles.label}>Nombre</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={nombre}
              onChangeText={setNombre}
              placeholder="Ej: Postres"
              placeholderTextColor={colors.faint}
              autoFocus
            />
          </View>

          <Text style={styles.label}>Orden</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={orden}
              onChangeText={setOrden}
              placeholder="0"
              placeholderTextColor={colors.faint}
              keyboardType="number-pad"
            />
          </View>
          <Text style={styles.ayuda}>Menor número, más arriba en la carta.</Text>

          {error && <Text style={styles.formError}>{error}</Text>}

          <View style={styles.modalBotones}>
            <TouchableOpacity style={styles.btnSecundario} onPress={onCancelar}>
              <Text style={styles.btnSecundarioText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnPrimario, guardando && styles.apagado]}
              onPress={guardar}
              disabled={guardando}
            >
              {guardando ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.btnPrimarioText}>Guardar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ---------- estilos ---------- */

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.bg },
  centrado: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  errorMsg: { color: colors.muted, fontSize: 13.5, textAlign: "center", lineHeight: 20 },

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
  nuevaBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.fc,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 999,
  },
  nuevaText: { color: "#FFF", fontSize: 12.5, fontWeight: "800" },

  vacio: { alignItems: "center", gap: 8, paddingVertical: 40, paddingHorizontal: 20 },
  vacioTitulo: { fontSize: 17, fontWeight: "800", color: colors.ink },

  seccion: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
  },
  seccionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  seccionNombre: { fontSize: 17, fontWeight: "800", color: colors.ink, letterSpacing: -0.2 },
  seccionMeta: { fontSize: 12, fontWeight: "600", color: colors.muted, marginTop: 2 },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
  },

  platoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 12,
    marginTop: 12,
  },
  platoInfo: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  platoFoto: { width: 46, height: 46, borderRadius: 12, backgroundColor: colors.paper },
  platoFotoVacia: { alignItems: "center", justifyContent: "center" },
  platoNombre: { fontSize: 14.5, fontWeight: "700", color: colors.ink },
  platoPrecio: { fontSize: 12.5, fontWeight: "600", color: colors.muted, marginTop: 2 },
  platoAcciones: { flexDirection: "row", alignItems: "center", gap: 6 },

  agregarPlatoBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: 12,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.fcSoft,
    backgroundColor: colors.paper,
  },
  agregarPlatoText: { color: colors.fc, fontSize: 13, fontWeight: "700" },

  modalFondo: {
    flex: 1,
    backgroundColor: "rgba(36,27,25,0.45)",
    justifyContent: "center",
    padding: 24,
  },
  modalCaja: { backgroundColor: colors.surface, borderRadius: 22, padding: 20 },
  modalTitulo: { fontSize: 19, fontWeight: "800", color: colors.ink, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "700", color: colors.ink, marginBottom: 6 },
  inputRow: {
    height: 50,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    justifyContent: "center",
    marginBottom: 12,
  },
  input: { fontSize: 15, fontWeight: "600", color: colors.ink, paddingVertical: 0 },
  ayuda: { fontSize: 12, fontWeight: "500", color: colors.muted, marginTop: -6, marginBottom: 8 },
  formError: { color: colors.fcDeep, fontSize: 13, fontWeight: "700", marginBottom: 8 },
  modalBotones: { flexDirection: "row", gap: 10, marginTop: 6 },
  btnPrimario: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.fc,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimarioText: { color: "#FFF", fontWeight: "800", fontSize: 15 },
  btnSecundario: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  btnSecundarioText: { color: colors.ink, fontWeight: "700", fontSize: 15 },
  apagado: { opacity: 0.7 },
});
