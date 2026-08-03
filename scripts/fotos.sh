#!/usr/bin/env bash
#
# fotos.sh — subir fotos de la carta sin pasar por la app
#
# Cargar imágenes desde un emulador es incómodo, así que esto hace lo mismo
# que la pantalla de editar plato, pero desde tu computadora: le manda el
# archivo al backend por multipart/form-data, exactamente igual que la app.
#
#   ./scripts/fotos.sh listar
#   ./scripts/fotos.sh subir 1 ~/Downloads/pizza.jpg
#   ./scripts/fotos.sh quitar 1
#   ./scripts/fotos.sh portada 1 ~/Downloads/local.jpg
#
# Correo, clave y URL se cambian con variables de entorno:
#   EMAIL=otro@correo.do PASS=suclave ./scripts/fotos.sh listar
#
# Escrito para el bash 3.2 que trae macOS y Python 3.9 — sin f-strings ni
# expansiones modernas, para que corra tal cual sin instalar nada.
#
set -eu

API="${API:-http://localhost:3000}"
EMAIL="${EMAIL:-owner@foodcourt.do}"
PASS="${PASS:-clave12345}"

rojo() { printf '\033[31m%s\033[0m\n' "$*"; }
gris() { printf '\033[90m%s\033[0m\n' "$*"; }

login() {
  respuesta=$(curl -s -X POST "$API/users/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")
  token=$(printf '%s' "$respuesta" | python3 -c \
    'import sys,json; print(json.load(sys.stdin).get("token",""))' 2>/dev/null || true)
  if [ -z "$token" ]; then
    rojo "No se pudo iniciar sesión como $EMAIL"
    gris "$respuesta"
    exit 1
  fi
  printf '%s' "$token"
}

comprobar_servidor() {
  if ! curl -s -m 5 "$API/health" >/dev/null; then
    rojo "No hay nadie en $API"
    gris "Levanta el backend, o apunta a otro:  API=http://otra-url ./scripts/fotos.sh ..."
    exit 1
  fi
}

# El archivo existe, parece imagen y no pasa de los 4 MB que acepta el backend.
revisar_imagen() {
  ruta="$1"
  if [ ! -f "$ruta" ]; then
    rojo "No existe el archivo: $ruta"
    exit 1
  fi
  minusculas=$(printf '%s' "$ruta" | tr '[:upper:]' '[:lower:]')
  case "$minusculas" in
    *.jpg|*.jpeg|*.png|*.gif|*.webp|*.heic) ;;
    *) rojo "Eso no parece una imagen: $ruta"; exit 1 ;;
  esac
  bytes=$(wc -c < "$ruta" | tr -d ' ')
  if [ "$bytes" -gt 4194304 ]; then
    rojo "La imagen pesa $(($bytes / 1048576)) MB y el máximo son 4 MB."
    gris "Hazla más chica:  sips -Z 1400 \"$ruta\" --out chica.jpg"
    exit 1
  fi
}

# Imprime el resultado de un plato o un local ya guardado.
mostrar_resultado() {
  campo="$1"
  python3 -c '
import sys, json
campo = sys.argv[1]
try:
    d = json.load(sys.stdin)
except Exception:
    print("\033[31m- respuesta inesperada del servidor\033[0m")
    raise SystemExit(1)
if campo in d:
    url = d[campo]
    print("\033[32m- " + str(d.get("nombre", "")) + "\033[0m")
    print("  " + ("(sin foto)" if url is None else str(url)))
else:
    print("\033[31m- " + str(d.get("mensaje", d)) + "\033[0m")
    raise SystemExit(1)
' "$campo"
}

cmd_listar() {
  comprobar_servidor
  token=$(login)
  curl -s "$API/stores/mias" -H "Authorization: Bearer $token" | python3 -c '
import sys, json, urllib.request

api = sys.argv[1]
locales = json.load(sys.stdin)
if not locales:
    print("Esta cuenta no tiene locales.")
    raise SystemExit

for local in locales:
    portada = "con portada" if local.get("portadaUrl") else "SIN portada"
    print("")
    print("\033[1mLOCAL %s - %s\033[0m  (%s)" % (local["id"], local["nombre"], portada))
    try:
        with urllib.request.urlopen("%s/stores/%s/menu" % (api, local["id"])) as r:
            menu = json.load(r)
    except Exception as e:
        print("  no se pudo leer la carta: %s" % e)
        continue
    for cat in menu["categorias"]:
        print("  %s" % cat["nombre"])
        for item in cat["items"]:
            marca = "\033[32mSI\033[0m" if item["imagenUrl"] else "\033[90m--\033[0m"
            agotado = "" if item["disponible"] else "  \033[90m(agotado)\033[0m"
            print("    [%s] id=%-4s %s%s" % (marca, item["id"], item["nombre"], agotado))

print("")
print("\033[90mSI = ya tiene foto    -- = sin foto\033[0m")
print("\033[90mSubir:  ./scripts/fotos.sh subir <id> <archivo>\033[0m")
' "$API"
}

cmd_subir() {
  comprobar_servidor
  revisar_imagen "$2"
  token=$(login)
  curl -s -X PUT "$API/menu-items/$1" \
    -H "Authorization: Bearer $token" \
    -F "imagen=@$2" \
    | mostrar_resultado imagenUrl
}

cmd_quitar() {
  comprobar_servidor
  token=$(login)
  curl -s -X PUT "$API/menu-items/$1" \
    -H "Authorization: Bearer $token" \
    -H 'Content-Type: application/json' \
    -d '{"quitarImagen":true}' \
    | mostrar_resultado imagenUrl
}

cmd_portada() {
  comprobar_servidor
  revisar_imagen "$2"
  token=$(login)
  # Ojo: aquí el campo se llama `portada`, no `imagen`.
  curl -s -X PUT "$API/stores/$1" \
    -H "Authorization: Bearer $token" \
    -F "portada=@$2" \
    | mostrar_resultado portadaUrl
}

ayuda() {
  cat <<'FIN'
fotos.sh - fotos de la carta sin pasar por la app

  listar                       Los platos con su id y cuáles ya tienen foto
  subir   <itemId> <archivo>   Pone (o reemplaza) la foto de un plato
  quitar  <itemId>             Deja el plato sin foto
  portada <storeId> <archivo>  Cambia la portada de un local

Ejemplos:
  ./scripts/fotos.sh listar
  ./scripts/fotos.sh subir 1 ~/Downloads/margarita.jpg
  ./scripts/fotos.sh portada 1 ~/Downloads/fachada.jpg

Variables: API, EMAIL, PASS
  EMAIL=otro@correo.do PASS=xxx ./scripts/fotos.sh listar

Las fotos van a Supabase, así que se ven enseguida en la app: desliza hacia
abajo en Inicio, o vuelve a entrar a la carta.
FIN
}

case "${1:-}" in
  listar)  cmd_listar ;;
  subir)   [ $# -eq 3 ] || { ayuda; exit 1; }; cmd_subir "$2" "$3" ;;
  quitar)  [ $# -eq 2 ] || { ayuda; exit 1; }; cmd_quitar "$2" ;;
  portada) [ $# -eq 3 ] || { ayuda; exit 1; }; cmd_portada "$2" "$3" ;;
  *)       ayuda ;;
esac
