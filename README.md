# Bitácora Ciber

App móvil personal para estudiar las cinco asignaturas del máster de ciberseguridad: **30 preguntas por tema**, con explicaciones y referencia al material. Reutiliza el motor y el diseño de [Bitácora PER](https://github.com/py-qwerty/bitacora-per), la app del mismo usuario; los detalles técnicos están en UPSTREAM.md.

**[Abrir Bitácora Ciber](https://py-qwerty.github.io/bitacora-ciberseguridad/)** · [Código en GitHub](https://github.com/py-qwerty/bitacora-ciberseguridad)

## Estudiar

Asignatura → tema → tres tests de 10 preguntas o test completo de 30. Una pregunta por pantalla, opciones en su orden original, navegación con botones, número, teclado o deslizamiento. Respuestas y posición se guardan en el navegador. «Comprobar respuesta» muestra la solución, una explicación y su fuente. El avance automático está desactivado al principio para poder leer la explicación. Tras terminar se puede repasar todo o solo errores y blancos; repetir reinicia únicamente ese test después de confirmarlo.

Simulacros personales de 30 preguntas de una asignatura o mezcladas, con 45 minutos orientativos y sin penalización. No reproducen reglas oficiales de UNIR ni asignan notas al campus. Las soluciones se ocultan durante el intento. Solo se guarda el resultado final; recargar o cerrar pierde el simulacro activo.

## Ejecutar

Sin dependencias de producción ni compilación:

```sh
npm run dev
```

Abrir http://127.0.0.1:4174. Se necesita Python 3 para el servidor local; también sirve cualquier servidor de archivos estáticos apuntado a `dist/`. La navegación usa fragmentos de URL.

```sh
npm run check
```

El ejecutor de pruebas de Node.js comprueba la integridad del banco, generación y corrección de simulacros, bloques de 10/test completo30, datos guardados corruptos y contratos básicos de interfaz. Los datos se validan también al cargar la app.

## Datos y procedencia

El banco diferencia preguntas confirmadas en campus, test del temario y práctica añadida. Cada pregunta incluye explicación, dificultad y fuente. Las opciones conservan su orden, importante para expresiones como «A y B». Consultar `dist/bank.json` y la pantalla «Cómo estudiar y fuentes» para la procedencia concreta. No son exámenes oficiales; las cuestiones jurídicas describen el material docente citado y requieren comprobar fuentes vigentes cuando se utilicen fuera del estudio.

Este repositorio no incluye los PDF originales, credenciales, nombre del estudiante ni su historial de campus. El progreso personal se guarda solo en `localStorage` de este navegador, con un prefijo separado de PER, sin servidor, analítica o sincronización. Si el almacenamiento falla, la app lo avisa y permite seguir en memoria. Borrar los datos del navegador borra el progreso.

Repositorio público: [py-qwerty/bitacora-ciberseguridad](https://github.com/py-qwerty/bitacora-ciberseguridad). GitHub Actions comprueba el proyecto y publica `dist/` en GitHub Pages cuando se actualiza `main`; las propuestas de cambios solo ejecutan las pruebas. La web se puede abrir sin el servidor local. El manifiesto permite añadir un acceso como app en navegadores compatibles; no incorpora una caché sin conexión. Fuentes Manrope y Barlow Condensed servidas localmente; licencias en FONT-LICENSES/ y assets/font-licenses/.


Reconstruir las 1.500 preguntas desde las fuentes de contenido versionadas: `npm run bank`. Distribución por tema en [content/coverage.json](content/coverage.json) y detalles de procedencia en [content/README.md](content/README.md).
