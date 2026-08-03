import { LinearGradient } from "expo-linear-gradient";
import { useState, type ReactNode } from "react";
import { Image, StyleSheet, Text, View, type ViewStyle } from "react-native";

import { portadaUri } from "@/lib/api";
import { darken, initials } from "@/theme";

/**
 * Lo mínimo para pintar una portada. Un `Store` completo encaja aquí, pero
 * también sirve para pantallas que solo tienen el nombre y el color
 * (ej. la carta, que llega por params o por deep link).
 */
export interface Portada {
  nombre: string;
  colorMarca: string;
  portadaUrl: string | null;
}

interface Props {
  store: Portada;
  height?: number;
  style?: ViewStyle;
  /** uri local (foto recién elegida) que tiene prioridad sobre la del servidor */
  overrideUri?: string | null;
  /** fuerza el degradado aunque haya foto — para previsualizar "quitar portada" */
  sinImagen?: boolean;
  children?: ReactNode;
}

/**
 * Portada de un local: la foto si existe, o un degradado con el colorMarca
 * y las iniciales del nombre (como en el diseño). Si la imagen falla al
 * cargar (ej. una URL de seed que no existe), cae al degradado también.
 */
export function StoreCover({
  store,
  height = 144,
  style,
  overrideUri,
  sinImagen,
  children,
}: Props) {
  const [uriFallida, setUriFallida] = useState<string | null>(null);
  const uri = overrideUri ?? portadaUri(store.portadaUrl);
  const mostrarImagen = !sinImagen && uri && uri !== uriFallida;

  return (
    <View style={[styles.wrap, { height }, style]}>
      {mostrarImagen ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => setUriFallida(uri)}
        />
      ) : (
        <LinearGradient
          colors={[store.colorMarca, darken(store.colorMarca, 0.45)]}
          start={{ x: 0.6, y: 0 }}
          end={{ x: 0.2, y: 1 }}
          style={[StyleSheet.absoluteFill, styles.center]}
        >
          <Text style={[styles.initials, { fontSize: height * 0.44 }]}>
            {initials(store.nombre)}
          </Text>
        </LinearGradient>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", overflow: "hidden", backgroundColor: "#DDD5CE" },
  center: { alignItems: "center", justifyContent: "center" },
  initials: { color: "rgba(255,255,255,0.25)", fontWeight: "800", letterSpacing: 1 },
});
