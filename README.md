# FoodCourt — Cliente (Expo + TypeScript)

Frontend de la app de delivery **FoodCourt** (RD). Consume el backend Node/Express
que corre en el puerto **3000**. No hay backend aquí: solo pantallas.

## Correr

```bash
npm install
npm start          # abre el menú de Expo (i = iOS, a = Android)
```

> El backend debe estar corriendo antes: `http://localhost:3000`.

## URL del API (importante)

Está centralizada en **`src/config.ts`**:

| Dónde pruebas              | URL que usa                         |
| -------------------------- | ----------------------------------- |
| iOS Simulator              | `http://localhost:3000` (automático)|
| Android Emulator           | `http://10.0.2.2:3000` (automático) |
| Celular físico con Expo Go | pon tu IP LAN en `LAN_IP` y `USE_LAN = true` |

Tu IP LAN: Mac → `ipconfig getifaddr en0` · Windows → `ipconfig` (IPv4).
El celular y la PC deben estar en la **misma red WiFi**.

## Pantallas

- **Inicio** (`src/app/(tabs)/index.tsx`): lista de locales (`GET /stores`) con
  portada (o color de marca + inicial si no hay foto), rating, envío, tiempo y
  badge Abierto/Cerrado. Pull-to-refresh, loading y reintentar.
- **Perfil** (`src/app/(tabs)/perfil.tsx`): flujo del dueño.
  - Sin sesión → login (`POST /users/login`), token guardado en SecureStore.
  - Con sesión → mis locales (`GET /stores/mias`), editar nombre/categoría y
    cambiar portada con ImagePicker (`PUT /stores/:id` multipart), cerrar sesión.
- **Buscar / Pedidos**: placeholders visuales del tab bar.

Cuenta de prueba: `owner@foodcourt.do` / `clave12345`

## Estructura

```
src/
  config.ts            # API_URL (único lugar a cambiar)
  types.ts             # Store, User, AuthResponse
  theme.ts             # paleta FoodCourt + helpers (darken, initials)
  lib/api.ts           # cliente del API tipado (fetch)
  lib/session.ts       # token en expo-secure-store
  components/store-cover.tsx
  app/
    _layout.tsx
    (tabs)/_layout.tsx # tabs: Inicio · Buscar · Pedidos · Perfil
    (tabs)/index.tsx   # Home
    (tabs)/perfil.tsx  # Login + Editar mi local
```
