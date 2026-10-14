# Encorely — app móvil

Encuentra con quién ir al próximo concierto: calificas canciones, marcas a qué concierto vas, ves quién más va y escucha lo mismo que tú, y si los dos se interesan, chatean con cifrado de extremo a extremo.

App nativa Android/iOS con Expo SDK 57. La arquitectura, el protocolo de cifrado y sus límites están en [ARCHITECTURE.md](ARCHITECTURE.md).

## Levantar en menos de 15 minutos (Android)

### 0. Requisitos

| Herramienta | Versión | Cómo |
|---|---|---|
| Node | 24 (`.node-version`) | `mise use node@24` |
| pnpm | 12 (`packageManager`) | `corepack enable` |
| JDK | 17 | `mise use java@temurin-17` |
| Android Studio | SDK 36 + un emulador (API 35) | Variable `ANDROID_HOME` apuntando al SDK |

Usa **solo pnpm**. Mezclar con npm o yarn rompe `node_modules`.

### 1. API local

Levanta el back siguiendo el README de `encorly_back` (rama `rebuild/v1`): Postgres con docker compose, migraciones, seed y la API en el puerto 5000. Comprueba que responde:

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
| Emulador Android | `http://10.0.2.2:5000` (es el `localhost` del PC visto desde el emulador) |
| Teléfono en la misma red | `http://<IP-del-PC>:5000` |

Si falta la variable, la app lo dice en pantalla en vez de colgarse.

### 3. Dev build en el emulador

El proyecto usa módulos nativos (push, cámara, teclado), así que corre en un **development build**, no en Expo Go.

```bash
~/Android/Sdk/emulator/emulator -avd <tu_avd> &
pnpm android        # expo run:android: compila e instala el dev build (la primera vez tarda)
pnpm start          # Metro para el dev build, en otra terminal
```

Después del primer build, basta con `pnpm start` y abrir la app instalada.

### 4. Cuenta de prueba

Crea una cuenta desde la app (correo + contraseña, mayor de 18). Para probar el match y el chat necesitas dos cuentas: usa dos emuladores, o el emulador y un teléfono.

## Scripts

| Script | Qué hace |
|---|---|
| `pnpm start` | Metro para el dev build |
| `pnpm android` / `pnpm ios` | Compila e instala el dev build |
| `pnpm verify` | `tsc` + ESLint + Jest (lo mismo que exige cada commit) |
| `pnpm test` | Jest |
| `pnpm gen:api` | Regenera los tipos del cliente desde `../encorly_back/contracts/openapi.v1.json` |
| `pnpm check:expo` | Revisa que las dependencias coincidan con el SDK 57 |

## Contrato con el back

Los tipos de la API no se escriben a mano: `pnpm gen:api` los genera del OpenAPI exportado por el back y `src/lib/api/types.ts` solo les da nombres. Si el back cambia el contrato (ver `encorly_back/contracts/CHANGELOG.md`), regenera y deja que `tsc` diga qué ajustar.

## Integraciones externas autorizadas

| Integración | Para qué | Qué falta configurar |
|---|---|---|
| Previews de iTunes Search | Audio de 30 s en Descubrir (las URLs vienen del back) | Nada |
| Push (Expo Push → FCM/APNs) | Avisos sin contenido de mensajes y matches | Proyecto EAS (`EXPO_PUBLIC_EAS_PROJECT_ID`), `google-services.json` de Firebase y credencial FCM v1 en EAS; APNs para iOS |
| Spotify (opcional) | Importar tus artistas más escuchados | Registrar `encorely://spotify-callback` en el Spotify Dashboard y agregar usuarios de prueba (modo desarrollo: máximo 5) |

Sin esas credenciales la app funciona igual: el push y Spotify se desactivan con un aviso claro.
