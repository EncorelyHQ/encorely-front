# Publicar Encorely en App Store y Google Play

La v1 **no se publica** (decisión D15 del reporte). Este documento deja todo listo para que publicar sea un paso, no un
proyecto. Estado a la fecha de esta rama (`rebuild/v1`).

Leyenda: ✅ hecho en el repo · 🟡 hecho a medias o con placeholder · ⬜ lo hace el dueño · ⛔ falta en el back.

## 1. Cuentas

| Qué | Estado | Nota |
|---|---|---|
| Apple Developer Program | ⬜ | 99 USD/año. Sin Mac: EAS firma y sube. |
| Google Play Console | ⬜ | 25 USD único. **Cuenta personal creada después del 13-11-2023: prueba cerrada con ≥ 12 testers que sigan inscritos 14 días seguidos** antes de poder pedir producción. Ver §9. |
| Expo (EAS) | ⬜ | `pnpm dlx eas-cli@24.13.0 login` y `pnpm dlx eas-cli@24.13.0 init` (escribe `extra.eas.projectId` en `app.json`; hoy no está). |
| Dominio y correo del responsable | ⬜ | Hace falta para el canal de reclamos (Ley 1581) y la ficha de las tiendas. |

## 2. Build firmado (EAS)

`eas.json` tiene cuatro perfiles (`cli.appVersionSource: remote`: EAS lleva el `versionCode`/`buildNumber`):

| Perfil | Para qué | API |
|---|---|---|
| `development` | Dev client interno, APK | `http://10.0.2.2:5000` (back local visto desde el emulador Android) |
| `development-simulator` | Igual, para el simulador iOS (reemplaza al viejo `validation-ios-simulator`) | igual |
| `preview` | Instalable interno (APK / ad hoc iOS) para QA y testers | 🟡 placeholder `https://api-staging.encorely.example` |
| `production` | AAB para Play / IPA para App Store, `autoIncrement` | 🟡 placeholder `https://api.encorely.example` |

Los perfiles `validation-*` anteriores se reemplazaron: no tenían `EXPO_PUBLIC_API_URL`, así que el build arrancaba sin
servidor (la app muestra "no tiene configurada la dirección del servidor"). `development` cubre `validation-android`,
`development-simulator` cubre `validation-ios-simulator` y `preview` cubre `validation-ios-device`.

> El `development` usa HTTP en claro hacia `10.0.2.2`: funciona porque el dev client es un build *debug*. Los builds
> `preview` y `production` deben apuntar a HTTPS.

Comandos (desde la raíz del front):

```bash
# Una vez
pnpm dlx eas-cli@24.13.0 login
pnpm dlx eas-cli@24.13.0 init
pnpm dlx eas-cli@24.13.0 credentials          # EAS genera keystore Android y certificados/perfiles iOS

# Builds
pnpm dlx eas-cli@24.13.0 build -p android --profile preview      # APK para testers
pnpm dlx eas-cli@24.13.0 build -p android --profile production   # AAB firmado
pnpm dlx eas-cli@24.13.0 build -p ios --profile production       # IPA firmada (requiere cuenta Apple)

# Envío
pnpm dlx eas-cli@24.13.0 submit -p ios --profile production --latest
pnpm dlx eas-cli@24.13.0 submit -p android --profile production --latest
```

`submit.production` está vacío a propósito: sin valores, `eas submit` pregunta lo que falte y guarda lo seguro en EAS.
Cuando haya cuentas, se completa con:

- iOS: `ascAppId` (ID numérico de la app en App Store Connect). La llave de la API de App Store Connect la gestiona
  `eas credentials`, nunca en el repo.
- Android: `serviceAccountKeyPath` (JSON de la cuenta de servicio de Google, **fuera del repo**, `*.json` de llaves no se
  commitea) y `track: "internal"` para subir a prueba interna. **La primera subida a Play es manual** desde la consola
  (Google lo exige para crear la app); después `eas submit` sirve.

Android **target SDK**: 36 sin configurar nada. Expo SDK 57 / React Native 0.86 lo fija en
`node_modules/react-native/gradle/libs.versions.toml` (`targetSdk = "36"`, `compileSdk = "36"`), que el plugin raíz de
Expo usa por defecto. Cumple el requisito de Play (≥ 36 para apps nuevas y actualizaciones desde el 31-08-2026).
No hace falta `expo-build-properties`.

## 3. Icono, splash y capturas

