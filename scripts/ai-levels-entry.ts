// Entry for scripts/ai-levels.mjs: both engines and both computer players, bundled for node.
export { applyTableAction, createTable } from "../src/switch/engine/table";
export { chooseTableAction } from "../src/switch/ai/tableAi";
export { applyAction, createInitialGame } from "../src/switch/engine/rules";
export { chooseComputerAction } from "../src/switch/ai/ai";
