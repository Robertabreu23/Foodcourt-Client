/** Paleta FoodCourt (tomada del diseño HTML). */
export const colors = {
  fc: "#FF5A36", // coral de marca
  fcSoft: "#FFE7DF",
  fcDeep: "#E8431F",
  ink: "#241B19",
  muted: "#7C6F69",
  faint: "#AFA39D",
  bg: "#FAF9F5", // fondo crema
  paper: "#FFF6F1",
  surface: "#FFFFFF",
  line: "#F0E6DF",
  mango: "#FFB121",
  leaf: "#1EA866",
};

/** Oscurece un color hex (#RRGGBB) para armar degradados tipo diseño. */
export function darken(hex: string, amount = 0.35): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return hex;
  const n = parseInt(clean, 16);
  const f = (c: number) => Math.max(0, Math.round(c * (1 - amount)));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** Iniciales del local para la portada sin foto ("Forno Rosso" → "FR"). */
export function initials(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}
