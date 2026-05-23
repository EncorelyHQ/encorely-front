# Encorely — Arquitectura del frontend (referencia)

## 1. Propósito del documento

Este documento describe la **arquitectura del cliente móvil** (Expo / React Native), su organización en carpetas, principios de diseño y criterios prácticos. Está pensado como **referencia arquitectónica**: alinear decisiones, facilitar evolución del producto y mantener coherencia entre módulos.

No sustituye un tutorial de onboarding; asume familiaridad con React Native y Expo Router.

## 2. Objetivos de la arquitectura

### Objetivos técnicos

- **Escalar** la base de código por dominios funcionales sin mezclar responsabilidades.
- Facilitar **mantenimiento y extensión** (nuevas pantallas, integraciones, reglas de negocio).
- Reducir **acoplamiento** entre features; el código compartido vive en un solo lugar gobernado.
- Mantener un **punto único de configuración** para APIs y constantes de entorno.
- Preparar el terreno para **separación posterior** (por ejemplo, packages en monorepo) sin reescribir todo el árbol.

### Objetivos organizacionales

- Permitir trabajo en paralelo sobre **módulos** distintos con límites claros.
- Reducir conflictos de merge al tocar archivos “globales” solo cuando corresponde.
- Estandarizar **dónde** va cada tipo de código.

### Objetivos de producto / negocio

- Acelerar **time-to-market** al añadir features con una ubicación obvia.
- Reducir riesgo en **refactors** al limitar el blast radius por capa.
- Incorporar nuevos flujos (p. ej. social, pagos) como **módulos** nuevos.

## 3. Principios

- **Separación de responsabilidades**: cada carpeta tiene un rol definido (rutas vs dominio vs integración vs UI transversal).
- **Alta cohesión por dominio**: lo que pertenece a un feature vive bajo `modules/<feature>/`.
- **Bajo acoplamiento**: los módulos dependen de `shared` y `clients` mediante imports explícitos; no importan otros módulos salvo excepción justificada.
- **Reutilización controlada**: hooks, tipos y tema global en `shared`; evitar “basurero” en `shared` (regla: si solo lo usa un módulo, no debe vivir ahí).
- **Evolución segura**: cambios en Spotify o en un módulo no deberían obligar a tocar `app/` salvo nueva ruta o guard.

> **Nota**: Encorely es hoy una **aplicación modular monolítica** (un solo repo y un solo bundle). La organización sigue **ideas alineadas** con frontends modulares y buenas prácticas de “feature folders”; no implica por sí sola Module Federation ni despliegues independientes hasta que el equipo decida ese paso.

## 4. Visión general

Stack principal:

- **Expo SDK 54**, **expo-router** (rutas basadas en archivos bajo `src/app`).
- **React Native** + **TypeScript**.
- **styled-components** para tema y parte de la UI.

Jerarquía conceptual:

| Capa        | Rol |
|------------|-----|
| **app**    | Solo rutas y layouts de navegación Expo; pantallas delegadas en `modules`. |
| **routes** | Reglas transversales de navegación (p. ej. guard de autenticación). |
| **layout** | Envoltorios de pantalla reutilizables (shell, gradiente, safe area). |
| **modules**| Dominios: auth, home, swipe, radar, matches, perfil, ajustes, chat. |
| **shared** | Contexto global, hooks transversales, tema, tipos y utilidades puras. |
| **clients**| Clientes HTTP / integración con APIs externas (Spotify). |
| **config** | URLs, constantes y lectura de `expo-constants` / `extra`. |

## 5. Estructura de carpetas

Estructura real (resumen):

```text
src/
├── app/                 # Expo Router: _layout, grupos (auth)/(main), reexports a modules
├── config/              # Configuración (p. ej. Spotify: URLs, market, helpers de env)
├── clients/             # Integración remota (p. ej. clients/spotify/)
├── shared/
│   ├── context/
│   ├── hooks/
│   ├── theme/
│   ├── types/
│   └── utils/
├── layout/              # Shells de UI (p. ej. ScreenShell)
├── routes/              # NavigationGuard y lógica de enrutado global
└── modules/
    ├── auth/            # screens + hooks, context, lib, types, services, utils
    ├── onboarding/
    ├── home/
    ├── swipe/           # screens, components, hooks, services, …
    ├── radar/
    ├── matches/
    ├── profile/
    ├── settings/
    └── chat/
```

Cada módulo incluye carpetas reservadas: `utils/`, `hooks/`, `context/`, `lib/`, `types/`, `services/` (además de `screens/` y `components/` cuando aplique).

### Integración Encorely API

- **Config:** [`src/config/api.ts`](src/config/api.ts) — `extra.apiBaseUrl` en `app.json`.
- **HTTP + DTOs:** [`src/clients/http/`](src/clients/http/), [`src/clients/encorely/`](src/clients/encorely/).
- **Dominio:** `modules/<feature>/services/` → clientes REST (sin `fetch` en pantallas).
- Guía de endpoints: [`docs/api.md`](docs/api.md).

### 5.1 `app/` — Núcleo de rutas

