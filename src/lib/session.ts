import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import type { User } from "@/types";

const TOKEN_KEY = "foodcourt_token";
const USER_KEY = "foodcourt_user";

// SecureStore no existe en web: usamos localStorage como respaldo
// para poder probar con `npm run web` sin que la app se cuelgue.
const esWeb = Platform.OS === "web";

async function guardarItem(key: string, value: string): Promise<void> {
  if (esWeb) {
    globalThis.localStorage?.setItem(key, value);
    return;
  }
  return SecureStore.setItemAsync(key, value);
}

async function leerItem(key: string): Promise<string | null> {
  if (esWeb) return globalThis.localStorage?.getItem(key) ?? null;
  return SecureStore.getItemAsync(key);
}

async function borrarItem(key: string): Promise<void> {
  if (esWeb) {
    globalThis.localStorage?.removeItem(key);
    return;
  }
  return SecureStore.deleteItemAsync(key);
}

export function getToken(): Promise<string | null> {
  return leerItem(TOKEN_KEY);
}

export async function getUser(): Promise<User | null> {
  const raw = await leerItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export async function saveSession(token: string, user: User): Promise<void> {
  await guardarItem(TOKEN_KEY, token);
  await guardarItem(USER_KEY, JSON.stringify(user));
}

export async function clearSession(): Promise<void> {
  await borrarItem(TOKEN_KEY);
  await borrarItem(USER_KEY);
}
