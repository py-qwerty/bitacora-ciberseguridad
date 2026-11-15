# Prácticas de redacción

Un archivo por tema: `content/practicas/<asignatura>/tema-NN.json`. `node scripts/build-practicas.mjs` los valida y los publica en `dist/practicas/<id>.json`. Para validar solo tus archivos: `node scripts/build-practicas.mjs --check content/practicas/redes/tema-01.json …`.

## Por qué existen

El examen final de cada asignatura vale el 60 % de la nota y tiene **10 preguntas tipo test (4 puntos, sin penalización)** y **6 puntos de redacción**. Según lo que dijeron los profesores en clase:

- **Redes:** 3 preguntas cortas de 2 puntos o 2 más largas de 3 puntos. Entra el temario y lo visto en clase. No piden memorizar comandos ni argumentos, pero sí entender una regla (p. ej. «dada esta regla iptables, ¿qué significa?», «¿cuándo usar RSA y cuándo AES?», «qué tecnología VPN usar»).
- **Gobierno y riesgos:** examen de hora y media; en el test **los fallos restan** (clase del 10 de noviembre). 2 preguntas de desarrollo de 3 puntos: una de la parte de gobierno (temas 1 a 4; el tema 5, certificaciones, **solo cae en el test**) y otra de análisis de riesgos (temas 6 a 10). Estilo: «enumera y describe brevemente», «explica», con algo de profundidad y sin repetir definiciones como un loro.
- **Ciberdelitos y regulación:** 2 casos prácticos pequeños, uno por cada parte: regulación (temas 1 a 5) y ciberdelitos (temas 6 a 10). Hay que **razonar y fundamentar**, no contestar en una línea: qué normativa debe cumplir esta empresa (RGPD, ENS, NIS2, sectores…), qué principio del ENS se cumple o no, qué delito puede ser esta conducta, firma frente a sello electrónico… **Nunca** se piden números de artículo ni nombres exactos de leyes.
- **Forense:** un ejercicio teórico-práctico de desarrollo **sin una única respuesta correcta** (p. ej. «llegas y el equipo está apagado / encendido, ¿qué haces y por qué?», priorizar evidencias). El esquema general del proceso forense (tema 6) hay que saber escribirlo literalmente. Las tres preguntas de la investigación: qué ha ocurrido, cómo y quién.
- **Sistemas:** el profesor explicará la estructura al final del curso. Ya dijo que solo entra el apartado «Ideas clave» de cada tema (no «A fondo») y que habrá test y baterías de problemas con vulnerabilidades en código (Java) y su solución. Se asume test + preguntas de desarrollo.

## Para quién se escribe

Para una persona principiante que solo sabe algo de informática. Español claro, frases cortas, siglas definidas la primera vez. La respuesta modelo debe ser **lo que un alumno bien preparado escribiría en el examen en el tiempo indicado** (no un ensayo): estructura clara, primero la idea central y luego los detalles, con un ejemplo cuando ayuda.

## Formato

```json
{
  "course": "redes",
  "number": 2,
  "open": [
    {
      "id": "redes-t02-d1",
      "kind": "larga",
      "points": 3,
      "minutes": 12,
      "prompt": "Explica qué es una DMZ y por qué se usa. Indica qué servicios colocarías en ella y cuáles no.",
      "keyPoints": [
        "Define la DMZ como una red intermedia entre Internet y la red interna",
        "Explica que aloja los servicios que deben ser accesibles desde fuera (web, correo, DNS público)",
        "Indica que la red interna (bases de datos, equipos de usuarios) no va en la DMZ",
        "Explica que si un servidor de la DMZ se compromete, el atacante no llega directamente a la red interna",
        "Menciona el cortafuegos o los cortafuegos que separan las zonas y sus reglas"
      ],
      "model": [
        "Una **DMZ** (zona desmilitarizada) es …",
        "Se usa porque …",
        "Por ejemplo, …"
      ],
      "tip": "Opcional: cómo enfocarla, la trampa típica o lo que el profesor remarcó en clase.",
      "fromClass": false,
      "sections": ["dmz"]
    }
  ],
  "cases": [
    {
      "id": "redes-t02-c1",
      "title": "Una tienda online que abre su web",
      "scenario": ["Párrafo 1 del enunciado con los datos del caso.", "Párrafo 2 opcional."],
      "minutes": 15,
      "points": 3,
      "questions": [
        { "prompt": "¿Dónde colocarías el servidor web y por qué?", "keyPoints": ["…", "…", "…"], "model": ["…"] }
      ],
      "tip": "Opcional.",
      "sections": ["dmz", "reglas"]
    }
  ],
  "order": [
    {
      "id": "redes-t02-o1",
      "title": "Ordena cómo evalúa un cortafuegos sus reglas",
      "items": ["Paso 1 en el orden correcto", "Paso 2", "Paso 3", "Paso 4"],
      "why": "Explicación breve de por qué es ese orden.",
      "sections": ["reglas"]
    }
  ]
}
```

Reglas (las comprueba el validador):

- `id`: `<asignatura>-tNN-d1`, `d2`… para abiertas; `c1`, `c2`… para casos; `o1`, `o2`… para ordenar.
- `kind` `corta` vale 2 puntos (unos 5 a 8 minutos); `larga` vale 3 puntos (unos 10 a 15 minutos). Los casos valen 3 puntos.
- `keyPoints`: 3 a 8 frases. Son la **rúbrica**: lo que un corrector busca para dar los puntos. Cada una comprobable («Menciona…», «Explica que…», «Distingue…», «Pone un ejemplo de…»).
- `model`: 1 a 8 párrafos. Solo se interpreta `**negrita**`. Sin enlaces ni HTML.
- `scenario`: 1 a 6 párrafos con datos concretos e inventados (empresas ficticias).
- `sections`: ids de apartado que existen en el tema digital (`content/temas/<asignatura>/tema-NN.json`); ahí está la explicación para repasar.
- `order` es opcional (0 a 4): solo para secuencias reales que hay que saber en orden (fases de un proceso, pasos de un protocolo, metodología). `items` va en el orden correcto; la app los baraja.
- `fromClass: true` si la pregunta sale de algo que el profesor remarcó en clase (ver transcripciones).

Contenido por tema: de 3 a 5 preguntas abiertas (mezcla de cortas y largas) y de 1 a 2 casos prácticos. En Ciberdelitos y Forense el caso práctico es lo central: 2 casos por tema cuando el tema lo permita. Todo debe salir del tema digital y de las clases: no inventes datos técnicos, cifras ni normas que no estén allí.
