export const GAME_IDS = [
  'checkers',
  'tic-tac-toe',
  'reaction',
  'emoji-find',
  'number-memory',
  'stroop-test',
  'ascending-numbers',
  'odd-one-out',
  'pattern-memory',
  'go-no-go',
  'mental-math',
  'sequence-memory',
  'card-memory',
  'time-estimation',
  'peripheral-vision',
  'twenty-four',
  'dual-n-back',
  'fifteen-puzzle',
  'sudoku',
] as const;

export type SoloGameId = (typeof GAME_IDS)[number];

export interface GameDefinition {
  id: SoloGameId;
  route: string;
  emoji: string;
  titleKey: string;
  descriptionKey: string;
  instructionsKey: string;
  category: 'speed' | 'memory' | 'logic' | 'attention';
  metric: 'duration_ms' | 'correct_count';
  friendOnly?: boolean;
  customSetup?: 'nback' | 'puzzle' | 'memory';
}

export const GAMES: readonly GameDefinition[] = [
  { id:'checkers', route:'/games/checkers', emoji:'⚪⚫', titleKey:'games.checkers.title', descriptionKey:'games.checkers.description', instructionsKey:'games.checkers.instructions', category:'logic', metric:'correct_count', friendOnly:true },
  { id:'tic-tac-toe', route:'/games/tic-tac-toe', emoji:'❌⭕', titleKey:'games.ticTacToe.title', descriptionKey:'games.ticTacToe.description', instructionsKey:'games.ticTacToe.instructions', category:'logic', metric:'correct_count', friendOnly:true },
  { id:'reaction', route:'/games/reaction', emoji:'⚡', titleKey:'games.reaction.title', descriptionKey:'games.reaction.description', instructionsKey:'games.reaction.instructions', category:'speed', metric:'duration_ms' },
  { id:'emoji-find', route:'/games/emoji-find', emoji:'🍎', titleKey:'games.emoji.title', descriptionKey:'games.emoji.description', instructionsKey:'games.emoji.instructions', category:'attention', metric:'duration_ms' },
  { id:'number-memory', route:'/games/number-memory', emoji:'🧠', titleKey:'games.numberMemory.title', descriptionKey:'games.numberMemory.description', instructionsKey:'games.numberMemory.instructions', category:'memory', metric:'duration_ms' },
  { id:'stroop-test', route:'/games/stroop-test', emoji:'🌈', titleKey:'games.stroop.title', descriptionKey:'games.stroop.description', instructionsKey:'games.stroop.instructions', category:'attention', metric:'duration_ms' },
  { id:'ascending-numbers', route:'/games/ascending-numbers', emoji:'🔢', titleKey:'games.ascending.title', descriptionKey:'games.ascending.description', instructionsKey:'games.ascending.instructions', category:'speed', metric:'duration_ms' },
  { id:'odd-one-out', route:'/games/odd-one-out', emoji:'👁', titleKey:'games.odd.title', descriptionKey:'games.odd.description', instructionsKey:'games.odd.instructions', category:'attention', metric:'duration_ms' },
  { id:'pattern-memory', route:'/games/pattern-memory', emoji:'🧩', titleKey:'games.pattern.title', descriptionKey:'games.pattern.description', instructionsKey:'games.pattern.instructions', category:'memory', metric:'duration_ms', customSetup:'memory' },
  { id:'go-no-go', route:'/games/go-no-go', emoji:'🚦', titleKey:'games.goNoGo.title', descriptionKey:'games.goNoGo.description', instructionsKey:'games.goNoGo.instructions', category:'attention', metric:'duration_ms' },
  { id:'mental-math', route:'/games/mental-math', emoji:'➕', titleKey:'games.math.title', descriptionKey:'games.math.description', instructionsKey:'games.math.instructions', category:'logic', metric:'duration_ms' },
  { id:'sequence-memory', route:'/games/sequence-memory', emoji:'🔄', titleKey:'games.sequence.title', descriptionKey:'games.sequence.description', instructionsKey:'games.sequence.instructions', category:'memory', metric:'duration_ms', customSetup:'memory' },
  { id:'card-memory', route:'/games/card-memory', emoji:'🃏', titleKey:'games.cards.title', descriptionKey:'games.cards.description', instructionsKey:'games.cards.instructions', category:'memory', metric:'duration_ms', customSetup:'memory' },
  { id:'time-estimation', route:'/games/time-estimation', emoji:'⏱️', titleKey:'games.time.title', descriptionKey:'games.time.description', instructionsKey:'games.time.instructions', category:'attention', metric:'duration_ms' },
  { id:'peripheral-vision', route:'/games/peripheral-vision', emoji:'👀', titleKey:'games.peripheral.title', descriptionKey:'games.peripheral.description', instructionsKey:'games.peripheral.instructions', category:'attention', metric:'duration_ms' },
  { id:'twenty-four', route:'/games/twenty-four', emoji:'🧮', titleKey:'games.twentyFour.title', descriptionKey:'games.twentyFour.description', instructionsKey:'games.twentyFour.instructions', category:'logic', metric:'duration_ms' },
  { id:'dual-n-back', route:'/games/dual-n-back', emoji:'🧠', titleKey:'games.nback.title', descriptionKey:'games.nback.description', instructionsKey:'games.nback.instructions', category:'memory', metric:'duration_ms', customSetup:'nback' },
  { id:'fifteen-puzzle', route:'/games/fifteen-puzzle', emoji:'🧩', titleKey:'games.puzzle.title', descriptionKey:'games.puzzle.description', instructionsKey:'games.puzzle.instructions', category:'logic', metric:'duration_ms', customSetup:'puzzle' },
  { id:'sudoku', route:'/games/sudoku', emoji:'🔳', titleKey:'games.sudoku.title', descriptionKey:'games.sudoku.description', instructionsKey:'games.sudoku.instructions', category:'logic', metric:'duration_ms' },
] as const;

export function getGameDefinition(id: string): GameDefinition | undefined {
  return GAMES.find((game) => game.id === id);
}
