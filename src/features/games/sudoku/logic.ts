import {
  pickRandom,
  shuffleRandom,
  type RandomSource,
} from '@/features/games/shared/random';

export type SudokuGrid = number[];

export interface SudokuPuzzle {
  puzzle: SudokuGrid;
  solution: SudokuGrid;
  clues: number;
}

const SIZE = 9;
const BOX = 3;
const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

function pattern(row: number, column: number): number {
  return (BOX * (row % BOX) + Math.floor(row / BOX) + column) % SIZE;
}

function shuffledAxis(random: RandomSource): number[] {
  const groups = shuffleRandom([0, 1, 2], random);
  return groups.flatMap((group) =>
    shuffleRandom([0, 1, 2], random).map((offset) => group * BOX + offset),
  );
}

export function generateSolvedSudoku(random: RandomSource): SudokuGrid {
  const rows = shuffledAxis(random);
  const columns = shuffledAxis(random);
  const digits = shuffleRandom(DIGITS, random);

  return rows.flatMap((row) =>
    columns.map((column) => digits[pattern(row, column)]),
  );
}

function usedInRow(grid: SudokuGrid, index: number, digit: number): boolean {
  const rowStart = Math.floor(index / SIZE) * SIZE;
  for (let offset = 0; offset < SIZE; offset += 1) {
    if (grid[rowStart + offset] === digit) return true;
  }
  return false;
}

function usedInColumn(grid: SudokuGrid, index: number, digit: number): boolean {
  const column = index % SIZE;
  for (let row = 0; row < SIZE; row += 1) {
    if (grid[row * SIZE + column] === digit) return true;
  }
  return false;
}

function usedInBox(grid: SudokuGrid, index: number, digit: number): boolean {
  const row = Math.floor(index / SIZE);
  const column = index % SIZE;
  const boxRow = Math.floor(row / BOX) * BOX;
  const boxColumn = Math.floor(column / BOX) * BOX;

  for (let rowOffset = 0; rowOffset < BOX; rowOffset += 1) {
    for (let columnOffset = 0; columnOffset < BOX; columnOffset += 1) {
      if (grid[(boxRow + rowOffset) * SIZE + boxColumn + columnOffset] === digit) return true;
    }
  }
  return false;
}

export function candidatesForCell(grid: SudokuGrid, index: number): number[] {
  if (grid[index] !== 0) return [];
  return DIGITS.filter(
    (digit) =>
      !usedInRow(grid, index, digit) &&
      !usedInColumn(grid, index, digit) &&
      !usedInBox(grid, index, digit),
  );
}

function findBestEmptyCell(grid: SudokuGrid): { index: number; candidates: number[] } | null {
  let best: { index: number; candidates: number[] } | null = null;

  for (let index = 0; index < grid.length; index += 1) {
    if (grid[index] !== 0) continue;
    const candidates = candidatesForCell(grid, index);
    if (candidates.length === 0) return { index, candidates };
    if (!best || candidates.length < best.candidates.length) {
      best = { index, candidates };
      if (candidates.length === 1) return best;
    }
  }

  return best;
}

export function countSudokuSolutions(source: SudokuGrid, limit = 2): number {
  const grid = [...source];
  let solutions = 0;

  function search(): void {
    if (solutions >= limit) return;
    const next = findBestEmptyCell(grid);
    if (!next) {
      solutions += 1;
      return;
    }
    if (next.candidates.length === 0) return;

    for (const digit of next.candidates) {
      grid[next.index] = digit;
      search();
      grid[next.index] = 0;
      if (solutions >= limit) return;
    }
  }

  search();
  return solutions;
}

const TARGET_CLUES = [46, 38, 32, 27] as const;

export function generateSudokuPuzzle(random: RandomSource, level: number): SudokuPuzzle {
  const safeLevel = Math.max(0, Math.min(3, Math.floor(level)));
  const solution = generateSolvedSudoku(random);
  const puzzle = [...solution];
  const removalOrder = shuffleRandom(
    Array.from({ length: SIZE * SIZE }, (_, index) => index),
    random,
  );
  const targetClues = TARGET_CLUES[safeLevel];
  let clues = SIZE * SIZE;

  for (const index of removalOrder) {
    if (clues <= targetClues) break;
    const previous = puzzle[index];
    puzzle[index] = 0;

    if (countSudokuSolutions(puzzle, 2) !== 1) {
      puzzle[index] = previous;
    } else {
      clues -= 1;
    }
  }

  return { puzzle, solution, clues };
}

export function cellPeers(index: number): number[] {
  const peers = new Set<number>();
  const row = Math.floor(index / SIZE);
  const column = index % SIZE;
  const boxRow = Math.floor(row / BOX) * BOX;
  const boxColumn = Math.floor(column / BOX) * BOX;

  for (let offset = 0; offset < SIZE; offset += 1) {
    peers.add(row * SIZE + offset);
    peers.add(offset * SIZE + column);
  }

  for (let rowOffset = 0; rowOffset < BOX; rowOffset += 1) {
    for (let columnOffset = 0; columnOffset < BOX; columnOffset += 1) {
      peers.add((boxRow + rowOffset) * SIZE + boxColumn + columnOffset);
    }
  }

  peers.delete(index);
  return [...peers];
}

export function isSameSudokuGroup(left: number, right: number): boolean {
  const leftRow = Math.floor(left / SIZE);
  const leftColumn = left % SIZE;
  const rightRow = Math.floor(right / SIZE);
  const rightColumn = right % SIZE;

  return (
    leftRow === rightRow ||
    leftColumn === rightColumn ||
    (
      Math.floor(leftRow / BOX) === Math.floor(rightRow / BOX) &&
      Math.floor(leftColumn / BOX) === Math.floor(rightColumn / BOX)
    )
  );
}

export function pickHintCell(
  board: SudokuGrid,
  solution: SudokuGrid,
  selectedIndex: number | null,
  random: RandomSource,
): number | null {
  if (
    selectedIndex !== null &&
    board[selectedIndex] !== solution[selectedIndex]
  ) {
    return selectedIndex;
  }

  const incomplete = board
    .map((value, index) => ({ value, index }))
    .filter(({ value, index }) => value !== solution[index])
    .map(({ index }) => index);

  return incomplete.length > 0 ? pickRandom(incomplete, random) : null;
}
