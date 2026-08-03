# Foodclub — Cliente (Expo + TypeScript)

Frontend de la app de delivery **Foodclub** (RD). Consume el backend Node/Express
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

### Cliente

- **Inicio** (`src/app/(tabs)/index.tsx`): lista de locales (`GET /stores`) con
  portada (o color de marca + inicial si no hay foto), rating, envío, tiempo y
  badge Abierto/Cerrado. Pull-to-refresh, loading y reintentar. Tocar una
  tarjeta abre la carta; en la cabecera hay el acceso al carrito con su badge.
- **Carta del local** (`src/app/store/[id].tsx`): `GET /stores/:id/menu` en una
  sola llamada. Secciones ordenadas por `orden`, chips para saltar entre ellas,
  y los platos agotados se ven en gris y no se abren. El color y la portada
  llegan por params desde Inicio, porque ese endpoint no los devuelve.
- **Detalle del plato** (`src/app/item/[id].tsx`): `GET /menu-items/:id` con sus
  grupos de opciones. `maxSel === 1` se pinta como botones redondos y `maxSel > 1`
  como casillas que se apagan al llegar al tope. Los grupos obligatorios bloquean
  el botón hasta cumplir `minSel`, y el precio se calcula como el backend:
  `(precioBase + Σ precioDelta) × cantidad`.
- **Carrito** (`src/app/carrito.tsx`): vive en memoria (`src/lib/cart-context.tsx`)
  porque `POST /orders` todavía no existe. Un carrito = un local: si agregas de
  otro, pregunta antes de vaciar. Cada línea guarda `itemId` + `opcionesElegidas`,
  que es justo lo que pedirá el endpoint de pedidos cuando exista.
- **Buscar** (`src/app/(tabs)/buscar.tsx`): filtra locales y platos en el cliente
  (sin tildes y sin mayúsculas), porque `GET /stores?search=` aún no existe. Las
  cartas se piden una sola vez, al empezar a escribir.
- **Confirmar pedido** (`src/app/checkout.tsx`): dirección, método de pago
  (efectivo con vuelto o tarjeta al recibir) y notas. Antes de dejar confirmar
  llama a `POST /orders/validar`: si el local cerró, algo se agotó o cambió un
  precio mientras el usuario decidía, lo muestra ahí mismo en vez de fallar al
  final. Los totales que se ven son los del servidor.
- **Seguimiento** (`src/app/pedido/[id].tsx`): línea de tiempo de los cinco
  estados, con el icono del estado latiendo mientras el pedido siga vivo. Se
  refresca solo cada 3 s (corto a propósito: con el modo demo del backend el
  pedido se entrega en 20 s) y el temporizador se apaga al llegar a un final.
  Muestra el repartidor con botón de llamar, y deja cancelar solo mientras se
  pueda. Si quien mira es el dueño del local, aparecen los botones para avanzar.
- **Mis pedidos** (`src/app/(tabs)/pedidos.tsx`): en curso e historial, con el
  estado en color y refresco de fondo mientras haya algo activo.
- **Mis direcciones** (`src/app/direcciones.tsx`): CRUD con etiquetas rápidas
  (Casa/Trabajo) y la regla de la principal — no se puede desmarcar, se cambia
  marcando otra.
- **Contraseñas**: cambiarla desde Perfil (pidiendo la actual) y el flujo de
  "olvidé la mía" desde el login. `src/app/restablecer.tsx` recibe el enlace del
  correo (`?token=…`) y está fuera del guard de sesión, porque justamente se abre
  cuando el usuario no puede entrar.

### Dueño

- **Perfil** (`src/app/(tabs)/perfil.tsx`): login/registro con el token en
  SecureStore; mis locales (`GET /stores/mias`), editar nombre/categoría y
  portada (`PUT /stores/:id` multipart) y entrada a la carta.
- **Pedidos del local** (`src/app/gestion/pedidos/[storeId].tsx`): la cola de la
  cocina. Filtros por estado, contador de nuevos, y cada tarjeta avanza el
  pedido sin salir de la lista ("Confirmar" → "Empezar a preparar" → …). Se
  refresca sola cada 10 s, así que los pedidos entran sin recargar.
- **Mi carta** (`src/app/gestion/[storeId].tsx`): secciones (crear, renombrar,
  reordenar, borrar) y sus platos, con un switch para marcar agotado al vuelo.
  El 409 al borrar una sección con platos se muestra tal cual lo manda el API.
- **Editar plato** (`src/app/gestion/plato.tsx`): crear y editar, con foto
  (`expo-image-picker` → multipart), mover de sección, y los grupos de opciones
  con sus opciones. Valida `minSel ≤ maxSel`, `maxSel ≥ 1` y `esRequerido → minSel ≥ 1`
  antes de llamar al API. Si el plato ya salió en pedidos, el 409 ofrece
  marcarlo agotado en vez de borrarlo.

Cuenta de prueba: `owner@foodcourt.do` / `clave12345`

## Estructura

```
src/
  config.ts            # API_URL (único lugar a cambiar)
  types.ts             # Store, User, y la carta (MenuItem, OptionGroup, …)
  theme.ts             # paleta Foodclub + helpers (darken, initials)
  lib/api.ts           # cliente del API tipado (fetch)
  lib/session.ts       # token en expo-secure-store
  lib/auth-context.tsx # sesión
  lib/cart-context.tsx # carrito (en memoria)
  components/store-cover.tsx
  components/cart-bar.tsx
  app/
    _layout.tsx
    (tabs)/_layout.tsx    # tabs: Inicio · Buscar · Pedidos · Perfil
    (tabs)/index.tsx      # Home
    (tabs)/buscar.tsx     # Buscar
    (tabs)/perfil.tsx     # Panel del dueño
    store/[id].tsx        # la carta
    item/[id].tsx         # detalle del plato
    carrito.tsx
    gestion/[storeId].tsx # gestión de la carta
    gestion/plato.tsx     # crear/editar plato + opciones
```

## Fotos sin pasar por el emulador

Cargar imágenes a un emulador es incómodo, así que hay un script que hace lo
mismo que la pantalla de editar plato, pero desde tu computadora:

```bash
./scripts/fotos.sh listar                          # los platos con su id
./scripts/fotos.sh subir 1 ~/Downloads/pizza.jpg   # foto de un plato
./scripts/fotos.sh quitar 1                        # dejarlo sin foto
./scripts/fotos.sh portada 1 ~/Downloads/local.jpg # portada del local
```

Usa la cuenta demo por defecto; con otra: `EMAIL=… PASS=… ./scripts/fotos.sh …`

## Imágenes

Las URLs vienen **completas** desde Supabase Storage, así que se usan tal cual.
`imagenUri()` en `src/lib/api.ts` sigue aceptando rutas relativas (`/uploads/…`)
por si se prueba contra un servidor viejo, pero ya no hace falta prefijar nada.

## Lo que falta (bloqueado por el backend)

Reseñas, favoritos, horarios, búsqueda server-side (`GET /stores?search=`),
`GET /users/me`, cupones y push. El buscador filtra en el cliente mientras tanto.
