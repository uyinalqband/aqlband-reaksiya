import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/layout/Screen';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  applyCheckersMove,
  getCheckersLegalMoves,
  indexToCoordinate,
  type CheckersPiece,
  type CheckersSide,
} from '@/features/games/checkers/logic';
import { useGameHistoryStore } from '@/store/gameHistoryStore';
import { useTelegramBackButton } from '@/hooks/useTelegramBackButton';
import { haptics } from '@/lib/telegram';

interface Puzzle {
  id: string;
  side: CheckersSide;
  pieces: Record<number, CheckersPiece>;
  from: number;
  to: number;
}

const PUZZLES: Puzzle[] = [
  { id: 'capture-left', side: 'white', pieces: { 21: 'w', 17: 'b', 8: 'b', 3: 'b' }, from: 21, to: 14 },
  { id: 'capture-right', side: 'white', pieces: { 22: 'w', 18: 'b', 5: 'b', 11: 'b' }, from: 22, to: 15 },
  { id: 'break-center', side: 'white', pieces: { 26: 'w', 22: 'b', 9: 'b', 2: 'b' }, from: 26, to: 17 },
  { id: 'black-counter', side: 'black', pieces: { 9: 'b', 13: 'w', 23: 'w', 30: 'w' }, from: 9, to: 16 },
  { id: 'last-rank', side: 'white', pieces: { 29: 'w', 25: 'b', 10: 'b', 7: 'b' }, from: 29, to: 22 },
];

function tashkentDayNumber(): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tashkent',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Math.floor(Date.UTC(Number(value.year), Number(value.month) - 1, Number(value.day)) / 86_400_000);
}

function dailyPuzzles(): Puzzle[] {
  const offset = tashkentDayNumber() % PUZZLES.length;
  return [...PUZZLES.slice(offset), ...PUZZLES.slice(0, offset)];
}

function puzzleBoard(puzzle: Puzzle): CheckersPiece[] {
  return Array.from({ length: 32 }, (_, index) => puzzle.pieces[index] ?? '.') as CheckersPiece[];
}

function pieceGlyph(piece: CheckersPiece): string {
  if (piece === 'W') return '♔';
  if (piece === 'B') return '♚';
  if (piece === 'w') return '●';
  if (piece === 'b') return '●';
  return '';
}