- **`_layout.tsx`**: providers globales (tema, auth, onboarding, fuentes, splash), `Stack` raíz.
- **Grupos `(auth)`, `(main)` y `(onboarding)`**: login; tabs principales; onboarding en 6 pasos (`step-1` … `step-6`) con `NavigationGuard` que bloquea `(main)` hasta marcar onboarding completo.
- **Archivos de ruta** (`login.tsx`, `swipe.tsx`, …): en la práctica **reexportan** el `default` desde `modules/...`, manteniendo la convención de expo-router sin duplicar lógica.
- **`index.tsx`**: entrada inicial que redirige al flujo de onboarding; el guard ajusta según sesión Spotify y flag `encorely_onboarding_complete` en AsyncStorage.

Qué aporta: una sola fuente de verdad para la jerarquía de navegación sin mezclar lógica de negocio.

### 5.2 `config/` — Configuración centralizada

Ejemplo actual: `config/spotify.ts` con URLs de Accounts/API, constantes de mercado y playlist de fallback, y helpers que leen `expo.extra`.

Qué aporta: evitar URLs y magic numbers dispersos; alinear entornos (dev/prod) vía `app.json` / variables cuando se formalicen.

### 5.3 `clients/` — Acceso a servicios externos

Ejemplo: `clients/spotify/spotifyApi.ts` (token, perfil, tracks, audio-features, vibe) y `swipeFeed.ts` (batch para swipe).

Qué aporta: separar **transporte y API remota** de la UI y de la orquestación en hooks.

### 5.4 `modules/` — Dominios

Cada módulo agrupa lo propio del feature:

- **`screens/`**: componentes de pantalla exportados como default para `app/`.
- **`components/`**, **`hooks/`** (opcional): solo lo que es específico del dominio (p. ej. swipe: `SwipeStack`, `useSwipeEngine`).

Qué aporta: al añadir “eventos” o “pagos”, se crea un módulo nuevo sin reordenar todo el árbol.

### 5.5 `shared/` — Transversal

- **context**: p. ej. sesión Encorely y vibe persistido.
- **hooks**: auth Spotify, cálculo de vibe vector, stubs de matches.
- **theme**: tokens para styled-components, tema de login con StyleSheet.
- **types**: contratos comunes (`VibeVector`, tipos de match).
- **utils**: funciones puras (p. ej. similitud coseno entre vectores).

Qué aporta: un solo sitio para código realmente reutilizable; conviene vigilar que no crezca sin criterio.

### 5.6 `layout/` y `routes/`

- **`layout/`**: presentación repetible entre pantallas (shell + gradiente + safe area).
- **`routes/`**: lógica que no es “pantalla”, p. ej. redirección según sesión.

## 6. Flujo de dependencias (intención)

Dirección preferente:

```text
app  →  modules  →  shared
                  →  clients  →  config
layout / routes son consumidos por app o modules según necesidad
```

**Reglas práctical:**

- `config` no debe importar `modules` ni `app`.
- `clients` puede usar `config` y tipos de `shared` cuando aplique.
- `shared` no importa `modules`.
- Evitar dependencias circulares; si aparecen, extraer a `shared` o `config` según el caso.

## 7. Convenciones y buenas prácticas

**Nombres**

- Componentes y pantallas: **PascalCase** (`SwipeScreen`, `SwipeCard`).
- Hooks: prefijo **`use`** + camelCase (`useSpotifyAuth`).
- Archivos de cliente API: sufijo claro (`spotifyApi.ts`, `swipeFeed.ts`) o convención de equipo unificada.
- Constantes en configuración: **UPPER_SNAKE** en `config/` cuando sea global.

**Imports**

- Preferir alias **`@/`** → `src/` (ver `tsconfig.json` y `experiments.tsconfigPaths` en Expo).

**Dominio vs shared**

- Regla heurística: *¿lo usan 2+ módulos sin acoplarse al detalle de uno?* → candidato a `shared`. Si no, permanece en el módulo.

**Rutas**

- Mantener `src/app` **delgado**: una línea de reexport hacia el screen del módulo facilita localizar el feature.

## 8. Beneficios esperados

- Escalabilidad por dominio sin rutas planas interminables.
- Impacto acotado al cambiar Spotify o un solo módulo.
- Navegación del repo más predecible para nuevos desarrolladores.
- Base coherente si el equipo evoluciona hacia packages o un monorepo.

## 9. Consideraciones de evolución

Posibles siguientes pasos (no obligatorios):

- Capa **`application/`** o casos de uso si la orquestación entre varios clientes crece.
- Conectar pantallas a `modules/*/services` (Encorely API ya scaffolded en `clients/encorely`).
- SignalR (`notificationHub`, `venueHub`) en `clients/encorely/signalr.ts` (TODO).
- Extraer módulos a workspaces npm/pnpm si el tamaño del equipo o del código lo justifica.
- Module Federation es propio del **ecosistema web**; en React Native el paralelo suele ser **monorepo + packages** o múltiples apps, no el mismo mecanismo.

## 10. Cómo ejecutar el proyecto

```bash
pnpm install   # o npm install
pnpm start     # expo start
```

Requisitos: Node LTS, entorno Expo (iOS Simulator / Android / Expo Go según flujo).

---

## Conclusión

La arquitectura de Encorely prioriza **claridad de capas**, **features agrupados** y **integraciones aisladas en `clients`**, alineada con objetivos de mantenimiento y crecimiento del producto. Está pensada para sostener el proyecto a **mediano plazo**, ajustando capas adicionales solo cuando la complejidad del dominio lo exija.
