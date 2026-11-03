# UX contract

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Navigation | dist/app.js render/currentRoute | PRODUCT.md | subjects, topics, practice, simulation, review | browser and UI tests |
| Select/Listbox | native select with label | DESIGN.md | platform-owned subject popup | browser keyboard and popup |
| Form | setup form with novalidate | PRODUCT.md | simulation subject selector | UI tests |
| Scrollbar | dist/styles.css global baseline | DESIGN.md | natural document scroll | token test and browser |
| Toast | #notice role=status | PRODUCT.md | persistent storage warning | storage failure test |
| Dialog | native dialog and ask() | PRODUCT.md | finish/reset/replace | Escape and focus |
| Material | app.js topicMaterial/materialBlock/practiceMaterial | PRODUCT.md | bundled relative PDF open/download | material UI tests and browser |
| Feedback | explanation(q) and sourceLabel | bank.json | practice and final review | test feedback |
| Digital topic | app.js temaPage/temaCard/temaFeedback, core.js validateTema | content/temas, PRODUCT.md | study page, topic card, argued practice feedback | tema validation and UI tests, browser |
| Local data | read/write/getPractice | PRODUCT.md | block10/full30/final simulations | reload and malformed-state tests |

No date picker, table selection, backend CRUD, login or sharing editor.

## Flows

Subjects → subject topics → digital topic (when published) and three blocks of ten and full test of thirty. Topic pages also show «Material del tema» for the bundled UNIR PDF. «Abrir tema» opens a separate tab with noopener; «Descargar PDF» requests a download. During practice the discreet PDF link also opens separately, so question state is retained. Links remain relative under the GitHub Pages subpath and load no document until followed. Missing or invalid material metadata omits the controls rather than showing broken links. Pages and size are shown only when valid. Topics are sorted by their numeric number and labeled explicitly «Tema n. Descripción». PDF titles follow the same label; downloads have a sanitized descriptive filename. User-facing titles are escaped; only bundled materials/...pdf paths are accepted. Every question offers native radios, explicit check, previous/next, swipe and a collapsed number selector. The explanatory feedback includes correct/incorrect text, rationale, source category and source page. Changing an answer removes its checked state. Default automatic progression is off; enabling it persists the preference. The final question never submits automatically.

Answers and position persist per topic/block, including checked explanations. Full30 is block0 and has its own progress. Finish uses an app-owned dialog with blank count; cancel and Escape keep all answers. Finish is idempotent. Completed tests show result and all/error-only review. Repeat confirms resetting that test only. Review stays read-only and never changes stored answers.

Simulation setup uses a native subject select; OS-owned popup geometry is accepted. Start picks thirty unique questions and a forty-five-minute deadline. No answer, position or flag is saved until delivery; refresh or closing loses that attempt. Internal navigation can return while time continues. Answers can change, be cleared or flagged. No explanation is exposed before delivery. Delivery/expiry saves one final snapshot. Final review has all/errors filters and shared feedback/source display. No official-grade or official-exam wording.

## Navigation and gestures

Inherited PER behavior: one natural document scroller, maximum width480px, bottom tabs with safe-area, tabs hidden during simulation. Main receives focus after route changes; question receives preventScroll focus after question navigation. Question changes preserve horizontal/vertical scroll with a temporary minimum height. Pointer swipe requires44px and 1.25× horizontal dominance. Screen-edge, button/link, vertical scroll and pointer-cancel gestures do not navigate. Mouse/touch drag suppresses its synthetic click. Keyboard arrows outside controls and numbered buttons are equivalent alternatives. Animation180ms exit/240ms entrance is cancellable, inert during transition and disabled under reduced motion.

## Failure and recovery

Bank loading times out after15 seconds; failure view retains shell and offers retry. Schema is validated before showing any question. Invalid saved data is discarded safely; current IDs and answer keys are validated. Storage failure uses a persistent status and memory fallback without claiming durable saving. Storage events update open practice tabs. Spanish Spain throughout, dates Europe/Madrid. Text wraps, native semantic controls, visible focus, textual tones, forced colors and reduced motion. No browser alert/confirm/prompt. No external account/session/authorization states apply.
