# Encorely — app móvil

Encuentra con quién ir al próximo concierto: calificas canciones, marcas a qué concierto vas, ves quién más va y escucha lo mismo que tú, y si los dos se interesan, chatean con cifrado de extremo a extremo.

App nativa Android/iOS con Expo SDK 57 (React Native 0.86, React 19.2, TypeScript estricto). El back es [`encorly_back`](../encorly_back) y el contrato entre ambos es `encorly_back/contracts/openapi.v1.json` (hoy en el **draft.17**). El detalle técnico (cifrado, sesión, motion) está en [ARCHITECTURE.md](ARCHITECTURE.md).

## Qué hace hoy

| Área | Qué puede hacer la persona |
|---|---|
| **Cuenta** | Registro con correo o con Spotify. Onboarding (datos y géneros), consentimiento de datos (Ley 1581) con aviso cuando cambia la versión, sesiones abiertas por dispositivo, descarga de sus datos y borrado de la cuenta |
| **Descubrir** | Califica canciones en un mazo con gesto y escucha la muestra de 30 s de Apple Music mientras decide. Las calificaciones arman su ADN musical |
| **Conciertos** | Lista por ciudad y detalle. Marca que va y ve **"Quién más va"** (radar): personas con "X % de gustos en común", redondeado de 5 en 5, con la razón al lado y la explicación de cómo se calcula |
| **Match** | "Me interesa" en el radar o en un perfil. Si es mutuo, hay match. Solo se ofrece cuando comparten un concierto vigente |
| **Chat cifrado** | Mensajes cifrados en el teléfono (X25519 + XChaCha20-Poly1305), historial local cifrado con SQLCipher, código de seguridad para verificar en persona (también por QR), respaldo cifrado con frase y traspaso a otro teléfono |
| **Perfil social** | Pestaña **Tú**: boleta con los géneros como stickers, tu música, tus artistas, tu temporada y "Así te ven" con las reacciones recibidas. El **perfil de otra persona** muestra "En común" y su música, y deja pegar reacciones (Yo también, Vamos a verlo, Pásame una). Hay una lista de quién reaccionó y un interruptor para ocultar el perfil |
| **Seguridad** | Bloquear y reportar desde el chat, desde un perfil o desde una reacción. El reporte del chat adjunta evidencia verificable (franking) sin revelar el resto de la conversación |
| **Spotify** | Entrar con Spotify, vincularlo e importar los artistas más escuchados |
| **Push** | Avisos de mensajes y matches sin contenido |
| **Panel admin** | Solo cuentas con rol admin, desde **Tú → Administración**: conciertos (crear, editar, publicar), catálogo de canciones (agregar desde iTunes con su muestra) y cola de reportes (resolver, descartar, suspender). Las listas se paginan con "Cargar más" |

## Arquitectura

```
App móvil (este repo)  ──HTTPS + JWT──▶  API .NET 10 (encorly_back)  ──▶  PostgreSQL 16
        ▲               ◀── WebSocket ──  (avisos del chat)
        └── tipos generados del contrato OpenAPI (pnpm gen:api)
Externos: iTunes (muestras y portadas) · Spotify (artistas) · Expo Push (avisos)
```

El código está en cuatro capas:

| Capa | Qué vive ahí | Regla |
|---|---|---|
| `src/app/` | Rutas de expo-router. Los grupos `(auth)`, `(onboarding)` y `(app)` se protegen con la sesión | Delgadas: importan la pantalla de su dominio |
| `src/features/<dominio>/` | Pantallas, componentes, hooks y lógica pura de cada dominio: `auth`, `onboarding`, `account`, `discover`, `events`, `match`, `chat`, `profile`, `social`, `safety`, `spotify`, `push`, `admin` y `dev` (solo en desarrollo) | Un dominio no edita archivos de otro: reutiliza por su `index.ts` |
| `src/ui/` | Design system "La boleta compartida": tokens, primitivas, stickers y motion 3D (solo transformaciones nativas, nunca WebGL) | Única fuente de colores, tipos y espacios |
| `src/lib/` | Cliente HTTP (timeout de 15 s, un solo refresh del token ante 401, errores en español), tipos del contrato, sesión, caché con TanStack Query y estado de la red | Sin UI salvo el aviso de red |

## Levantar en local (Android)

### 0. Requisitos

