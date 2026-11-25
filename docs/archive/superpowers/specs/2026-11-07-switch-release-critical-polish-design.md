# Switch Release-Critical Polish Design

## Intent

Finish the six release-critical items from the 7 November 2026 deep-dive review without changing Switch's rules, visual identity, saved history or public deployment.

## Goals

- Restore an unfinished One v One, Domino, Darts, Tournament Groups, Knockout or Switch Cup session after refresh.
- Show the opening guided-game lesson automatically, then leave later explanations available on demand.
- Use full spoken card names and grammatically correct articles.
- Announce matching cards as selectable once a multi-card play has begun.
- Distinguish one-night Tournament Groups from longer Season Leagues.
- Remove demonstration advertising and future paid-membership promotion from the public experience.

## Non-goals

- No rule changes, redesign, new account requirement, production deployment or saved-history rewrite.
- No Google sign-in expansion in this pass.
- No new game types.

## Constraints

- Preserve existing local data and tolerate older saved payloads with no active-session record.
- Keep app-owned UI changes inside `src/Prototype.tsx`, `src/prototype.css` and existing screen modules; do not alter the protected mobile runtime.
- Continue to support iPhone, Pixel, offline use and reduced motion.

## Approach

Three approaches were considered: reconstruct sessions from the existing score totals, store a versioned active-session snapshot in extensions, or introduce a new database schema. Reconstruction loses undo and tournament progress; a new schema is too disruptive. The selected approach stores a defensive, versioned `switchActiveNight` snapshot inside the existing extensions object, clears it only on reset or successful history save, and ignores malformed snapshots.

The tutorial keeps its opening explanation but no longer interrupts every turn by default. Full guidance remains a deliberate user option. Copy, labels and promotional removal are direct refinements of the existing screens.

## Acceptance

- Refresh returns every active scoring format to the same progress and controls.
- Old and malformed saved data still open safely.
- No automatic lesson appears after ordinary turns unless the user enables it.
- Card controls expose full names and truthful selectable/legal states.
- The two league concepts cannot be confused by their labels.
- No demonstration ad or ad-free membership preview appears publicly.
