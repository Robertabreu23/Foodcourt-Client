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
  portadaUrl: string | null; // ej. "/uploads/img-123.jpg" — anteponer API_URL
}

export interface User {
  id: number;
  nombre: string;
  email: string;
  telefono: string;
  rol: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}
