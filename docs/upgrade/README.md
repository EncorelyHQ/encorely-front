# Actualización del frontend

Fecha: 2026-10-13. Entorno local, rama `codex/actualizar-dependencias`. Referencia inicial: `ff115419cf21e6b97674117f3c93b45da2f2328c`.

Expo se migró por etapas 54 → 55 → 56 → 57. La resolución final es Expo 57.0.28, React 19.2.3 y React Native 0.86.3. Las dependencias nativas se alinearon con `expo install`. [Inventario](INVENTORY.md), [resolución](inventory-after.json), [baseline](baseline.json) y `pnpm-lock.yaml` permiten revisar los cambios.

`expo-av` se sustituyó por `expo-audio`. El hook de preview mantiene reproducción al mostrar la tarjeta, pausa, progreso, fin y liberación al cambiar/desmontar; cancela respuestas tardías y tolera errores de inicialización. Se añadieron seis pruebas. `expo-asset` es el peer nativo requerido. No se habilitan grabación, micrófono ni reproducción en segundo plano. Se retiró `victory-native` tras comprobar que no había imports activos.

Se sustituyó `StyleSheet.absoluteFillObject` por `absoluteFill`, con el mismo estilo, porque RN 0.86 retiró la propiedad anterior. Splash mantiene imagen y color mediante el plugin admitido. Se corrigió el harness Jest y el alias TypeScript. La revisión React comprobó dependencias de hooks y liberación de recursos; no se cambiaron estilos, navegación ni reglas de afinidad.

## Reproducir comprobaciones

Usar Node 24 LTS y el pnpm 12.11.2 declarado en packageManager. Desde el repositorio:

```powershell
pnpm install --frozen-lockfile
pnpm check:expo
pnpm typecheck
pnpm test
pnpm dlx expo-doctor
pnpm build:bundles
```

Resultados: 30 pruebas aprobadas; typecheck correcto; Expo Doctor 21/21; peers y matriz correctos. Exportación web, Android e iOS correcta. Node 24.21.0 y Node 26 se probaron sin cambiar instalaciones globales. La exportación JavaScript/Hermes no constituye un build nativo APK/IPA. Los logs en este directorio incluyen fallos intermedios corregidos y resultados finales (`node24-tests.txt`, `node24-typecheck.txt`, `expo-doctor.txt`, `build-all.txt`, `frozen-install.txt`).

## Excepciones de compatibilidad y seguridad

TypeScript 6, Jest 29, test-renderer 1.2 y AsyncStorage 2.2 respetan las dependencias y peers de Expo 57/React 19.2.3. Versiones individuales más nuevas no satisfacen esa matriz. No se incluyeron betas. [Matriz oficial](https://docs.expo.dev/versions/v57.0.0/).

Overrides transitivos compatibles redujeron los avisos npm de 63 a cuatro, sin críticos. Persisten dos altos y dos moderados. Ver [auditoría completa](pnpm-audit.json) y [rutas y advisories](security-exceptions.json).

| Paquete | Severidad | Motivo pendiente |
|---|---|---|
| node-forge 1.4.0 | Alta | La corrección 1.4.1 indicada no estaba publicada |
| braces 3.0.3 | Alta | La corrección 3.0.4 indicada no estaba publicada |
| sprintf-js 1.1.3 | Moderada | La corrección 1.1.4 indicada no estaba publicada |
| decode-uri-component | Moderada | 0.5 cambia a ESM; query-string CommonJS actual necesita una actualización compatible del consumidor |

El último aviso incluye una dependencia de ejecución de Expo Router; no todos los hallazgos son exclusivos de herramientas. Revisar registros y nuevas versiones compatibles antes de publicar; repetir auditoría tras cada corrección y comprobar navegación/URLs. No forzar versiones mayores solo para silenciar el informe.

## Checklist pendiente de aceptación

Propietario: mantenedor del proyecto, con cuentas y dispositivos de pruebas. Usar datos sintéticos y servicios aislados. Registrar plataforma, versión de build, resultado y evidencia por caso:

- Autenticación Spotify de cuentas nuevas/existentes, renovación y cierre de sesión; verificar correo del perfil y asociación con la cuenta existente.
- Onboarding completo y persistencia de progreso tras reiniciar.
- Swipes, umbral de 25 y afinidad del 70%; radar, matches y navegación.
- Chat, hubs SignalR, reconexión y eventos Kafka sin duplicación/pérdida.
- Playlists y persistencia en PostgreSQL; errores de red.
- Audio en dispositivo/web: autoplay permitido, pausa/reanudación, progreso, final, sin preview, URL fallida y cambio rápido de tarjeta.
- Comparación visual de pantallas restantes, móvil/tablet/escritorio, teclado y orientación. `baseline-*.jpg`, `current-*.jpg` y `visual-smoke.json` cubren solo onboarding pasos 1–3; no se hicieron acciones de cuenta.

## Builds nativos

`eas.json` contiene perfiles `validation-android` (APK), `validation-ios-simulator` y `validation-ios-device`. No se enviaron builds remotos ni se provisionaron certificados. El propietario debe autorizar/configurar EAS y sus credenciales antes de ejecutar builds que suban el repositorio. iOS requiere Mac/simulador o dispositivo y firma adecuada. Mínimos aceptados: iOS 16.4 y Android 7; la [documentación de Expo](https://docs.expo.dev/versions/v57.0.0/) recoge los requisitos.

## Rollback

Conservar primero los cambios de esta rama mediante commit o respaldo revisado. Crear una rama de recuperación desde la referencia inicial y reinstalar con el lockfile original. No ejecutar reset destructivo ni borrar archivos existentes. Si se publicó un build, el propietario debe restaurar el artefacto anterior y verificar compatibilidad del backend. No mezclar bundles OTA de distintos SDKs. La actualización local no publicó ningún artefacto.
