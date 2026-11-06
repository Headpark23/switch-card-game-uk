# Switch Night Local History Design

## Intent

Make the Switch scorekeeper feel like a lasting game-night companion while it remains a focused, solo, local-first app. A completed night should become a trustworthy record that can be reviewed or exported without requiring an account.

## Goals

- Save a completed, user-named night with its date, format, players, result and format-specific details.
- Show winners, tables, LOST elimination order and Cup rounds from immutable snapshots.
- Keep all history on the device inside the existing `switchScoreKeeper` record.
- Export history as portable JSON.
- Delete an individual night only after confirmation.
- Preserve every older field and never manufacture sample activity.

## Non-goals

- Google sign-in, cloud sync, family groups, friend links, collaborative editing and production deployment.
- Season statistics or reusable groups in this phase.
- Reconstructing history from older scores that were never explicitly saved.

## Constraints

- Preserve the exact `switchScoreKeeper` storage key and schema version 1 compatibility.
- Put the additive history collection under the existing extensions area.
- Never alter or delete unreadable storage automatically.
- A user must explicitly save a result; rendering a champion must not create history by itself.
- Head-to-head and domino require a unique leader at or above the target. Darts, knockout and Cup require a champion. League history requires at least two complete four-player leagues and records each final table plus the generated playoff fixtures.
- History snapshots are immutable and independent of later edits to player names or active scores.

## Approaches considered

### Automatic saving

Save as soon as a target or champion is reached. This is fast, but it can record accidental taps, duplicate a result after undo, and make deletion feel like error recovery.

### Explicit save of a validated result — selected

Show a night-name field and a clear save action only when the current format has a valid result. This gives the user control and prevents false activity while still making completion obvious.

### Separate history database

Use another browser key or IndexedDB. It offers more scale, but creates migration and backup complexity that this local solo app does not need yet.

## Experience

The active score screen shows a compact night name and completion panel. When the result is not ready, the panel explains what remains. When ready, “Save completed night” writes one immutable snapshot and confirms it.

A History section in the scorekeeper lists newest first. Each card shows the night name, local date, format and winner or outcome. Expanding it reveals players and format-specific details. Export downloads all saved nights as JSON. Delete uses a confirmation and removes only that night.

An empty state says that completed nights saved here will appear here; it does not display fictional players or matches.

## Data shape

`extensions.switchNightHistory` is an array of versioned `SwitchNightRecord` objects with stable id, ISO completion time, title, format, players, outcome label and a format-specific snapshot. Parsing is defensive: invalid entries are ignored in the UI but retained in the raw extension until the next explicit history edit, when valid records are written back alongside all unrelated extension fields.

## Accessibility and safety

- Native buttons and `details` summaries remain keyboard accessible.
- Dates use the device locale while exports retain ISO timestamps.
- Export has an explicit filename and contains only locally recorded game information.
- Delete confirmation names the exact night.
- Reduced-motion behavior remains unchanged.