| Herramienta | Versión | Cómo |
|---|---|---|
| Node | 24 (`.node-version`) | `mise use node@24` |
| pnpm | 12 (`packageManager`) | `corepack enable` |
| JDK | 17 | `mise use java@temurin-17` |
| Android Studio | SDK 36 + un emulador (API 35) | `ANDROID_HOME` apuntando al SDK |

Usa **solo pnpm**: mezclarlo con npm o yarn rompe `node_modules`.

### 1. API local

Levanta el back con su README (rama `dev` de `encorly_back`): Postgres con docker compose y la API en el puerto 5000, con migraciones y seed automáticos. Comprueba que responde:

```bash
curl http://localhost:5000/health/live
```

### 2. Configurar la app

```bash
pnpm install
cp .env.example .env
```

`EXPO_PUBLIC_API_URL` en `.env`:

| Dónde corre la app | Valor |
|---|---|
| Emulador Android | `http://10.0.2.2:5000` (el `localhost` del PC visto desde el emulador) |
| Teléfono en la misma red | `http://<IP-del-PC>:5000` (esta también le sirve al emulador) |

La URL queda dentro del bundle, así que hay que reiniciar Metro si cambia. Si falta la variable, la app lo dice en pantalla en vez de colgarse.

### 3. Development build

La app usa módulos nativos (SQLCipher para el historial del chat, cámara, push, teclado), así que corre en un **development build**. **Expo Go no sirve**: la app se cierra al abrir.

```bash
pnpm android        # compila e instala el dev build en el emulador (la primera vez tarda)
pnpm start          # Metro para el dev build
```

**En un teléfono, sin cable:**
1. El APK de desarrollo (`android/app/build/outputs/apk/debug/app-debug.apk`) trae ARM y x86. Se instala una vez: se copia al teléfono o se sirve por la red local, por ejemplo con `python3 -m http.server`, y se abre desde el navegador.
2. Con `EXPO_PUBLIC_API_URL=http://<IP-del-PC>:5000 pnpm start`, Metro muestra un QR. Al escanearlo con la cámara se abre la app conectada al PC.

El teléfono y el PC tienen que estar en la misma red, y el teléfono necesita internet para las muestras y portadas de Apple. Las redes de universidad suelen aislar a los dispositivos entre sí; el hotspot del teléfono evita ese problema.

### 4. Cuentas

Crea una cuenta desde la app (correo y contraseña, mayor de 18, o Spotify). Para probar match y chat hacen falta dos cuentas, en dos dispositivos. El panel admin necesita una cuenta con rol `Admin` en la base local.

## Scripts

| Script | Qué hace |
|---|---|
| `pnpm start` | Metro para el dev build |
| `pnpm android` / `pnpm ios` | Compila e instala el dev build |
| `pnpm verify` | `tsc` + ESLint + Jest (lo que exige cada PR) |
| `pnpm test` | Jest |
| `pnpm gen:api` | Regenera los tipos desde `../encorly_back/contracts/openapi.v1.json` |
| `pnpm check:expo` | Revisa que las dependencias coincidan con el SDK 57 |

En desarrollo hay dos pantallas de prueba sin sesión ni API, para revisar el design system:
- `encorely://dev-motion`: motion y stickers.
- `encorely://dev-profile`: perfil y reacciones con datos de prueba.

## Ramas y contrato

- **`Dev`** es la rama de integración: cada cambio entra por PR con `pnpm verify` en verde. **`main`** es la rama estable.
- Los tipos de la API no se escriben a mano. `pnpm gen:api` los genera del OpenAPI del back y `src/lib/api/types.ts` solo les da nombres. Si el back cambia el contrato (ver `encorly_back/contracts/CHANGELOG.md`), se regenera y `tsc` dice qué ajustar.

## Integraciones externas

| Integración | Para qué | Qué falta configurar |
|---|---|---|
| iTunes Search | Muestras de 30 s y portadas en Descubrir; búsqueda del catálogo en el panel admin | Nada: las URLs vienen del back |
| Push (Expo Push → FCM/APNs) | Avisos sin contenido de mensajes y matches | Proyecto EAS (`EXPO_PUBLIC_EAS_PROJECT_ID`), `google-services.json` de Firebase y credencial FCM v1 en EAS; APNs para iOS |
| Spotify (opcional) | Entrar con Spotify e importar tus artistas | Registrar `encorely://spotify-callback` en el Spotify Dashboard y agregar usuarios de prueba (modo desarrollo: máximo 5) |

Sin esas credenciales la app funciona igual: el push y Spotify se desactivan con un aviso claro.
