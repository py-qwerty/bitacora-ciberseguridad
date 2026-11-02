# Reuse of the PER application

Derived from the user's Bitácora PER source at https://github.com/py-qwerty/bitacora-per, inspected 2 November 2026. No original question bank, campus account/history, source PDFs, remote identity or deployment credentials were copied.

Retained engine mechanisms: Fisher–Yates shuffle, question signatures, time formatting/deadline helpers, practice block ordering, swipeDirection threshold; app.js local persistence + in-memory fallback, currentRoute/render routing, accessible modal lifecycle, native radio answer handling, optional auto advance, question navigation context, QUESTION_MOTION timings, animation cancellation, retainQuestionScroll, pointer capture/click suppression and keyboard alternatives. Core validation and exam sampling/grading are adapted to the master's data contract; PER's official quotas, pass limits and nautical content are removed.

styles.css and local font faces are inherited with minimal master's-specific feedback/selector variants. Typography license notices are retained. The new SVG notebook replaces the nautical compass. No packages or framework were added.
