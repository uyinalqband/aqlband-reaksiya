export type CheckersPiece = '.' | 'w' | 'W' | 'b' | 'B';
export type CheckersSide = 'white' | 'black';

export interface CheckersMove {
  from: number;
  to: number;
  captured: number | null;
  promotes: boolean;
}

export const CHECKERS_INITIAL_BOARD = 'bbbbbbbbbbbb........wwwwwwwwwwww';

const DIAGONALS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
] as const;

export function parseCheckersBoard(value: string | null | undefined): CheckersPiece[] {
  const safe = typeof value === 'string' && /^[wWbB.]{32}$/.test(value)
    ? value
    : CHECKERS_INITIAL_BOARD;
  return safe.split('') as CheckersPiece[];
}

export function serializeCheckersBoard(board: readonly CheckersPiece[]): string {
  return board.join('');
}

export function indexToCoordinate(index: number): { row: number; column: number } {
  const row = Math.floor(index / 4);
  const offset = index % 4;
  const column = row % 2 === 0 ? offset * 2 + 1 : offset * 2;
  return { row, column };
}

export function coordinateToIndex(row: number, column: number): number | null {
  if (
    row < 0 ||
    row > 7 ||
    column < 0 ||
    column > 7 ||
    (row + column) % 2 === 0
  ) {
    return null;
  }

  return row * 4 + Math.floor(column / 2);
}

export function pieceSide(piece: CheckersPiece): CheckersSide | null {
  if (piece === 'w' || piece === 'W') return 'white';
  if (piece === 'b' || piece === 'B') return 'black';
  return null;
}

export function isKing(piece: CheckersPiece): boolean {
  return piece === 'W' || piece === 'B';
}

export function opponentSide(side: CheckersSide): CheckersSide {
  return side === 'white' ? 'black' : 'white';
}

function promotionRow(side: CheckersSide): number {
  return side === 'white' ? 0 : 7;
}

function pieceFor(side: CheckersSide, king: boolean): CheckersPiece {
  if (side === 'white') return king ? 'W' : 'w';
  return king ? 'B' : 'b';
}

function manCaptureMoves(
  board: readonly CheckersPiece[],
  from: number,
  side: CheckersSide,
): CheckersMove[] {
  const { row, column } = indexToCoordinate(from);
  const moves: CheckersMove[] = [];

  for (const [rowStep, columnStep] of DIAGONALS) {
    const middle = coordinateToIndex(row + rowStep, column + columnStep);
    const landing = coordinateToIndex(row + rowStep * 2, column + columnStep * 2);
    if (middle === null || landing === null) continue;
    if (
      pieceSide(board[middle]) === opponentSide(side) &&
      board[landing] === '.'
    ) {
      moves.push({
        from,
        to: landing,
        captured: middle,
        promotes: indexToCoordinate(landing).row === promotionRow(side),
      });
    }
  }

  return moves;
}

function kingCaptureMoves(
  board: readonly CheckersPiece[],
  from: number,
  side: CheckersSide,
): CheckersMove[] {
  const origin = indexToCoordinate(from);
  const moves: CheckersMove[] = [];

  for (const [rowStep, columnStep] of DIAGONALS) {
    let row = origin.row + rowStep;
    let column = origin.column + columnStep;
    let capturedIndex: number | null = null;

    while (true) {
      const index = coordinateToIndex(row, column);
      if (index === null) break;
      const piece = board[index];

      if (piece === '.') {
        if (capturedIndex !== null) {
          moves.push({
            from,
            to: index,
            captured: capturedIndex,
            promotes: false,
          });
        }
      } else if (pieceSide(piece) === side) {
        break;
      } else if (capturedIndex !== null) {
        break;
      } else {
        capturedIndex = index;
      }

      row += rowStep;
      column += columnStep;
    }
  }

  return moves;
}

export function captureMovesForPiece(
  board: readonly CheckersPiece[],
  from: number,
): CheckersMove[] {
  const piece = board[from];
  const side = pieceSide(piece);
  if (!side) return [];
  return isKing(piece)
    ? kingCaptureMoves(board, from, side)
    : manCaptureMoves(board, from, side);
}

function manQuietMoves(
  board: readonly CheckersPiece[],
  from: number,
  side: CheckersSide,
): CheckersMove[] {
  const { row, column } = indexToCoordinate(from);
  const rowStep = side === 'white' ? -1 : 1;
  const moves: CheckersMove[] = [];

  for (const columnStep of [-1, 1] as const) {
    const to = coordinateToIndex(row + rowStep, column + columnStep);
    if (to === null || board[to] !== '.') continue;
    moves.push({
      from,
      to,
      captured: null,
      promotes: indexToCoordinate(to).row === promotionRow(side),
    });
  }

  return moves;
}

function kingQuietMoves(
  board: readonly CheckersPiece[],
  from: number,
): CheckersMove[] {
  const origin = indexToCoordinate(from);
  const moves: CheckersMove[] = [];

  for (const [rowStep, columnStep] of DIAGONALS) {
    let row = origin.row + rowStep;
    let column = origin.column + columnStep;

    while (true) {
      const to = coordinateToIndex(row, column);
      if (to === null || board[to] !== '.') break;
      moves.push({ from, to, captured: null, promotes: false });
      row += rowStep;
      column += columnStep;
    }
  }

  return moves;
}

export function getCheckersLegalMoves(
  board: readonly CheckersPiece[],
  side: CheckersSide,
  forcedFrom: number | null = null,
): CheckersMove[] {
  const eligible = forcedFrom === null
    ? board
        .map((piece, index) => ({ piece, index }))
        .filter(({ piece }) => pieceSide(piece) === side)
        .map(({ index }) => index)
    : [forcedFrom].filter((index) => pieceSide(board[index]) === side);

  const captures = eligible.flatMap((index) => captureMovesForPiece(board, index));
  if (captures.length > 0) return captures;
  if (forcedFrom !== null) return [];

  return eligible.flatMap((index) => {
    const piece = board[index];
    return isKing(piece)
      ? kingQuietMoves(board, index)
      : manQuietMoves(board, index, side);
  });
}

export function applyCheckersMove(
  board: readonly CheckersPiece[],
  move: CheckersMove,
): CheckersPiece[] {
  const next = [...board];
  const movingPiece = next[move.from];
  const side = pieceSide(movingPiece);
  if (!side) return next;

  next[move.from] = '.';
  if (move.captured !== null) next[move.captured] = '.';

  const destinationRow = indexToCoordinate(move.to).row;
  const becomesKing =
    isKing(movingPiece) ||
    destinationRow === promotionRow(side);

  next[move.to] = pieceFor(side, becomesKing);
  return next;
}

export function countCheckersPieces(
  board: readonly CheckersPiece[],
  side: CheckersSide,
): { total: number; kings: number } {
  let total = 0;
  let kings = 0;

  for (const piece of board) {
    if (pieceSide(piece) !== side) continue;
    total += 1;
    if (isKing(piece)) kings += 1;
  }

  return { total, kings };
}

export function roleToSide(role: 'host' | 'guest'): CheckersSide {
  return role === 'host' ? 'white' : 'black';
}
