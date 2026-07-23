import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/layout/Screen';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { GameSetupPanel } from '@/components/games/GameSetupPanel';
import { GameSessionSummary } from '@/components/games/GameSessionSummary';
import { DuelGameResult } from '@/components/games/DuelGameResult';
import { readDuelGameContext } from '@/features/duel/duelSession';
import { createRoundRandom } from '@/features/games/shared/random';
import {
  cellPeers,
  generateSudokuPuzzle,
  isSameSudokuGroup,
  pickHintCell,
  type SudokuGrid,
} from '@/features/games/sudoku/logic';
import {
  difficultyIndex,
  type GameSessionConfig,
} from '@/features/games/session/config';
import { useGameHistoryStore } from '@/store/gameHistoryStore';
import { useTelegramBackButton } from '@/hooks/useTelegramBackButton';
import { haptics } from '@/lib/telegram';

interface SudokuOutcome {
  durationMs: number;
  mistakes: number;
  hints: number;
  clues: number;
}

interface UndoSnapshot {
  board: SudokuGrid;
  notes: Record<number, number[]>;
  mistakes: number;
  hintsUsed: number;
  penaltyMs: number;
}

type Phase = 'setup' | 'playing' | 'result';

const GAME_ID = 'sudoku' as const;
const MISTAKE_PENALTY_MS = 15_000;
const HINT_PENALTY_MS = 30_000;
const HINT_LIMITS = [3, 2, 1, 0] as const;

