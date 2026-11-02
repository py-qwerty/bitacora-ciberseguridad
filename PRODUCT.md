# Product and domain evidence

User request, 2 November 2026: locate the PER study app and reuse its engine for the cybersecurity master's subjects, with thirty realistic questions per topic, known questions included, feedback for learning, a new repository and GitHub upload.

## Scope

Five subjects and ten topics per subject, thirty questions per topic: 1,500 questions. Data arrives in dist/bank.json, with stable IDs, a global numeric topic ID, subject ID, four options in source order, one answer, explanation, difficulty and source page. A question's provenance is one of campus-confirmed, temario-test or practice. Only evidence-backed imported corrections can claim campus confirmation. Practice is educational material, not an official examination or legal advice.

## Topic materials

User follow-up, 2 November 2026: include all fifty original topic PDFs in the public GitHub Pages application. Each topic has optional material metadata: a relative materials/...pdf URL, format, page count, byte size and title. The source is the UNIR teaching material; PDFs are included by the user’s request, independently from the question bank and its correction/provenance. No student account data or campus grade history is added. Open and download actions use bundled relative links; study progress remains in the app’s own browser storage.

## Inherited and changed behavior

Reuse Bitácora PER's 480px mobile UI, browser-local persistence, native accessible modal, four-option question renderer, swipe thresholds, two-phase animation and scroll retention. Each topic offers three ten-question blocks and a full thirty-question test, saved independently. Automatic progression is optional and defaults off. Check reveals the answer and explanation; changing a selection clears the previous check. Completed-test review includes an errors/blank filter.

A simulation selects thirty distinct questions from the chosen subject or all subjects and permits forty-five minutes. This duration is a study choice, not UNIR's examination rule. There is no claimed official pass threshold or subject quota. Its in-progress state is memory-only, inherited from PER; delivery/expiry persists a final snapshot and gives score, wrong and blank counts plus explanations. Options are never shuffled.

## Access and retention

User follow-up, 2 November 2026: publish the repository and the application on GitHub Pages, explicitly making the repository public. Public repository under py-qwerty and public static site at https://py-qwerty.github.io/bitacora-ciberseguridad/. The workflow validates before publishing only dist/ from main; pull requests do not deploy. No backend, accounts, remote mutation, analytics or personal data. LocalStorage prefix is separate from the PER app. Practice answers/checked feedback/index persist in this browser, final simulations persist, and failures use an explicit warning plus memory fallback. Clearing browser data removes progress. Font assets remain locally hosted under their existing licenses. Local and hosted origins keep their browser progress separately.
