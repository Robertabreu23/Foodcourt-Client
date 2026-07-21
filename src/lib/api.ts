import { API_URL } from "@/config";
import type { AuthResponse, Store } from "@/types";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function parse<T>(res: Response): Promise<T> {
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // respuesta sin cuerpo JSON
  }
  if (!res.ok) {
    const d = data as { mensaje?: string; error?: string; message?: string } | null;
    throw new ApiError(res.status, d?.mensaje ?? d?.error ?? d?.message ?? `Error ${res.status}`);
  }
  return data as T;
}

/** GET /stores — locales aprobados, orden por rating desc. Público. */
export function getStores(): Promise<Store[]> {
  return fetch(`${API_URL}/stores`).then((r) => parse<Store[]>(r));
}

/** POST /users/login */
export function login(email: string, password: string): Promise<AuthResponse> {
  return fetch(`${API_URL}/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  }).then((r) => parse<AuthResponse>(r));
}

export interface RegisterInput {
  nombre: string;
  email: string;
  telefono: string;
  password: string; // mínimo 8 caracteres
}

/** POST /users/register — 201 { user, token }. 409 si el email ya existe. */
export function register(datos: RegisterInput): Promise<AuthResponse> {
  return fetch(`${API_URL}/users/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  }).then((r) => parse<AuthResponse>(r));
}

/** GET /stores/mias — locales del usuario logueado. */
export function getMisLocales(token: string): Promise<Store[]> {
  return fetch(`${API_URL}/stores/mias`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => parse<Store[]>(r));
}

export interface UpdateStoreInput {
  nombre?: string;
  categoria?: string;
  /** uri local elegida con expo-image-picker */
  imagenUri?: string | null;
}

/** PUT /stores/:id — multipart/form-data, campos opcionales. */
export function updateStore(
  token: string,
  id: number,
  { nombre, categoria, imagenUri }: UpdateStoreInput,
): Promise<Store> {
  const form = new FormData();
  if (nombre) form.append("nombre", nombre);
  if (categoria) form.append("categoria", categoria);
  if (imagenUri) {
    // Formato React Native: objeto { uri, name, type } (distinto al web)
    form.append("portada", {
      uri: imagenUri,
      name: "portada.jpg",
      type: "image/jpeg",
    } as unknown as Blob);
  }
  return fetch(`${API_URL}/stores/${id}`, {
    method: "PUT",
    // OJO: NO poner Content-Type — fetch arma el boundary del multipart solo.
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  }).then((r) => parse<Store>(r));
}

/** Arma la URL completa de una portada, o null si no hay. */
export function portadaUri(portadaUrl: string | null): string | null {
  if (!portadaUrl) return null;
  // Si ya es absoluta (http/https) se usa tal cual; si es relativa
  // ("/uploads/img-123.jpg") se le antepone la URL del API.
  if (/^https?:\/\//i.test(portadaUrl)) return portadaUrl;
  return `${API_URL}${portadaUrl}`;
}