| Qué | Estado | Requisito |
|---|---|---|
| Icono iOS | ✅ `assets/icon.png` 1024×1024 RGB sin alfa | App Store: 1024×1024, sin transparencia |
| Icono adaptativo Android | ✅ foreground/background/monochrome 1024 | Play: además icono de ficha 512×512 PNG 32 bits ⬜ (exportarlo del mismo arte) |
| Splash | ✅ `assets/splash-icon.png` sobre `#121110` | — |
| Feature graphic Play | ⬜ | 1024×500, sin texto pegado a los bordes |
| Capturas iPhone | ⬜ | 6,9" (1320×2868 o 1290×2796), 3 a 10. No hay iPad (`supportsTablet: false`) |
| Capturas Android | ⬜ | Teléfono, 2 a 8, 9:16 |

Capturas a tomar (con datos del seed, nunca con datos inventados ni personas reales):

1. Descubrir: una canción del catálogo con su portada, botones **Paso** / **Me gusta**.
2. Conciertos: lista por ciudad con el filtro.
3. Detalle de un concierto con la boleta y **Voy a este concierto**.
4. Radar del concierto con personas afines (géneros en común).
5. Pantalla de match (la boleta compartida).
6. Chat con el indicador "Cifrado de extremo a extremo".
7. Verificación del chat con el código de seguridad / QR.
8. Tú: perfil y "Tu música".
9. (Opcional) Términos y privacidad, para mostrar el control de datos.

## 4. Política de privacidad y términos (URL)

El back las publica y la app las abre desde **Tú → Términos y privacidad** (`/settings/legal`) y en el registro:

| Documento | URL (base = `Legal:PublicBaseUrl` del back) | Estado |
|---|---|---|
| Política de tratamiento de datos | `<base>/legal/privacidad` | ✅ en el back · 🟡 `PublicBaseUrl` por defecto es `http://localhost:5000` |
| Términos | `<base>/legal/terminos` | igual |
| Borrado de cuenta web | `<base>/cuenta/eliminar` | igual |

⬜ Definir `Legal__PublicBaseUrl` con el dominio HTTPS público antes de cualquier build `preview`/`production`.
Esa misma URL de privacidad va en la ficha de App Store Connect y en Play Console.

## 5. Etiquetas de privacidad (App Store "App Privacy" y Play "Data safety")

Inventario sacado del contrato (`src/lib/api/schema.d.ts`) y del back. Respuestas comunes a toda la tabla:

- **Cifrado en tránsito: sí** (HTTPS obligatorio en `preview`/`production`).
- **Rastreo / tracking: no.** No hay SDK de publicidad, analítica ni crash reporting. `NSPrivacyTracking: false`.
- **Compartido con terceros: no** (en el sentido de Play: transferir a un tercero). El hosting del back y el servicio
  de push de Expo/Apple/Google actúan como **proveedores de servicio**, que Play excluye de "compartir".
- **Venta de datos / publicidad: no.**
- **Vinculado a la identidad: sí** para todo lo de la cuenta.
- **Borrable: sí.** Borrar la cuenta (app o web) elimina en cascada perfil, swipes, likes, matches, mensajes, llaves,
  tokens, push tokens y consentimientos (`UserService.DeleteAsync`). Los reportes de moderación se conservan sin la
  identidad vinculada.

