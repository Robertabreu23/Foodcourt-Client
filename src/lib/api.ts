import { API_URL } from "@/config";
import type {
  Address,
  AuthResponse,
  EstadoPedido,
  MenuCategory,
  MenuItem,
  MenuItemDetail,
  MenuOption,
  MetodoPago,
  NuevaLineaPedido,
  OptionGroup,
  Order,
  Store,
  StoreMenu,
  ValidacionPedido,
} from "@/types";

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

/**
 * Petición JSON con token opcional. Los 204 (borrados) no traen cuerpo,
 * así que ni se intenta leerlos.
 */
async function pedir<T>(
  ruta: string,
  { metodo = "GET", body, token }: { metodo?: string; body?: unknown; token?: string } = {},
): Promise<T> {
  const res = await fetch(`${API_URL}${ruta}`, {
    method: metodo,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  return parse<T>(res);
}

/** Igual que `pedir` pero con multipart (para los endpoints que suben foto). */
async function pedirForm<T>(
  ruta: string,
  { metodo, form, token }: { metodo: string; form: FormData; token: string },
): Promise<T> {
  const res = await fetch(`${API_URL}${ruta}`, {
    method: metodo,
    // OJO: NO poner Content-Type — fetch arma el boundary del multipart solo.
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  return parse<T>(res);
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
  /** deja el local sin portada — ver §4.6 de BACKEND.md */
  quitarPortada?: boolean;
}

/** PUT /stores/:id — multipart/form-data, campos opcionales. */
export function updateStore(
  token: string,
  id: number,
  { nombre, categoria, imagenUri, quitarPortada }: UpdateStoreInput,
): Promise<Store> {
  const form = new FormData();
  if (nombre) form.append("nombre", nombre);
  if (categoria) form.append("categoria", categoria);
  // Si además viene una foto nueva, manda el archivo: reemplazar gana sobre quitar.
  if (quitarPortada && !imagenUri) form.append("quitarPortada", "true");
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

/* ================= LA CARTA (público) ================= */

/** GET /stores/:storeId/menu — cabecera del local + carta completa. 404 si no existe. */
export function getStoreMenu(storeId: number): Promise<StoreMenu> {
  return pedir<StoreMenu>(`/stores/${storeId}/menu`);
}

/** GET /menu-items/:itemId — el plato con sus grupos de opciones. */
export function getMenuItem(itemId: number): Promise<MenuItemDetail> {
  return pedir<MenuItemDetail>(`/menu-items/${itemId}`);
}

/* ================= CATEGORÍAS DE LA CARTA (dueño) ================= */

export function crearCategoria(
  token: string,
  storeId: number,
  datos: { nombre: string; orden?: number },
): Promise<MenuCategory> {
  return pedir<MenuCategory>(`/stores/${storeId}/menu-categories`, {
    metodo: "POST",
    body: datos,
    token,
  });
}

export function actualizarCategoria(
  token: string,
  storeId: number,
  categoryId: number,
  datos: { nombre?: string; orden?: number },
): Promise<MenuCategory> {
  return pedir<MenuCategory>(`/stores/${storeId}/menu-categories/${categoryId}`, {
    metodo: "PUT",
    body: datos,
    token,
  });
}

/** DELETE → 204. Da 409 (con mensaje listo para mostrar) si tiene platos dentro. */
export function borrarCategoria(
  token: string,
  storeId: number,
  categoryId: number,
): Promise<void> {
  return pedir<void>(`/stores/${storeId}/menu-categories/${categoryId}`, {
    metodo: "DELETE",
    token,
  });
}

/* ================= PLATOS (dueño) ================= */

export interface MenuItemInput {
  nombre?: string;
  descripcion?: string;
  precioBase?: number;
  categoryId?: number;
  disponible?: boolean;
  esVegetariano?: boolean;
  /** uri local elegida con expo-image-picker; si no se manda, la foto actual se conserva */
  imagenUri?: string | null;
  /** deja el plato sin foto — ver §4.6 de BACKEND.md */
  quitarImagen?: boolean;
}

/** Los campos del plato como los espera un multipart (todo va en texto). */
function formDePlato(datos: MenuItemInput): FormData {
  const form = new FormData();
  if (datos.categoryId !== undefined) form.append("categoryId", String(datos.categoryId));
  if (datos.nombre !== undefined) form.append("nombre", datos.nombre);
  if (datos.descripcion !== undefined) form.append("descripcion", datos.descripcion);
  if (datos.precioBase !== undefined) form.append("precioBase", String(datos.precioBase));
  if (datos.disponible !== undefined) form.append("disponible", String(datos.disponible));
  if (datos.esVegetariano !== undefined) form.append("esVegetariano", String(datos.esVegetariano));
  // Si además viene una foto nueva, manda el archivo: reemplazar gana sobre quitar.
  if (datos.quitarImagen && !datos.imagenUri) form.append("quitarImagen", "true");
  if (datos.imagenUri) {
    // Formato React Native: objeto { uri, name, type } (distinto al web)
    form.append("imagen", {
      uri: datos.imagenUri,
      name: "plato.jpg",
      type: "image/jpeg",
    } as unknown as Blob);
  }
  return form;
}

/**
 * POST /menu-items — 201 con el plato creado.
 * Manda multipart si hay foto y JSON si no (el backend acepta las dos).
 */
export function crearPlato(
  token: string,
  datos: MenuItemInput & { categoryId: number; nombre: string; precioBase: number },
): Promise<MenuItem> {
  if (datos.imagenUri) {
    return pedirForm<MenuItem>("/menu-items", {
      metodo: "POST",
      form: formDePlato(datos),
      token,
    });
  }
  const { imagenUri: _sinFoto, ...json } = datos;
  return pedir<MenuItem>("/menu-items", { metodo: "POST", body: json, token });
}

/** PUT /menu-items/:itemId — todos los campos opcionales, manda solo lo que cambia. */
export function actualizarPlato(
  token: string,
  itemId: number,
  datos: MenuItemInput,
): Promise<MenuItem> {
  if (datos.imagenUri) {
    return pedirForm<MenuItem>(`/menu-items/${itemId}`, {
      metodo: "PUT",
      form: formDePlato(datos),
      token,
    });
  }
  const { imagenUri: _sinFoto, ...json } = datos;
  return pedir<MenuItem>(`/menu-items/${itemId}`, { metodo: "PUT", body: json, token });
}

/**
 * DELETE /menu-items/:itemId → 204.
 * 409 si el plato ya salió en pedidos: ahí toca marcarlo como no disponible.
 */
export function borrarPlato(token: string, itemId: number): Promise<void> {
  return pedir<void>(`/menu-items/${itemId}`, { metodo: "DELETE", token });
}

/* ================= GRUPOS DE OPCIONES Y OPCIONES (dueño) ================= */

export interface OptionGroupInput {
  nombre?: string;
  esRequerido?: boolean;
  minSel?: number;
  maxSel?: number;
}

export function crearGrupo(
  token: string,
  itemId: number,
  datos: OptionGroupInput & { nombre: string },
): Promise<OptionGroup> {
  return pedir<OptionGroup>(`/menu-items/${itemId}/option-groups`, {
    metodo: "POST",
    body: datos,
    token,
  });
}

export function actualizarGrupo(
  token: string,
  groupId: number,
  datos: OptionGroupInput,
): Promise<OptionGroup> {
  return pedir<OptionGroup>(`/option-groups/${groupId}`, { metodo: "PUT", body: datos, token });
}

/** DELETE → 204. Borra también las opciones del grupo. */
export function borrarGrupo(token: string, groupId: number): Promise<void> {
  return pedir<void>(`/option-groups/${groupId}`, { metodo: "DELETE", token });
}

export function crearOpcion(
  token: string,
  groupId: number,
  datos: { nombre: string; precioDelta?: number },
): Promise<MenuOption> {
  return pedir<MenuOption>(`/option-groups/${groupId}/options`, {
    metodo: "POST",
    body: datos,
    token,
  });
}

export function actualizarOpcion(
  token: string,
  groupId: number,
  optionId: number,
  datos: { nombre?: string; precioDelta?: number },
): Promise<MenuOption> {
  return pedir<MenuOption>(`/option-groups/${groupId}/options/${optionId}`, {
    metodo: "PUT",
    body: datos,
    token,
  });
}

export function borrarOpcion(token: string, groupId: number, optionId: number): Promise<void> {
  return pedir<void>(`/option-groups/${groupId}/options/${optionId}`, {
    metodo: "DELETE",
    token,
  });
}

/* ================= CONTRASEÑAS ================= */

/** PUT /users/me/password — pide la actual aunque ya haya sesión. */
export function cambiarPassword(
  token: string,
  passwordActual: string,
  passwordNueva: string,
): Promise<{ mensaje: string }> {
  return pedir<{ mensaje: string }>("/users/me/password", {
    metodo: "PUT",
    body: { passwordActual, passwordNueva },
    token,
  });
}

/**
 * POST /users/password/olvide — público.
 * Responde `200` SIEMPRE, exista o no el correo: si distinguiera, cualquiera
 * podría averiguar quién tiene cuenta probando emails. No intentes deducirlo.
 */
export function olvidePassword(email: string): Promise<{ mensaje: string }> {
  return pedir<{ mensaje: string }>("/users/password/olvide", {
    metodo: "POST",
    body: { email },
  });
}

/** POST /users/password/reset — con el token del enlace del correo. */
export function resetPassword(
  token: string,
  passwordNueva: string,
): Promise<{ mensaje: string }> {
  return pedir<{ mensaje: string }>("/users/password/reset", {
    metodo: "POST",
    body: { token, passwordNueva },
  });
}

/* ================= DIRECCIONES ================= */

export interface AddressInput {
  etiqueta?: string | null;
  calle?: string;
  referencia?: string | null;
  sector?: string;
  ciudad?: string | null;
  esPrincipal?: boolean;
}

/** GET /addresses — la principal viene primero. */
export function getDirecciones(token: string): Promise<Address[]> {
  return pedir<Address[]>("/addresses", { token });
}

export function crearDireccion(
  token: string,
  datos: AddressInput & { calle: string; sector: string },
): Promise<Address> {
  return pedir<Address>("/addresses", { metodo: "POST", body: datos, token });
}

export function actualizarDireccion(
  token: string,
  addressId: number,
  datos: AddressInput,
): Promise<Address> {
  return pedir<Address>(`/addresses/${addressId}`, { metodo: "PUT", body: datos, token });
}

export function borrarDireccion(token: string, addressId: number): Promise<void> {
  return pedir<void>(`/addresses/${addressId}`, { metodo: "DELETE", token });
}

/* ================= PEDIDOS ================= */

export interface NuevoPedido {
  storeId: number;
  addressId: number;
  metodoPago: MetodoPago;
  pagaCon?: number | null;
  notas?: string | null;
  items: NuevaLineaPedido[];
}

/**
 * POST /orders/validar — repasa el carrito SIN crear nada.
 * Devuelve `200` aunque haya problemas: mira `ok`, no el código HTTP.
 */
export function validarPedido(
  token: string,
  datos: Omit<NuevoPedido, "metodoPago" | "pagaCon" | "notas"> &
    Partial<Pick<NuevoPedido, "metodoPago">>,
): Promise<ValidacionPedido> {
  return pedir<ValidacionPedido>("/orders/validar", {
    metodo: "POST",
    body: datos,
    token,
  });
}

/** POST /orders — el backend calcula los precios; nunca se los mandamos. */
export function crearPedido(token: string, datos: NuevoPedido): Promise<Order> {
  return pedir<Order>("/orders", { metodo: "POST", body: datos, token });
}

/** GET /orders?estado=activos|historial */
export function getPedidos(
  token: string,
  estado?: "activos" | "historial",
  { limit = 20, offset = 0 }: { limit?: number; offset?: number } = {},
): Promise<Order[]> {
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (estado) query.set("estado", estado);
  return pedir<Order[]>(`/orders?${query}`, { token });
}

/** GET /orders/:id — lo ven el cliente que lo hizo y el dueño del local. */
export function getPedido(token: string, orderId: number): Promise<Order> {
  return pedir<Order>(`/orders/${orderId}`, { token });
}

/**
 * PATCH /orders/:id/estado — el backend deduce del pedido si eres cliente o
 * comercio, así que no hay que decírselo.
 */
export function cambiarEstadoPedido(
  token: string,
  orderId: number,
  estado: EstadoPedido,
  motivo?: string | null,
): Promise<Order> {
  return pedir<Order>(`/orders/${orderId}/estado`, {
    metodo: "PATCH",
    body: { estado, motivo: motivo ?? null },
    token,
  });
}

/** GET /stores/:storeId/orders — la cola del panel del comercio. */
export function getPedidosDelLocal(
  token: string,
  storeId: number,
  { estado, desde, limit = 50, offset = 0 }: {
    estado?: EstadoPedido;
    desde?: string;
    limit?: number;
    offset?: number;
  } = {},
): Promise<Order[]> {
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (estado) query.set("estado", estado);
  if (desde) query.set("desde", desde);
  return pedir<Order[]>(`/stores/${storeId}/orders?${query}`, { token });
}

/* ================= IMÁGENES ================= */

/**
 * URL lista para `<Image>`, o null si no hay imagen.
 *
 * Hoy el backend las manda **absolutas** (viven en Supabase Storage), así que
 * casi siempre esto devuelve la ruta tal cual. Se conserva el caso relativo
 * (`/uploads/...`) para no romper contra un servidor viejo o sembrado a mano.
 */
export function imagenUri(ruta: string | null): string | null {
  if (!ruta) return null;
  if (/^https?:\/\//i.test(ruta)) return ruta;
  return `${API_URL}${ruta}`;
}

/** Alias histórico de `imagenUri`, para las portadas de los locales. */
export const portadaUri = imagenUri;
