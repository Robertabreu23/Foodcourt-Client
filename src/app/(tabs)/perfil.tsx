import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { SafeAreaView } from "react-native-safe-area-context";

import { StoreCover } from "@/components/store-cover";
import {
  ApiError,
  cambiarPassword,
  getMisLocales,
  getSuscripcion,
  updateStore,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { colors, initials } from "@/theme";
import type { Store, Suscripcion } from "@/types";

export default function PerfilScreen() {
  const { token, user, cerrarSesion } = useAuth();

  // La ruta está protegida: si no hay token, el guard ya nos sacó al login.
  if (!token) return null;

  return (
    <OwnerPanel
      token={token}
      nombreUsuario={user?.nombre ?? "Usuario"}
      // El rol de admin no cambia con el plan, así que el del token sirve.
      // Para "¿es comercio?" NO se usa: eso lo dice `GET /suscripcion`.
      esAdmin={user?.rol === "admin"}
      onCerrarSesion={cerrarSesion}
    />
  );
}

/* ================= PANEL DEL DUEÑO ================= */

interface OwnerProps {
  token: string;
  nombreUsuario: string;
  esAdmin: boolean;
  onCerrarSesion: () => void;
}

function OwnerPanel({ token, nombreUsuario, esAdmin, onCerrarSesion }: OwnerProps) {
  const [locales, setLocales] = useState<Store[]>([]);
  const [suscripcion, setSuscripcion] = useState<Suscripcion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seleccionado, setSeleccionado] = useState<Store | null>(null);
  const [cambiandoPass, setCambiandoPass] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      // El plan y los locales se piden juntos: el estado del plan decide qué
      // se puede hacer con los locales (crear otro, o si están ocultos).
      const [mios, plan] = await Promise.all([
        getMisLocales(token),
        // Si el endpoint del plan falla, los locales igual se muestran.
        getSuscripcion(token).catch(() => null),
      ]);
      setLocales(mios);
      setSuscripcion(plan);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        Alert.alert("Sesión expirada", "Vuelve a iniciar sesión.");
        onCerrarSesion();
        return;
      }
      setError(e instanceof Error ? e.message : "No se pudieron cargar tus locales.");
    } finally {
      setCargando(false);
    }
  }, [token, onCerrarSesion]);

  // Al volver de pagar el plan o de crear un local, refrescar.
  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  if (seleccionado) {
    return (
      <EditarLocal
        token={token}
        store={seleccionado}
        onBack={() => setSeleccionado(null)}
        onSaved={(actualizado) => {
          setLocales((prev) => prev.map((s) => (s.id === actualizado.id ? actualizado : s)));
          setSeleccionado(actualizado);
        }}
        onSessionExpired={onCerrarSesion}
      />
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      {/* Tarjeta del usuario logueado */}
      <View style={styles.userCard}>
        <LinearGradient
          colors={[colors.mango, "#FF7A45"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.userAvatar}
        >
          <Text style={styles.userAvatarText}>{initials(nombreUsuario)}</Text>
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={styles.userHola}>Hola,</Text>
          <Text style={styles.userNombre} numberOfLines={1}>
            {nombreUsuario}
          </Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={onCerrarSesion}>
          <Ionicons name="log-out-outline" size={16} color={colors.fcDeep} />
          <Text style={styles.logoutText}>Salir</Text>
        </TouchableOpacity>
      </View>

      {/* Accesos de la cuenta — valen igual para cliente y para dueño. */}
      <View style={styles.accesos}>
        <Acceso
          icono="location-outline"
          titulo="Mis direcciones"
          sub="Dónde recibes tus pedidos"
          onPress={() => router.push("/direcciones")}
        />
        <Acceso
          icono="key-outline"
          titulo="Cambiar contraseña"
          sub="Te pediremos la actual"
          onPress={() => setCambiandoPass(true)}
        />
        {esAdmin && (
          <Acceso
            icono="shield-checkmark-outline"
            titulo="Revisión de locales"
            sub="Aprobar o rechazar los nuevos"
            onPress={() => router.push("/admin/locales")}
          />
        )}
      </View>

      <View style={[styles.panelHeader, styles.panelHeaderRow]}>
        <Text style={styles.panelTitle}>Mis locales</Text>
        {suscripcion?.alDia && (
          <TouchableOpacity
            style={[styles.nuevoBtn, !suscripcion.puedeCrearOtro && styles.apagado]}
            onPress={() =>
              suscripcion.puedeCrearOtro
                ? router.push("/local-nuevo")
                : Alert.alert(
                    "Llegaste al tope",
                    `Tu plan permite ${suscripcion.maxLocales} locales y ya tienes ${suscripcion.localesUsados}.`,
                  )
            }
            hitSlop={6}
          >
            <Ionicons name="add" size={17} color="#FFF" />
            <Text style={styles.nuevoBtnText}>Nuevo</Text>
          </TouchableOpacity>
        )}
      </View>

      {cargando ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.fc} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorMsg}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={cargar}>
            <Text style={styles.ctaText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 6, gap: 14 }}>
          {/* El plan manda: sin él no se publican locales, y si vence se ocultan. */}
          {suscripcion && !suscripcion.alDia && (
            <TouchableOpacity
              style={styles.planCard}
              onPress={() => router.push("/plan")}
              activeOpacity={0.9}
            >
              <View style={styles.planIcono}>
                <Ionicons
                  name={locales.length > 0 ? "alert-circle" : "storefront"}
                  size={22}
                  color={colors.fc}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.planTitulo}>
                  {suscripcion.estado === "vencida" ? "Tu plan venció" : "Vende en Foodclub"}
                </Text>
                <Text style={styles.planSub}>
                  {locales.length > 0
                    ? `Tus ${locales.length} local${locales.length === 1 ? "" : "es"} no se están mostrando. Renueva para que vuelvan.`
                    : "Publica hasta 3 locales y recibe pedidos por US$19.99 al mes."}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.fc} />
            </TouchableOpacity>
          )}

          {suscripcion?.alDia && (
            <TouchableOpacity
              style={styles.planActivo}
              onPress={() => router.push("/plan")}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark-circle" size={17} color={colors.leaf} />
              <Text style={styles.planActivoText}>
                Plan activo · {suscripcion.localesUsados} de {suscripcion.maxLocales} locales
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.faint} />
            </TouchableOpacity>
          )}

          {locales.length === 0 && !suscripcion?.alDia ? (
            <View style={styles.emptyBox}>
              <Ionicons name="storefront-outline" size={38} color={colors.faint} />
              <Text style={styles.emptyTitle}>Todavía no tienes locales</Text>
              <Text style={styles.errorMsg}>
                Tu cuenta es de cliente: ya puedes pedir desde el Inicio. Si tienes un negocio,
                hazte comercio arriba y publícalo aquí.
              </Text>
            </View>
          ) : locales.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="add-circle-outline" size={38} color={colors.faint} />
              <Text style={styles.emptyTitle}>Publica tu primer local</Text>
              <Text style={styles.errorMsg}>
                Tu plan está al día. Toca “Nuevo” para crearlo; entrará en revisión y después ya
                podrás montar su carta.
              </Text>
            </View>
          ) : (
            <Text style={styles.panelSub}>Elige el local que quieres editar:</Text>
          )}
          {locales.map((s) => (
            <View key={s.id} style={styles.localCard}>
              <TouchableOpacity
                style={styles.localItem}
                activeOpacity={0.8}
                onPress={() => setSeleccionado(s)}
              >
                <StoreCover store={s} height={56} style={styles.localThumb} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.localNombre} numberOfLines={1}>
                    {s.nombre}
                  </Text>
                  <Text style={styles.localMeta}>{s.categoria ?? "Sin categoría"}</Text>
                  <View style={styles.localBadges}>
                    {s.estadoVerificacion !== "aprobado" && (
                      <Badge
                        texto={s.estadoVerificacion === "pendiente" ? "En revisión" : "Rechazado"}
                        color={s.estadoVerificacion === "pendiente" ? "#B26A00" : colors.fcDeep}
                        fondo={s.estadoVerificacion === "pendiente" ? "#FFF3DC" : colors.fcSoft}
                      />
                    )}
                    <Badge
                      texto={s.estadoOperacion === "abierto" ? "Abierto" : "Cerrado"}
                      color={s.estadoOperacion === "abierto" ? "#177449" : colors.muted}
                      fondo={s.estadoOperacion === "abierto" ? "#E9F6EF" : colors.paper}
                    />
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.faint} />
              </TouchableOpacity>

              {/* La cola de pedidos es lo que más se abre: va en primer plano. */}
              <TouchableOpacity
                style={styles.pedidosBtn}
                activeOpacity={0.85}
                onPress={() =>
                  router.push({
                    pathname: "/gestion/pedidos/[storeId]",
                    params: { storeId: String(s.id) },
                  })
                }
              >
                <Ionicons name="receipt-outline" size={16} color="#FFF" />
                <Text style={styles.pedidosBtnText}>Ver pedidos del local</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      {cambiandoPass && (
        <ModalPassword token={token} onCerrar={() => setCambiandoPass(false)} />
      )}
    </SafeAreaView>
  );
}

