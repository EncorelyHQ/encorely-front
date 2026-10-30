# Pruebas E2E con Maestro

Flujos en `.maestro/` (appId `com.encorely.app`). Prueban la app instalada, no el bundle web: Expo Go no sirve, hace falta un
development build o un build `preview`.

| Flujo | Qué prueba | Toca datos |
|---|---|---|
| `01-registro-onboarding` | Bienvenida → registro con consentimiento → fecha y ciudad → géneros → Descubrir | Crea una cuenta `e2e-<timestamp>@encorely.test` |
| `02-descubrir-swipe` | Calificar canciones con **Me gusta** / **Paso** (la alternativa accesible al gesto) | Guarda swipes de la cuenta de prueba |
| `03-asistencia-radar` | Abrir un concierto, **Voy a este concierto** y ver el radar (personas o estado vacío) | Marca asistencia |
| `04-chat-mensaje` | Abrir el chat con un match y enviar un mensaje cifrado | Envía un mensaje |
| `05-bloquear` | **Más opciones → Bloquear o reportar → Bloquear a …** y verlo en Personas bloqueadas | Bloquea al match (no se recupera) |
| `06-borrar-cuenta` | Registro de una cuenta desechable y borrado con la palabra BORRAR | Crea y borra una cuenta |

`subflows/` tiene las piezas comunes (abrir limpio, entrar, registrar, descartar el aviso de push). `config.yaml` fija el
orden: el 05 va casi al final porque deja al par bloqueado.

## Variables (nunca en los archivos)

Maestro lee automáticamente las variables del entorno que empiezan por `MAESTRO_`. Las credenciales salen de ahí; no hay
contraseñas escritas en ningún YAML ni en este documento.

| Variable | Uso |
|---|---|
| `MAESTRO_E2E_EMAIL` | Cuenta existente con onboarding completo (flujos 02–05). Sirve una demo del seed, p. ej. `revisor@encorely.demo` |
| `MAESTRO_E2E_PASSWORD` | Su contraseña. Para las demo es `DEMO_USER_PASSWORD` del `.env` del back |
| `MAESTRO_E2E_NEW_PASSWORD` | Contraseña para las cuentas desechables de los flujos 01 y 06 (12+ caracteres) |
| `MAESTRO_E2E_EVENT` | Nombre exacto de un concierto del seed, p. ej. `Reguetón Capital Bogotá` |
| `MAESTRO_E2E_PEER_NAME` | Nombre visible de alguien con quien `MAESTRO_E2E_EMAIL` ya tiene match (flujos 04 y 05) |

### Preparar el match de 04 y 05

El seed no crea matches. Con dos cuentas demo que van al mismo concierto (las dos marcan asistencia en el seed):
entra con A, abre el concierto, en el radar toca **Me interesa** en B; repite con B hacia A. Al segundo like aparece la
pantalla de match. `MAESTRO_E2E_PEER_NAME` es el nombre de B.

## Correr local

1. Back arriba con el seed y `DEMO_USER_PASSWORD` definido (ver README del back).
2. App instalada en el emulador: `pnpm android` (usa `EXPO_PUBLIC_API_URL` de tu `.env`; en el emulador Android el host es
   `http://10.0.2.2:5000`), o un build `development` de EAS.
3. Maestro instalado (`curl -fsSL "https://get.maestro.mobile.dev" | bash`).
4. Exporta las variables en la sesión (sin dejarlas en el historial: `read -s` las pide sin eco):

```bash
export MAESTRO_E2E_EMAIL='revisor@encorely.demo'
read -rs MAESTRO_E2E_PASSWORD && export MAESTRO_E2E_PASSWORD
read -rs MAESTRO_E2E_NEW_PASSWORD && export MAESTRO_E2E_NEW_PASSWORD
export MAESTRO_E2E_EVENT='Reguetón Capital Bogotá'
export MAESTRO_E2E_PEER_NAME='<nombre del match>'

maestro test .maestro                       # todo, en el orden de config.yaml
maestro test .maestro/02-descubrir-swipe.yaml
maestro test --include-tags=registro .maestro
```

Para depurar selectores: `maestro studio`.

## Correr en EAS (Workflows)

Requiere un back alcanzable desde la nube de EAS (staging real, no `10.0.2.2`) y su URL en el perfil `preview` de
`eas.json` (hoy es el placeholder `https://api-staging.encorely.example`).

1. Variables en EAS, entorno `preview`, visibilidad **Secret** para las contraseñas:

```bash
pnpm dlx eas-cli@24.13.0 env:create --environment preview --name MAESTRO_E2E_EMAIL --value 'revisor@encorely.demo' --visibility plaintext
pnpm dlx eas-cli@24.13.0 env:create --environment preview --name MAESTRO_E2E_PASSWORD --visibility secret   # pide el valor
pnpm dlx eas-cli@24.13.0 env:create --environment preview --name MAESTRO_E2E_NEW_PASSWORD --visibility secret
```

2. Workflow `.eas/workflows/e2e-android.yml` (no está creado: se agrega cuando exista staging):

```yaml
name: e2e-android
on:
  pull_request:
    branches: ['*']
jobs:
  build:
    type: build
    params:
      platform: android
      profile: preview
  maestro:
    needs: [build]
    type: maestro
    environment: preview
    runs_on: linux-large-nested-virtualization
    params:
      build_id: ${{ needs.build.outputs.build_id }}
      flow_path: ['.maestro']
      retries: 1
      record_screen: true
```

3. `pnpm dlx eas-cli@24.13.0 workflow:run .eas/workflows/e2e-android.yml`.

iOS: mismo job con un build de simulador (`development-simulator` o un perfil con `ios.simulator: true`).

Fuente: [EAS Workflows, job `maestro`](https://docs.expo.dev/eas/workflows/pre-packaged-jobs) y
[ejemplo E2E](https://docs.expo.dev/eas/workflows/examples/e2e-tests).

## Fragilidad conocida

- No hay `testID` en la app: los flujos usan textos y `accessibilityLabel` reales en español. Donde el label visible y
  el campo comparten texto (`Tu nombre`, `Contraseña`) se usa `index: 1`. Si cambian los textos, cambian los flujos.
  Recomendado: agregar `testID` a `TextField`, a los botones de Descubrir y al composer del chat.
- `05-bloquear` distingue el título del sheet y el botón por índice.
- El push primer se descarta con un `runFlow` condicional; si cambia su copy, el flujo sigue pero puede taparse la UI.
