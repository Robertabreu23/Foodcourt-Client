import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { MenuOption } from "@/types";

/**
 * CARRITO LOCAL
 *
 * El backend todavía no tiene `POST /orders` ni `/cart`, así que el carrito
 * vive en memoria (se pierde si cierras la app — no hay AsyncStorage en el
 * proyecto y SecureStore no está pensado para guardar listas).
 *
 * Cada línea guarda ya calculado lo que hace falta para pintar el carrito,
 * pero también `itemId` + `opcionesElegidas`, que es exactamente lo que
 * pedirá `POST /orders` cuando exista.
 */

export interface LineaCarrito {
  /** identifica la línea: mismo plato con distintas opciones = líneas distintas */
  clave: string;
  itemId: number;
  cantidad: number;
  /** las opciones marcadas (guardamos nombre y delta para poder mostrarlas) */
  opcionesElegidas: MenuOption[];
  // --- datos para pintar, copiados al agregar ---
  nombre: string;
  imagenUrl: string | null;
  precioBase: number;
  /** precioBase + suma de los deltas — el precio de UNA unidad */
  precioUnitario: number;
}

/** Lo que hace falta para agregar un plato (la clave se calcula sola). */
export type NuevaLinea = Omit<LineaCarrito, "clave" | "precioUnitario">;

interface CartContextValue {
  /** el local del carrito, o null si está vacío */
  storeId: number | null;
  storeNombre: string | null;
  envioBase: number;
  lineas: LineaCarrito[];
  /** total de unidades — para el badge del tab */
  cantidadTotal: number;
  subtotal: number;
  total: number;
  /**
   * Agrega un plato. Si el carrito tiene platos de OTRO local devuelve
   * `{ ok: false, localActual }` sin tocar nada: pregúntale al usuario y
   * vuelve a llamar con `reemplazar: true`.
   */
  agregar: (
    local: { storeId: number; storeNombre: string; envioBase: number },
    linea: NuevaLinea,
    opciones?: { reemplazar?: boolean },
  ) => { ok: true } | { ok: false; localActual: string };
  cambiarCantidad: (clave: string, cantidad: number) => void;
  quitar: (clave: string) => void;
  vaciar: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

/** Precio de una unidad: base + deltas (que pueden ser negativos). */
export function precioUnitarioDe(precioBase: number, opciones: MenuOption[]): number {
  return precioBase + opciones.reduce((suma, o) => suma + o.precioDelta, 0);
}

/** Mismo plato + mismas opciones = misma línea (se suman las cantidades). */
function claveDeLinea(itemId: number, opciones: MenuOption[]): string {
  const ids = opciones.map((o) => o.id).sort((a, b) => a - b);
  return `${itemId}:${ids.join(",")}`;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lineas, setLineas] = useState<LineaCarrito[]>([]);
  const [local, setLocal] = useState<{
    storeId: number;
    storeNombre: string;
    envioBase: number;
  } | null>(null);

  const agregar = useCallback<CartContextValue["agregar"]>(
    (nuevoLocal, linea, opciones) => {
      // Un carrito = un local (el envío y el pedido son de un solo comercio).
      // Ojo: si el carrito está vacío no hay conflicto aunque quede el local
      // anterior guardado — solo choca cuando de verdad hay platos dentro.
      const hayOtroLocal =
        lineas.length > 0 && !!local && local.storeId !== nuevoLocal.storeId;
      if (hayOtroLocal && !opciones?.reemplazar) {
        return { ok: false, localActual: local!.storeNombre };
      }
      const empezarDeCero = hayOtroLocal;
      const clave = claveDeLinea(linea.itemId, linea.opcionesElegidas);
      const completa: LineaCarrito = {
        ...linea,
        clave,
        precioUnitario: precioUnitarioDe(linea.precioBase, linea.opcionesElegidas),
      };

      setLocal(nuevoLocal);
      setLineas((previas) => {
        const base = empezarDeCero ? [] : previas;
        const yaEsta = base.find((l) => l.clave === clave);
        if (!yaEsta) return [...base, completa];
        return base.map((l) =>
          l.clave === clave ? { ...l, cantidad: l.cantidad + linea.cantidad } : l,
        );
      });
      return { ok: true };
    },
    [local, lineas.length],
  );

  const cambiarCantidad = useCallback((clave: string, cantidad: number) => {
    setLineas((previas) =>
      cantidad <= 0
        ? previas.filter((l) => l.clave !== clave)
        : previas.map((l) => (l.clave === clave ? { ...l, cantidad } : l)),
    );
  }, []);

  // Al quitar el último plato, el carrito deja de tener local.
  useEffect(() => {
    if (lineas.length === 0) setLocal(null);
  }, [lineas.length]);

  const quitar = useCallback(
    (clave: string) => cambiarCantidad(clave, 0),
    [cambiarCantidad],
  );

  const vaciar = useCallback(() => {
    setLineas([]);
    setLocal(null);
  }, []);

  const value = useMemo<CartContextValue>(() => {
    const subtotal = lineas.reduce((s, l) => s + l.precioUnitario * l.cantidad, 0);
    const envioBase = lineas.length > 0 ? (local?.envioBase ?? 0) : 0;
    return {
      storeId: local?.storeId ?? null,
      storeNombre: local?.storeNombre ?? null,
      envioBase,
      lineas,
      cantidadTotal: lineas.reduce((s, l) => s + l.cantidad, 0),
      subtotal,
      total: subtotal + envioBase,
      agregar,
      cambiarCantidad,
      quitar,
      vaciar,
    };
  }, [lineas, local, agregar, cambiarCantidad, quitar, vaciar]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart debe usarse dentro de <CartProvider>");
  return ctx;
}