/* ================= PIEZAS DE LA CUENTA ================= */

function Badge({ texto, color, fondo }: { texto: string; color: string; fondo: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: fondo }]}>
      <Text style={[styles.badgeText, { color }]}>{texto}</Text>
    </View>
  );
}

function Acceso({
  icono,
  titulo,
  sub,
  onPress,
}: {
  icono: keyof typeof Ionicons.glyphMap;
  titulo: string;
  sub: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.acceso} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.accesoIcono}>
        <Ionicons name={icono} size={18} color={colors.fc} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.accesoTitulo}>{titulo}</Text>
        <Text style={styles.accesoSub}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.faint} />
    </TouchableOpacity>
  );
}

/**
 * Cambiar la contraseña sabiéndola.
 *
 * Se pide la actual aunque ya haya sesión: un token puede estar en un celular
 * que quedó desbloqueado encima de una mesa. El backend responde `401` si no
 * coincide — el mismo código que si el token venciera, así que aquí hay que
 * distinguirlos con cuidado para no cerrar la sesión por una clave mal escrita.
 */
function ModalPassword({ token, onCerrar }: { token: string; onCerrar: () => void }) {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [ver, setVer] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enviar = async () => {
    if (!actual) return setError("Escribe tu contraseña actual.");
    if (nueva.length < 8) return setError("La nueva debe tener al menos 8 caracteres.");
    if (nueva === actual) return setError("La nueva tiene que ser distinta de la actual.");
    if (nueva !== repetir) return setError("Las dos contraseñas nuevas no coinciden.");

    setEnviando(true);
    setError(null);
    try {
      await cambiarPassword(token, actual, nueva);
      onCerrar();
      Alert.alert("Listo", "Tu contraseña quedó actualizada. Tu sesión sigue abierta.");
    } catch (e) {
      // Aquí un 401 significa "la contraseña actual no coincide", NO que la
      // sesión venció: por eso no se cierra sesión.
      setError(
        e instanceof ApiError && e.status === 401
          ? "Tu contraseña actual no es correcta."
          : e instanceof Error
            ? e.message
            : "No se pudo cambiar.",
      );
      setEnviando(false);
    }
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={onCerrar}>
      <KeyboardAvoidingView
        style={styles.modalFondo}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.modalCaja}>
          <Text style={styles.modalTitulo}>Cambiar contraseña</Text>
          <Text style={styles.modalTexto}>
            Te pedimos la actual por seguridad, aunque ya hayas iniciado sesión.
          </Text>

          <Text style={styles.inputLabel}>Contraseña actual</Text>
          <View style={styles.inputRow}>
            <Ionicons name="lock-closed-outline" size={18} color="#9A8D86" />
            <TextInput
              style={styles.input}
              value={actual}
              onChangeText={setActual}
              placeholder="La de siempre"
              placeholderTextColor={colors.faint}
              secureTextEntry={!ver}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setVer((v) => !v)} hitSlop={10}>
              <Ionicons name={ver ? "eye-off-outline" : "eye-outline"} size={19} color="#9A8D86" />
            </TouchableOpacity>
          </View>

          <Text style={styles.inputLabel}>Nueva</Text>
          <View style={styles.inputRow}>
            <Ionicons name="key-outline" size={18} color="#9A8D86" />
            <TextInput
              style={styles.input}
              value={nueva}
              onChangeText={setNueva}
              placeholder="Al menos 8 caracteres"
              placeholderTextColor={colors.faint}
              secureTextEntry={!ver}
              autoCapitalize="none"
            />
          </View>

          <Text style={styles.inputLabel}>Repite la nueva</Text>
          <View style={styles.inputRow}>
            <Ionicons name="key-outline" size={18} color="#9A8D86" />
            <TextInput
              style={styles.input}
              value={repetir}
              onChangeText={setRepetir}
              placeholder="La misma de arriba"
              placeholderTextColor={colors.faint}
              secureTextEntry={!ver}
              autoCapitalize="none"
            />
          </View>

          {error && <Text style={styles.formError}>{error}</Text>}

          <View style={styles.modalBotones}>
            <TouchableOpacity style={styles.modalSecundario} onPress={onCerrar}>
              <Text style={styles.modalSecundarioText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalPrimario, enviando && styles.ctaDisabled]}
              onPress={enviar}
              disabled={enviando}
            >
              {enviando ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.ctaText}>Guardar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ================= EDITAR LOCAL ================= */

