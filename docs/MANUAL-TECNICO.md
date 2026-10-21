# Manual técnico — Encorely móvil

| | |
|---|---|
| Propósito | Guiar a quien instala, compila, prueba y mantiene la app. Explica el porqué y dónde está cada cosa; el detalle vive en [README](../README.md), [ARCHITECTURE](../ARCHITECTURE.md) y `docs/` |
| Público | Quien mantenga o compile la app (desarrollo, QA técnico, quien prepare un build) |
| Rama base | `Dev` |
| Contrato con el back | `v1.0.0-draft.17` (`encorly_back/contracts/openapi.v1.json`) |
| Fecha | 2026-10-20 |

Los comandos de instalación, verificación y build de este manual se ejecutaron tal cual el 2026-10-20 en Ubuntu 22.04 con Node 24.16.0 y pnpm 12.11.2. Los resultados que se citan son de esa corrida. Los pasos que necesitan el emulador se documentan desde el README y el código, y se marcan al final de su sección.

## Índice

1. [Introducción y alcance](#1-introducción-y-alcance)
2. [Arquitectura](#2-arquitectura)
3. [Requisitos](#3-requisitos)
4. [Instalación y ejecución](#4-instalación-y-ejecución)
5. [Configuración](#5-configuración)
6. [Contrato con el back](#6-contrato-con-el-back)
7. [Design system "La boleta compartida"](#7-design-system-la-boleta-compartida)
8. [Chat cifrado en el cliente](#8-chat-cifrado-en-el-cliente)
9. [Push y Spotify](#9-push-y-spotify)
10. [Pruebas](#10-pruebas)
11. [Build y distribución](#11-build-y-distribución)
12. [Mantenimiento y actualización de SDK](#12-mantenimiento-y-actualización-de-sdk)
13. [Solución de problemas](#13-solución-de-problemas)
14. [Pendientes detectados](#14-pendientes-detectados)

## 1. Introducción y alcance

Encorely conecta personas que van al mismo concierto y escuchan música parecida. La app califica canciones, marca asistencia a conciertos, muestra un radar de asistentes afines, crea matches recíprocos y abre un chat cifrado de extremo a extremo.

- Objetivo: app nativa Android e iOS con Expo SDK 57 (React Native 0.86.3, React 19.2.3, TypeScript 6 estricto).
- La web de Expo no es objetivo. `react-native-web` sigue en las dependencias, pero no hay build web soportado.
- El back es `encorly_back` (.NET 10). Su manual técnico cubre base de datos, API y despliegue.
- La v1 no se publica en tiendas (decisión D15 de `reportes/06-decisiones-y-alcance-v1.md`). El repo queda preparado: ver [tiendas.md](tiendas.md).
- QA en iOS no se hizo (no hay Mac en el entorno).

Convenciones del código: inglés en identificadores, español en textos de la app y en comentarios de dominio. Comillas simples y sin `;` (ESLint de Expo). Commits en español, en imperativo.

## 2. Arquitectura

El diagrama, las capas, la navegación, la sesión y el protocolo de cifrado están en [ARCHITECTURE.md](../ARCHITECTURE.md). Lo esencial para orientarse:

| Carpeta | Qué hay | Regla |
|---|---|---|
| `src/app/` | Rutas de expo-router (raíz declarada en el plugin `expo-router` de `app.json`) | Archivos delgados: importan la pantalla de su feature |
| `src/features/<dominio>/` | Pantallas, componentes, hooks y lógica pura: `account`, `admin`, `auth`, `chat`, `dev`, `discover`, `events`, `match`, `onboarding`, `profile`, `push`, `safety`, `shared`, `social`, `spotify` | Un dominio usa otro por su `index.ts` |
| `src/ui/` | Design system (sección 7) | Única fuente de colores, tipos, espacios y radios |
| `src/lib/` | `config.ts`, cliente API, sesión, TanStack Query, red, polyfills | Sin UI salvo el aviso "Sin conexión" |

Piezas que conviene conocer antes de tocar código:

- **Arranque.** `src/app/_layout.tsx` importa primero `@/lib/polyfills` (instala `crypto.getRandomValues` para `@noble`), carga las fuentes y retiene el splash hasta resolver fuentes y sesión.
- **Navegación.** `Stack` raíz con tres grupos protegidos por `Stack.Protected`: `(auth)`, `(onboarding)` y `(app)`. `(app)` contiene las tabs (`src/app/(app)/(tabs)/`: Descubrir, Conciertos, Chats, Tú) y, encima, las pantallas de detalle, ajustes y el panel de administración (`src/app/(app)/admin/`). `spotify-callback` queda fuera de los grupos para recibir el redirect con o sin sesión.
- **Sesión única.** `src/lib/session/SessionContext.tsx` y `tokenStore.ts`. En el teléfono solo se guardan los tokens (SecureStore) y las llaves del chat.
- **Cliente API.** `src/lib/api/client.ts`: base `${EXPO_PUBLIC_API_URL}/api/v1`, timeout de 15 s, un solo refresh en vuelo ante 401 y cierre de sesión con aviso si el refresh es rechazado. `endpoints.ts` agrupa las llamadas por dominio (`authApi`, `meApi`, `eventsApi`, `chatApi`, `devicesApi`, `adminApi`, etc.). `errors.ts` traduce `ProblemDetails` a texto para la persona y ramifica por `code`.
- **Tiempo real.** `src/features/chat/realtime/chatHub.ts`: SignalR contra `${EXPO_PUBLIC_API_URL}/hubs/chat`, con el access token vigente y reconexión a 0, 2, 5, 10 y 30 s.

## 3. Requisitos

| Herramienta | Versión | De dónde sale | Comprobar |
|---|---|---|---|
| Node | 24 (`engines`: `>=24 <27`) | `.node-version` | `node -v` → `v24.x` |
| pnpm | 12.11.2 | `packageManager` de `package.json` | `pnpm -v` → `12.11.2` |
| JDK | 17 | README | `java -version` |
| Android SDK | plataforma 36, build-tools 36 | README; RN 0.86 compila con `compileSdk`/`targetSdk` 36 | `ls ~/Android/Sdk/platforms` |
| Emulador | AVD `encorely_api35` (API 35) | entorno del proyecto | `ls ~/.android/avd` |
| Back | `encorly_back` en la carpeta hermana `../encorly_back` | `gen:api` y README | `ls ../encorly_back/contracts` |

Versiones con mise, no con nvm ni apt:

```bash
mise install node@24
mise install java@temurin-17
```

En la máquina de redacción ya estaban Node 24.16.0 y `temurin-17.0.20+8`; los dos comandos se comprobaron con `mise install --dry-run` (instalarían los parches más recientes, 24.22.0 y 17.0.20+101) y no se ejecutaron. Para activarlas en el repo, `mise use node@24 java@temurin-17` escribe un `mise.toml` local (el repo no trae uno). En esta máquina mise no lee `.node-version` por sí solo: el Node activo salía de la configuración global.

El gestor es pnpm y solo pnpm. El lockfile es `pnpm-lock.yaml`; npm o yarn sobre esta instalación rompen `node_modules` (sección 13).

Para compilar el dev build de Android hacen falta además `ANDROID_HOME` apuntando al SDK (`~/Android/Sdk`) y el JDK 17 activo en esa terminal. En la máquina de redacción ninguno de los dos estaba en el entorno por defecto: el JDK está instalado con mise (`temurin-17.0.20+8`) pero no activo fuera de un `mise.toml`.

## 4. Instalación y ejecución

### 4.1 Instalar dependencias

Desde la raíz del front, con el back clonado al lado (`Encorely/encorely-front` y `Encorely/encorly_back`):

```bash
node -v                          # v24.16.0 en la corrida de referencia
pnpm -v                          # 12.11.2
pnpm install --frozen-lockfile   # ~6 s con el store de pnpm ya poblado
```

`--frozen-lockfile` falla si `package.json` y `pnpm-lock.yaml` no coinciden, que es lo que se quiere: el lockfile es la fuente de verdad (lo usa también la CI).

Configuración de pnpm que conviene saber:

| Archivo | Qué fija | Por qué |
|---|---|---|
| `.npmrc` | `ignore-scripts=true`, `strict-peer-dependencies=true`, `auto-install-peers=true` | No corre scripts de instalación de terceros; un peer incompatible falla en vez de avisar |
| `pnpm-workspace.yaml` | `overrides` de transitivas con avisos de seguridad, `minimumReleaseAgeExclude` para esas mismas versiones, `allowBuilds: unrs-resolver: false` | Ver [upgrade/README.md](upgrade/README.md), "Excepciones de compatibilidad y seguridad" |

### 4.2 Verificación rápida sin emulador

```bash
pnpm typecheck
pnpm lint
pnpm test
```

Los tres pasaron en la corrida de referencia (tiempos y conteos en la sección 10). `pnpm verify` los encadena y es lo que exige cada commit.

### 4.3 Configurar la URL del API

```bash
cp .env.example .env
```

`EXPO_PUBLIC_API_URL` en `.env`:

| Dónde corre la app | Valor |
|---|---|
| Emulador Android | `http://10.0.2.2:5000` (`10.0.2.2` es el `localhost` del PC visto desde el emulador) |
| Teléfono en la misma red | `http://<IP-del-PC>:5000` |

Sin la variable, la app no se cuelga: muestra "Falta configurar el servidor" (`src/app/_layout.tsx`). No hay valor por defecto a `localhost` a propósito: en un teléfono `localhost` es el propio teléfono.

El back tiene que estar arriba en el puerto 5000 (ver su README y su manual técnico). Comprobación: `curl http://localhost:5000/health/live`.

### 4.4 Expo Go o dev build

La app corre en un development build (`expo-dev-client`), no en Expo Go. `pnpm start` ya arranca Metro en modo dev client (`expo start --dev-client`). Lo que obliga al build propio:

| Necesita build nativo | Dónde |
|---|---|
| Historial del chat en SQLCipher (`expo-sqlite` con `useSQLCipher: true`) | `src/features/chat/local/sqliteStore.ts` |
| Push remoto (`expo-notifications`) | `src/features/push/` |
| Teclado (`react-native-keyboard-controller`) | `src/app/_layout.tsx` |
| Plugins de `app.json`: permisos, splash, canal de notificaciones | `app.json` |

Sin el módulo nativo de SQLCipher la base local no abre y el chat cae al modo "solo servidor" de la v1 (sin ack ni rotación), como describe ARCHITECTURE.

### 4.5 Ejecutar en el emulador

```bash
export ANDROID_HOME="$HOME/Android/Sdk"
~/Android/Sdk/emulator/emulator -avd encorely_api35 &
pnpm android     # expo run:android: genera android/, compila e instala el dev build (la primera vez tarda)
pnpm start       # expo start --dev-client: Metro en el puerto 8081, en otra terminal
```

Después del primer build basta con `pnpm start` y abrir la app instalada. Se vuelve a compilar (`pnpm android`) solo si cambia algo nativo: una dependencia con código nativo, un plugin o un campo de `app.json`.

`android/` e `ios/` se generan (Continuous Native Generation) y están en `.gitignore`: no se editan a mano.

Para probar match y chat hacen falta dos cuentas en dos dispositivos (dos emuladores, o emulador y teléfono).

> Los pasos 4.3 (copia de `.env`), 4.5 y la comprobación con `curl` no se re-ejecutaron al redactar este manual: requieren el emulador y el back, que estaban en uso por otra sesión.

## 5. Configuración

### 5.1 Variables de entorno

Las variables `EXPO_PUBLIC_*` se incrustan en el bundle de JavaScript al compilar. Cualquiera que tenga el APK puede leerlas: nunca van secretos ahí.

| Variable | Obligatoria | Dónde se lee | Qué hace | Si falta |
|---|---|---|---|---|
| `EXPO_PUBLIC_API_URL` | Sí | `src/lib/config.ts` | URL base del API, sin `/api/v1` y sin barra final (se recortan las barras sobrantes). De ella salen `API_BASE` (`/api/v1`) y `HUB_URL` (`/hubs/chat`) | Pantalla "Falta configurar el servidor"; el cliente lanza `ApiError('config')` |
| `EXPO_PUBLIC_EAS_PROJECT_ID` | No | `src/features/push/config.ts` | ID del proyecto EAS para pedir el token de push. Se usa solo si no hay `extra.eas.projectId` en `app.json` ni `easConfig.projectId` | El push queda desactivado (`missingProjectId`) y la app no pide permiso |
| `MAESTRO_E2E_*` | Solo E2E | Maestro | Credenciales y datos de los flujos E2E | Ver [e2e.md](e2e.md) |

`.env.example` solo trae `EXPO_PUBLIC_API_URL`. En los builds de EAS la URL sale de cada perfil de `eas.json` (sección 11).

### 5.2 `app.json`

No hay `app.config.js` ni `app.config.ts`: toda la configuración es estática.

| Campo | Valor | Nota |
|---|---|---|
| `name` / `slug` | `Encorely` / `encorely-app` | |
| `scheme` | `encorely` | Deep links `encorely://…` |
| `ios.bundleIdentifier` / `android.package` | `com.encorely.app` | También es el `appId` de Maestro |
| `orientation` | `portrait` | |
| `userInterfaceStyle` | `automatic` | El tema sigue al sistema (sección 7) |
| `ios.supportsTablet` | `false` | |
| `ios.config.usesNonExemptEncryption` | `true` | Cifrado propio (E2EE y SQLCipher). Justificación en [tiendas.md](tiendas.md) §10 |
| `ios.privacyManifests` | `NSPrivacyTracking: false` y APIs de "required reason" | Tabla en [tiendas.md](tiendas.md) §10 |
| `android.allowBackup` | `false` | Llaves y base local fuera del backup de Android |
| `android.softwareKeyboardLayoutMode` | `resize` | |
| `extra.spotifyClientId` | client ID público de Spotify | PKCE no usa secreto; puede ir en el repo |
| `experiments.tsconfigPaths` | `true` | Habilita el alias `@/` → `src/` en Metro |
| `experiments.typedRoutes` | `false` | |

### 5.3 Plugins

| Plugin | Configuración | Efecto |
|---|---|---|
| `expo-router` | `root: src/app` | Rutas bajo `src/app/` |
| `expo-secure-store` | `configureAndroidBackup: true`, `faceIDPermission: false` | Excluye SecureStore del backup de Android; no pide Face ID |
| `expo-font` | | Fuentes de `@expo-google-fonts/*` |
| `expo-audio` | grabación, micrófono y reproducción en segundo plano desactivados | Solo previews de 30 s |
| `expo-camera` | texto de permiso propio, micrófono desactivado | Solo para escanear el QR de verificación |
| `expo-notifications` | `color: #FF6A2B`, `defaultChannel: messages` | Canal Android "Mensajes" |
| `expo-web-browser`, `expo-asset`, `expo-image` | | |
| `expo-splash-screen` | imagen `assets/splash-icon.png` sobre `#121110` | Igual en claro y oscuro |
| `expo-sqlite` | `useSQLCipher: true` | Historial local cifrado; exige build nativo |

### 5.4 Permisos declarados

| Permiso | Estado | Dónde |
|---|---|---|
| Cámara | Pedido, con el texto "Encorely usa la cámara solo para escanear el código de seguridad de tu match y verificar que nadie más lee el chat." | plugin `expo-camera` |
| Notificaciones | Pedido después de una pantalla propia (`src/features/push/PushPrimer.tsx`), nunca al arrancar | `src/features/push/permission.ts` |
| Micrófono | Desactivado | plugins `expo-audio` y `expo-camera` |
| Face ID | Desactivado | plugin `expo-secure-store` |
| Android bloqueados | `RECORD_AUDIO`, `SYSTEM_ALERT_WINDOW`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` | `android.blockedPermissions` |

No hay ubicación, fotos ni contactos. La ciudad la escribe la persona.

### 5.5 Deep links y payloads

| Entrada | Destino | Nota |
|---|---|---|
| `encorely://spotify-callback` | `src/app/spotify-callback.tsx` | Redirect de Spotify. Debe estar registrada en el Spotify Dashboard tal cual, sin barra final |
| `encorely://dev-motion`, `encorely://dev-profile` | `src/app/dev-motion.tsx`, `dev-profile.tsx` | Laboratorios de motion y perfil. Solo con `__DEV__`; en release redirigen a `/` |
| Toque en una notificación | `/chat/<matchId>` o `/chats` | `src/features/push/payload.ts` valida el id con `^[A-Za-z0-9-]{1,64}$` antes de navegar |
| QR `encorely:v1:…` | Pantalla de verificación del chat | Código de seguridad, se lee con el escáner de la app |
| QR `encorely-link:v1:<id>:<pública>` | Traspaso a otro teléfono | `src/features/chat/link/linkDevice.ts` |

No hay universal links ni App Links (`associatedDomains` o `intentFilters`).

## 6. Contrato con el back

El contrato es `encorly_back/contracts/openapi.v1.json` y su historial está en `encorly_back/contracts/CHANGELOG.md`. Los tipos del cliente no se escriben a mano.

| Archivo | Papel |
|---|---|
| `src/lib/api/schema.d.ts` | Generado por `openapi-typescript`. No se edita y ESLint lo ignora |
| `src/lib/api/types.ts` | Solo alias legibles: `type SessionUser = components['schemas']['AuthUserDto']` |
| `src/lib/api/endpoints.ts` | Una función por endpoint, agrupadas por dominio |
| `src/lib/api/client.ts` | Transporte: auth, refresh, timeout, errores |

### 6.1 Regenerar los tipos

```bash
ls ../encorly_back/contracts                      # CHANGELOG.md  openapi.v1.json
pnpm gen:api                                      # ~2 s
git diff --stat src/lib/api/schema.d.ts
pnpm typecheck
```

`gen:api` lee la ruta relativa `../encorly_back/contracts/openapi.v1.json`: el back tiene que estar en la carpeta hermana. Lee el archivo de la rama que tenga el back en ese momento, así que antes hay que confirmar en qué rama está:

```bash
git -C ../encorly_back log -1 --oneline -- contracts/openapi.v1.json
```

### 6.2 Qué draft integra el front

`info.version` del OpenAPI dice `1.0.0`; la etiqueta del draft vive en el CHANGELOG. El front en `Dev` integra el draft.17 (commit `521e726`, "Integra el contrato draft.17"). Se comprobó generando el esquema desde el `openapi.v1.json` del draft.17 a un archivo aparte: salió idéntico al `schema.d.ts` versionado, y `pnpm gen:api` no deja cambios.

### 6.3 Cuando sube la versión del contrato

1. Leer en `../encorly_back/contracts/CHANGELOG.md` todas las entradas por encima del draft integrado. Las marcadas **Rompe** obligan a ajustar el cliente.
2. `pnpm gen:api`.
3. `pnpm typecheck`: los errores señalan qué ajustar. Primero `types.ts` (nombres), luego `endpoints.ts` y los hooks de cada feature.
4. Hay drafts que solo cambian comportamiento y no tocan el OpenAPI (el draft.13, por ejemplo: nuevos `code` de error). Ahí `tsc` no avisa: buscar en `src/` los `code` afectados y revisar `src/lib/api/errors.ts`.
5. `pnpm verify` y un recorrido manual de las pantallas afectadas.
6. Commit con el draft en el mensaje, como los anteriores: `Integra el contrato draft.N: …`.

## 7. Design system "La boleta compartida"

Todo vive en `src/ui/` y se importa desde `@/ui`. La auditoría de diseño de origen es `reportes/03-auditoria-diseno.md` (§5–6). Las reglas de producto están resumidas en [ARCHITECTURE.md](../ARCHITECTURE.md), "Diseño" y "Perfil social".

### 7.1 Tokens (`src/ui/tokens.ts`)

| Grupo | Contenido |
|---|---|
| Temas | `venue` (oscuro, fondo `#121110`) y `papel` (claro, fondo `#F6F1E8`). `ThemeProvider` (`src/ui/theme.tsx`) elige según `useColorScheme()`. Acento `#FF6A2B` en los dos; como texto sobre papel se oscurece a `#B83A0A` para pasar AA |
| Colores semánticos | `bg`, `surface`, `surface2`, `border`, `borderInput`, `text`, `textMuted`, `textSubtle`, `accent`, `onAccent`, `accentText`, `ticket*`, `verified`, `danger`, `scrim` |
| Stickers | `sticker.paper`, `stamp`, `band`, `ink`: iguales en los dos temas; todas las parejas pasan AA (la más baja, 6,25:1) |
| Espacios | `space`: 4, 8, 12, 16, 24, 32, 48 y `gutter` 20 (escala de 4 pt) |
| Radios | `radius`: `sm` 8, `md` 16, `full` 999 |
| Toque | `touch.min` 44, `comfortable` 48, `large` 56 |
| Fuentes | Big Shoulders Display (cartel y títulos), Archivo (texto), IBM Plex Mono (datos, con cifras tabulares) |
| Tipos | `display`, `title1`, `title2`, `headline`, `body`, `callout`, `footnote`, `caption`, `data`. Solo `display`, `title1` y `title2` limitan el escalado (`maxFontScale`) |
| Motion | `duration` 160/220/320/450 ms, `easeOut`, `spring` |

Los colores se leen del tema con `useTheme()` o `useStyles((theme) => …)`. No se agregan colores sueltos fuera de `tokens.ts`.

### 7.2 Componentes base

Exportados por `src/ui/index.ts`: `Screen`, `Text`, `Button`, `IconButton`, `TextField`, `Checkbox`, `RadioGroup`, `Chip`, `ListRow`/`ListSection`, `Sheet`/`ConfirmSheet`, `Alert`, `Toast`, `Avatar`, `Logo`, `SegmentedTabs`, estados (`EmptyState`, `ErrorState`, `LoadingState`, `Skeleton`), `TicketCard` (la boleta con muesca), `Sticker`/`StickerTitle`/`ReactionTag` y los de motion (`ScrollReveal`, `ParallaxTicket`, `Carousel3D`). La matemática del motion está en `src/ui/motionMath.ts`, con tests.

### 7.3 Iconos

Phosphor, por imports profundos, solo desde `src/ui/icons.ts`: el índice de `phosphor-react-native` arrastraría unos 1500 iconos al bundle. Para sumar uno, confirmar que existe `node_modules/phosphor-react-native/src/icons/<Nombre>.tsx` y agregar el `export` en `icons.ts`. El alias de tipos para esa ruta está en `tsconfig.json`.

### 7.4 Reglas

- Sin emojis como iconos. Sin gradientes de color, glow ni blur. `expo-linear-gradient` se usa solo como velo de legibilidad sobre portadas (`SongCard`, `ArtistCarousel`).
- Sin datos inventados: lo que no viene del API no se muestra. Los porcentajes se redondean de 5 en 5 y, si el back manda `affinity: null`, no hay número.
- Contraste AA verificado en los dos temas. Objetivos táctiles de 44 pt como mínimo.
- Reduce motion manda: `useMotion()` (`src/ui/motion.ts`) es el único lugar que lo decide.
- Stickers solo en gustos y en algunos títulos del perfil; nunca en ajustes, listas, formularios ni botones.

## 8. Chat cifrado en el cliente

El protocolo completo (llaves, AAD, padding, franking, rotación, respaldo, traspaso y modelo de amenazas) está en [ARCHITECTURE.md](../ARCHITECTURE.md), "Chat cifrado de extremo a extremo". Esta sección dice dónde está cada parte en el código.

### 8.1 Mapa de archivos (`src/features/chat/`)

| Carpeta / archivo | Qué hace |
|---|---|
| `crypto/envelope.ts` | Cifrado y descifrado de mensajes: XChaCha20-Poly1305, AAD, padding, franking |
| `crypto/keyBundle.ts`, `pairKey.ts`, `boxChain.ts` | Identidad Ed25519, cajas X25519 firmadas, llave del par con HKDF, cadena de rotación |
| `crypto/safetyNumber.ts` | Código de seguridad y su QR |
| `crypto/backupCipher.ts`, `linkCode.ts`, `sealedBox.ts` | Respaldo con scrypt, código corto del traspaso, sobre del traspaso |
| `crypto/random.ts` + `src/lib/polyfills.ts` | `crypto.getRandomValues` sobre `expo-crypto` (Hermes no lo trae) |
| `keys/deviceKeys.ts`, `keys/peerKeys.ts` | Llaves propias y pines de contactos |
| `keys/expoStores.ts` | Adaptadores a SecureStore y AsyncStorage |
| `local/sqliteStore.ts`, `local/memoryStore.ts` | Historial local SQLCipher y su doble en memoria para Jest |
| `data/localSync.ts`, `data/keyMaintenance.ts`, `data/publishKeys.ts` | Sincronización y ack, rotación semanal, publicación de llaves |
| `realtime/chatHub.ts` | Conexión SignalR |
| `backup/`, `link/` | Respaldo cifrado opcional y traspaso a otro teléfono |
| `screens/SecurityScreen.tsx`, `screens/ScanScreen.tsx`, `components/SafetyCodeTicket.tsx` | Verificación del código de seguridad |

### 8.2 Llaves en el dispositivo

- Se generan en el teléfono con `@noble/curves` (Ed25519 y X25519); se cifra con `@noble/ciphers` y se deriva con `@noble/hashes`. Son JS puro.
- Se guardan en SecureStore con `keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY` (`keys/expoStores.ts`): solo con el teléfono desbloqueado y fuera de copias de iCloud o del backup de Android.
- Llaves namespaced por usuario: `e2ee_v1_<userId>_identity`, `_meta`, `_chain`, `_box_<n>`, `_install_id`; pines en `e2ee_v1_<userId>_peer_…` con índice `e2ee_v1_<userId>_peers`; llave de la base local en `e2ee_v1_<userId>_dbkey`. La base es `encorely_chat_<userId>.db`.
- Cerrar sesión conserva llaves, pines e historial. Borrar la cuenta los destruye.
- ESLint prohíbe cualquier `console.*` en `crypto/` y `keys/`, y en el resto solo deja `warn` y `error` (`eslint.config.js`).

### 8.3 Código de seguridad

`crypto/safetyNumber.ts`: para cada persona, `SHA-256("ENCORELY-FP-v1" ‖ userId ‖ 0 ‖ identidad Ed25519)`; de cada huella salen 6 bloques de 5 dígitos. Se ordenan por `userId` para que los dos teléfonos muestren lo mismo: 60 dígitos en 12 bloques. El QR lleva el prefijo `encorely:v1:` y se escanea con `expo-camera`. La rotación semanal de cajas no cambia el código, porque la identidad no rota.

### 8.4 Límites que no se deben maquillar

- Sin forward secrecy por mensaje. Hay rotación semanal de la llave de caja: quien robe la llave vigente lee lo cifrado con ella (hasta 7 días, más si la app no se abre).
- Un dispositivo activo por cuenta. El traspaso copia la identidad a otro teléfono, no es multi-dispositivo.
- El historial vive en el teléfono. Sin respaldo, perder el teléfono es perder el historial.
- La verificación es manual (código o QR en persona).
- En la app se dice "cifrado de extremo a extremo", nunca "como Signal". Los textos de la app sobre esto están en `src/features/safety/e2eeDisclosure.ts`.

## 9. Push y Spotify

Las dos integraciones son opcionales. Sin credenciales la app funciona y lo dice con un aviso claro.

### 9.1 Push (`src/features/push/`)

| Archivo | Qué hace |
|---|---|
| `config.ts` | `resolveProjectId()` busca el ID de EAS en `extra.eas.projectId`, `easConfig.projectId` y `EXPO_PUBLIC_EAS_PROJECT_ID`. `pushAvailability()` devuelve `ready`, `missingProjectId`, `simulator` o `unsupported` |
| `PushPrimer.tsx`, `usePushPrompt.ts`, `permission.ts` | Pantalla propia antes del diálogo del sistema |
| `setup.ts` | Crea el canal Android `messages` antes de pedir el token (Android 13+ no da token sin canal) y define qué se muestra con la app abierta |
| `registration.ts` | Pide el token y lo registra en el back |
| `payload.ts`, `usePushNavigation.ts` | Lee `{ t: 'chat' \| 'match', matchId }` y navega |

Registro del token:

1. `Notifications.getExpoPushTokenAsync({ projectId })` devuelve un token Expo con forma `ExponentPushToken[…]`.
2. `PUT /devices/push-token` con `{ token, platform }`. El back solo acepta `ExponentPushToken[…]` o `ExpoPushToken[…]`; cualquier otra cosa da 400 `validation_failed` (contrato draft.14). Por eso se manda el token Expo y no el token nativo de FCM o APNs.
3. Si ese token estaba en otra cuenta (mismo teléfono, otra sesión), el back lo pasa a la nueva y cierra la sesión anterior.
4. El último token aceptado queda en SecureStore (`encorely_push_token_v1`) para poder borrarlo al cerrar sesión con `DELETE /devices/push-token` (tope de 3 s, no bloquea el logout). Al borrar la cuenta no se llama: el back ya borró los dispositivos.

Se sincroniza al arrancar, al entrar, al volver a primer plano y cuando el token rota. Nunca pide permiso por su cuenta. Las notificaciones no llevan contenido, nombre ni texto.

Lo que falta configurar para recibir push: proyecto EAS (`pnpm dlx eas-cli@24.13.0 init` escribe `extra.eas.projectId`), `google-services.json` de Firebase con credencial FCM v1 en EAS y APNs para iOS. En un emulador o simulador `Device.isDevice` es falso y el registro se salta (`simulator`).

### 9.2 Spotify (`src/features/spotify/`)

PKCE S256 en el teléfono, sin secreto (`spotifyAuth.ts`):

- Verificador de 32 bytes aleatorios (43 caracteres), `state` de 16 bytes. El `state` se valida antes de mirar `error` o `code`.
- El PKCE pendiente se guarda en SecureStore antes de abrir el navegador (vence a los 10 min, un solo uso). Si Android mata la app mientras la persona está en Spotify, `src/app/spotify-callback.tsx` retoma el flujo.
- Redirect: `encorely://spotify-callback`, generada con `makeRedirectUri` y sin barra final.

| Flujo | Alcance | Quién canjea el `code` | Endpoint del back |
|---|---|---|---|
| Entrar con Spotify (`features/auth/components/SpotifySignIn.tsx`) | `user-read-email` | El back | `POST /auth/spotify` |
| Vincular Spotify a una cuenta o reconfirmar el borrado (`SpotifyLinkRow.tsx`, `DeleteAccountScreen.tsx`) | `user-read-email` | El back | `POST /me/spotify/link` |
| Importar artistas (`useSpotifyImport.ts`, `SpotifyConnectCard.tsx`) | `user-top-read` | El teléfono | `POST /me/spotify/import` (máx. 50 artistas, nombre ≤ 200, ≤ 20 géneros) |

En la importación el token de Spotify no sale del teléfono: la app lee `GET /v1/me/top/artists?limit=50&time_range=medium_term` y manda al back solo nombres y géneros. El refresh token de Spotify queda en SecureStore, por usuario.

Límite del modo desarrollo: Spotify solo deja entrar a las cuentas registradas a mano como usuarios de prueba en el Dashboard (máximo 5). A cualquier otra responde 403, que la app traduce como error `devMode` con un mensaje que lo explica (`errors.ts`). La cuota extendida exige una solicitud aparte a Spotify; ver [tiendas.md](tiendas.md) §11.

Configuración en el Spotify Dashboard: redirect `encorely://spotify-callback` exacta y la lista de usuarios de prueba. El client ID va en `app.json` → `extra.spotifyClientId`.

## 10. Pruebas

| Comando | Qué corre | Resultado el 2026-10-20 |
|---|---|---|
| `pnpm typecheck` | `tsc --noEmit` | Pasó, ~35 s |
| `pnpm lint` | `eslint . --max-warnings 0` | Pasó sin avisos, ~100 s |
| `pnpm test` | `jest --runInBand` | 56 suites, 490 tests, todos pasan. Jest reporta ~146 s en frío (~17 s con caché); el proceso tarda unos 5 min más en salir (sección 13, "Jest did not exit") |
| `pnpm verify` | los tres anteriores (`test --silent`) | Pasó, ~6 min en total |
| `pnpm check:expo` | `expo install --check` | Falla: 8 paquetes con parche pendiente (sección 13) |
| `pnpm build:bundles` | `expo export` Android + iOS | Pasó, ~3 min (con `EXPO_PUBLIC_API_URL` de la CI) |
| `pnpm gen:api` | `openapi-typescript` sobre el contrato | Pasó, ~2 s, sin cambios en `schema.d.ts` |

Jest usa el preset `jest-expo`, el alias `@/` → `src/` y un `transformIgnorePatterns` que deja transformar `@noble` y las rutas de `.pnpm` (`package.json` → `jest`). Los tests viven en `__tests__/` dentro de cada feature y de `src/ui/`. La cripto se prueba contra vectores y casos de manipulación (bits alterados, sobre movido de conversación, firma inválida, rotación, pinning); el historial local se prueba con `local/memoryStore.ts`, no con SQLite.

Para un archivo o un patrón:

```bash
pnpm test src/features/chat        # 20 suites, 180 tests, ~30 s
pnpm test -t 'safety code'         # 5 tests, ~40 s
```

E2E: flujos de Maestro en `.maestro/`, contra un dev build o un build `preview` instalado. Variables, preparación del match y ejecución local o en EAS: [e2e.md](e2e.md). No se re-ejecutaron al redactar este manual (requieren el emulador).

CI: `.github/workflows/frontend.yml` instala con `--frozen-lockfile` y corre `check:expo`, `typecheck`, `lint`, `test --silent` y `build:bundles` con `EXPO_PUBLIC_API_URL=https://api.example.invalid`.

## 11. Build y distribución

### 11.1 Bundles de JavaScript

```bash
EXPO_PUBLIC_API_URL=https://api.example.invalid pnpm build:bundles
```

Es lo que hace la CI. Genera los bundles Hermes de Android e iOS en `dist/` (ignorado por git). Comprueba que todo empaqueta, pero no es un APK ni una IPA. En la corrida de referencia tardó ~3 min y produjo `entry-….hbc` de 6,1 MB (Android) y 5,9 MB (iOS) más los assets.

### 11.2 Perfiles de EAS (`eas.json`)

| Perfil | Salida | `EXPO_PUBLIC_API_URL` |
|---|---|---|
| `development` | Dev client interno, APK | `http://10.0.2.2:5000` |
| `development-simulator` | Igual, para el simulador de iOS | hereda de `development` |
| `preview` | APK interno o ad hoc iOS para QA | placeholder `https://api-staging.encorely.example` |
| `production` | AAB para Play / IPA para App Store, `autoIncrement` | placeholder `https://api.encorely.example` |

`cli.appVersionSource: remote`: EAS lleva `versionCode` y `buildNumber`. La CLI se usa fijada a la versión de `eas.json`:

```bash
pnpm dlx eas-cli@24.13.0 build -p android --profile preview
```

Antes del primer build hay que hacer `login`, `init` y `credentials`. Todavía no hay `extra.eas.projectId` en `app.json`. `preview` y `production` deben apuntar a HTTPS; `development` usa HTTP en claro porque el dev client es un build debug.

### 11.3 Tiendas

Cuentas, iconos, capturas, etiquetas de privacidad, borrado de cuenta, Ley 1581, export compliance y Spotify: [tiendas.md](tiendas.md). Android apunta a `targetSdk` 36 sin configuración extra (lo fija React Native 0.86).

> Ningún build de EAS se ejecutó al redactar este manual: requieren cuenta de Expo y credenciales.

## 12. Mantenimiento y actualización de SDK

### 12.1 Historial y método

La migración de Expo 54 a 57 (por etapas 55 y 56), sus logs, la auditoría de dependencias y las excepciones de seguridad están en [upgrade/README.md](upgrade/README.md) y [upgrade/INVENTORY.md](upgrade/INVENTORY.md). Ese material es del 2026-10-13 y describe la base anterior a la reconstrucción (sección 14).

Para un parche o un SDK nuevo:

1. Leer las notas de la versión en la [documentación de Expo](https://docs.expo.dev/versions/latest/) y la matriz de versiones del SDK.
2. Parar Metro.
3. Actualizar con `pnpm exec expo install`, que elige la versión compatible con el SDK, no con `pnpm add` a secas.
4. `pnpm install --frozen-lockfile` en limpio para confirmar el lockfile.
5. `pnpm check:expo`, `pnpm verify` y `pnpm build:bundles`.
6. Si cambió algo nativo, nuevo dev build (`pnpm android`) y recorrido en el emulador.
7. Revisar `pnpm-workspace.yaml`: los `overrides` de seguridad pueden sobrar con versiones nuevas.

No forzar versiones mayores para silenciar `pnpm audit` y no mezclar actualizaciones OTA de SDK distintos.

### 12.2 Tareas frecuentes

| Tarea | Pasos |
|---|---|
| Pantalla nueva | Pantalla en `src/features/<dominio>/screens/`, ruta delgada en `src/app/` dentro del grupo que corresponda |
| Endpoint nuevo | Contrato del back → `pnpm gen:api` → alias en `types.ts` → función en `endpoints.ts` → hook de TanStack Query en la feature → test |
| Icono nuevo | `export` en `src/ui/icons.ts` (sección 7.3) |
| Dependencia nativa nueva | `pnpm exec expo install <paquete>` con Metro parado, plugin en `app.json` si lo pide, razones de privacidad de iOS ([tiendas.md](tiendas.md) §10), nuevo dev build |
| Color o espacio nuevo | Solo en `src/ui/tokens.ts`, verificando contraste AA en los dos temas |

> Los pasos de 12.1 y 12.2 son procedimiento; no se ejecutaron actualizaciones al redactar este manual.

## 13. Solución de problemas

Solo errores vistos en este proyecto. El título de cada entrada es el síntoma, con el mensaje exacto cuando lo hay.

### `node_modules` vacío o incompleto después de instalar o arrancar
- Causa: otro gestor sobre la instalación existente (por ejemplo, pnpm sobre una instalación hecha con npm). Al ver el lockfile desincronizado, reinstala y deja `node_modules` vacío.
- Solución: detectar el gestor por el lockfile (`pnpm-lock.yaml`) o por `node_modules/.modules.yaml` (pnpm) frente a `node_modules/.package-lock.json` (npm), y usar ese mismo. En este repo es pnpm. Si solo se quiere arrancar sin que el gestor revise dependencias, `npx expo start --dev-client` en vez de `pnpm start`.

### El bundle no resuelve `@react-navigation/…`
- Causa: Expo Router 56+ trae React Navigation dentro de su propio paquete; `@react-navigation/*` no está instalado.
- Solución: importar desde `expo-router/react-navigation`, como `useHeaderHeight` en `src/features/chat/screens/ConversationScreen.tsx`. No agregar `@react-navigation/*` con `pnpm add`.

### Metro se cae al instalar un paquete
- Causa: `pnpm add` reescribe `node_modules` mientras Metro lo vigila.
- Solución: parar Metro, instalar, volver a `pnpm start`.

### Metro sirve un bundle viejo: los cambios no aparecen
- Causa: el límite de inotify (65536 watches) sin watchman; Metro deja de ver cambios.
- Solución: reiniciar Metro y matar también el proceso hijo que queda en el puerto 8081 (`ss -ltnp | grep 8081`, luego `kill <pid>`). Subir `fs.inotify.max_user_watches` toca `/etc`: pedir permiso antes.

### La terminal se cierra al matar un proceso (exit 144)
- Causa: `pkill -f <patrón>` o `pgrep -f <patrón> | xargs kill` coinciden con la línea de comandos de la propia shell.
- Solución: `pgrep -f` en un comando aparte y luego `kill <pid>`, o un patrón con corchetes que no coincide consigo mismo: `pgrep -f "expo[ ]start"`.

### El primer deep link no abre nada
- Causa: con el dev client arrancando en frío, el primer deep link se pierde.
- Solución: mandarlo otra vez cuando la app ya cargó.

### La app muestra "Falta configurar el servidor"
- Causa: falta `EXPO_PUBLIC_API_URL` en `.env` o en el perfil de EAS. Pasó con los antiguos perfiles `validation-*`, que no la definían (ver [tiendas.md](tiendas.md) §2).
- Solución: definirla (sección 4.3) y reiniciar Metro: la variable se incrusta al empaquetar.

### `pnpm check:expo` falla con "Found outdated dependencies"
- Síntoma (2026-10-20): `@expo/metro-runtime`, `expo`, `expo-asset`, `expo-auth-session`, `expo-constants`, `expo-linking`, `expo-notifications` y `expo-router` piden un parche más nuevo dentro de SDK 57 (por ejemplo `expo@57.0.28 - expected version: ~57.0.30`). `frontend.yml` corre este paso primero: en una rama donde la CI se dispare (`main`, `rebuild/v1`), fallaría ahí.
- Causa: Expo publicó parches después de fijar el lockfile.
- Solución: actualizar con `pnpm exec expo install --fix` siguiendo 12.1, con Metro parado, y verificar. No se aplicó al redactar este manual.

### Jest termina pero tarda en salir: "Jest did not exit one second after the test run has completed."
- Causa: alguna prueba deja una operación asíncrona abierta. Las 490 pruebas pasan; con la suite completa el proceso sale con código 0 unos 5 min después del resumen. Con un filtro (`pnpm test src/features/chat`) sale enseguida.
- Solución: no es un fallo de la suite. Para buscar la prueba que deja el handle abierto, Jest sugiere `--detectOpenHandles` (no se ejecutó al redactar este manual).

### `StyleSheet.absoluteFillObject` es `undefined`
- Causa: React Native 0.86 la retiró ([upgrade/README.md](upgrade/README.md)).
- Solución: `StyleSheet.absoluteFill`, mismo estilo.

### Los fps medidos en el emulador no cuadran
- Causa: el emulador usa render por software (`swangle`).
- Solución: medir rendimiento y animaciones en un Android real.

### El push no se registra en el emulador
- Causa: `Device.isDevice` es falso en emulador y simulador (`pushAvailability()` = `simulator`), o falta el ID del proyecto EAS (`missingProjectId`).
- Solución: probar en un teléfono real con un build que tenga `extra.eas.projectId` o `EXPO_PUBLIC_EAS_PROJECT_ID`.

### Spotify responde 403 al importar o entrar
- Causa: la app de Spotify está en modo desarrollo y la cuenta no está en la lista de usuarios de prueba.
- Solución: agregarla en el Spotify Dashboard (máximo 5).

### Spotify rechaza la redirección
- Causa: Spotify compara la redirect URI carácter por carácter; una barra final la rompe.
- Solución: registrar exactamente `encorely://spotify-callback`.

### `pnpm gen:api` no encuentra el contrato
- Causa: el back no está en la carpeta hermana `../encorly_back`.
- Solución: clonar el back al lado del front o crear el worktree en `Encorely/` para que la ruta relativa resuelva.

## 14. Pendientes detectados

Documentación desactualizada o que contradice el código a la fecha. No se corrigió en esta rama.

1. **README, "API local"**: pide el back en la rama `rebuild/v1`. Esa rama del back está en el contrato draft.6; el front integra el draft.17, que está en `dev`.
2. **ARCHITECTURE.md, título**: "rama `rebuild/v1`". La rama de trabajo del front es `Dev`; `origin/rebuild/v1` del front quedó en los drafts 7 y 8 (2026-10-14).
3. **tiendas.md, encabezado**: "Estado a la fecha de esta rama (`rebuild/v1`)". Mismo caso.
4. **CI (`.github/workflows/frontend.yml`)**: corre en `push` y `pull_request` a `main` y `rebuild/v1`, no a `Dev`. Los PR a `Dev` no pasan por la CI.
5. **CI que fallaría**: `frontend.yml` empieza con `pnpm check:expo`, que hoy falla por 8 parches pendientes de SDK 57. Si se agrega `Dev` a los disparadores (punto 4), el primer PR queda en rojo hasta aplicar esos parches.
6. **`vercel.json`**: llama a `pnpm run build:web`, un script que no existe en `package.json`. Además la web no es objetivo.
7. **README, tabla de scripts**: no lista `typecheck`, `lint` ni `build:bundles`.
8. **README, requisitos**: `mise use node@24` crea un `mise.toml` sin versionar; el repo no trae `mise.toml` y mise no leyó `.node-version` en la máquina de redacción.
9. **`.env.example`**: no incluye `EXPO_PUBLIC_EAS_PROJECT_ID`, que el README nombra y `src/features/push/config.ts` lee.
10. **ARCHITECTURE.md, "Capas y carpetas"**: la lista de dominios omite `account`, `admin` y `shared`, que existen en `src/features/`. Tampoco menciona el panel de administración (`src/app/(app)/admin/`).
11. **docs/upgrade/README.md**: describe la base anterior. Nombra la rama `codex/actualizar-dependencias`; los perfiles `validation-*` de `eas.json`, ya reemplazados; "30 pruebas aprobadas" (hoy 490); "exportación web" (hoy `build:bundles` solo exporta Android e iOS); un checklist con Kafka, playlists en PostgreSQL y autenticación Spotify de la app vieja; y comandos en bloque `powershell`.
12. **docs/upgrade/INVENTORY.md**: lista paquetes que ya no están en `package.json` (`@expo-google-fonts/golos-text`, `@expo-google-fonts/inter`, `@expo/ngrok`, `styled-components`, `lottie-react-native`, `expo-blur`) y no lista dependencias actuales (`@noble/*`, `@microsoft/signalr`, `expo-sqlite`, `expo-camera`, `expo-notifications`, las fuentes Archivo, Big Shoulders e IBM Plex Mono, entre otras).
13. **docs/e2e.md, "Fragilidad conocida"**: sigue vigente que no hay ningún `testID` en `src/`. Es una recomendación abierta, no un error del documento.
