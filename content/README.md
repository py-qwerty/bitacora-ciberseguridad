# Banco de preguntas

Cinco asignaturas, diez temas por asignatura y treinta preguntas por tema: **1.500 preguntas**. `coverage.json` registra la distribución calculada, y `source-index.json` el número de páginas de los cincuenta materiales docentes. Los índices no incluyen rutas del ordenador. Los 50 PDF originales se publican en `dist/materials/`; `materials.json` registra el título de la portada, la asignatura, el número de tema, el enlace, las páginas, el tamaño y la huella de integridad SHA-256 (Secure Hash Algorithm de 256 bits).

`base/` conserva las 860 preguntas de práctica ya preparadas a partir del temario. `additions/` completa la cobertura con preguntas del test de cada tema y nuevos casos. El tema 1 de Sistemas incorpora las diez soluciones observadas en el campus el 2 de noviembre de 2026; esta confirmación no se extiende a los demás temas.

Cada pregunta tiene cuatro opciones en orden fijo, una respuesta, explicación, dificultad y página de referencia. Las siglas del glosario se expanden en la explicación. Cuando un ejercicio del material resulta ambiguo, carece de la imagen necesaria o contiene un error, se formula un caso equivalente de práctica y se conserva la explicación de la adaptación en `source.adaptation`. No se presenta una clave inventada como una corrección del campus.

Reconstruir el banco servido:

```sh
npm run bank
npm run check
```

Los ejercicios de normativa se interpretan en el contexto y versión citados. Se han reparado, entre otros, los casos sobre cookies no exentas, encargados del tratamiento, requisitos de firma cualificada, clasificación NIS 2 y denuncia telemática. Referencias primarias utilizadas para esas correcciones:

- [Ley 34/2002, servicios de la sociedad de la información y comercio electrónico](https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758).
- [Ley 6/2020, determinados aspectos de los servicios electrónicos de confianza](https://www.boe.es/buscar/act.php?id=BOE-A-2020-14046).
- [Reglamento 910/2014, identificación electrónica y servicios de confianza](https://www.boe.es/buscar/doc.php?id=DOUE-L-2014-81822).
- [Directiva 2022/2555, NIS 2](https://www.boe.es/buscar/doc.php?id=DOUE-L-2022-81963).
- [Ley de Enjuiciamiento Criminal, artículo 266](https://www.boe.es/buscar/act.php?id=BOE-A-1882-6036#a266).

Las claves de práctica están razonadas para el aprendizaje. La revisión editorial y las pruebas de integridad no equivalen a validación independiente de cada respuesta por el profesorado. El banco no es un examen oficial.

`clases/` contiene las «preguntas de clase»: hasta diez por tema, basadas en lo que los profesores remarcaron en las clases grabadas. No cuentan en las 1.500 del banco base ni en el test completo de 30; forman un test aparte por tema (`fromClass: true`).

## Esquemas con iconos

Un apartado puede incluir `{ "type": "diagram", "kind": "hub|flow|layers|compare", ... }`. Los iconos salen de la lista cerrada `ICONS` de `dist/core.js` (Tabler Icons, licencia MIT) y `validateTema` rechaza iconos o formas no válidos. Solo se permite **negrita** en los textos.
