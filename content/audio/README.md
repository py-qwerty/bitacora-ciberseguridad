# Guiones de audio

Un guion por tema: `content/audio/<asignatura>/tema-NN.json`. Es lo que se narra con ElevenLabs (`scripts/build-audio.mjs`). **No es la lectura del tema**: es un resumen explicado de cada apartado, como lo contaría un buen profesor en un minuto, para escucharlo antes de leer o para repasar.

## Formato

```json
{
  "course": "sistemas",
  "number": 2,
  "sections": {
    "<id del apartado>": [
      { "b": 0, "text": "Primera idea, explicada de palabra." },
      { "b": 3, "text": "Segunda idea." },
      { "b": 7, "text": "Cierre con la idea clave." }
    ]
  }
}
```

- Tiene que haber una entrada por **cada** apartado del tema, con su mismo `id`.
- `b` es el número del bloque del tema que ese trozo está explicando (el primero es 0). La web resalta ese bloque mientras suena. Los `b` van en orden creciente (se pueden repetir o saltar bloques). Para ver los bloques numerados: `node scripts/outline-tema.mjs <asignatura>/<número>`.
- El título del apartado se lee solo: no hay que repetirlo.

## Cómo se escribe

- **Entre 600 y 1.100 caracteres por apartado** (unos 45-75 segundos), en 3 a 5 segmentos. Los apartados muy densos pueden llegar a 1.400.
- Se cuenta lo esencial: qué es, para qué sirve, la diferencia que hay que tener clara y **cómo cae en el test** (la trampa típica, si el tema la señala). Se termina con la idea clave.
- Para quien empieza de cero: español claro, de tú, frases cortas. Se puede usar la analogía del tema si ayuda, en una frase.
- Está escrito para el oído: nada de listas, tablas, paréntesis largos, negritas ni símbolos. Una tabla se cuenta como contraste («la intimidad reacciona; la protección de datos se adelanta»). Un esquema se cuenta como recorrido («primero…, después…, y al final…»).
- Las siglas se dicen con su significado la primera vez en cada apartado («el CCN, el Centro Criptológico Nacional»). Los números, artículos de ley y nombres exactos se mantienen tal como están en el tema, sin inventar ninguno.
- Solo texto plano: sin `**`, sin comillas raras, sin saltos de línea, sin código. Si hay que nombrar un comando o una cabecera, se dice de palabra.
- No se añade nada que no esté en el tema.

## Comprobar y generar

```
node scripts/build-audio.mjs --plan          # valida todos los guiones y enseña el coste
node scripts/build-audio.mjs sistemas/2      # narra lo que falte de ese tema
```

Las voces se turnan, una por apartado (cuatro por defecto; `--voice id1,id2` para elegir otras). Cambiar las voces no regenera lo ya narrado: para rehacerlo, `--force`.
