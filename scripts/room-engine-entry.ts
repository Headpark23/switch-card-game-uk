// What the online-play server needs from the table engine. `npm run build:engine` bundles this, and everything it
// imports, into the single plain-JavaScript file api/_engine.js, so the server plays the very same rules as the app.
export { applyTableAction, createTable, dealTo, isLegalTablePlay, MAX_SEATS, openingNote, penaliseMissedLastCard, POWER_START_CHANCE, tableLegalMoves, tablePlaces } from "../src/switch/table";
export { chooseTableAction } from "../src/switch/tableAi";
export { rankOf } from "../src/switch/cards";
export { isSeriesOver, ONLINE_MAX_PLAYERS, pendingGames, resultOf, seriesOutcome, startSeries, submitGame, validateSetup } from "../src/switch/series";
