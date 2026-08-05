/** Un local (Store) tal como lo devuelve el API. */
export interface Store {
  id: number;
  ownerUserId: number;
  nombre: string;
  categoria: string | null;
  estadoVerificacion: "pendiente" | "aprobado" | "rechazado";
  estadoOperacion: "abierto" | "cerrado";
  ratingPromedio: number;
  envioBase: number;
  tiempoEstimadoMin: number | null;
  tiempoEstimadoMax: number | null;
  colorMarca: string; // ej. "#C0392B" — fondo cuando no hay portada
  portadaUrl: string | null; // URL completa de Supabase, o null
  telefono?: string | null;
  direccion?: string | null;
}

export type Rol = "cliente" | "comercio" | "repartidor" | "admin";

export interface User {
  id: number;
  nombre: string;
  email: string;
  telefono: string;
  /**
   * OJO: el rol del token se queda viejo. El JWT dura 7 días, así que después
   * de pagar el plan sigue diciendo `cliente`. Para decidir qué mostrar usa
   * `GET /suscripcion` (ver `Suscripcion.alDia`), que lee la base de datos.
   */
  rol: Rol | string;
}

/* ================= PLAN DE COMERCIOS ================= */

export type EstadoSuscripcion =
  | "sin_suscripcion"
  | "pendiente"
  | "activa"
  | "vencida"
  | "cancelada";

/** GET /suscripcion — la fuente de verdad sobre si puede publicar locales. */
export interface Suscripcion {
  estado: EstadoSuscripcion;
  /** lo único que de verdad importa: paga y no ha vencido */
  alDia: boolean;
  maxLocales: number;
  localesUsados: number;
  puedeCrearOtro: boolean;
  /** ISO, o null si nunca ha pagado */
  periodoFin: string | null;
}

export interface AuthResponse {
  user: User;
  token: string;
}

/* ================= LA CARTA ================= */

/** Una sección de la carta ("Pizzas", "Postres"). */
export interface MenuCategory {
  id: number;
  storeId: number;
  nombre: string;
  orden: number; // menor número = más arriba
}

/** Un plato. Los grupos de opciones solo vienen en GET /menu-items/:id. */
export interface MenuItem {
  id: number;
  storeId: number;
  categoryId: number;
  nombre: string;
  descripcion: string | null;
  precioBase: number;
  imagenUrl: string | null; // relativa — anteponer API_URL
  disponible: boolean; // false = agotado
  esVegetariano: boolean;
}

/** Una opción dentro de un grupo. `precioDelta` puede ser negativo. */
export interface MenuOption {
  id: number;
  nombre: string;
  precioDelta: number;
}

/**
 * Grupo de opciones de un plato.
 * `maxSel === 1` → radios · `maxSel > 1` → checkboxes con tope.
 */
export interface OptionGroup {
  id: number;
  nombre: string;
  esRequerido: boolean;
  minSel: number;
  maxSel: number;
  opciones: MenuOption[];
}

/** GET /menu-items/:itemId — el plato con sus grupos de opciones. */
export interface MenuItemDetail extends MenuItem {
  grupos: OptionGroup[];
}

/** Una sección de la carta con sus platos dentro. */
export interface MenuCategoryConItems extends MenuCategory {
  items: MenuItem[];
}

/** GET /stores/:storeId/menu — cabecera del local + carta completa. */
export interface StoreMenu {
  id: number;
  nombre: string;
  categoria: string | null;
  estadoOperacion: "abierto" | "cerrado";
  envioBase: number;
  categorias: MenuCategoryConItems[];
}

/* ================= DIRECCIONES ================= */

export interface Address {
  id: number;
  userId: number;
  etiqueta: string | null; // "Casa", "Trabajo"
  calle: string;
  referencia: string | null;
  sector: string;
  ciudad: string | null;
  lat: number | null;
  lng: number | null;
  esPrincipal: boolean;
}

/* ================= PEDIDOS ================= */

/**
 * Los tres finales (`entregado`, `cancelado`, `rechazado`) ya no se mueven.
 * El orden de este array es el del avance: sirve para pintar la línea de tiempo.
 */
export const ESTADOS_EN_CURSO = [
  "pendiente",
  "confirmado",
  "preparando",
  "en_camino",
  "entregado",
] as const;

export type EstadoPedido =
  | (typeof ESTADOS_EN_CURSO)[number]
  | "cancelado"
  | "rechazado";

export type MetodoPago = "efectivo" | "tarjeta_entrega";

/** Una opción congelada dentro de una línea del pedido. */
export interface OrderItemOption {
  optionId: number | null;
  nombre: string;
  precioDelta: number;
}

/**
 * Una línea del pedido. `nombre`, `precioUnitario` y `opciones` son **copias**
 * del momento en que se pidió: si el dueño cambia la carta, esto no se mueve.
 */
export interface OrderItem {
  id: number;
  menuItemId: number | null; // null si el plato se borró después
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  imagenUrl: string | null;
  opciones: OrderItemOption[];
}

export interface Order {
  id: number;
  codigo: string; // "FC-H5BOEO" — el que se le dice al repartidor
  userId: number;
  storeId: number;
  storeNombre: string;
  storeColorMarca: string;
  storeOwnerUserId: number;
  estado: EstadoPedido;
  subtotal: number;
  envio: number;
  total: number;
  metodoPago: MetodoPago;
  pagaCon: number | null;
  notas: string | null;
  motivo: string | null; // por qué se rechazó o canceló
  addressId: number | null;
  direccionTexto: string; // copia congelada
  tiempoEstimadoMin: number | null;
  tiempoEstimadoMax: number | null;
  clienteNombre: string;
  clienteTelefono: string;
  repartidorNombre: string | null; // se llenan al pasar a "en_camino"
  repartidorTelefono: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

/** Lo que se manda por cada plato al crear o validar un pedido. */
export interface NuevaLineaPedido {
  itemId: number;
  cantidad: number;
  /** ids de opción (los `id` de grupos[].opciones[]) */
  opciones: number[];
  /** solo en /orders/validar: el precio que la app le mostró al usuario */
  precioUnitario?: number;
}

export type TipoProblema =
  | "local_no_existe"
  | "local_cerrado"
  | "direccion_invalida"
  | "sin_items"
  | "no_existe"
  | "agotado"
  | "opciones_invalidas"
  | "cantidad_invalida"
  | "precio_cambio";

export interface ProblemaPedido {
  tipo: TipoProblema;
  itemId?: number;
  mensaje: string; // ya redactado para el usuario
  precioNuevo?: number;
}

/** POST /orders/validar — repasa el carrito sin crear nada. */
export interface ValidacionPedido {
  ok: boolean;
  storeAbierto: boolean;
  subtotal: number;
  envio: number;
  total: number;
  problemas: ProblemaPedido[];
}
