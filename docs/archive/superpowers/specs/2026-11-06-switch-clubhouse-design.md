# Switch Clubhouse Design

## Intent

Turn real Switch Nights into an ongoing local competition people want to return to. The app should remember who played, reveal genuine patterns through statistics and charts, and support season-long leagues without accounts or fabricated activity.

## Product principles

- Engagement comes from real progress, rivalry and shared memories—not pressure loops, fake users, arbitrary daily streaks or hidden scoring.
- Switch remains the product. This is a clubhouse for Switch players, not a generic analytics dashboard.
- Every number must be reproducible from saved completed-night records.
- The app remains fully local and useful without Google sign-in.

## Stable local profiles

Each regular player has one local profile with a stable ID, display name, colour and creation date. Names are compared case-insensitively after trimming; two active profiles cannot have the same normalised name, so households with two people named Alex use a distinguishing nickname or initial.

Starting a score session resolves typed player names to existing profiles or creates new profiles. The scoring engine receives profile IDs, so future history attaches automatically. Existing history is not rewritten. Older records whose player ID does not match a profile may contribute when exactly one profile has the same normalised display name; ambiguous records remain unassigned rather than guessed.

Profiles can be renamed or archived. Archiving removes a person from new-game shortcuts but preserves every historical result and statistic.

## Statistics

For each profile derive:

- nights played, wins and win rate;
- current and best consecutive-win streak, measured across that person’s appearances rather than calendar days;
- last ten results as win/loss form;
- wins by Switch format;
- monthly wins for the latest six calendar months represented in history;
- milestone badges based only on real history: first night, first win, five nights, three consecutive wins, three formats played and Switch Cup champion.

The overall clubhouse shows total saved nights, most wins, best win rate with a three-night minimum, and the closest rivalry. Rivalries count nights where both profiles appeared and show each person’s wins plus results won by someone else.

## Season leagues

A local season has a name, at least two active profiles, a stable ID, creation date, active/completed status and the IDs of counted nights. Adding a saved night is explicit. A night can count once per season when at least two season members participated.

Transparent points:

- three points to each recorded winner who belongs to the season;
- one appearance point to every other participating season member;
- non-participants receive zero;
- standings sort by points, wins, nights played, then original season order.

This works across all six Switch score formats. Completing a season freezes its membership and table; it can still be reviewed but cannot accept more nights.

## Experience

The scorekeeper gains a compact four-way clubhouse switcher: Score, Stats, Leagues and History. Score retains the current working setup. History keeps the existing expandable records and export/delete controls.

Profiles appear as tactile cream-and-gold player tokens rather than SaaS cards. The Stats view leads with a large editorial win-rate dial for the selected player, then a six-month gold bar chart, recent form, format record and milestones. Every chart has readable text values and an accessible label.

Leagues resemble a physical club noticeboard: a season title, ordered table, counted-night list and explicit actions. Creating a season uses a name plus checkboxes for active profiles. Eligible history records show “Count in league”; the same record cannot be counted twice.

## Visual direction

- Palette: cream `#f7f1e3`, forest `#073c2a`, ink `#18372b`, gold `#b58a32`, paper `#fffdf7`, loss clay `#a84d3c`.
- Type: DM Serif Display for decisive results and standings; DM Sans for controls, labels and data.
- Layout: one memorable circular win-rate dial; charts and tables stay flat and paper-like, using rules and ink rather than gradients or generic floating cards.
- Motion: only user-triggered view changes and chart reveals; reduced-motion settings remove them.

## Data compatibility and safety

Profiles live in `extensions.switchProfiles`; seasons live in `extensions.switchSeasons`. Both collections are versioned and defensively parsed. All unrelated extension fields and the exact `switchScoreKeeper` key remain intact. Malformed entries are ignored in the interface without crashing. No existing history, score or unknown field is deleted automatically.

Deleting historical nights keeps the existing confirmed-delete behaviour and automatically removes the missing ID from derived season calculations without destroying the season. Profile archival and season completion require confirmation because they affect future use.

## Deferred

Cloud backup, Google sign-in, cross-device identity, family invitations, friend sharing, push notifications and public leaderboards remain deferred until this local product is proven.

## Approaches considered

1. Aggregate typed names directly. Fast, but case changes and duplicate names produce dishonest statistics.
2. Stable local profiles with derived stats and explicit seasons—selected. It creates a reliable offline foundation that can later map to verified accounts.
3. Build cloud identity now. Rejected for this phase because it makes authentication the dependency before the product has earned it.
