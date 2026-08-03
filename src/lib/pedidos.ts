import { Ionicons } from "@expo/vector-icons";

import { colors } from "@/theme";
import { ESTADOS_EN_CURSO, type EstadoPedido, type MetodoPago, type Order } from "@/types";

/**
 * Cómo se ve cada estado de un pedido. Está aquí y no en cada pantalla para
 * que el seguimiento, la lista y el panel del comercio no se contradigan.
 */

export interface PintaEstado {
  /** para el cliente */
  etiqueta: string;
  /** frase que acompaña en la pantalla de seguimiento */
  frase: string;
  icono: keyof typeof Ionicons.glyphMap;
  color: string;
  fondo: string;
}

export const PINTA_ESTADO: Record<EstadoPedido, PintaEstado> = {
  pendiente: {
    etiqueta: "Esperando al local",
    frase: "Le avisamos al local. En un momento confirman tu pedido.",
    icono: "hourglass-outline",
    color: "#B26A00",
    fondo: "#FFF3DC",
  },
  confirmado: {
    etiqueta: "Confirmado",
    frase: "¡El local aceptó tu pedido! Ya casi empiezan.",
    icono: "checkmark-circle-outline",
    color: "#0E7C86",
    fondo: "#DFF4F6",
  },
  preparando: {
    etiqueta: "En la cocina",
    frase: "Están cocinando lo tuyo. Huele bien desde aquí.",
    icono: "flame-outline",
    color: "#C2410C",
    fondo: "#FFE7DF",
  },
  en_camino: {
    etiqueta: "En camino",
    frase: "Tu pedido salió. Ve preparando el timbre.",
    icono: "bicycle-outline",
    color: "#1D4ED8",
    fondo: "#E0E9FF",
  },
  entregado: {
    etiqueta: "Entregado",
    frase: "¡Buen provecho! Gracias por pedir con Foodclub.",
    icono: "checkmark-done-outline",
    color: "#177449",
    fondo: "#E9F6EF",
  },
  cancelado: {
    etiqueta: "Cancelado",
    frase: "Este pedido se canceló.",
    icono: "close-circle-outline",
    color: "#7C6F69",
    fondo: "#F1ECE8",
  },
  rechazado: {
    etiqueta: "Rechazado",
    frase: "El local no pudo tomar este pedido.",
    icono: "alert-circle-outline",
    color: "#B3261E",
    fondo: "#FCE8E6",
  },
};

/** Los tres estados finales ya no se mueven. */
export function esFinal(estado: EstadoPedido): boolean {
  return estado === "entregado" || estado === "cancelado" || estado === "rechazado";
}

/** Un pedido "activo" es el que todavía está en curso. */
export function esActivo(estado: EstadoPedido): boolean {
  return !esFinal(estado);
}

/** Posición en la línea de tiempo; -1 si se salió del camino (cancelado). */
export function pasoDe(estado: EstadoPedido): number {
  return ESTADOS_EN_CURSO.indexOf(estado as (typeof ESTADOS_EN_CURSO)[number]);
}

/** El cliente solo puede cancelar antes de que empiecen a cocinar. */
export function clientePuedeCancelar(estado: EstadoPedido): boolean {
  return estado === "pendiente" || estado === "confirmado";
}

/** El siguiente estado al que el comercio puede avanzar, o null si no hay. */
export function siguienteEstado(estado: EstadoPedido): EstadoPedido | null {
  const i = pasoDe(estado);
  if (i < 0 || i >= ESTADOS_EN_CURSO.length - 1) return null;
  return ESTADOS_EN_CURSO[i + 1];
}

/** El verbo del botón del comercio: "Confirmar", "Empezar a preparar"… */
export const ACCION_COMERCIO: Record<string, string> = {
  confirmado: "Confirmar pedido",
  preparando: "Empezar a preparar",
  en_camino: "Marcar en camino",
  entregado: "Marcar entregado",
};

export const NOMBRE_PAGO: Record<MetodoPago, string> = {
  efectivo: "Efectivo",
  tarjeta_entrega: "Tarjeta al recibir",
};

export const ICONO_PAGO: Record<MetodoPago, keyof typeof Ionicons.glyphMap> = {
  efectivo: "cash-outline",
  tarjeta_entrega: "card-outline",
};

/** "hace 5 min", "hace 2 h", "ayer" — sin traer una librería de fechas. */
export function haceCuanto(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias === 1) return "ayer";
  return `hace ${dias} días`;
}

/** "25-40 min", o null si el local no lo tiene puesto. */
export function textoTiempo(pedido: Order): string | null {
  if (pedido.tiempoEstimadoMin == null || pedido.tiempoEstimadoMax == null) return null;
  return `${pedido.tiempoEstimadoMin}-${pedido.tiempoEstimadoMax} min`;
}

/** Resumen corto de las líneas: "2× Pizza Margarita · 1× Refresco". */
export function resumenItems(pedido: Order): string {
  return pedido.items.map((i) => `${i.cantidad}× ${i.nombre}`).join(" · ");
}

/** El color de acento del pedido: el de su estado, salvo que esté en curso. */
export function acentoDe(pedido: Order): string {
  return esFinal(pedido.estado) ? PINTA_ESTADO[pedido.estado].color : pedido.storeColorMarca || colors.fc;
}
