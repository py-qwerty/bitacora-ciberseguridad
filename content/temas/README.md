# Temas digitales

Un tema digital por tema del temario: `content/temas/<asignatura>/tema-NN.json`. `npm run temas` los valida y los publica en `dist/temas/<id>.json`, donde `<id>` es el identificador numérico global del tema en `bank.json`. La app los carga solo cuando se abre el tema.

## Para quién se escribe

Para una persona que **solo sabe algo de informática** y empieza el máster desde cero. El tema tiene que ser súper didáctico:

- Español claro, frases cortas y un tono cercano («imagina que…», «fíjate en que…»).
- Se define cada término y cada sigla la primera vez que aparece: «GPO (Group Policy Object, objeto de directiva de grupo): un paquete de ajustes que…». No se da por sabido nada propio de la ciberseguridad.
- Se va de lo concreto a lo abstracto: primero un ejemplo o una analogía cotidiana, después la definición y por último el detalle técnico.
- Cada apartado responde a tres preguntas: qué es, para qué sirve y cómo se reconoce en una pregunta de test.
- Las listas, tablas y comparaciones sustituyen a los párrafos largos cuando hay enumeraciones o diferencias.
- Se escribe con palabras propias: se sintetiza y se explica el temario de la UNIR, sin copiar párrafos. Se indican las páginas del PDF de las que procede cada apartado.

El objetivo es que, después de leer el tema, cualquiera de sus 30 preguntas de test se pueda responder **argumentando**, sin memorizar la clave. Todo concepto que necesite una pregunta debe estar explicado en algún apartado.

## Formato

```json
{
  "course": "sistemas",
  "number": 1,
  "title": "Seguridad en Windows Server",
  "minutes": 35,
  "intro": {
    "why": "Por qué importa este tema, en 2-4 frases y con un ejemplo real.",
    "before": ["Idea previa que necesitas, explicada en una frase."],
    "goals": ["Al terminar sabrás explicar…"]
  },
  "sections": [
    {
      "id": "dominio",
      "title": "El dominio: una oficina con conserje",
      "pages": [5, 7],
      "blocks": [
        { "type": "p", "text": "Texto. Admite **negrita** para el concepto clave." },
        { "type": "analogy", "text": "Piensa en… como si fuera…" },
        { "type": "term", "term": "Controlador de dominio (DC)", "text": "Definición sencilla." },
        { "type": "list", "title": "Opcional", "items": ["…", "…"] },
        { "type": "steps", "title": "Opcional", "items": ["Primero…", "Después…"] },
        { "type": "table", "title": "Opcional", "head": ["Nivel", "Qué aplica"], "rows": [["Dominio", "…"]] },
        { "type": "example", "title": "Caso práctico", "text": "…" },
        { "type": "exam", "text": "Cómo lo pregunta el test y la trampa típica." },
        { "type": "key", "text": "La idea que debes llevarte de este apartado." }
      ]
    }
  ],
  "summary": ["Idea clave 1", "Idea clave 2"],
  "glossary": [{ "term": "AD (Active Directory)", "text": "…" }],
  "questions": {
    "sistemas-t01-01": {
      "section": "dominio",
      "reasoning": "Razonamiento paso a paso que, partiendo del concepto, lleva a la respuesta correcta.",
      "options": {
        "a": "Por qué esta opción es correcta o incorrecta.",
        "b": "…",
        "c": "…",
        "d": "…"
      },
      "doubt": "Opcional: solo si, tras leer el temario, la clave del banco parece discutible. Explica por qué."
    }
  }
}
```

Reglas que comprueba `npm run temas`:

- `course`, `number` y `title` coinciden con el tema de `bank.json`.
- Los `id` de apartado son únicos, en minúsculas, con letras, números y guiones.
- Cada bloque usa uno de los tipos anteriores, con texto no vacío. Las tablas tienen filas del mismo ancho que la cabecera.
- `questions` contiene exactamente las 30 preguntas del tema. Cada una apunta a un apartado existente y argumenta las cuatro opciones.
- El texto no contiene HTML. Solo se interpreta `**negrita**`; todo lo demás se muestra tal cual.

La explicación de la opción correcta debe coincidir con la clave de `bank.json`. Si el temario contradice la clave, se argumenta igualmente la clave del banco y la discrepancia se explica en `doubt`, para revisarla.
