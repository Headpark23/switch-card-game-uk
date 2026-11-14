# Mobile Prototype Agent Guide

## Prototype Instructions

## Project Direction

- Preserve the current warm cream, forest-green, and gold visual system, editorial typography, generated card-table hero, and simple four-tab information architecture.
- Continue through controlled, incremental improvements. Do not restart the project, replace the chosen design direction, or rebuild working features without a demonstrated technical need.
- Switch 2.0 (owner decision, 13 Nov 2026): Switch is "your game-night club" with four equal experiences: playing Switch against the computer, scoring real game nights, clubs and competitions, and personal achievements. It replaces the earlier "primarily instructional" positioning; learning stays complete but sits under Home ("Learn rules").
- Treat the complete game rules as the app's main attraction. Lead with an attractive, interactive teaching narrative derived from the original app's Rules and Game Flow sections, then connect it directly to practice in the guided game.
- Keep “Learn to play” as a complete guided game against the computer. Offer optional legal-move hints, explain invalid moves, enforce the app's Switch rules, and continue play until either side wins.
- Competitive play against 1 to 7 computers lives in PLAY and counts towards your record. Guided practice lives in Learn the Rules, never counts towards stats, streaks or badges, and ends with "Ready for the real challenge? Play against the computer."
- The tutorial remains a companion for physical card nights. The tutorial must be fabulous and encourage physical play: every move explains what was played, the rule, why it matters, what you could play and a tip, and the flow leads from practice to real cards to logging the night. Build the coach and lessons game-agnostic so the pattern can be reused in other physical card and board game apps.
- Test existing interactions before changing them, then verify iPhone and Pixel layouts after each meaningful change.

In ChatGPT Work Mode, run `sites-preview start "$PWD"`, open `http://terminal.local:4173/` in the cloud browser, and verify the rendered app and its primary interactions. Keep that preview open and tell the user to inspect it in the cloud browser; do not present the local URL as a user-facing chat link. In Codex Desktop, run the local server yourself, open the preview in the in-app browser, and provide the clickable local URL. Do not deploy to Sites unless the user explicitly asks to share, publish, or deploy. Do not give the user server-start instructions when you can run it.

Before planning or implementing any mobile-app change, read this `AGENTS.md` in full. It is the source of truth for the template's runtime and component guidance.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Editing Boundary

- Build app-specific UI in `src/Prototype.tsx` and `src/prototype.css`.
- Treat `src/App.tsx`, `src/main.tsx`, `src/styles.css`, `src/mobile/`, `public/assets/iphone/`, `public/assets/android/`, `public/assets/status/`, `vite.config.ts`, `worker/index.js`, and `scripts/prepare-sites-build.mjs` as protected runtime files. Do not edit, replace, remove, or recreate them unless the user explicitly asks to change the mobile runtime itself. For an explicit runtime change, update the affected lock hashes only after verifying the new runtime behavior.
- Run `npm run check:runtime` before preview or handoff. If it fails, restore the protected runtime instead of weakening or bypassing the check.
- `npm run build` preserves the mobile runtime and prepares the static Cloudflare Worker output required by Sites. Before a Sites handoff, confirm `dist/client/index.html`, `dist/server/index.js`, `dist/.openai/hosting.json`, and source `.openai/hosting.json` exist, then run `npm run test:sites`. Do not replace this project with a Vinext starter.

## Runtime Contract

