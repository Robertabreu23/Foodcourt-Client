import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { imagenUri } from "@/lib/api";
import { useCart, type LineaCarrito } from "@/lib/cart-context";
import { colors } from "@/theme";

/**
 * EL CARRITO
 *
 * Vive solo en la app: el backend todavía no tiene `POST /orders`. Cada línea
 * guarda `itemId` + `opcionesElegidas`, que es justo lo que habrá que enviar
 * cuando ese endpoint exista.
 */
export default function CarritoScreen() {
  const { lineas, storeNombre, subtotal, envioBase, total, cambiarCantidad, quitar, vaciar } =
    useCart();
  const insets = useSafeAreaInsets();

  const confirmarVaciar = () => {
    Alert.alert("Vaciar el carrito", "Se quitarán todos los platos. ¿Seguro?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Vaciar", style: "destructive", onPress: vaciar },
    ]);
  };

  return (
    <View style={styles.pantalla}>
      {/* ===== Cabecera ===== */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={colors.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.titulo}>Tu carrito</Text>
          {storeNombre ? (
            <Text style={styles.subtitulo} numberOfLines={1}>
              {storeNombre}
            </Text>
          ) : null}
        </View>
        {lineas.length > 0 && (
          <TouchableOpacity style={styles.vaciarBtn} onPress={confirmarVaciar} hitSlop={6}>
            <Ionicons name="trash-outline" size={16} color={colors.fcDeep} />
            <Text style={styles.vaciarText}>Vaciar</Text>
          </TouchableOpacity>
        )}
      </View>

      {lineas.length === 0 ? (
        <View style={styles.vacio}>
          <Ionicons name="basket-outline" size={52} color={colors.faint} />
          <Text style={styles.vacioTitulo}>Tu carrito está vacío</Text>
          <Text style={styles.vacioSub}>
            Elige un local en Inicio y agrega tus platos favoritos.
          </Text>
          <TouchableOpacity style={styles.btnPrimario} onPress={() => router.replace("/")}>
            <Text style={styles.btnPrimarioText}>Ver locales</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 18, paddingBottom: 24 }}
          >
            {lineas.map((linea) => (
              <LineaRow
                key={linea.clave}
                linea={linea}
                onMas={() => cambiarCantidad(linea.clave, linea.cantidad + 1)}
                onMenos={() => cambiarCantidad(linea.clave, linea.cantidad - 1)}
                onQuitar={() => quitar(linea.clave)}
              />
            ))}

            {/* ===== Resumen ===== */}
            <View style={styles.resumen}>
              <FilaResumen etiqueta="Subtotal" valor={subtotal} />
              <FilaResumen etiqueta="Envío" valor={envioBase} />
              <View style={styles.separador} />
              <FilaResumen etiqueta="Total" valor={total} destacada />
            </View>
          </ScrollView>

          {/* ===== Pagar ===== */}
          <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
            <TouchableOpacity
              style={styles.btnPagar}
              onPress={() => router.push("/checkout")}
              activeOpacity={0.9}
            >
              <Text style={styles.btnPagarText}>Continuar</Text>
              <Text style={styles.btnPagarText}>RD${total}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

/* ---------- una línea del carrito ---------- */

function LineaRow({
  linea,
  onMas,
  onMenos,
  onQuitar,
}: {
  linea: LineaCarrito;
  onMas: () => void;
  onMenos: () => void;
  onQuitar: () => void;
}) {
  const foto = imagenUri(linea.imagenUrl);

  return (
    <View style={styles.linea}>
      {foto ? (
        <Image source={{ uri: foto }} style={styles.lineaFoto} resizeMode="cover" />
      ) : (
        <View style={[styles.lineaFoto, styles.lineaFotoVacia]}>
          <Ionicons name="fast-food-outline" size={20} color={colors.faint} />
        </View>
      )}

      <View style={{ flex: 1 }}>
        <View style={styles.lineaTituloRow}>
          <Text style={styles.lineaNombre} numberOfLines={2}>
            {linea.nombre}
          </Text>
          <TouchableOpacity onPress={onQuitar} hitSlop={8}>
            <Ionicons name="close" size={18} color={colors.faint} />
          </TouchableOpacity>
        </View>

        {linea.opcionesElegidas.length > 0 && (
          <Text style={styles.lineaOpciones} numberOfLines={3}>
            {linea.opcionesElegidas.map((o) => o.nombre).join(" · ")}
          </Text>
        )}

        <View style={styles.lineaPieRow}>
          <View style={styles.stepper}>
            <TouchableOpacity style={styles.stepperBtn} onPress={onMenos} hitSlop={6}>
              <Ionicons
                name={linea.cantidad === 1 ? "trash-outline" : "remove"}
                size={15}
                color={linea.cantidad === 1 ? colors.fcDeep : colors.ink}
              />
            </TouchableOpacity>
            <Text style={styles.stepperValor}>{linea.cantidad}</Text>
            <TouchableOpacity style={styles.stepperBtn} onPress={onMas} hitSlop={6}>
              <Ionicons name="add" size={15} color={colors.ink} />
            </TouchableOpacity>
          </View>
          <Text style={styles.lineaPrecio}>RD${linea.precioUnitario * linea.cantidad}</Text>
        </View>
      </View>
    </View>
  );
}

function FilaResumen({
  etiqueta,
  valor,
  destacada,
}: {
  etiqueta: string;
  valor: number;
  destacada?: boolean;
}) {
  return (
    <View style={styles.resumenFila}>
      <Text style={destacada ? styles.resumenTotalLabel : styles.resumenLabel}>{etiqueta}</Text>
      <Text style={destacada ? styles.resumenTotalValor : styles.resumenValor}>RD${valor}</Text>
    </View>
  );
}

/* ---------- estilos ---------- */

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.bg },

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
  vaciarBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.fcSoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  vaciarText: { color: colors.fcDeep, fontSize: 12.5, fontWeight: "700" },

  vacio: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 10 },
  vacioTitulo: { fontSize: 19, fontWeight: "800", color: colors.ink },
  vacioSub: { fontSize: 13.5, color: colors.muted, textAlign: "center", lineHeight: 20 },
  btnPrimario: {
    marginTop: 10,
    backgroundColor: colors.fc,
    paddingHorizontal: 26,
    paddingVertical: 13,
    borderRadius: 999,
  },
  btnPrimarioText: { color: "#FFF", fontWeight: "800", fontSize: 14 },

  linea: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    padding: 12,
    marginBottom: 12,
  },
  lineaFoto: { width: 68, height: 68, borderRadius: 14, backgroundColor: colors.paper },
  lineaFotoVacia: { alignItems: "center", justifyContent: "center" },
  lineaTituloRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  lineaNombre: { flex: 1, fontSize: 15, fontWeight: "800", color: colors.ink },
  lineaOpciones: { fontSize: 12, fontWeight: "500", color: colors.muted, marginTop: 3, lineHeight: 17 },
  lineaPieRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  lineaPrecio: { fontSize: 15, fontWeight: "800", color: colors.ink },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.paper,
    borderRadius: 999,
    padding: 4,
  },
  stepperBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperValor: {
    minWidth: 22,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "800",
    color: colors.ink,
  },

  resumen: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    padding: 16,
    marginTop: 4,
  },
  resumenFila: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 },
  resumenLabel: { fontSize: 14, fontWeight: "600", color: colors.muted },
  resumenValor: { fontSize: 14, fontWeight: "700", color: colors.ink },
  separador: { height: 1, backgroundColor: colors.line, marginVertical: 8 },
  resumenTotalLabel: { fontSize: 16.5, fontWeight: "800", color: colors.ink },
  resumenTotalValor: { fontSize: 18, fontWeight: "800", color: colors.fc },

  footer: {
    paddingHorizontal: 18,
    paddingTop: 12,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  btnPagar: {
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.fc,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  btnPagarText: { color: "#FFF", fontSize: 16, fontWeight: "800" },
});
