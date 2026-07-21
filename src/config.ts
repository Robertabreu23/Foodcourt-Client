import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * URL BASE DEL API — detección AUTOMÁTICA de la IP.
 *
 * En desarrollo, Expo sirve la app desde tu PC (Metro). Esa misma IP es donde
 * corre el backend, así que la leemos de `hostUri` y le cambiamos el puerto
 * a 3000. Funciona en simulador, emulador y celular físico con Expo Go,
 * y se actualiza sola cuando cambias de red WiFi. 🎉
 *
 * Si algún día necesitas forzar una URL (ej. backend en otra máquina o con
 * `expo start --tunnel`), pon la URL completa en OVERRIDE:
 *   const OVERRIDE = "http://192.168.1.50:3000";
 */
const OVERRIDE: string | null = null;

function hostDeMetro(): string | null {
  // ej. "172.29.4.154:8081" → "172.29.4.154"
  const hostUri = Constants.expoConfig?.hostUri;
  if (!hostUri) return null;
  const host = hostUri.split(":")[0];
  // Con `--tunnel` el host es un dominio exp.direct donde NO está el backend.
  if (!host || host.includes("exp.direct")) return null;
  return host;
}

const host = hostDeMetro();

export const API_URL: string =
  OVERRIDE ??
  (host
    ? `http://${host}:3000`
    : Platform.select({
        ios: "http://localhost:3000",
        android: "http://10.0.2.2:3000", // localhost del emulador Android
        default: "http://localhost:3000",
      })!);