- Preserve the mobile device runtime unless the user's task explicitly asks otherwise. Do not replace it with a standalone page. Visual fidelity applies to app-owned content inside the device screen, not to template-owned device chrome.
- Keep `App` composed around `PhoneFrame` -> `KeyboardProvider`, with `StatusBar`, app content, `HomeIndicator`, and `KeyboardDock` mounted inside the phone frame. `StatusBar` and the iOS home indicator are overlaid device chrome. When the Android keyboard is closed, the app viewport reserves the protected navigation-bar region instead of painting behind it. When the Android keyboard is open, preserve the current full-screen keyboard layout: its asset includes the IME navigation strip and the separate black navigation bar is hidden. iOS screens continue to paint behind the home-indicator area and own their safe-area content padding.
- Preserve the `iPhone` / `Pixel 10` device picker and both calibrated device presets. The Pixel screen is `427 x 952`; its `32 x 32` camera circle and `public/assets/android/navigation-bar.svg` bottom navigation bar are protected device chrome, not app content.
- Preserve the device picker's intentionally lightweight Codex styling in the top-right corner: its trigger wrapper is borderless and transparent, its trigger sizes to content, and its right-aligned menu uses the compact 3px inset plus the specified hairline and elevation shadow layers. Keep the prototype root and default app screen white.
- Preserve `StatusBar` as live device chrome, including its platform-specific typography, source status-icon assets, and spacing. Pixel 10 uses Roboto, Android indicators, and 32px top, left, and right padding. iPhone uses its iOS indicators, system typography, and calibrated spacing. Do not hardcode screenshot times like `9:41` into the status bar, replace its real-time clock, or move status bar content into app markup unless the user explicitly asks for a fixed/mock device time.
- `PhoneFrame` owns the calibrated device frame, screen portal, device picker, camera cutout, and custom cursor. Keep device assets in `public/assets/iphone/` and `public/assets/android/`; if an asset fails to load, repair the asset path or restore the asset instead of removing the frame, keyboard, or image render.
- Use `MobileScroll` directly for simple single-screen prototypes. Use `FlowStack` for conventional multi-screen flows whose routes can own their fixed header and footer; when using it, define each route as a `FlowScreen`: `{ id, header?, headerHeight?, footer?, footerHeight?, render }`, and use `flow.push(screen)`, `flow.pop()`, and `flow.replace(screen)` from `FlowStack` render callbacks or `useFlow()` instead of introducing another router.
- Use `Carousel` for a carousel, horizontal rail, swipeable cards, image or media strip, horizontally scrollable cards, chip rail, or other horizontal collection.
- For a layered app shell—such as a persistent composer, independently presented sheet, pushed/peek sidebar, or app-wide transition—compose directly in `Prototype.tsx` rather than forcing it through `FlowStack`. Keep app-owned fixed chrome as sibling layers outside `MobileScroll`.
- When using `FlowScreen`, put route-owned fixed headers or footers in `FlowScreen.header` or `FlowScreen.footer`. Set `headerHeight` to the visible app-toolbar height; `FlowStack` adds the device's top safe-area/status-bar inset automatically. Do not include `StatusBar` or its height in the header. Set `footerHeight` to the full app-footer height. `FlowScreen.footer` is an overlay, not reserved layout space; screens using it must add their own bottom content padding such as `padding-bottom: calc(var(--flow-footer-height) + var(--mobile-safe-area-height) + 24px)` so final content can scroll above the footer while still painting behind it.
- Render only scrollable content inside `MobileScroll`; it is for content that should move with scroll and rubber-band overscroll. Keep app-owned headers, nav bars, tabs, composers, and overlays outside it. This keeps scroll physics, safe areas, keyboard insets, scrollbars, and drag click suppression active without letting content paint under fixed chrome.
- Buttons, links, cards, and images inside `MobileScroll` should still allow drag scrolling when the pointer moves beyond tap slop. Use `data-scroll-drag="ignore"` only for rare controls that must own the drag gesture themselves.
- Do not add `var(--keyboard-height)` to ordinary screen/content padding inside `MobileScroll`; the scroll viewport already shrinks above the simulated keyboard. For custom fixed composers, search bars, or toast chrome, use `useKeyboardInsets().bottomInset`. It is relative to the app viewport: Android returns `0` while the closed-keyboard viewport already reserves navigation, then returns the keyboard height while open; iOS continues to clear the home indicator while closed and ride directly above the keyboard while open. Do not pin custom bottom chrome to `bottom: 0` or only `keyboardHeight`.
- Use `KeyboardInput`, `KeyboardTextarea`, or `MobileTextField` for every text-entry control. A raw `input` or `textarea` disconnects focus, keyboard animation, safe-area insets, and attached surfaces.
- Use `BottomSheet` for phone-scoped sheets. Its props are `open`, `onOpenChange`, `title`, optional `description`, optional `snap`, and `children`; it renders through the phone screen portal and dismisses the keyboard before opening.

## Horizontal Carousels

- Use `Carousel` for horizontally draggable cards, images, media, chips, or other horizontal collections. Do not recreate these with `overflow-x`, custom pointer handlers, or a generic div.
- `Carousel` can be nested directly inside `MobileScroll`. It owns horizontal gestures and automatically yields vertical gestures to the parent.
- Never put `data-scroll-drag="ignore"` on or around a `Carousel`; doing so prevents vertical parent scrolling when a gesture begins inside it.
- Do not add CSS scroll snapping to `Carousel`; its runtime owns momentum and release motion.
- Use `data-scroll-drag="ignore"` only when a control must prevent parent scrolling in every drag direction.

See `src/mobile/COMPONENTS.md` for the full component and gesture contract.

