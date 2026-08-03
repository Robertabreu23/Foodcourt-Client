import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
  actualizarGrupo,
  actualizarOpcion,
  actualizarPlato,
  borrarGrupo,
  borrarOpcion,
  crearGrupo,
  crearOpcion,
  crearPlato,
  getMenuItem,
  getStoreMenu,
  imagenUri,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { colors } from "@/theme";
import type { MenuCategory, MenuOption, OptionGroup } from "@/types";

/**
 * EDITOR DE UN PLATO (panel del dueño)
 *
 * Sirve para crear (sin `itemId`) y para editar (con `itemId`). Los grupos de
 * opciones solo aparecen cuando el plato ya existe, porque cuelgan de su id.
 */
export default function EditarPlatoScreen() {
  const params = useLocalSearchParams<{
    storeId: string;
    categoryId: string;
    itemId?: string;
  }>();
  const storeId = Number(params.storeId);
  const { token, cerrarSesion } = useAuth();
  const insets = useSafeAreaInsets();

  // Cuando se crea un plato nuevo, aquí queda su id y se desbloquean las opciones.
  const [itemId, setItemId] = useState<number | null>(
    params.itemId ? Number(params.itemId) : null,
  );
  const esNuevo = itemId === null;

  const [cargando, setCargando] = useState(!esNuevo);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- campos del plato ---
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [precio, setPrecio] = useState("");
  const [disponible, setDisponible] = useState(true);
  const [vegetariano, setVegetariano] = useState(false);
  const [categoryId, setCategoryId] = useState<number>(Number(params.categoryId));
  const [imagenUrl, setImagenUrl] = useState<string | null>(null);
  const [fotoNueva, setFotoNueva] = useState<string | null>(null);
  const [quitarFoto, setQuitarFoto] = useState(false);

  // --- carta y opciones ---
  const [categorias, setCategorias] = useState<MenuCategory[]>([]);
  const [grupos, setGrupos] = useState<OptionGroup[]>([]);
  const [editandoGrupo, setEditandoGrupo] = useState<{ grupo: OptionGroup | null } | null>(null);
  const [editandoOpcion, setEditandoOpcion] = useState<{
    groupId: number;
    opcion: MenuOption | null;
  } | null>(null);

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
      Alert.alert("No se pudo", e instanceof Error ? e.message : porDefecto);
    },
    [cerrarSesion],
  );

  /** Recarga el plato del API (trae también sus grupos de opciones). */
  const recargarPlato = useCallback(async (id: number) => {
    const detalle = await getMenuItem(id);
    setNombre(detalle.nombre);
    setDescripcion(detalle.descripcion ?? "");
    setPrecio(String(detalle.precioBase));
    setDisponible(detalle.disponible);
    setVegetariano(detalle.esVegetariano);
    setCategoryId(detalle.categoryId);
    setImagenUrl(detalle.imagenUrl);
    setGrupos(detalle.grupos);
    setQuitarFoto(false);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        // Las secciones sirven para poder mover el plato de categoría.
        const menu = await getStoreMenu(storeId);
        setCategorias(menu.categorias);
        if (itemId) await recargarPlato(itemId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo cargar el plato.");
      } finally {
        setCargando(false);
      }
    })();
    // Solo al montar: después se refresca a mano tras cada cambio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!token) return null;

  /* ---------- foto ---------- */

  const elegirFoto = async () => {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert("Permiso necesario", "Permite el acceso a tus fotos para subir la imagen.");
      return;
    }
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!resultado.canceled && resultado.assets[0]) {
      setFotoNueva(resultado.assets[0].uri);
      setQuitarFoto(false); // elegir una foto cancela el "quitar" pendiente
    }
  };

  const quitarFotoActual = () => {
    if (fotoNueva) {
      // Todavía no se ha subido: basta con descartarla.
      setFotoNueva(null);
      return;
    }
    Alert.alert("Quitar la foto", "El plato quedará sin imagen. ¿Seguro?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Quitar", style: "destructive", onPress: () => setQuitarFoto(true) },
    ]);
  };

  /* ---------- guardar el plato ---------- */

  const guardar = async () => {
    if (!nombre.trim()) {
      setError("El plato necesita un nombre.");
      return;
    }
    const precioNum = Number(precio);
    if (!Number.isFinite(precioNum) || precioNum < 0) {
      setError("El precio tiene que ser un número mayor o igual a 0.");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const datos = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim(),
        precioBase: precioNum,
        categoryId,
        disponible,
        esVegetariano: vegetariano,
        imagenUri: fotoNueva,
        quitarImagen: quitarFoto,
      };
      if (itemId) {
        const actualizado = await actualizarPlato(token, itemId, datos);
        setImagenUrl(actualizado.imagenUrl);
        setFotoNueva(null);
        setQuitarFoto(false);
        Alert.alert("Guardado", "El plato quedó actualizado.");
      } else {
        const creado = await crearPlato(token, datos);
        setItemId(creado.id);
        setImagenUrl(creado.imagenUrl);
        setFotoNueva(null);
        setQuitarFoto(false);
        Alert.alert("Plato creado", "Ya puedes agregarle grupos de opciones.");
      }
    } catch (e) {
      manejarError(e, "No se pudo guardar el plato.");
    } finally {
      setGuardando(false);
    }
  };

  /* ---------- grupos de opciones ---------- */

  const guardarGrupo = async (datos: {
    nombre: string;
    esRequerido: boolean;
    minSel: number;
    maxSel: number;
  }) => {
    if (!itemId) return;
    const enEdicion = editandoGrupo?.grupo;
    setGuardando(true);
    try {
      if (enEdicion) await actualizarGrupo(token, enEdicion.id, datos);
      else await crearGrupo(token, itemId, datos);
      setEditandoGrupo(null);
      await recargarPlato(itemId);
    } catch (e) {
      manejarError(e, "No se pudo guardar el grupo.");
    } finally {
      setGuardando(false);
    }
  };

  const confirmarBorrarGrupo = (grupo: OptionGroup) => {
    Alert.alert(
      "Borrar grupo",
      `Se borrará "${grupo.nombre}" y sus ${grupo.opciones.length} opción(es).`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Borrar",
          style: "destructive",
          onPress: async () => {
            if (!itemId) return;
            try {
              await borrarGrupo(token, grupo.id);
              await recargarPlato(itemId);
            } catch (e) {
              manejarError(e, "No se pudo borrar el grupo.");
            }
          },
        },
      ],
    );
  };

  const guardarOpcion = async (datos: { nombre: string; precioDelta: number }) => {
    if (!itemId || !editandoOpcion) return;
    const { groupId, opcion } = editandoOpcion;
    setGuardando(true);
    try {
      if (opcion) await actualizarOpcion(token, groupId, opcion.id, datos);
      else await crearOpcion(token, groupId, datos);
      setEditandoOpcion(null);
      await recargarPlato(itemId);
    } catch (e) {
      manejarError(e, "No se pudo guardar la opción.");
    } finally {
      setGuardando(false);
    }
  };

  const confirmarBorrarOpcion = (groupId: number, opcion: MenuOption) => {
    Alert.alert("Borrar opción", `¿Borrar "${opcion.nombre}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Borrar",
        style: "destructive",
        onPress: async () => {
          if (!itemId) return;
          try {
            await borrarOpcion(token, groupId, opcion.id);
            await recargarPlato(itemId);
          } catch (e) {
            manejarError(e, "No se pudo borrar la opción.");
          }
        },
      },
    ]);
  };

  /* ---------- render ---------- */

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color={colors.fc} />
      </View>
    );
  }

  // Con "quitar" pendiente se previsualiza el plato ya sin foto.
  const foto = quitarFoto ? null : (fotoNueva ?? imagenUri(imagenUrl));

  return (
    <View style={styles.pantalla}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.titulo}>{esNuevo ? "Nuevo plato" : "Editar plato"}</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 40 }}
        >
          {/* ===== Foto ===== */}
          <View style={styles.fotoBox}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              onPress={elegirFoto}
              activeOpacity={0.85}
            >
              {foto ? (
                <Image source={{ uri: foto }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : (
                <View style={styles.fotoVacia}>
                  <Ionicons name="camera-outline" size={28} color={colors.faint} />
                  <Text style={styles.fotoVaciaText}>Agregar foto</Text>
                </View>
              )}
            </TouchableOpacity>

            {foto ? (
              <View style={styles.fotoAcciones}>
                <TouchableOpacity style={styles.fotoAccion} onPress={elegirFoto} hitSlop={6}>
                  <Ionicons name="camera-outline" size={14} color="#FFF" />
                  <Text style={styles.fotoAccionText}>Cambiar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.fotoAccion} onPress={quitarFotoActual} hitSlop={6}>
                  <Ionicons name="trash-outline" size={14} color="#FFF" />
                  <Text style={styles.fotoAccionText}>Quitar</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          {fotoNueva && !quitarFoto && (
            <Text style={styles.fotoHint}>Foto nueva — guarda para subirla.</Text>
          )}
          {quitarFoto && (
            <Text style={styles.fotoHintQuitar}>
              Se quitará la foto al guardar. Toca la caja para elegir una nueva.
            </Text>
          )}

          {/* ===== Datos ===== */}
          <Text style={styles.label}>Nombre</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={nombre}
              onChangeText={setNombre}
              placeholder="Ej: Pizza Margarita"
              placeholderTextColor={colors.faint}
            />
          </View>

          <Text style={styles.label}>Descripción</Text>
          <View style={[styles.inputRow, styles.inputMulti]}>
            <TextInput
              style={[styles.input, { height: 74, textAlignVertical: "top" }]}
              value={descripcion}
              onChangeText={setDescripcion}
              placeholder="Salsa de tomate, mozzarella y albahaca"
              placeholderTextColor={colors.faint}
              multiline
            />
          </View>

          <Text style={styles.label}>Precio base (RD$)</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={precio}
              onChangeText={setPrecio}
              placeholder="350"
              placeholderTextColor={colors.faint}
              keyboardType="decimal-pad"
            />
          </View>

          <Text style={styles.label}>Sección de la carta</Text>
          <View style={styles.chipsWrap}>
            {categorias.map((c) => {
              const activa = c.id === categoryId;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.chip, activa && styles.chipActivo]}
                  onPress={() => setCategoryId(c.id)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chipText, activa && styles.chipTextActivo]}>{c.nombre}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>Disponible</Text>
              <Text style={styles.switchAyuda}>Apágalo para marcarlo agotado.</Text>
            </View>
            <Switch
              value={disponible}
              onValueChange={setDisponible}
              trackColor={{ false: colors.line, true: "#BDE9D2" }}
              thumbColor={disponible ? colors.leaf : "#F4F0EC"}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>Vegetariano</Text>
              <Text style={styles.switchAyuda}>Se muestra con una etiqueta verde.</Text>
            </View>
            <Switch
              value={vegetariano}
              onValueChange={setVegetariano}
              trackColor={{ false: colors.line, true: "#BDE9D2" }}
              thumbColor={vegetariano ? colors.leaf : "#F4F0EC"}
            />
          </View>

          {error && <Text style={styles.formError}>{error}</Text>}

          <TouchableOpacity
            style={[styles.btnGuardar, guardando && styles.apagado]}
            onPress={guardar}
            disabled={guardando}
            activeOpacity={0.9}
          >
            {guardando ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.btnGuardarText}>
                {esNuevo ? "Crear plato" : "Guardar cambios"}
              </Text>
            )}
          </TouchableOpacity>

          {/* ===== Grupos de opciones ===== */}
          <View style={styles.opcionesHeader}>
            <Text style={styles.opcionesTitulo}>Grupos de opciones</Text>
            {!esNuevo && (
              <TouchableOpacity
                style={styles.nuevoGrupoBtn}
                onPress={() => setEditandoGrupo({ grupo: null })}
                hitSlop={6}
              >
                <Ionicons name="add" size={16} color="#FFF" />
                <Text style={styles.nuevoGrupoText}>Grupo</Text>
              </TouchableOpacity>
            )}
          </View>

          {esNuevo ? (
            <Text style={styles.ayudaBloque}>
              Guarda el plato primero. Después podrás agregarle grupos como “Tamaño” o “Extras”.
            </Text>
          ) : grupos.length === 0 ? (
            <Text style={styles.ayudaBloque}>
              Todavía no tiene opciones. Un grupo es una pregunta al cliente (“Tamaño”) y sus
              opciones son las respuestas (“Personal”, “Mediana”).
            </Text>
          ) : (
            grupos.map((grupo) => (
              <View key={grupo.id} style={styles.grupoCaja}>
                <View style={styles.grupoHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.grupoNombre}>{grupo.nombre}</Text>
                    <Text style={styles.grupoMeta}>
                      {grupo.esRequerido ? "Obligatorio" : "Opcional"} · elige entre {grupo.minSel} y{" "}
                      {grupo.maxSel}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() => setEditandoGrupo({ grupo })}
                    hitSlop={6}
                  >
                    <Ionicons name="pencil" size={14} color={colors.ink} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() => confirmarBorrarGrupo(grupo)}
                    hitSlop={6}
                  >
                    <Ionicons name="trash-outline" size={14} color={colors.fcDeep} />
                  </TouchableOpacity>
                </View>

                {grupo.opciones.map((opcion) => (
                  <View key={opcion.id} style={styles.opcionRow}>
                    <Text style={styles.opcionNombre} numberOfLines={1}>
                      {opcion.nombre}
                    </Text>
                    <Text
                      style={[
                        styles.opcionDelta,
                        { color: opcion.precioDelta < 0 ? colors.leaf : colors.muted },
                      ]}
                    >
                      {opcion.precioDelta === 0
                        ? "Sin costo"
                        : `${opcion.precioDelta > 0 ? "+" : "−"}RD$${Math.abs(opcion.precioDelta)}`}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setEditandoOpcion({ groupId: grupo.id, opcion })}
                      hitSlop={8}
                    >
                      <Ionicons name="pencil" size={14} color={colors.faint} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => confirmarBorrarOpcion(grupo.id, opcion)}
                      hitSlop={8}
                    >
                      <Ionicons name="close" size={16} color={colors.faint} />
                    </TouchableOpacity>
                  </View>
                ))}

                <TouchableOpacity
                  style={styles.agregarOpcionBtn}
                  onPress={() => setEditandoOpcion({ groupId: grupo.id, opcion: null })}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add-circle-outline" size={16} color={colors.fc} />
                  <Text style={styles.agregarOpcionText}>Agregar opción</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {editandoGrupo && (
        <ModalGrupo
          grupo={editandoGrupo.grupo}
          guardando={guardando}
          onCancelar={() => setEditandoGrupo(null)}
          onGuardar={guardarGrupo}
        />
      )}
      {editandoOpcion && (
        <ModalOpcion
          opcion={editandoOpcion.opcion}
          guardando={guardando}
          onCancelar={() => setEditandoOpcion(null)}
          onGuardar={guardarOpcion}
        />
      )}
    </View>
  );
}

/* ---------- modal: grupo de opciones ---------- */

function ModalGrupo({
  grupo,
  guardando,
  onCancelar,
  onGuardar,
}: {
  grupo: OptionGroup | null;
  guardando: boolean;
  onCancelar: () => void;
  onGuardar: (datos: {
    nombre: string;
    esRequerido: boolean;
    minSel: number;
    maxSel: number;
  }) => void;
}) {
  const [nombre, setNombre] = useState(grupo?.nombre ?? "");
  const [requerido, setRequerido] = useState(grupo?.esRequerido ?? false);
  const [minSel, setMinSel] = useState(String(grupo?.minSel ?? 0));
  const [maxSel, setMaxSel] = useState(String(grupo?.maxSel ?? 1));
  const [error, setError] = useState<string | null>(null);

  const guardar = () => {
    const min = Number(minSel);
    const max = Number(maxSel);
    // Las mismas reglas que valida el backend, para no depender de su 400.
    if (!nombre.trim()) return setError("Ponle un nombre al grupo.");
    if (!Number.isInteger(min) || !Number.isInteger(max)) {
      return setError("Los mínimos y máximos tienen que ser números enteros.");
    }
    if (max < 1) return setError("El máximo tiene que ser al menos 1.");
    if (min > max) return setError("El mínimo no puede ser mayor que el máximo.");
    if (requerido && min < 1) {
      return setError("Si el grupo es obligatorio, el mínimo tiene que ser al menos 1.");
    }
    setError(null);
    onGuardar({ nombre: nombre.trim(), esRequerido: requerido, minSel: min, maxSel: max });
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={onCancelar}>
      <View style={styles.modalFondo}>
        <View style={styles.modalCaja}>
          <Text style={styles.modalTitulo}>{grupo ? "Editar grupo" : "Nuevo grupo"}</Text>

          <Text style={styles.label}>Nombre</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={nombre}
              onChangeText={setNombre}
              placeholder="Ej: Tamaño"
              placeholderTextColor={colors.faint}
              autoFocus
            />
          </View>

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>Obligatorio</Text>
              <Text style={styles.switchAyuda}>El cliente tendrá que elegir.</Text>
            </View>
            <Switch
              value={requerido}
              onValueChange={(v) => {
                setRequerido(v);
                // Un grupo obligatorio necesita mínimo 1: se ajusta solo.
                if (v && Number(minSel) < 1) setMinSel("1");
              }}
              trackColor={{ false: colors.line, true: "#FFD4C7" }}
              thumbColor={requerido ? colors.fc : "#F4F0EC"}
            />
          </View>

          <View style={styles.filaDoble}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Mínimo</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  value={minSel}
                  onChangeText={setMinSel}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={colors.faint}
                />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Máximo</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  value={maxSel}
                  onChangeText={setMaxSel}
                  keyboardType="number-pad"
                  placeholder="1"
                  placeholderTextColor={colors.faint}
                />
              </View>
            </View>
          </View>
          <Text style={styles.ayuda}>
            Máximo 1 → el cliente ve botones redondos (elige una). Más de 1 → casillas.
          </Text>

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

/* ---------- modal: opción ---------- */

function ModalOpcion({
  opcion,
  guardando,
  onCancelar,
  onGuardar,
}: {
  opcion: MenuOption | null;
  guardando: boolean;
  onCancelar: () => void;
  onGuardar: (datos: { nombre: string; precioDelta: number }) => void;
}) {
  const [nombre, setNombre] = useState(opcion?.nombre ?? "");
  const [delta, setDelta] = useState(String(opcion?.precioDelta ?? 0));
  const [error, setError] = useState<string | null>(null);

  const guardar = () => {
    if (!nombre.trim()) return setError("Ponle un nombre a la opción.");
    const valor = Number(delta);
    if (!Number.isFinite(valor)) return setError("El precio extra tiene que ser un número.");
    setError(null);
    onGuardar({ nombre: nombre.trim(), precioDelta: valor });
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={onCancelar}>
      <View style={styles.modalFondo}>
        <View style={styles.modalCaja}>
          <Text style={styles.modalTitulo}>{opcion ? "Editar opción" : "Nueva opción"}</Text>

          <Text style={styles.label}>Nombre</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={nombre}
              onChangeText={setNombre}
              placeholder="Ej: Queso extra"
              placeholderTextColor={colors.faint}
              autoFocus
            />
          </View>

          <Text style={styles.label}>Precio extra (RD$)</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={delta}
              onChangeText={setDelta}
              placeholder="0"
              placeholderTextColor={colors.faint}
              // El teclado numérico de iOS no trae el signo −, por eso este es el completo.
              keyboardType={Platform.OS === "ios" ? "numbers-and-punctuation" : "numeric"}
            />
          </View>
          <Text style={styles.ayuda}>
            Puede ser negativo para descontar (ej. −20 por “sin cebolla”).
          </Text>

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
  centrado: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },

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
  titulo: { flex: 1, fontSize: 21, fontWeight: "800", color: colors.ink, letterSpacing: -0.3 },

  fotoBox: {
    height: 180,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderStyle: "dashed",
  },
  fotoVacia: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6 },
  fotoVaciaText: { fontSize: 13, fontWeight: "700", color: colors.muted },
  fotoAcciones: { position: "absolute", right: 12, bottom: 12, flexDirection: "row", gap: 8 },
  fotoAccion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  fotoAccionText: { color: "#FFF", fontSize: 12, fontWeight: "700" },
  fotoHint: { fontSize: 12.5, fontWeight: "600", color: colors.leaf, marginTop: 8 },
  fotoHintQuitar: { fontSize: 12.5, fontWeight: "600", color: colors.fcDeep, marginTop: 8 },

  label: { fontSize: 13, fontWeight: "700", color: colors.ink, marginBottom: 6, marginTop: 14 },
  inputRow: {
    minHeight: 50,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    justifyContent: "center",
  },
  inputMulti: { paddingVertical: 10 },
  input: { fontSize: 15, fontWeight: "600", color: colors.ink, paddingVertical: 0 },
  ayuda: { fontSize: 12, fontWeight: "500", color: colors.muted, marginTop: 6, lineHeight: 17 },
  formError: { color: colors.fcDeep, fontSize: 13, fontWeight: "700", marginTop: 12 },

  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipActivo: { backgroundColor: colors.fc, borderColor: colors.fc },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.ink },
  chipTextActivo: { color: "#FFF", fontWeight: "700" },

  switchRow: {
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
  switchLabel: { fontSize: 15, fontWeight: "700", color: colors.ink },
  switchAyuda: { fontSize: 12, fontWeight: "500", color: colors.muted, marginTop: 2 },

  btnGuardar: {
    height: 54,
    borderRadius: 15,
    backgroundColor: colors.fc,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  btnGuardarText: { color: "#FFF", fontSize: 16, fontWeight: "800" },
  apagado: { opacity: 0.7 },

  opcionesHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 30,
    marginBottom: 10,
  },
  opcionesTitulo: { fontSize: 19, fontWeight: "800", color: colors.ink, letterSpacing: -0.3 },
  nuevoGrupoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.fc,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  nuevoGrupoText: { color: "#FFF", fontSize: 12.5, fontWeight: "800" },
  ayudaBloque: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.muted,
    lineHeight: 20,
    backgroundColor: colors.paper,
    padding: 14,
    borderRadius: 14,
  },

  grupoCaja: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  grupoHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  grupoNombre: { fontSize: 15.5, fontWeight: "800", color: colors.ink },
  grupoMeta: { fontSize: 12, fontWeight: "600", color: colors.muted, marginTop: 2 },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  opcionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 10,
    marginTop: 10,
  },
  opcionNombre: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.ink },
  opcionDelta: { fontSize: 13, fontWeight: "700" },
  agregarOpcionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.paper,
  },
  agregarOpcionText: { color: colors.fc, fontSize: 13, fontWeight: "700" },

  modalFondo: {
    flex: 1,
    backgroundColor: "rgba(36,27,25,0.45)",
    justifyContent: "center",
    padding: 24,
  },
  modalCaja: { backgroundColor: colors.surface, borderRadius: 22, padding: 20 },
  modalTitulo: { fontSize: 19, fontWeight: "800", color: colors.ink },
  filaDoble: { flexDirection: "row", gap: 12 },
  modalBotones: { flexDirection: "row", gap: 10, marginTop: 20 },
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
});