| Dato | ¿Se recolecta? | Obligatorio | Visible para otros usuarios | Finalidad | Play: categoría | App Store: categoría |
|---|---|---|---|---|---|---|
| Correo | Sí | Sí | No | Cuenta, login | Info personal → Correo | Contacto → Correo |
| Nombre para mostrar | Sí | Sí | Sí (radar, match, chat) | Funcionalidad | Info personal → Nombre | Contacto → Nombre |
| Contraseña | Solo hash bcrypt en el back | Sí | No | Autenticación | No es un tipo de dato de la ficha | Igual |
| Fecha de nacimiento | Sí (otros ven solo la edad) | Sí | Edad sí, fecha no | Verificar 18+, funcionalidad | Info personal → Otra info | Otros datos |
| Ciudad | Sí, **escrita por el usuario**, no ubicación del dispositivo | Sí | Sí | Mostrar conciertos cercanos | Info personal → Otra info | Otros datos (no es "ubicación": no se lee GPS) |
| Biografía | Sí | No | Sí | Funcionalidad | Actividad → Otro contenido del usuario | Contenido → Otro contenido del usuario |
| Géneros musicales declarados | Sí | Sí (≥ 1) | Sí ("les gusta") | Afinidad y sugerencias | Actividad → Otro contenido del usuario | Otros datos |
| Swipes (me gusta / paso) | Sí | No | No | Afinidad (personalización en la app) | Actividad → Interacciones en la app | Uso → Interacción con el producto |
| Artistas y géneros de Spotify | Sí, solo si conecta Spotify; el token de Spotify **no** sale del teléfono | No | No | Afinidad | Actividad → Otro contenido del usuario | Otros datos |
| Asistencia a eventos | Sí | No | Sí (radar del evento) | Funcionalidad (radar) | Actividad → Otras acciones | Uso → Interacción con el producto |
| Likes y matches | Sí | No | El otro lado del match | Funcionalidad | Actividad → Otras acciones | Uso → Interacción con el producto |
| Mensajes del chat | **Cifrados de extremo a extremo**: el servidor guarda texto cifrado y metadatos (quién, cuándo) y los borra tras la entrega | No | El destinatario | Funcionalidad | Ver nota (*) | Contenido → Correos o mensajes de texto (ver nota) |
| Contenido de mensajes reportados | Sí, **solo si el usuario reporta** (adjunta el texto descifrado como evidencia, con franking) | No | Moderación | Seguridad, prevención de fraude | Mensajes → Otros mensajes en la app | Contenido → Correos o mensajes de texto |
| Reportes y bloqueos | Sí | No | No | Seguridad y moderación | Actividad → Otras acciones | Otros datos |
| Token de push (Expo) | Sí, si acepta avisos | No | No | Avisos sin contenido (nuevo match/mensaje) | Dispositivo u otros IDs | Identificadores → ID del dispositivo |
| Llaves públicas de cifrado (Ed25519/X25519) | Sí (las privadas **nunca** salen del teléfono) | Sí para chatear | El match (para verificar) | Seguridad (E2EE) | Dispositivo u otros IDs | Otros datos |
| Respaldo cifrado de llaves (`/me/backup`) | Sí, solo si se activa; cifrado en el teléfono | No | No | Funcionalidad | Archivos y docs | Otros datos |
| Sesiones (refresh tokens) | Sí (hash) | Sí | No | Seguridad de la cuenta | No es un tipo de dato de la ficha | — |
| Consentimientos (versión y fecha) | Sí | Sí | No | Cumplimiento legal (Ley 1581) | No es un tipo de dato de la ficha | — |