## Keyboard Rule

The simulated keyboard is a separate top-layer component. Before presenting anything that behaves like iOS navigation or modal UI, dismiss it first.

Call `keyboard.hide()` before:

- pushing, popping, or replacing FlowStack routes
- opening bottom sheets, action sheets, dialogs, menus, or navigation sheets
- starting transitions where the destination should not inherit text-input focus

`FlowStack` already hides the keyboard for `push`, `pop`, and `replace`. `BottomSheet` already hides it before opening. If you add new modal/sheet/navigation primitives, follow the same rule.

When a composer, search surface, or other keyboard-attached component closes, call `keyboard.hide()` in the same event before changing that component's open state. Position attached surfaces from `useKeyboardInsets()` rather than a separate timer or visibility flag so both dismiss together.

When any text-entry control loses focus, dismiss the simulated keyboard. If the control is custom or does not use the runtime's keyboard-aware fields, handle its blur event and call `keyboard.hide()` explicitly. Keep the keyboard open only when focus is moving directly to another text-entry control that should share the same keyboard session.

## Interaction Rules

- Do not trigger buttons or inputs after a pointer has become a drag. Preserve the drag suppression behavior in `MobileScroll`.
- Do not allow native browser image/file dragging inside the phone frame. Preserve the phone-level `dragstart` suppression and non-draggable image styles so scroll drags that begin on images still scroll the prototype.
- Use `KeyboardInput`, `KeyboardTextarea`, or `MobileTextField` for text entry so the simulated keyboard and safe-area insets stay connected.
- Fixed phone chrome should not animate with pushed screens. Screen content can animate; the status bar, camera cutout, and preview chrome should stay put.
- Keep the keyboard below the home indicator/safe area layer in z-index, and above ordinary app UI while visible.
- Keep the home indicator as the topmost safe-area layer in the z-index above everything else in the prototype.

## Rules rulings (owner decisions)

- The game rules are sacrosanct. Nine rulings on contentious points are recorded in `docs/RULES-RULINGS.md` (win on 8/2/K/A, first card of a set matches suit or number, picking up ends your turn, several 8s or 7s count once, mixed kings allowed, deck flips oldest-first). Never change a rule, the engine or the in-app rule text without the owner's say-so, and keep all three in step.
- `scripts/table-sim.mjs` plays 2 to 6 player games from the written rules; `tests/switch-rules-sim.spec.ts` proves the engine agrees with it.
- Tutorial layout: the table and the player's hand come first. Coaching is one quiet strip that opens a sheet; never stack tips above the cards.

## Scoring rulings
Darts: first to three legs wins a set. Knock Out: whoever finishes last in a round is out, until one player is left (ruling 11, revised). Leagues: place points (N..1), then round wins, then a deciding game. Scorekeeper ends matches at target or sets. See `docs/RULES-RULINGS.md` items 10-13. Home screen is a one-screen hub of action tiles; the five-move rules guide opens from "Learn the rules".

## Naming and coaching decisions (Nov 2026)
- One name per thing, everywhere: "Group Play" (one-night leagues and playoffs), "Knock Out", "Switch Cup", and "Seasons" for the long-running table across nights. The first bottom tab is "Home".
- Every scorekeeper result can be corrected: league rounds undo until playoff games start, Cup results have Change and Undo, and a tie of any size is settled by one deciding game for the whole group.
- Tutorial hints are optional: the coach strip offers the coach's pick but names the move only after Show hint, automatic guidance, or a tap on the strip.

## Presentation decisions (Nov 2026, "bolder evolution, playful throughout")
- The felt card table (green felt, gold rim, real cards) is the app's signature: main screens open with a `FeltHeader` (`src/ui.tsx`), the scorekeeper with its compact form. The status bar is runtime chrome with dark text, so felt never runs behind it.
- Real playing cards are the icon language: home actions are four aces dealt onto the table, and game types and modes use `MiniFan` hands instead of numbers or generic icons. Other icons come from Phosphor in one weight; no emoji or text glyphs as icons.
- No small-caps label above a heading, and no thick coloured side stripes on cards or callouts.
- Wins are celebrated with `CardShower` (a match, Knock Out, Cup, league championship, beating the computer); it never blocks taps and is skipped under reduced motion.
- Pick-ups at the table (14 Nov 2026): card backs slide from the deck to whoever picks up, like a played card in reverse. Penalty pick-ups (2, 4, 6, 8, 5, 10) are slower, a small "+N" floats up from the deck, and "Ouch!" floats up from anyone hit by a penalty while on their last card (`drawTiming` in `src/switch/presentation.ts`).