interface EditarProps {
  token: string;
  store: Store;
  onBack: () => void;
  onSaved: (s: Store) => void;
  onSessionExpired: () => void;
}

function EditarLocal({ token, store, onBack, onSaved, onSessionExpired }: EditarProps) {
  const [nombre, setNombre] = useState(store.nombre);
  const [categoria, setCategoria] = useState(store.categoria ?? "");
  const [telefono, setTelefono] = useState(store.telefono ?? "");
  const [direccion, setDireccion] = useState(store.direccion ?? "");
  const [envio, setEnvio] = useState(String(store.envioBase ?? 0));
  const [tiempoMin, setTiempoMin] = useState(
    store.tiempoEstimadoMin != null ? String(store.tiempoEstimadoMin) : "",
  );
  const [tiempoMax, setTiempoMax] = useState(
    store.tiempoEstimadoMax != null ? String(store.tiempoEstimadoMax) : "",
  );
  const [imagenUri, setImagenUri] = useState<string | null>(null);
  const [quitarPortada, setQuitarPortada] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const abierto = store.estadoOperacion === "abierto";

  /**
   * Abrir/cerrar se guarda al instante, sin esperar al botón: es lo que el
   * dueño toca cuando se le daña el horno o cierra la cocina, y ahí no quiere
   * andar buscando "Guardar".
   */
  const alternarOperacion = async (valor: boolean) => {
    setCambiandoEstado(true);
    setOk(false);
    try {
      const actualizado = await updateStore(token, store.id, {
        estadoOperacion: valor ? "abierto" : "cerrado",
      });
      onSaved(actualizado);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        Alert.alert("Sesión expirada", "Vuelve a iniciar sesión.");
        onSessionExpired();
        return;
      }
      Alert.alert("No se pudo", e instanceof Error ? e.message : "Intenta de nuevo.");
    } finally {
      setCambiandoEstado(false);
    }
  };

  const elegirFoto = async () => {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert("Permiso necesario", "Permite el acceso a tus fotos para cambiar la portada.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setImagenUri(result.assets[0].uri);
      setQuitarPortada(false); // elegir una foto cancela el "quitar" pendiente
      setOk(false);
    }
  };

  const quitarFotoActual = () => {
    if (imagenUri) {
      // Todavía no se ha subido: basta con descartarla.
      setImagenUri(null);
      return;
    }
    Alert.alert("Quitar la portada", "El local quedará con su color de marca. ¿Seguro?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Quitar",
        style: "destructive",
        onPress: () => {
          setQuitarPortada(true);
          setOk(false);
        },
      },
    ]);
  };

  const guardar = async () => {
    if (!nombre.trim()) {
      setError("El nombre no puede quedar vacío.");
      return;
    }
    const envioNum = Number(envio);
    if (!Number.isFinite(envioNum) || envioNum < 0) {
      setError("El envío tiene que ser un número mayor o igual a 0.");
      return;
    }
    const min = tiempoMin.trim() ? Number(tiempoMin) : undefined;
    const max = tiempoMax.trim() ? Number(tiempoMax) : undefined;
    if ((min !== undefined && !Number.isFinite(min)) || (max !== undefined && !Number.isFinite(max))) {
      setError("Los tiempos tienen que ser números en minutos.");
      return;
    }
    if (min !== undefined && max !== undefined && min > max) {
      setError("El tiempo mínimo no puede ser mayor que el máximo.");
      return;
    }

    setGuardando(true);
    setError(null);
    setOk(false);
    try {
      const actualizado = await updateStore(token, store.id, {
        nombre: nombre.trim(),
        categoria: categoria.trim() || undefined,
        telefono: telefono.trim() || undefined,
        direccion: direccion.trim() || undefined,
        envioBase: envioNum,
        ...(min !== undefined ? { tiempoEstimadoMin: min } : {}),
        ...(max !== undefined ? { tiempoEstimadoMax: max } : {}),
        imagenUri,
        quitarPortada,
      });
      setImagenUri(null); // la portada ya vive en el servidor
      setQuitarPortada(false);
      onSaved(actualizado);
      setOk(true);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        Alert.alert("Sesión expirada", "Vuelve a iniciar sesión.");
        onSessionExpired();
        return;
      }
      if (e instanceof ApiError && e.status === 403) {
        setError("No eres el dueño de este local.");
      } else {
        setError(e instanceof Error ? e.message : "No se pudo guardar.");
      }
    } finally {
      setGuardando(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.panelHeader, { flexDirection: "row", alignItems: "center", gap: 12 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={onBack} hitSlop={8}>
            <Ionicons name="chevron-back" size={20} color={colors.ink} />
          </TouchableOpacity>
          <Text style={[styles.panelTitle, { flex: 1 }]} numberOfLines={1}>
            Editar local
          </Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {/* Vista previa de la portada */}
          <View style={styles.previewCard}>
            <StoreCover
              store={store}
              height={170}
              overrideUri={imagenUri}
              sinImagen={quitarPortada}
            />
            <View style={styles.fotoAcciones}>
              <TouchableOpacity style={styles.fotoBtn} onPress={elegirFoto} activeOpacity={0.85}>
                <Ionicons name="camera-outline" size={16} color="#FFF" />
                <Text style={styles.fotoBtnText}>Cambiar foto</Text>
              </TouchableOpacity>
              {/* Solo tiene sentido si hay algo que quitar. */}
              {(imagenUri || (store.portadaUrl && !quitarPortada)) && (
                <TouchableOpacity
                  style={styles.fotoBtn}
                  onPress={quitarFotoActual}
                  activeOpacity={0.85}
                >
                  <Ionicons name="trash-outline" size={16} color="#FFF" />
                </TouchableOpacity>
              )}
            </View>
          </View>
          {imagenUri && !quitarPortada && (
            <Text style={styles.fotoHint}>Foto nueva seleccionada — guarda para subirla.</Text>
          )}
          {quitarPortada && (
            <Text style={styles.fotoHintQuitar}>
              Se quitará la portada al guardar. Quedará el color de marca.
            </Text>
          )}

          {/* ===== El interruptor de recibir pedidos ===== */}
          <View style={[styles.operacionCaja, abierto && styles.operacionAbierta]}>
            <View style={[styles.operacionIcono, abierto && styles.operacionIconoAbierto]}>
              {cambiandoEstado ? (
                <ActivityIndicator size="small" color={abierto ? colors.leaf : colors.muted} />
              ) : (
                <Ionicons
                  name={abierto ? "radio-button-on" : "moon-outline"}
                  size={20}
                  color={abierto ? colors.leaf : colors.muted}
                />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.operacionTitulo}>
                {abierto ? "Recibiendo pedidos" : "No recibes pedidos"}
              </Text>
              <Text style={styles.operacionSub}>
                {abierto
                  ? "Los clientes pueden pedirte ahora mismo."
                  : "Tu carta se ve, pero nadie puede pedir."}
              </Text>
            </View>
            <Switch
              value={abierto}
              onValueChange={alternarOperacion}
              disabled={cambiandoEstado}
              trackColor={{ false: colors.line, true: "#BDE9D2" }}
              thumbColor={abierto ? colors.leaf : "#F4F0EC"}
            />
          </View>

          {store.estadoVerificacion === "pendiente" && (
            <View style={styles.revisionAviso}>
              <Ionicons name="hourglass-outline" size={16} color="#B26A00" />
              <Text style={styles.revisionText}>
                Este local está en revisión: todavía no sale en el Inicio. Puedes ir montando su
                carta mientras tanto.
              </Text>
            </View>
          )}

          {/* Atajo al panel de la carta: secciones, platos y opciones. */}
          <TouchableOpacity
            style={styles.cartaBtn}
            onPress={() =>
              router.push({
                pathname: "/gestion/[storeId]",
                params: { storeId: String(store.id) },
              })
            }
            activeOpacity={0.85}
          >
            <View style={styles.cartaIcono}>
              <Ionicons name="restaurant-outline" size={18} color={colors.fc} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cartaTitulo}>Gestionar la carta</Text>
              <Text style={styles.cartaSub}>Secciones, platos y grupos de opciones</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.faint} />
          </TouchableOpacity>

          <Text style={styles.inputLabel}>Nombre del local</Text>
          <View style={styles.inputRow}>
            <Ionicons name="storefront-outline" size={18} color="#9A8D86" />
            <TextInput
              style={styles.input}
              value={nombre}
              onChangeText={(t) => {
                setNombre(t);
                setOk(false);
              }}
              placeholder="Ej: Forno Rosso"
              placeholderTextColor={colors.faint}
            />
          </View>

          <Text style={styles.inputLabel}>Categoría</Text>
          <View style={styles.inputRow}>
            <Ionicons name="pricetag-outline" size={18} color="#9A8D86" />
            <TextInput
              style={styles.input}
              value={categoria}
              onChangeText={(t) => {
                setCategoria(t);
                setOk(false);
              }}
              placeholder="Ej: Pizzería · Italiana"
              placeholderTextColor={colors.faint}
            />
          </View>

          <Text style={styles.inputLabel}>Costo del envío (RD$)</Text>
          <View style={styles.inputRow}>
            <Ionicons name="bicycle-outline" size={18} color="#9A8D86" />
            <TextInput
              style={styles.input}
              value={envio}
              onChangeText={(t) => {
                setEnvio(t);
                setOk(false);
              }}
              placeholder="150"
              placeholderTextColor={colors.faint}
              keyboardType="number-pad"
            />
          </View>
          {store.envioBase === 0 && (
            <Text style={styles.ayudaCampo}>
              Está en 0: los clientes ven “Envío gratis”. Ponle su precio si cobras el delivery.
            </Text>
          )}

          <Text style={styles.inputLabel}>Tiempo de entrega (minutos)</Text>
          <View style={styles.filaDoble}>
            <View style={[styles.inputRow, { flex: 1 }]}>
              <Text style={styles.prefijoCampo}>De</Text>
              <TextInput
                style={styles.input}
                value={tiempoMin}
                onChangeText={(t) => {
                  setTiempoMin(t);
                  setOk(false);
                }}
                placeholder="25"
                placeholderTextColor={colors.faint}
                keyboardType="number-pad"
              />
            </View>
            <View style={[styles.inputRow, { flex: 1 }]}>
              <Text style={styles.prefijoCampo}>a</Text>
              <TextInput
                style={styles.input}
                value={tiempoMax}
                onChangeText={(t) => {
                  setTiempoMax(t);
                  setOk(false);
                }}
                placeholder="40"
                placeholderTextColor={colors.faint}
                keyboardType="number-pad"
              />
            </View>
          </View>

          <Text style={styles.inputLabel}>Teléfono</Text>
          <View style={styles.inputRow}>
            <Ionicons name="call-outline" size={18} color="#9A8D86" />
            <TextInput
              style={styles.input}
              value={telefono}
              onChangeText={(t) => {
                setTelefono(t);
                setOk(false);
              }}
              placeholder="809-555-0000"
              placeholderTextColor={colors.faint}
              keyboardType="phone-pad"
            />
          </View>

          <Text style={styles.inputLabel}>Dirección</Text>
          <View style={styles.inputRow}>
            <Ionicons name="location-outline" size={18} color="#9A8D86" />
            <TextInput
              style={styles.input}
              value={direccion}
              onChangeText={(t) => {
                setDireccion(t);
                setOk(false);
              }}
              placeholder="Av. Lincoln 1002"
              placeholderTextColor={colors.faint}
            />
          </View>

          {error && <Text style={styles.formError}>{error}</Text>}
          {ok && (
            <View style={styles.okBox}>
              <Ionicons name="checkmark-circle" size={16} color={colors.leaf} />
              <Text style={styles.okText}>¡Cambios guardados! La portada ya está actualizada.</Text>
            </View>
          )}

          <TouchableOpacity style={[styles.cta, guardando && styles.ctaDisabled]} onPress={guardar} disabled={guardando}>
            {guardando ? <ActivityIndicator color="#FFF" /> : <Text style={styles.ctaText}>Guardar cambios</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ================= ESTILOS ================= */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },

  userCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 18,
    marginTop: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    padding: 14,
  },
  userAvatar: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  userAvatarText: { color: "#FFF", fontWeight: "800", fontSize: 16 },
  userHola: { fontSize: 12, fontWeight: "600", color: colors.muted },
  userNombre: { fontSize: 16, fontWeight: "800", color: colors.ink, letterSpacing: -0.2 },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.fcSoft,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
  },
  logoutText: { color: colors.fcDeep, fontSize: 12.5, fontWeight: "700" },

  panelHeader: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 6 },
  panelTitle: { fontSize: 24, fontWeight: "800", color: colors.ink, letterSpacing: -0.4 },
  panelSub: { fontSize: 13.5, fontWeight: "600", color: colors.muted, marginBottom: 2 },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  errorMsg: { color: colors.muted, fontSize: 13.5, textAlign: "center", lineHeight: 20 },
  retryBtn: { backgroundColor: colors.fc, paddingHorizontal: 26, paddingVertical: 12, borderRadius: 999 },
  emptyBox: { alignItems: "center", gap: 8, paddingVertical: 30, paddingHorizontal: 12 },
  emptyTitle: { fontSize: 17, fontWeight: "800", color: colors.ink },

  panelHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  nuevoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.fc,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
  },
  nuevoBtnText: { color: "#FFF", fontSize: 12.5, fontWeight: "800" },
  apagado: { opacity: 0.45 },

  planCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.fc,
    borderRadius: 18,
    padding: 14,
  },
  planIcono: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.fcSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  planTitulo: { fontSize: 15.5, fontWeight: "800", color: colors.ink },
  planSub: { fontSize: 12.5, fontWeight: "500", color: colors.muted, marginTop: 3, lineHeight: 18 },
  planActivo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#E9F6EF",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  planActivoText: { flex: 1, fontSize: 13, fontWeight: "700", color: "#177449" },

  localBadges: { flexDirection: "row", gap: 6, marginTop: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7 },
  badgeText: { fontSize: 10.5, fontWeight: "800" },

  accesos: { paddingHorizontal: 18, marginTop: 14, gap: 10 },
  acceso: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    padding: 13,
  },
  accesoIcono: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.fcSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  accesoTitulo: { fontSize: 14.5, fontWeight: "800", color: colors.ink },
  accesoSub: { fontSize: 12, fontWeight: "500", color: colors.muted, marginTop: 2 },

  localCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    padding: 12,
    gap: 12,
  },
  localItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  pedidosBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    height: 46,
    borderRadius: 13,
    backgroundColor: colors.ink,
  },
  pedidosBtnText: { color: "#FFF", fontSize: 14, fontWeight: "800" },

  modalFondo: {
    flex: 1,
    backgroundColor: "rgba(36,27,25,0.45)",
    justifyContent: "center",
    padding: 24,
  },
  modalCaja: { backgroundColor: colors.surface, borderRadius: 22, padding: 22 },
  modalTitulo: { fontSize: 19, fontWeight: "800", color: colors.ink },
  modalTexto: { fontSize: 13, color: colors.muted, lineHeight: 19, marginTop: 6, marginBottom: 8 },
  modalBotones: { flexDirection: "row", gap: 10, marginTop: 18 },
  modalPrimario: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.fc,
    alignItems: "center",
    justifyContent: "center",
  },
  modalSecundario: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  modalSecundarioText: { color: colors.ink, fontWeight: "700", fontSize: 15 },
  localThumb: { width: 56, borderRadius: 14 },
  localNombre: { fontSize: 16, fontWeight: "800", color: colors.ink },
  localMeta: { fontSize: 12.5, fontWeight: "500", color: colors.muted, marginTop: 2 },

  operacionCaja: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 18,
    padding: 14,
    marginTop: 14,
  },
  operacionAbierta: { borderColor: "#BDE9D2", backgroundColor: "#F4FBF7" },
  operacionIcono: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  operacionIconoAbierto: { backgroundColor: "#E9F6EF" },
  operacionTitulo: { fontSize: 15, fontWeight: "800", color: colors.ink },
  operacionSub: { fontSize: 12, fontWeight: "500", color: colors.muted, marginTop: 2 },

  revisionAviso: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#FFF3DC",
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
  },
  revisionText: { flex: 1, fontSize: 12.5, fontWeight: "600", color: "#7A5200", lineHeight: 18 },

  filaDoble: { flexDirection: "row", gap: 10 },
  prefijoCampo: { fontSize: 13.5, fontWeight: "700", color: colors.muted },
  ayudaCampo: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.muted,
    marginTop: -8,
    marginBottom: 12,
    lineHeight: 17,
  },

  cartaBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    padding: 14,
    marginTop: 14,
    marginBottom: 4,
  },
  cartaIcono: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.fcSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  cartaTitulo: { fontSize: 15.5, fontWeight: "800", color: colors.ink },
  cartaSub: { fontSize: 12.5, fontWeight: "500", color: colors.muted, marginTop: 2 },

  inputLabel: { fontSize: 13, fontWeight: "700", color: colors.ink, marginBottom: 7, marginTop: 4 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 52,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    marginBottom: 14,
  },
  input: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.ink, paddingVertical: 0 },
  formError: { color: colors.fcDeep, fontSize: 13, fontWeight: "600", marginBottom: 10 },
  cta: {
    height: 54,
    borderRadius: 15,
    backgroundColor: colors.fc,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    shadowColor: colors.fc,
    shadowOpacity: 0.36,
    shadowRadius: 11,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  ctaDisabled: { opacity: 0.7 },
  ctaText: { color: "#FFF", fontSize: 16, fontWeight: "800" },

  previewCard: {
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 8,
  },
  fotoAcciones: { position: "absolute", right: 12, bottom: 12, flexDirection: "row", gap: 8 },
  fotoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
  },
  fotoBtnText: { color: "#FFF", fontSize: 12.5, fontWeight: "700" },
  fotoHint: { fontSize: 12.5, fontWeight: "600", color: colors.leaf, marginBottom: 10 },
  fotoHintQuitar: { fontSize: 12.5, fontWeight: "600", color: colors.fcDeep, marginBottom: 10 },
  okBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#E9F6EF",
    borderRadius: 12,
    padding: 11,
    marginBottom: 10,
  },
  okText: { flex: 1, fontSize: 13, fontWeight: "600", color: "#177449" },
});