(*) Play exime de declarar como recolectados los datos que salen del dispositivo pero que el desarrollador no puede
leer por el cifrado de extremo a extremo ([ayuda de Play, Data safety](https://support.google.com/googleplay/android-developer/answer/10787469)).
Encorely igual **sí** puede leer el texto de un mensaje cuando el usuario lo reporta, así que "Mensajes" se declara como
recolectado, opcional, con finalidad "Seguridad / prevención de fraude". En App Store se declara lo mismo por prudencia.

Datos que **no** se recolectan (responder "no" en las fichas): ubicación precisa o aproximada del dispositivo, fotos o
videos (no hay fotos de perfil en v1), audio, contactos, calendario, salud, finanzas, historial web, diagnósticos,
identificador de publicidad. La cámara se usa solo para leer el QR de verificación y no guarda ni envía imágenes.

Privacy manifest de iOS: ✅ en `app.json` → `ios.privacyManifests` (ver §10).

## 6. Borrado de cuenta

| Requisito | Estado |
|---|---|
| Dentro de la app (App Store 5.1.1(v), Play) | ✅ **Tú → Borrar cuenta** (escribir BORRAR). `DELETE /me` |
| Por URL web, sin la app (Play) | ✅ en el back: `<base>/cuenta/eliminar` (correo + contraseña, `POST /account-deletion`, con rate limit). La app la muestra en **Términos y privacidad → Borrar la cuenta desde la web**. 🟡 depende de `PublicBaseUrl` |
| Declararla en Play Console (Data safety → URL de borrado) | ⬜ |

## 7. Contenido generado por usuarios: reportar, bloquear, contacto

| Requisito (App Store 1.2, Play UGC) | Estado |
|---|---|
| Reportar a una persona o mensaje | ✅ desde el chat (**Más opciones → Bloquear o reportar**), con evidencia verificable (franking) |
| Bloquear | ✅ desde el chat; lista y desbloqueo en **Tú → Personas bloqueadas** |
| Moderación | ✅ en el back: `/admin/reports` y suspensión de usuarios (panel admin) |
| **Atender reportes en ≤ 24 h** (lo exige Apple para apps con UGC) | ⬜ proceso del dueño: alguien revisa el panel a diario. Escribir el compromiso en los términos y en las notas para el revisor |
| Contacto publicado | ⛔/⬜ ver §8 |

## 8. Ley 1581 de 2012 (Colombia)

| Requisito | Estado |
|---|---|
| Autorización previa, expresa e informada | ✅ casilla obligatoria en el registro con enlaces a términos y política; el back exige `acceptTerms` y la versión vigente y guarda versión + fecha (prueba de la autorización) |
| Re-consentimiento cuando cambia la política | 🟡 pantalla `/consent` lista (`ConsentGate`), **pero el back no expone qué versión aceptó el usuario** (⛔ ver "Pendientes del back"). Hoy solo se activa si una petición autenticada responde `code: consent_required` |
| Aviso de privacidad / política publicada | ✅ en el back (`/legal/privacidad`), incluye finalidades, derechos y cómo ejercerlos |
| Derechos: acceso (copia), rectificación, supresión | ✅ **Descargar mis datos** (`GET /me/export`), **Editar perfil**, **Borrar cuenta** |
| Canal de consultas y reclamos | ⛔/⬜ El back no expone canal y la política dice "usa el contacto publicado en la ficha". Constante pendiente en `src/features/account/contact.ts` (`PRIVACY_CONTACT_EMAIL = null`); la app hoy lo indica así. **El dueño define el correo** y, mejor, lo expone el back en `/legal/current` y en la política |
| Plazos (consultas 10 días hábiles, reclamos 15) y queja ante la SIC | ✅ informados en **Términos y privacidad** |
| Transferencia internacional (si el hosting está fuera de Colombia) | ⬜ mencionarla en la política (art. 26) |
| Registro Nacional de Bases de Datos (SIC) | ⬜ verificar si aplica según el tamaño del responsable |

## 9. Clasificación, cuenta demo y revisión

- **Clasificación 18+**: App Store → cuestionario de edad con "Contenido generado por usuarios / citas" → 18+.
  Play → cuestionario IARC (app social/de citas) y en "Público objetivo" solo 18+. La app valida 18+ en el onboarding
  con la fecha de nacimiento (el back lo vuelve a validar).
- **Cuenta demo para revisores**: `revisor@encorely.demo` (seed del back, ciudad Bogotá, va a varios conciertos).
  La contraseña es `DEMO_USER_PASSWORD` del `.env` del back: **la define el dueño y se escribe solo en App Store Connect
  (App Review Information) y en Play Console (Acceso a la app)**, nunca en el repo.
  ⬜ El seed **no crea matches**: para que el revisor pueda probar chat, reportar y bloquear, antes de enviar hay que
  crearle un match con otra cuenta demo (ver `docs/e2e.md`, "Preparar el match") y explicarlo en las notas.
- **Notas para el revisor** (plantilla): qué hace la app; dónde está borrar cuenta, reportar y bloquear; que los chats
  son E2EE y por qué la cámara (QR de verificación); que los reportes se atienden en ≤ 24 h.
- **Prueba cerrada de Play (cuenta personal)**: 12 testers como mínimo, inscritos **14 días seguidos** en la pista de
  prueba cerrada, antes de solicitar acceso a producción. Usar el build `production` (AAB) en la pista cerrada; el APK
  `preview` sirve para QA interno pero no cuenta.
- Riesgo App Store: Apple es estricta con apps de citas (guía 4.3, categoría saturada). Diferenciar en la ficha: el
  foco es ir a conciertos con gente afín, no un swipe de personas.

## 10. Cifrado y export compliance

**Decisión: `ios.config.usesNonExemptEncryption: true`** en `app.json` (Expo lo escribe como
`ITSAppUsesNonExemptEncryption = YES` en el `Info.plist`).

Por qué: el chat cifra de extremo a extremo **dentro de la app** (X25519, Ed25519 y XChaCha20-Poly1305 con `@noble/*`) y el historial
local usa SQLCipher. Apple solo considera exenta la criptografía del propio sistema operativo (HTTPS vía URLSession,
etc.); usar algoritmos estándar implementados en la app **no** es exento, aunque sean estándar
([Apple: Complying with encryption export regulations](https://developer.apple.com/documentation/security/complying-with-encryption-export-regulations)).
Expo pide marcar `false` solo si la app y sus librerías no usan cifrado más allá del exento
([Expo: TestFlight, "Missing Compliance"](https://docs.expo.dev/submit/testflight)).

Qué hace el dueño en App Store Connect al subir el primer build:

1. Responder el cuestionario de cifrado: algoritmos estándar (no propietarios), para proteger datos del usuario;
   califica como *mass market* (EAR categoría 5 parte 2, ECCN 5D992.c, excepción 740.17(b)(1)). Confirmar con el
   cuestionario vigente si pide documentación o el reporte anual de autoclasificación al BIS.
2. **Francia**: la distribución de cifrado no exento exige declaración ante la ANSSI. Si no se va a hacer, excluir
   Francia de la disponibilidad.
3. Cuando Apple entregue un código de cumplimiento, agregarlo como `ios.infoPlist.ITSEncryptionExportComplianceCode`
   para no repetir el cuestionario en cada build. No inventar ese valor.

**Privacy manifest** (`ios.privacyManifests` en `app.json`): `NSPrivacyTracking: false`, sin dominios de rastreo y las
APIs de "required reason" que usan las dependencias nativas. Los códigos salen de los `PrivacyInfo.xcprivacy` que traen
los paquetes instalados (Apple no siempre los lee bien desde pods estáticos, por eso Expo recomienda repetirlos en el
manifiesto de la app: [Expo: Apple privacy](https://docs.expo.dev/guides/apple-privacy/)):

| Categoría | Razones | Quién la usa |
|---|---|---|
| UserDefaults | `CA92.1` | react-native, expo-constants, expo-notifications |
| FileTimestamp | `C617.1`, `0A2A.1`, `3B52.1` | react-native, async-storage, expo-application (`C617.1`); expo-file-system (`0A2A.1`, `3B52.1`) |
| SystemBootTime | `35F9.1` | react-native (timing), expo-device |
| DiskSpace | `E174.1`, `85F4.1` | expo-file-system |

Si se agrega una dependencia nativa, revisar su `ios/PrivacyInfo.xcprivacy` y sumar sus razones. Apple avisa por correo
tras una subida si falta alguna.

**Permisos** (textos en español, mínimos): cámara ✅ ("solo para escanear el código de seguridad…"); micrófono
desactivado en `expo-audio`/`expo-camera` y `RECORD_AUDIO` bloqueado en Android; notificaciones con primer propio
antes del diálogo del sistema; Face ID desactivado en SecureStore. No hay ubicación, fotos ni contactos.

## 11. Spotify

| Requisito | Estado |
|---|---|
| Conexión opcional con PKCE en el dispositivo; el token no llega al back | ✅ |
| Atribución (nombre/logo de Spotify donde se muestre contenido suyo) | 🟡 revisar la tarjeta de conexión contra las [Design Guidelines de Spotify](https://developer.spotify.com/documentation/design) |
| Cumplir la Developer Policy (no usar datos para entrenar modelos ni para publicidad; borrar al desconectar) | 🟡 revisar al publicar |
| Modo desarrollo limitado a pocos usuarios registrados a mano en el dashboard de Spotify | ⬜ la cuota extendida exige solicitud aparte; si no se obtiene, publicar con Spotify desactivado o como función para testers |

`extra.spotifyClientId` en `app.json` es un **client ID público** (PKCE no usa secreto): puede ir en el repo.

## Pendientes del back (bloquean partes de este checklist)

1. **Versión aceptada en `GET /me`** (p. ej. `acceptedConsentVersion: string | null`) o un middleware que responda
   `403` con `code: consent_required` cuando la última versión aceptada no es la vigente. El front ya lee ambos
   (`src/features/account/consent.ts`); sin esto el re-consentimiento no se dispara solo.
2. **Canal de contacto** en `GET /legal/current` (correo del responsable) y en la política, en vez de "el contacto
   publicado en la ficha".
3. **Sesión actual en `GET /me/sessions`** (`current: true` o un claim `sid` en el JWT) y, si se quiere, plataforma del
   dispositivo. Hoy el front infiere "Este teléfono" cruzando `lastUsedAt` con el `iat` del token; si no logra
   reconocerla, ofrece cerrar todas.
4. `Legal__PublicBaseUrl` con HTTPS público y staging real para `preview` y para Maestro en EAS.