## Switch 2.0 decisions (13 Nov 2026)
- Five permanent bottom tabs: Home | Play | Score | Club | Me. The lit tab follows the section on screen (`SECTION` map in `Prototype.tsx`); no oversized hero tab.
- Home is a compact dashboard on the photographic `hero.webp` background: greeting, resume cards, four launch tiles (Play cards, Keep score, My club, Achievements), recent activity, discovery chips (Learn rules, Puzzles, Questions, Plan a night, Join a night).
- The table game is presented through `src/switch/presentation.ts`: the engine decides a move once, the screen walks its steps (pause, each card landing in order from the right seat, effect) and only then shows the next player. Never render the engine's final pile early. Active seat: red glow plus readable text (YOUR MOVE / NAME IS CHOOSING).
- Storage inventory: `docs/STORAGE-KEYS.md`. Never reset or rename keys; new data gets new keys.

## Nobody loses a score (owner decisions, 13 Nov 2026)
- Every game played is a stat: wins and losses, on nights and against the computer, all count and all show in Me > History. Tapping a row opens the full record (date, night name, venue, every score).
- A phone's games follow its owner. Games played before they chose a name sit under the automatic "You" player and are merged into the name they pick (`src/switch/identity.ts`); never repoint "me" without `claimMe`.
- A shared night code is how results travel: a friend who joins says which player they are, and every night the host saves under that code is added to the friend's own history and stats, even if their app was closed (`src/switch/joinedNights.ts`, results kept by `api/_night.js`). Saved results queue on the host's phone until they reach the server.
- When a night is won the scorekeeper asks to save it straight away, in a sheet. Saving is never something the host has to scroll to find.
- Jacks (ruling 18): one or three reverse; two or four never reverse and mean play again, so they cannot be a last play.

## Shared clubs (owner decision, 13 Nov 2026)
- Clubs, players, nights and leagues must sync between phones automatically; this is a core feature, not an extra. A club is shared under an 8-character code (`api/club.js`, `src/switch/clubSync.ts`). Every phone keeps its own copy and exchanges it with the shared one by id, so nothing is ever dropped (`api/_clubMerge.js` holds the merge rules for server and phones). Games against the computer stay private.
- Sharing must be obvious: Home offers "Share my club" and "Join a club", saving a night lands on a screen with the invitation, a club link (`/?club=CODE`) goes straight to "Which one are you?", and once joined everything syncs with no further steps.
- `tests/switch-club-sync.spec.ts` and `tests/switch-two-phones.spec.ts` run two real browser phones against one server; keep them passing.


## Computer game types (owner decisions, 14 Nov 2026)
- PLAY offers Single game, Knock Out, Group Play, Switch Cup, Darts scoring and Dominoes scoring against 1 to 7 computers (8 at the table). 7 or 8 seats use two decks (ruling 21). Computers, in order: John, Paul, George, Ringo, Ziggy, Marley, Bowie. Rules and scoring are in `docs/RULES-RULINGS.md` items 21-22. Every type is recorded in stats, trophies, badges and streaks.
- Knock Out against the computer is 1 v 1 rounds, winners go through (ruling 25). Last Card is called after selecting the first card(s) of a finishing set and before selecting the final card; the button lives in the player's card area (ruling 26).
- Group Play league games are played on (ruling 24): the first out scores the league size in points and leaves, the rest keep playing, and so on down to 1 point for the last player. Never end a league round at the first finisher.
- Dominoes scoring (computer mode) is a lowest-total-wins game: leftover cards add to your total (A 1 ... K 13), and the first to reach the chosen number loses.

## Online play with friends and family (owner decisions, 14 Nov 2026)
- Online play is a private table with friends and family, started from Play ("Play with friends": Start a table, Join with a code). Computers fill empty seats. No public matchmaking, no accounts needed, no free-text chat. Design: `docs/superpowers/specs/2026-11-14-switch-online-play-design.md`.
- Online games count: every finished game is a stat (win or loss) and shows in Me > History, like every other game.
- Reactions are a fixed set of 18 (10 sayings, 8 emojis) and nothing else; the server stores only the id. They are message content, so emoji here do not break the no-emoji-icons rule.
- Absent players get a visible countdown. No move for 30 seconds: they are told the computer will play their move in 10 seconds. At 40 seconds the computer plays it (ruling 23).
- The server owns the game and sends each seat a masked view. Nobody but the server may see another seat's hand or the draw pile order.