export function CheckersPuzzleScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const addAttempt = useGameHistoryStore((state) => state.addAttempt);
  const puzzles = useMemo(dailyPuzzles, []);
  const [index, setIndex] = useState(0);
  const [board, setBoard] = useState(() => puzzleBoard(puzzles[0]));
  const [selected, setSelected] = useState<number | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [finished, setFinished] = useState(false);
  const [feedback, setFeedback] = useState('');
  const startedAt = useRef(Date.now());
  const timers = useRef<number[]>([]);
  const puzzle = puzzles[index];
  const goBack = () => navigate('/games', { replace: true });
  useTelegramBackButton(goBack);
  useEffect(() => () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  }, []);

  const legalMoves = useMemo(
    () => getCheckersLegalMoves(board, puzzle.side),
    [board, puzzle.side],
  );
  const selectedTargets = selected === null
    ? new Set<number>()
    : new Set(legalMoves.filter((move) => move.from === selected).map((move) => move.to));

  const finish = async (nextMistakes: number) => {
    const duration = Math.max(1, Date.now() - startedAt.current);
    await addAttempt({
      gameId: 'checkers-puzzle',
      value: duration,
      metric: 'duration_ms',
      meta: {
        rounds: puzzles.length,
        correct: puzzles.length,
        errors: nextMistakes,
        mistakes: nextMistakes,
        difficulty: 'progressive',
        puzzleId: puzzles.map((item) => item.id).join(','),
      },
    });
    setFinished(true);
  };

  const choose = (cell: number | null) => {
    if (cell === null || finished || feedback) return;
    if (selected === null) {
      const ownsPiece = legalMoves.some((move) => move.from === cell);
      if (ownsPiece) {
        setSelected(cell);
        haptics.selection();
      }
      return;
    }

    const move = legalMoves.find((candidate) => candidate.from === selected && candidate.to === cell);
    if (!move) {
      if (legalMoves.some((candidate) => candidate.from === cell)) setSelected(cell);
      else setSelected(null);
      return;
    }

    if (move.from !== puzzle.from || move.to !== puzzle.to) {
      setMistakes((value) => value + 1);
      setFeedback(t('checkersPuzzle.tryAgain'));
      haptics.error();
      timers.current.push(window.setTimeout(() => setFeedback(''), 700));
      return;
    }

    setBoard(applyCheckersMove(board, move));
    setSelected(null);
    setFeedback(t('checkersPuzzle.correct'));
    haptics.success();
    timers.current.push(window.setTimeout(() => {
      const nextIndex = index + 1;
      if (nextIndex >= puzzles.length) {
        void finish(mistakes);
        setFeedback('');
        return;
      }
      setIndex(nextIndex);
      setBoard(puzzleBoard(puzzles[nextIndex]));
      setFeedback('');
    }, 650));
  };

  const restart = () => {
    setIndex(0);
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
    setBoard(puzzleBoard(puzzles[0]));
    setSelected(null);
    setMistakes(0);
    setFinished(false);
    setFeedback('');
    startedAt.current = Date.now();
  };

  return (
    <Screen>
      <TopBar title={t('games.checkersPuzzle.title')} onBack={goBack} />
      {finished ? (
        <Card className="text-center">
          <div className="text-5xl">🏆</div>
          <h2 className="mt-4 font-display text-2xl font-black">{t('checkersPuzzle.finished')}</h2>
          <p className="mt-2 text-sm text-mist-500">
            {t('checkersPuzzle.summary', { count: puzzles.length, mistakes })}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Button onClick={restart}>{t('checkersPuzzle.retry')}</Button>
            <Button variant="secondary" onClick={goBack}>{t('common.back')}</Button>
          </div>
        </Card>
      ) : (
        <>
          <Card className="mb-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.18em] text-violet-300">
                  {t('checkersPuzzle.progress', { current: index + 1, total: puzzles.length })}
                </p>
                <h2 className="mt-1 font-display text-lg font-black">{t('checkersPuzzle.findMove')}</h2>
              </div>
              <span className="rounded-2xl bg-amber-400/10 px-3 py-2 text-xs font-black text-amber-300">
                {puzzle.side === 'white' ? t('checkersPuzzle.whiteTurn') : t('checkersPuzzle.blackTurn')}
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-mist-500">{t('checkersPuzzle.hint')}</p>
          </Card>

          <div className="mx-auto aspect-square w-full max-w-md overflow-hidden rounded-3xl border-4 border-[#274762] bg-[#b8cce0] shadow-2xl">
            <div className="grid h-full grid-cols-8 grid-rows-8">
              {Array.from({ length: 64 }, (_, visualIndex) => {
                const row = Math.floor(visualIndex / 8);
                const column = visualIndex % 8;
                const playable = (row + column) % 2 === 1;
                const boardIndex = playable ? row * 4 + Math.floor(column / 2) : null;
                const piece = boardIndex === null ? '.' : board[boardIndex];
                const target = boardIndex !== null && selectedTargets.has(boardIndex);
                const active = boardIndex === selected;
                return (
                  <button
                    key={visualIndex}
                    type="button"
                    disabled={!playable}
                    onClick={() => choose(boardIndex)}
                    aria-label={playable && boardIndex !== null
                      ? `${indexToCoordinate(boardIndex).row + 1}:${indexToCoordinate(boardIndex).column + 1}`
                      : undefined}
                    className={`relative flex items-center justify-center ${
                      playable ? 'bg-[#294661]' : 'bg-[#c8d9e8]'
                    } ${active ? 'ring-4 ring-inset ring-emerald-300' : ''}`}
                  >
                    {target ? <span className="absolute h-3 w-3 rounded-full bg-emerald-300 shadow-glow" /> : null}
                    {piece !== '.' ? (
                      <span className={`relative flex h-[72%] w-[72%] items-center justify-center rounded-full border-2 text-[clamp(1rem,6vw,2rem)] shadow-lg ${
                        piece === 'w' || piece === 'W'
                          ? 'border-white bg-gradient-to-br from-white to-slate-300 text-slate-500'
                          : 'border-rose-300/50 bg-gradient-to-br from-[#5f2944] to-[#23111d] text-rose-200'
                      }`}>
                        {pieceGlyph(piece)}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 min-h-12 text-center">
            <p className={`text-sm font-bold ${feedback === t('checkersPuzzle.correct') ? 'text-emerald-300' : 'text-amber-300'}`}>
              {feedback || t('checkersPuzzle.selectPiece')}
            </p>
          </div>
        </>
      )}
    </Screen>
  );
}
