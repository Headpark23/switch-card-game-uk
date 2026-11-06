export type Suit = "S" | "H" | "D" | "C";

export type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";

export type CardId = `${Rank}${Suit}`;

export type CardColour = "red" | "black";

export interface Card {
  readonly id: CardId;
  readonly rank: Rank;
  readonly suit: Suit;
  readonly colour: CardColour;
}

export type Turn = "player" | "computer";

export type PendingPenalty =
  | { readonly kind: "draw-two"; readonly cards: 2 | 4 | 6 | 8 }
  | { readonly kind: "black-king"; readonly units: 1 | 2; readonly cards: 5 | 10 }
  | { readonly kind: "miss-turn" };

export type GameStatus = "playing" | "won";

export interface GameState {
  readonly playerHand: readonly CardId[];
  readonly computerHand: readonly CardId[];
  readonly drawPile: readonly CardId[];
  readonly discardPile: readonly CardId[];
  readonly currentSuit: Suit;
  readonly turn: Turn;
  readonly pendingPenalty: PendingPenalty | null;
  readonly status: GameStatus;
  readonly winner: Turn | null;
  readonly move: number;
}

export type GameAction =
  | { readonly type: "play"; readonly cards: readonly CardId[]; readonly chosenSuit?: Suit }
  | { readonly type: "draw" }
  | { readonly type: "accept-missed-turn" };

export type RandomSource = () => number;
