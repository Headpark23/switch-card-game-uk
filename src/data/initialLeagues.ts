export interface Player {
  id: string;
  name: string;
  avatar: string;
  color: string;
}

export interface MatchScoreEntry {
  playerId: string;
  playerName: string;
  score: number;
  rank: number;
}

export interface MatchRecord {
  id: string;
  leagueId: string;
  gameId: string;
  gameName: string;
  date: string;
  scores: MatchScoreEntry[];
  winnerId: string;
  winnerName: string;
  notes?: string;
}

export interface League {
  id: string;
  name: string;
  description: string;
  code: string;
  createdDate: string;
  playerIds: string[];
}

export const INITIAL_PLAYERS: Player[] = [
  { id: 'p1', name: 'Martin', avatar: '👑', color: '#053527' },
  { id: 'p2', name: 'Sarah', avatar: '⭐', color: '#ac7b26' },
  { id: 'p3', name: 'Dad', avatar: '🎩', color: '#2b4c7e' },
  { id: 'p4', name: 'Mum', avatar: '🌸', color: '#a43620' },
  { id: 'p5', name: 'Jack', avatar: '⚡', color: '#4a6b57' },
];

export const INITIAL_LEAGUES: League[] = [
  {
    id: 'league-family',
    name: 'Friday Family Card Night',
    description: 'Weekly living room championship — glory, bragging rights and the crown.',
    code: 'FAM-7742',
    createdDate: 'Sep 2026',
    playerIds: ['p1', 'p2', 'p3', 'p4'],
  },
  {
    id: 'league-pub',
    name: 'The Red Lion Pub Crew',
    description: 'Cribbage, Switch and Gin Rummy over pints.',
    code: 'PUB-1934',
    createdDate: 'Aug 2026',
    playerIds: ['p1', 'p3', 'p5'],
  },
];

export const INITIAL_MATCH_HISTORY: MatchRecord[] = [
  {
    id: 'm-1',
    leagueId: 'league-family',
    gameId: 'switch',
    gameName: 'Switch (UK)',
    date: 'Oct 3, 2026',
    winnerId: 'p1',
    winnerName: 'Martin',
    scores: [
      { playerId: 'p1', playerName: 'Martin', score: 25, rank: 1 },
      { playerId: 'p2', playerName: 'Sarah', score: 18, rank: 2 },
      { playerId: 'p3', playerName: 'Dad', score: 12, rank: 3 },
      { playerId: 'p4', playerName: 'Mum', score: 8, rank: 4 },
    ],
    notes: 'Epic black king chain battle in round 3!',
  },
  {
    id: 'm-2',
    leagueId: 'league-family',
    gameId: 'rummy',
    gameName: 'Gin Rummy',
    date: 'Oct 5, 2026',
    winnerId: 'p2',
    winnerName: 'Sarah',
    scores: [
      { playerId: 'p2', playerName: 'Sarah', score: 112, rank: 1 },
      { playerId: 'p1', playerName: 'Martin', score: 84, rank: 2 },
    ],
    notes: 'Sarah hit an undercut on the final hand.',
  },
  {
    id: 'm-3',
    leagueId: 'league-family',
    gameId: 'hearts',
    gameName: 'Hearts',
    date: 'Oct 7, 2026',
    winnerId: 'p4',
    winnerName: 'Mum',
    scores: [
      { playerId: 'p4', playerName: 'Mum', score: 14, rank: 1 },
      { playerId: 'p1', playerName: 'Martin', score: 32, rank: 2 },
      { playerId: 'p3', playerName: 'Dad', score: 58, rank: 3 },
      { playerId: 'p2', playerName: 'Sarah', score: 104, rank: 4 },
    ],
    notes: 'Mum dodged every single trick like a ninja.',
  },
  {
    id: 'm-4',
    leagueId: 'league-family',
    gameId: 'cheat',
    gameName: 'Cheat (I Doubt It)',
    date: 'Oct 8, 2026',
    winnerId: 'p1',
    winnerName: 'Martin',
    scores: [
      { playerId: 'p1', playerName: 'Martin', score: 15, rank: 1 },
      { playerId: 'p3', playerName: 'Dad', score: 10, rank: 2 },
      { playerId: 'p2', playerName: 'Sarah', score: 5, rank: 3 },
      { playerId: 'p4', playerName: 'Mum', score: 2, rank: 4 },
    ],
    notes: 'Dad got caught claiming 4 Aces!',
  },
  {
    id: 'm-5',
    leagueId: 'league-pub',
    gameId: 'cribbage',
    gameName: 'Cribbage',
    date: 'Oct 2, 2026',
    winnerId: 'p3',
    winnerName: 'Dad',
    scores: [
      { playerId: 'p3', playerName: 'Dad', score: 121, rank: 1 },
      { playerId: 'p1', playerName: 'Martin', score: 109, rank: 2 },
    ],
    notes: 'Dad had a 24-point hand with triple 5s.',
  },
];
