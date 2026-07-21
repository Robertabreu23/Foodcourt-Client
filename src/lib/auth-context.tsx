import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { clearSession, getToken, getUser, saveSession } from "@/lib/session";
import type { User } from "@/types";

interface AuthContextValue {
  /** null = sin sesión */
  token: string | null;
  user: User | null;
  /** true mientras se lee SecureStore al arrancar */
  cargando: boolean;
  iniciarSesion: (token: string, user: User) => Promise<void>;
  cerrarSesion: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [cargando, setCargando] = useState(true);

  // Al arrancar, restaurar la sesión guardada (si hay).
  useEffect(() => {
    (async () => {
      try {
        const [t, u] = await Promise.all([getToken(), getUser()]);
        setToken(t);
        setUser(u);
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  const iniciarSesion = useCallback(async (t: string, u: User) => {
    await saveSession(t, u);
    setToken(t);
    setUser(u);
  }, []);

  const cerrarSesion = useCallback(async () => {
    await clearSession();
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ token, user, cargando, iniciarSesion, cerrarSesion }),
    [token, user, cargando, iniciarSesion, cerrarSesion],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