function formatClock(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function cloneNotes(notes: Record<number, number[]>): Record<number, number[]> {
  return Object.fromEntries(
    Object.entries(notes).map(([index, values]) => [index, [...values]]),
  );
}

function resolveSudokuLevel(config: GameSessionConfig, round: number): number {
  if (config.difficulty !== 'progressive') {
    return difficultyIndex(config.difficulty, round);
  }

  const totalRounds = config.rounds === 'survival' ? 1 : config.rounds;
  if (totalRounds <= 1) return 1;

  const progress = (round - 1) / (totalRounds - 1);
  return Math.min(3, Math.round(progress * 3));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function SudokuScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const addAttempt = useGameHistoryStore((state) => state.addAttempt);
  const duelContext = useMemo(
    () => readDuelGameContext(location.state, GAME_ID),
    [location.state],
  );

  const [phase, setPhase] = useState<Phase>('setup');
  const [config, setConfig] = useState<GameSessionConfig | null>(null);
  const [round, setRound] = useState(1);
  const [outcomes, setOutcomes] = useState<SudokuOutcome[]>([]);

  const [puzzle, setPuzzle] = useState<SudokuGrid>([]);
  const [solution, setSolution] = useState<SudokuGrid>([]);
  const [board, setBoard] = useState<SudokuGrid>([]);
  const [clues, setClues] = useState(0);
  const [notes, setNotes] = useState<Record<number, number[]>>({});
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [notesMode, setNotesMode] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [penaltyMs, setPenaltyMs] = useState(0);
  const [undoStack, setUndoStack] = useState<UndoSnapshot[]>([]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [roundSolved, setRoundSolved] = useState(false);

  const startedAtRef = useRef(0);
  const generatedKeyRef = useRef('');
  const finishingRef = useRef(false);

  const level = config ? resolveSudokuLevel(config, round) : 1;
  const hintLimit = HINT_LIMITS[level];
  const givens = useMemo(
    () => new Set(puzzle.map((value, index) => (value !== 0 ? index : -1)).filter((index) => index >= 0)),
    [puzzle],
  );

  const totalEditable = Math.max(1, 81 - clues);
  const correctlyFilled = board.reduce(
    (count, value, index) =>
      count + (!givens.has(index) && value !== 0 && value === solution[index] ? 1 : 0),
    0,
  );
  const progressPercent = Math.round((correctlyFilled / totalEditable) * 100);
  const averageMs = average(outcomes.map((outcome) => outcome.durationMs));
  const totalMistakes = outcomes.reduce((sum, outcome) => sum + outcome.mistakes, 0);
  const totalHints = outcomes.reduce((sum, outcome) => sum + outcome.hints, 0);

  const goHome = useCallback(() => navigate('/', { replace: true }), [navigate]);

  const changeSettings = useCallback(() => {
    if (duelContext) {
      goHome();
      return;
    }
    generatedKeyRef.current = '';
    setConfig(null);
    setPhase('setup');
  }, [duelContext, goHome]);

  const handleBack = useCallback(() => {
    if (phase === 'playing' && !roundSolved) {
      const confirmed = window.confirm(t('sudoku.exitConfirm'));
      if (!confirmed) return;
    }
    if (phase === 'setup' || duelContext) goHome();
    else changeSettings();
  }, [changeSettings, duelContext, goHome, phase, roundSolved, t]);

  useTelegramBackButton(handleBack);

  const saveUndo = useCallback(() => {
    setUndoStack((current) => [
      ...current.slice(-39),
      {
        board: [...board],
        notes: cloneNotes(notes),
        mistakes,
        hintsUsed,
        penaltyMs,
      },
    ]);
  }, [board, hintsUsed, mistakes, notes, penaltyMs]);

  const setupRound = useCallback(
    (sessionConfig: GameSessionConfig, roundNumber: number) => {
      const key = `${duelContext?.duelId ?? 'solo'}:${sessionConfig.difficulty}:${roundNumber}`;
      if (generatedKeyRef.current === key) return;
      generatedKeyRef.current = key;

      const roundLevel = resolveSudokuLevel(sessionConfig, roundNumber);
      const random = createRoundRandom(duelContext?.duelId, GAME_ID, roundNumber);
      const generated = generateSudokuPuzzle(random, roundLevel);
      const firstEmpty = generated.puzzle.findIndex((value) => value === 0);

      setPuzzle(generated.puzzle);
      setSolution(generated.solution);
      setBoard([...generated.puzzle]);
      setClues(generated.clues);
      setNotes({});
      setSelectedIndex(firstEmpty >= 0 ? firstEmpty : null);
      setNotesMode(false);
      setMistakes(0);
      setHintsUsed(0);
      setPenaltyMs(0);
      setUndoStack([]);
      setElapsedMs(0);
      setRoundSolved(false);
      finishingRef.current = false;
      startedAtRef.current = performance.now();
    },
    [duelContext?.duelId],
  );

  const startSession = useCallback((sessionConfig: GameSessionConfig) => {
    generatedKeyRef.current = '';
    setConfig({
      ...sessionConfig,
      rounds: sessionConfig.rounds === 'survival' ? 1 : sessionConfig.rounds,
    });
    setRound(1);
    setOutcomes([]);
    setPhase('playing');
  }, []);

  useEffect(() => {
    if (duelContext && phase === 'setup') startSession(duelContext.config);
  }, [duelContext, phase, startSession]);

  useEffect(() => {
    if (phase !== 'playing' || !config) return;
    setupRound(config, round);
  }, [config, phase, round, setupRound]);

  useEffect(() => {
    if (phase !== 'playing' || roundSolved || startedAtRef.current === 0) return;
    const update = () => {
      setElapsedMs(performance.now() - startedAtRef.current + penaltyMs);
    };
    update();
    const interval = window.setInterval(update, 250);
    return () => window.clearInterval(interval);
  }, [penaltyMs, phase, roundSolved]);

  const finishRound = useCallback(
    async (
      finalBoard: SudokuGrid,
      finalMistakes: number,
      finalHints: number,
      finalPenaltyMs: number,
    ) => {
      if (!config || finishingRef.current) return;
      if (!finalBoard.every((value, index) => value === solution[index])) return;

      finishingRef.current = true;
      setRoundSolved(true);
      haptics.success();

      const outcome: SudokuOutcome = {
        durationMs: Math.max(
          1,
          Math.round(performance.now() - startedAtRef.current + finalPenaltyMs),
        ),
        mistakes: finalMistakes,
        hints: finalHints,
        clues,
      };
      const nextOutcomes = [...outcomes, outcome];
      setOutcomes(nextOutcomes);

      const targetRounds = config.rounds === 'survival' ? 1 : config.rounds;
      if (round >= targetRounds) {
        const finalAverage = average(nextOutcomes.map((item) => item.durationMs));
        await addAttempt({
          gameId: GAME_ID,
          metric: 'duration_ms',
          value: finalAverage,
          meta: {
            rounds: nextOutcomes.length,
            correct: nextOutcomes.length,
            difficulty: config.difficulty,
            mistakes: nextOutcomes.reduce((sum, item) => sum + item.mistakes, 0),
            hints: nextOutcomes.reduce((sum, item) => sum + item.hints, 0),
            clues: Math.round(
              nextOutcomes.reduce((sum, item) => sum + item.clues, 0) /
                nextOutcomes.length,
            ),
          },
        });
        window.setTimeout(() => setPhase('result'), 650);
        return;
      }

      window.setTimeout(() => {
        generatedKeyRef.current = '';
        setRound((current) => current + 1);
      }, 900);
    },
    [addAttempt, clues, config, outcomes, round, solution],
  );

  const clearPeerNotes = useCallback(
    (source: Record<number, number[]>, index: number, digit: number) => {
      const next = cloneNotes(source);
      for (const peer of cellPeers(index)) {
        if (!next[peer]) continue;
        next[peer] = next[peer].filter((value) => value !== digit);
        if (next[peer].length === 0) delete next[peer];
      }
      delete next[index];
      return next;
    },
    [],
  );

  const enterDigit = useCallback(
    (digit: number) => {
      if (
        selectedIndex === null ||
        givens.has(selectedIndex) ||
        roundSolved ||
        solution.length !== 81
      ) {
        return;
      }

      saveUndo();

      if (notesMode && board[selectedIndex] === 0) {
        setNotes((current) => {
          const next = cloneNotes(current);
          const values = new Set(next[selectedIndex] ?? []);
          if (values.has(digit)) values.delete(digit);
          else values.add(digit);
          next[selectedIndex] = [...values].sort((left, right) => left - right);
          if (next[selectedIndex].length === 0) delete next[selectedIndex];
          return next;
        });
        haptics.selection();
        return;
      }

      const nextBoard = [...board];
      nextBoard[selectedIndex] = digit;
      const correct = digit === solution[selectedIndex];
      const alreadySameWrong =
        board[selectedIndex] === digit && digit !== solution[selectedIndex];
      const nextMistakes = correct || alreadySameWrong ? mistakes : mistakes + 1;
      const nextPenalty = correct || alreadySameWrong
        ? penaltyMs
        : penaltyMs + MISTAKE_PENALTY_MS;

      setBoard(nextBoard);
      setMistakes(nextMistakes);
      setPenaltyMs(nextPenalty);
      setNotes((current) =>
        correct
          ? clearPeerNotes(current, selectedIndex, digit)
          : { ...current, [selectedIndex]: [] },
      );

      if (correct) {
        haptics.impact('light');
        void finishRound(nextBoard, nextMistakes, hintsUsed, nextPenalty);
      } else if (!alreadySameWrong) {
        haptics.error();
      }
    },
    [
      board,
      clearPeerNotes,
      finishRound,
      givens,
      hintsUsed,
      mistakes,
      notesMode,
      penaltyMs,
      roundSolved,
      saveUndo,
      selectedIndex,
      solution,
    ],
  );

  const eraseSelected = useCallback(() => {
    if (selectedIndex === null || givens.has(selectedIndex) || roundSolved) return;
    saveUndo();
    const nextBoard = [...board];
    nextBoard[selectedIndex] = 0;
    setBoard(nextBoard);
    setNotes((current) => {
      const next = cloneNotes(current);
      delete next[selectedIndex];
      return next;
    });
    haptics.selection();
  }, [board, givens, roundSolved, saveUndo, selectedIndex]);

  const undo = useCallback(() => {
    const snapshot = undoStack[undoStack.length - 1];
    if (!snapshot || roundSolved) return;
    setBoard(snapshot.board);
    setNotes(snapshot.notes);
    setMistakes(snapshot.mistakes);
    setHintsUsed(snapshot.hintsUsed);
    setPenaltyMs(snapshot.penaltyMs);
    setUndoStack((current) => current.slice(0, -1));
    haptics.selection();
  }, [roundSolved, undoStack]);

  const useHint = useCallback(() => {
    if (
      !config ||
      hintsUsed >= hintLimit ||
      roundSolved ||
      solution.length !== 81
    ) {
      return;
    }

    const random = createRoundRandom(
      duelContext?.duelId,
      GAME_ID,
      round,
      `hint-${hintsUsed + 1}`,
    );
    const hintIndex = pickHintCell(board, solution, selectedIndex, random);
    if (hintIndex === null || givens.has(hintIndex)) return;

    saveUndo();
    const nextBoard = [...board];
    const digit = solution[hintIndex];
    nextBoard[hintIndex] = digit;
    const nextHints = hintsUsed + 1;
    const nextPenalty = penaltyMs + HINT_PENALTY_MS;

    setBoard(nextBoard);
    setSelectedIndex(hintIndex);
    setHintsUsed(nextHints);
    setPenaltyMs(nextPenalty);
    setNotes((current) => clearPeerNotes(current, hintIndex, digit));
    haptics.success();
    void finishRound(nextBoard, mistakes, nextHints, nextPenalty);
  }, [
    board,
    clearPeerNotes,
    config,
    duelContext?.duelId,
    finishRound,
    givens,
    hintLimit,
    hintsUsed,
    mistakes,
    penaltyMs,
    round,
    roundSolved,
    saveUndo,
    selectedIndex,
    solution,
  ]);

  const selectedValue =
    selectedIndex === null ? 0 : board[selectedIndex] ?? 0;

  if (!config && phase === 'setup') {
    return (
      <Screen>
        <TopBar title={t('games.sudoku.title')} onBack={goHome} />
        <GameSetupPanel gameId={GAME_ID} onStart={startSession} />
      </Screen>
    );
  }

  return (
    <Screen>
      <TopBar title={t('games.sudoku.title')} onBack={handleBack} />

      {phase === 'playing' && config && (
        <div>
          <div className="flex items-center justify-between text-sm text-mist-500">
            <span>
              {t('gameplay.round')} {round}/
              {config.rounds === 'survival' ? 1 : config.rounds}
            </span>
            <span>{t(`difficulty.${config.difficulty}.title`)}</span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <SudokuStat
              label={t('sudoku.time')}
              value={formatClock(elapsedMs)}
              accent
            />
            <SudokuStat
              label={t('sudoku.mistakes')}
              value={String(mistakes)}
            />
            <SudokuStat
              label={t('sudoku.progress')}
              value={`${progressPercent}%`}
            />
          </div>

          <Card className="mt-4" padded={false}>
            <div className="flex items-center justify-between border-b border-ink-600/60 px-4 py-3 text-xs">
              <span className="text-mist-500">
                {t('sudoku.clues')}: <b className="text-mist-200">{clues}</b>
              </span>
              <span className="text-mist-500">
                {t('sudoku.hints')}: <b className="text-mist-200">{Math.max(0, hintLimit - hintsUsed)}</b>
              </span>
              <span className="text-mist-500">
                {notesMode ? `✎ ${t('sudoku.notesOn')}` : t('sudoku.autoCheck')}
              </span>
            </div>

            <div className="relative mx-auto aspect-square w-full max-w-[25rem] border-2 border-[#D8A941]/70 bg-[#F7F0E2] shadow-[0_18px_45px_-20px_rgba(0,0,0,0.9)]">
              <div className="grid h-full grid-cols-9">
                {board.map((value, index) => {
                  const row = Math.floor(index / 9);
                  const column = index % 9;
                  const given = givens.has(index);
                  const selected = selectedIndex === index;
                  const related =
                    selectedIndex !== null &&
                    isSameSudokuGroup(selectedIndex, index);
                  const sameNumber =
                    selectedValue !== 0 && value === selectedValue;
                  const wrong =
                    !given && value !== 0 && value !== solution[index];
                  const cellNotes = notes[index] ?? [];

                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setSelectedIndex(index)}
                      className={[
                        'relative flex min-h-0 items-center justify-center border-[#9A856B]/45 transition-colors',
                        column === 2 || column === 5
                          ? 'border-r-2 border-r-[#594667]/75'
                          : column < 8
                            ? 'border-r'
                            : '',
                        row === 2 || row === 5
                          ? 'border-b-2 border-b-[#594667]/75'
                          : row < 8
                            ? 'border-b'
                            : '',
                        selected
                          ? 'z-10 bg-[#7C3AED] text-white shadow-[inset_0_0_0_2px_rgba(255,255,255,0.5)]'
                          : wrong
                            ? 'bg-[#FECACA] text-[#991B1B]'
                            : sameNumber
                              ? 'bg-[#F6D783] text-[#2A1837]'
                              : related
                                ? 'bg-[#E9DDF6] text-[#2A1837]'
                                : given
                                  ? 'bg-[#F8F1E5] text-[#25172F]'
                                  : 'bg-[#FFFDF7] text-[#5B21B6]',
                      ].join(' ')}
                    >
                      {value !== 0 ? (
                        <span
                          className={[
                            'font-display text-[clamp(1rem,5.2vw,1.65rem)] leading-none',
                            given ? 'font-black' : 'font-bold',
                          ].join(' ')}
                        >
                          {value}
                        </span>
                      ) : cellNotes.length > 0 ? (
                        <span className="grid h-full w-full grid-cols-3 grid-rows-3 p-[2px] text-[clamp(0.42rem,1.9vw,0.66rem)] font-bold leading-none text-[#6D5B74]">
                          {Array.from({ length: 9 }, (_, noteIndex) => {
                            const digit = noteIndex + 1;
                            return (
                              <span
                                key={digit}
                                className="flex items-center justify-center"
                              >
                                {cellNotes.includes(digit) ? digit : ''}
                              </span>
                            );
                          })}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {roundSolved && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#160E28]/88 text-center backdrop-blur-sm">
                  <div className="text-6xl">✨</div>
                  <p className="mt-4 font-display text-2xl font-bold text-white">
                    {t('sudoku.solved')}
                  </p>
                  <p className="mt-2 font-mono text-lg text-gold-300">
                    {formatClock(elapsedMs)}
                  </p>
                </div>
              )}
            </div>
          </Card>

          <div className="mt-4 grid grid-cols-9 gap-1.5">
            {Array.from({ length: 9 }, (_, index) => index + 1).map((digit) => {
              const completed =
                board.filter(
                  (value, cellIndex) =>
                    value === digit && value === solution[cellIndex],
                ).length >= 9;

              return (
                <button
                  key={digit}
                  type="button"
                  disabled={completed || roundSolved}
                  onClick={() => enterDigit(digit)}
                  className={[
                    'aspect-square rounded-xl border font-display text-xl font-black transition-all active:scale-95',
                    completed
                      ? 'border-ink-700 bg-ink-900 text-mist-700'
                      : notesMode
                        ? 'border-gold-400/60 bg-gold-500/15 text-gold-300'
                        : 'border-violet-400/40 bg-violet-600/20 text-violet-200',
                  ].join(' ')}
                >
                  {digit}
                </button>
              );
            })}
          </div>

          <div className="mt-3 grid grid-cols-4 gap-2">
            <ActionButton
              label={t('sudoku.undo')}
              icon="↶"
              active={false}
              disabled={undoStack.length === 0 || roundSolved}
              onClick={undo}
            />
            <ActionButton
              label={t('sudoku.erase')}
              icon="⌫"
              active={false}
              disabled={
                selectedIndex === null ||
                givens.has(selectedIndex) ||
                roundSolved
              }
              onClick={eraseSelected}
            />
            <ActionButton
              label={t('sudoku.notes')}
              icon="✎"
              active={notesMode}
              disabled={roundSolved}
              onClick={() => setNotesMode((current) => !current)}
            />
            <ActionButton
              label={t('sudoku.hint')}
              icon="💡"
              active={false}
              disabled={hintsUsed >= hintLimit || roundSolved}
              onClick={useHint}
            />
          </div>

          <div className="mt-4">
            <div className="flex justify-between text-xs text-mist-500">
              <span>{t('sudoku.progress')}</span>
              <span className="font-mono text-mist-300">
                {correctlyFilled}/{totalEditable}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-700">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 via-violet-400 to-gold-400 transition-[width] duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            {(mistakes > 0 || hintsUsed > 0) && (
              <p className="mt-2 text-center text-[11px] text-mist-600">
                {t('sudoku.penaltyInfo', {
                  seconds:
                    (mistakes * MISTAKE_PENALTY_MS +
                      hintsUsed * HINT_PENALTY_MS) /
                    1000,
                })}
              </p>
            )}
          </div>
        </div>
      )}

      {phase === 'result' && config && (
        duelContext ? (
          <DuelGameResult
            context={duelContext}
            title={t('games.sudoku.title')}
            emoji="🔳"
            averageMs={averageMs}
            completedRounds={outcomes.length}
            correct={outcomes.length}
            errors={totalMistakes}
            config={config}
            onHome={goHome}
          />
        ) : (
          <GameSessionSummary
            title={t('games.sudoku.title')}
            emoji="🔳"
            averageMs={averageMs}
            completedRounds={outcomes.length}
            correct={outcomes.length}
            errors={totalMistakes}
            config={config}
            onReplay={() => startSession(config)}
            onChangeSettings={changeSettings}
            onHome={goHome}
          >
            <Card className="mt-4 w-full">
              <div className="grid grid-cols-3 gap-2 text-center">
                <SudokuStat
                  label={t('sudoku.mistakes')}
                  value={String(totalMistakes)}
                />
                <SudokuStat
                  label={t('sudoku.hintsUsed')}
                  value={String(totalHints)}
                />
                <SudokuStat
                  label={t('sudoku.averageClues')}
                  value={String(
                    Math.round(
                      outcomes.reduce((sum, item) => sum + item.clues, 0) /
                        Math.max(1, outcomes.length),
                    ),
                  )}
                />
              </div>
            </Card>
          </GameSessionSummary>
        )
      )}
    </Screen>
  );
}

function SudokuStat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-ink-600/60 bg-ink-800/80 px-2 py-3 text-center">
      <p
        className={`font-mono text-base font-bold tabular-nums ${
          accent ? 'text-gold-400' : 'text-mist-100'
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-[9px] font-medium uppercase tracking-wide text-mist-500">
        {label}
      </p>
    </div>
  );
}

function ActionButton({
  label,
  icon,
  active,
  disabled,
  onClick,
}: {
  label: string;
  icon: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        'flex min-h-14 flex-col items-center justify-center rounded-xl border px-1 transition-all active:scale-95 disabled:opacity-30',
        active
          ? 'border-gold-400/70 bg-gold-500/15 text-gold-300'
          : 'border-ink-600 bg-ink-800 text-mist-300',
      ].join(' ')}
    >
      <span className="text-xl leading-none">{icon}</span>
      <span className="mt-1 text-[9px] font-semibold uppercase">{label}</span>
    </button>
  );
}
