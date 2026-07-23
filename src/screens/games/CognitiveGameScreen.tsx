import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/layout/Screen';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { GameSetupPanel } from '@/components/games/GameSetupPanel';
import { DuelGameResult } from '@/components/games/DuelGameResult';
import { getGameDefinition } from '@/features/games/catalog';
import { readDuelGameContext } from '@/features/duel/duelSession';
import {
  difficultyIndex,
  shouldFinishSession,
  type GameSessionConfig,
} from '@/features/games/session/config';
import { formatMs } from '@/features/games/session/metrics';
import { useGameHistoryStore } from '@/store/gameHistoryStore';
import { useOnlineStore } from '@/store/onlineStore';
import { useTelegramBackButton } from '@/hooks/useTelegramBackButton';
import { haptics } from '@/lib/telegram';
import { shareGameResult } from '@/lib/share';
import {
  createRoundRandom,
  pickRandom,
  randomInteger,
  shuffleRandom,
  type RandomSource,
} from '@/features/games/shared/random';

interface Challenge {
  prompt: string;
  options: string[];
  answer: string;
  note?: string;
}

interface RoundOutcome {
  durationMs: number;
  correct: boolean;
  timedOut?: boolean;
}

interface NBackStimulus {
  position: number;
  sound: string;
  expected: 'position' | 'sound' | 'both' | 'none';
}

type Phase = 'setup' | 'playing' | 'result';
type PeripheralDirection = 'nw' | 'n' | 'ne' | 'w' | 'e' | 'sw' | 's' | 'se';

const DIRECTION_META: Record<PeripheralDirection, { arrow: string; left: string; top: string }> = {
  nw: { arrow: '↖', left: '8%', top: '10%' },
  n: { arrow: '↑', left: '46%', top: '6%' },
  ne: { arrow: '↗', left: '83%', top: '10%' },
  w: { arrow: '←', left: '5%', top: '45%' },
  e: { arrow: '→', left: '87%', top: '45%' },
  sw: { arrow: '↙', left: '8%', top: '80%' },
  s: { arrow: '↓', left: '46%', top: '84%' },
  se: { arrow: '↘', left: '83%', top: '80%' },
};

const STICKERS = ['🚀', '🍎', '🐼', '⭐', '🎯', '🦊', '⚽', '🎵', '🌙', '🐸', '🦁', '🦉'];
const SEQUENCE_PAD = ['🚀', '🍎', '⭐', '🐼', '⚽', '🎵'];
const NBACK_SOUNDS = ['🔔', '🥁', '🎺', '🎹'];

const now = () => performance.now();

function average(values: number[]): number {
  return values.length === 0 ? 0 : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function formatElapsedTime(milliseconds: number): string {
  const safe = Math.max(0, Math.floor(milliseconds));
  const totalSeconds = Math.floor(safe / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const tenths = Math.floor((safe % 1000) / 100);

  if (minutes > 0) return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return `${String(seconds).padStart(2, '0')}.${tenths}s`;
}

function countPlacedPuzzleTiles(tiles: number[]): number {
  return tiles.reduce(
    (count, value, index) => count + (value !== 0 && value === index + 1 ? 1 : 0),
    0,
  );
}

function makeMathChallenge(level: number, random: RandomSource): Challenge {
  if (level === 0) {
    const a = 2 + randomInteger(random, 0, 17);
    const b = 2 + randomInteger(random, 0, 17);
    const answer = a + b;
    return numericOptions(`${a} + ${b} = ?`, answer, 2, random);
  }

  if (level === 1) {
    const a = 10 + randomInteger(random, 0, 44);
    const b = 2 + randomInteger(random, 0, 24);
    const subtract = random() > 0.5;
    return numericOptions(`${a} ${subtract ? '−' : '+'} ${b} = ?`, subtract ? a - b : a + b, 4, random);
  }

  if (level === 2) {
    const a = 3 + randomInteger(random, 0, 9);
    const b = 3 + randomInteger(random, 0, 9);
    const c = 2 + randomInteger(random, 0, 11);
    const answer = a * b + c;
    return numericOptions(`${a} × ${b} + ${c} = ?`, answer, 6, random);
  }

  const divisor = 2 + randomInteger(random, 0, 7);
  const quotient = 3 + randomInteger(random, 0, 11);
  const extra = 3 + randomInteger(random, 0, 19);
  const answer = quotient + extra;
  return numericOptions(`${divisor * quotient} ÷ ${divisor} + ${extra} = ?`, answer, 8, random);
}

function numericOptions(prompt: string, answer: number, distance: number, random: RandomSource): Challenge {
  const values = new Set<number>([answer]);
  while (values.size < 4) {
    const offset = randomInteger(random, 1, distance) * (random() > 0.5 ? 1 : -1);
    values.add(answer + offset);
  }
  return { prompt, options: shuffleRandom([...values], random).map(String), answer: String(answer) };
}

function makeTwentyFourChallenge(level: number, random: RandomSource): Challenge {
  const sets = [
    { prompt: '6 · 6 · 6 · 6', answer: '6 + 6 + 6 + 6', options: ['6 + 6 + 6 + 6', '6 × 6 − 6 − 6', '(6 + 6) × 2', '6 × 6 ÷ 6 + 6'] },
    { prompt: '2 · 3 · 4 · 6', answer: '6 ÷ 2 × (4 + 3)', options: ['6 ÷ 2 × (4 + 3)', '6 × 4 − 3 + 2', '(6 − 2) × (4 + 3)', '6 + 4 × 3 + 2'] },
    { prompt: '3 · 3 · 8 · 8', answer: '8 ÷ (3 − 8 ÷ 3)', options: ['8 ÷ (3 − 8 ÷ 3)', '8 + 8 + 3 + 3', '8 × 3 + 8 ÷ 3', '(8 − 3) × (8 − 3)'] },
    { prompt: '1 · 5 · 5 · 5', answer: '5 × (5 − 1 ÷ 5)', options: ['5 × (5 − 1 ÷ 5)', '5 + 5 + 5 + 1', '(5 − 1) × 5 + 5', '5 × 5 − 5 + 1'] },
    { prompt: '4 · 4 · 7 · 7', answer: '(7 − 4) × (7 + 1)', options: ['(7 − 4) × (7 + 1)', '7 + 7 + 4 + 4', '7 × 4 − 7 + 4', '(7 − 4) × 7 + 4'] },
    { prompt: '2 · 5 · 7 · 9', answer: '(9 − 5) × (7 − 2)', options: ['(9 − 5) × (7 − 2)', '9 + 7 + 5 + 2', '9 × 2 + 7 − 5', '(9 + 5) × 2 − 7'] },
  ];
  const pool = level <= 1 ? sets.slice(0, 3) : sets;
  const selected = pickRandom(pool, random);
  return { ...selected, options: shuffleRandom(selected.options, random), note: '= 24' };
}

function makeOddChallenge(level: number, random: RandomSource): Challenge {
  const pairs = [
    ['🍎', '🍏'], ['🐶', '🐺'], ['🐼', '🐻'], ['🌕', '🌝'], ['🚗', '🚕'], ['⚽', '🏀'],
    ['😎', '🤓'], ['🦁', '🐯'], ['🍓', '🍒'], ['🚀', '🛸'], ['🎯', '🧿'], ['🐸', '🦎'],
  ] as const;
  const [common, odd] = pickRandom(pairs, random);
  const count = [6, 9, 12, 16][level];
  const oddIndex = randomInteger(random, 0, count - 1);
  return {
    prompt: '',
    options: Array.from({ length: count }, (_, index) => (index === oddIndex ? odd : common)),
    answer: String(oddIndex),
  };
}

function makeAscendingChallenge(level: number, random: RandomSource): Challenge {
  const count = [9, 12, 16, 20][level];
  return {
    prompt: '1',
    options: shuffleRandom(Array.from({ length: count }, (_, index) => String(index + 1)), random),
    answer: String(count),
  };
}

function buildNBackSequence(nBack: number, length: number, random: RandomSource): NBackStimulus[] {
  const sequence: NBackStimulus[] = [];
  for (let index = 0; index < length; index += 1) {
    if (index < nBack) {
      sequence.push({
        position: randomInteger(random, 0, 8),
        sound: pickRandom(NBACK_SOUNDS, random),
        expected: 'none',
      });
      continue;
    }

    const expected = pickRandom(['position', 'sound', 'both', 'none'] as const, random);
    const previous = sequence[index - nBack];
    let position = randomInteger(random, 0, 8);
    let sound = pickRandom(NBACK_SOUNDS, random);

    if (expected === 'position' || expected === 'both') position = previous.position;
    else while (position === previous.position) position = randomInteger(random, 0, 8);

    if (expected === 'sound' || expected === 'both') sound = previous.sound;
    else while (sound === previous.sound) sound = pickRandom(NBACK_SOUNDS, random);

    sequence.push({ position, sound, expected });
  }
  return sequence;
}

export function CognitiveGameScreen() {
  const { gameId = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const game = getGameDefinition(gameId);
  const id = game?.id;
  const addAttempt = useGameHistoryStore((state) => state.addAttempt);
  const appUserId = useOnlineStore((state) => state.appUserId);
  const duelContext = useMemo(
    () => (id ? readDuelGameContext(location.state, id) : null),
    [id, location.state],
  );

  const [phase, setPhase] = useState<Phase>('setup');
  const [config, setConfig] = useState<GameSessionConfig | null>(null);
  const [round, setRound] = useState(1);
  const [outcomes, setOutcomes] = useState<RoundOutcome[]>([]);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [feedback, setFeedback] = useState('');

  const [ascendingNext, setAscendingNext] = useState(1);
  const [pattern, setPattern] = useState<number[]>([]);
  const [patternSticker, setPatternSticker] = useState('⭐');
  const [selectedPattern, setSelectedPattern] = useState<number[]>([]);
  const [showPattern, setShowPattern] = useState(false);
  const [patternGridSize, setPatternGridSize] = useState(9);

  const [sequence, setSequence] = useState<string[]>([]);
  const [sequenceInput, setSequenceInput] = useState<string[]>([]);
  const [showSequence, setShowSequence] = useState(false);

  const [cards, setCards] = useState<string[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [matchedCards, setMatchedCards] = useState<number[]>([]);

  const [tiles, setTiles] = useState<number[]>([]);
  const [puzzleMoves, setPuzzleMoves] = useState(0);
  const [cardMoves, setCardMoves] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);

  const [timeRunning, setTimeRunning] = useState(false);
  const [timeStart, setTimeStart] = useState(0);

  const [peripheralDirection, setPeripheralDirection] = useState<PeripheralDirection>('n');
  const [peripheralSticker, setPeripheralSticker] = useState('⭐');
  const [peripheralVisible, setPeripheralVisible] = useState(false);
  const [peripheralCanAnswer, setPeripheralCanAnswer] = useState(false);

  const [goStimulus, setGoStimulus] = useState<{ sticker: string; shouldTap: boolean } | null>(null);
  const [goVisible, setGoVisible] = useState(false);

  const [nBackSequence, setNBackSequence] = useState<NBackStimulus[]>([]);
  const [nBackIndex, setNBackIndex] = useState(0);
  const [nBackCorrect, setNBackCorrect] = useState(0);
  const [nBackErrors, setNBackErrors] = useState(0);
  const [nBackResponseTimes, setNBackResponseTimes] = useState<number[]>([]);

  const timersRef = useRef<number[]>([]);
  const roundFinishedRef = useRef(false);
  const puzzleMovesRef = useRef(0);
  const cardMovesRef = useRef(0);

  const level = config ? difficultyIndex(config.difficulty, round) : 1;
  const averageMs = average(outcomes.map((outcome) => outcome.durationMs));
  const correctRounds = outcomes.filter((outcome) => outcome.correct).length;
  const errors = outcomes.filter((outcome) => !outcome.correct).length;
  const timeouts = outcomes.filter((outcome) => outcome.timedOut).length;
  const puzzlePlaced = countPlacedPuzzleTiles(tiles);
  const matchedPairs = Math.floor(matchedCards.length / 2);
  const totalPairs = Math.floor(cards.length / 2);

  function clearTimers() {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  }

  function schedule(callback: () => void, delay: number) {
    const timer = window.setTimeout(callback, delay);
    timersRef.current.push(timer);
  }

  async function finishRound(durationMs: number, correct: boolean, timedOut = false) {
    if (!config || !id || roundFinishedRef.current) return;
    roundFinishedRef.current = true;
    clearTimers();
    setElapsedMs(Math.max(0, Math.round(durationMs)));
    setStartedAt(0);
    if (correct) haptics.success(); else haptics.error();

    const outcome: RoundOutcome = {
      durationMs: Math.max(1, Math.round(durationMs)),
      correct,
      timedOut,
    };
    const nextOutcomes = [...outcomes, outcome];
    setOutcomes(nextOutcomes);

    const done = shouldFinishSession(config, round, !correct);
    if (done) {
      const value = average(nextOutcomes.map((item) => item.durationMs));
      await addAttempt({
        id: duelContext && appUserId ? `duel-${duelContext.duelId}-${appUserId}` : undefined,
        gameId: id,
        value,
        metric: 'duration_ms',
        meta: {
          rounds: nextOutcomes.length,
          correct: nextOutcomes.filter((item) => item.correct).length,
          errors: nextOutcomes.filter((item) => !item.correct).length,
          difficulty: config.difficulty,
          survival: config.rounds === 'survival',
          memorySize: config.memorySize ?? null,
          nBack: config.nBack ?? null,
          puzzleShuffle: config.puzzleShuffle ?? null,
          puzzleMoves: id === 'fifteen-puzzle' ? puzzleMovesRef.current : null,
          cardMoves: id === 'card-memory' ? cardMovesRef.current : null,
        },
      });
      setPhase('result');
      return;
    }

    setFeedback(correct ? t('gameplay.correct') : t('gameplay.wrong'));
    schedule(() => setRound((current) => current + 1), 550);
  }

  function beginRound() {
    if (!id || !config) return;
    const random = createRoundRandom(duelContext?.duelId, id, round);
    clearTimers();
    roundFinishedRef.current = false;
    setFeedback('');
    setChallenge(null);
    setStartedAt(0);
    setElapsedMs(0);
    setAscendingNext(1);
    setSelectedPattern([]);
    setSequenceInput([]);
    setFlippedCards([]);
    setMatchedCards([]);
    setTimeRunning(false);
    setPeripheralVisible(false);
    setPeripheralCanAnswer(false);
    setGoVisible(false);
    setGoStimulus(null);
    setPuzzleMoves(0);
    setCardMoves(0);
    puzzleMovesRef.current = 0;
    cardMovesRef.current = 0;

    if (id === 'ascending-numbers') {
      setChallenge(makeAscendingChallenge(level, random));
      setStartedAt(now());
      return;
    }

    if (id === 'odd-one-out') {
      setChallenge(makeOddChallenge(level, random));
      setStartedAt(now());
      return;
    }

    if (id === 'mental-math') {
      setChallenge(makeMathChallenge(level, random));
      setStartedAt(now());
      return;
    }

    if (id === 'twenty-four') {
      setChallenge(makeTwentyFourChallenge(level, random));
      setStartedAt(now());
      return;
    }

    if (id === 'pattern-memory') {
      const gridSize = [9, 12, 16, 20][level];
      const requested = config.memorySize ?? 4;
      const count = Math.min(gridSize - 1, requested + level + Math.floor((round - 1) / 2));
      const nextPattern = shuffleRandom(Array.from({ length: gridSize }, (_, index) => index), random).slice(0, count);
      setPatternGridSize(gridSize);
      setPattern(nextPattern);
      setPatternSticker(pickRandom(STICKERS, random));
      setShowPattern(true);
      schedule(() => {
        setShowPattern(false);
        setStartedAt(now());
      }, [2400, 1750, 1200, 850][level]);
      return;
    }

    if (id === 'sequence-memory') {
      const length = Math.min(10, (config.memorySize ?? 4) + level + Math.floor((round - 1) / 2));
      const nextSequence = Array.from({ length }, () => pickRandom(SEQUENCE_PAD, random));
      setSequence(nextSequence);
      setShowSequence(true);
      schedule(() => {
        setShowSequence(false);
        setStartedAt(now());
      }, Math.max(900, 2700 - level * 500));
      return;
    }

    if (id === 'card-memory') {
      const pairCount = [3, 4, 6, 8][level];
      const icons = shuffleRandom(STICKERS, random).slice(0, pairCount);
      setCards(shuffleRandom([...icons, ...icons], random));
      setStartedAt(now());
      return;
    }

    if (id === 'fifteen-puzzle') {
      const nextTiles = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0];
      let emptyIndex = 15;
      let previousEmptyIndex = -1;
      const shuffleMoves = Math.min(180, (config.puzzleShuffle ?? 40) + level * 25);
      for (let move = 0; move < shuffleMoves; move += 1) {
        const row = Math.floor(emptyIndex / 4);
        const column = emptyIndex % 4;
        const available: number[] = [];
        if (row > 0) available.push(emptyIndex - 4);
        if (row < 3) available.push(emptyIndex + 4);
        if (column > 0) available.push(emptyIndex - 1);
        if (column < 3) available.push(emptyIndex + 1);

        const forwardMoves = available.filter((target) => target !== previousEmptyIndex);
        const target = pickRandom(forwardMoves.length > 0 ? forwardMoves : available, random);
        previousEmptyIndex = emptyIndex;
        [nextTiles[emptyIndex], nextTiles[target]] = [nextTiles[target], nextTiles[emptyIndex]];
        emptyIndex = target;
      }
      setTiles(nextTiles);
      setStartedAt(now());
      return;
    }

    if (id === 'time-estimation') {
      const ranges = [[2, 3], [3, 5], [5, 8], [7, 12]];
      const [minimum, maximum] = ranges[level];
      const target = randomInteger(random, minimum, maximum);
      setChallenge({ prompt: String(target), options: ['start'], answer: String(target) });
      return;
    }

    if (id === 'peripheral-vision') {
      const directions = level < 2
        ? (['n', 'e', 's', 'w'] as PeripheralDirection[])
        : (Object.keys(DIRECTION_META) as PeripheralDirection[]);
      const direction = pickRandom(directions, random);
      setPeripheralDirection(direction);
      setPeripheralSticker(pickRandom(STICKERS, random));
      schedule(() => {
        setPeripheralVisible(true);
        schedule(() => {
          setPeripheralVisible(false);
          setPeripheralCanAnswer(true);
          setStartedAt(now());
        }, [700, 480, 300, 180][level]);
      }, [900, 750, 600, 450][level]);
      return;
    }

    if (id === 'go-no-go') {
      const goStickers = ['🚀', '🍏', '✅', '🐸'];
      const noGoStickers = ['🛑', '🍎', '❌', '🦊'];
      const shouldTap = random() > [0.28, 0.34, 0.4, 0.45][level];
      const stimulus = { sticker: pickRandom(shouldTap ? goStickers : noGoStickers, random), shouldTap };
      setGoStimulus(stimulus);
      schedule(() => {
        setGoVisible(true);
        setStartedAt(now());
        schedule(() => {
          if (roundFinishedRef.current) return;
          if (stimulus.shouldTap) void finishRound([1600, 1200, 900, 650][level] + 900, false, true);
          else void finishRound([1600, 1200, 900, 650][level], true);
        }, [1600, 1200, 900, 650][level]);
      }, 450 + randomInteger(random, 0, [700, 600, 450, 350][level] - 1));
      return;
    }

    if (id === 'dual-n-back') {
      const nBack = config.nBack ?? 2;
      const length = 7 + level * 2 + nBack;
      setNBackSequence(buildNBackSequence(nBack, length, random));
      setNBackIndex(0);
      setNBackCorrect(0);
      setNBackErrors(0);
      setNBackResponseTimes([]);
      setStartedAt(now());
    }
  }

  function startGame(nextConfig: GameSessionConfig) {
    clearTimers();
    setConfig(nextConfig);
    setRound(1);
    setOutcomes([]);
    setPhase('playing');
  }

  function handleBasicAnswer(value: string) {
    if (!challenge || !id || !config) return;

    if (id === 'ascending-numbers') {
      const selected = Number(value);
      if (selected !== ascendingNext) {
        setFeedback(t('gameplay.wrong'));
        haptics.error();
        if (config.rounds === 'survival') void finishRound(now() - startedAt + 1000, false);
        return;
      }
      if (selected === Number(challenge.answer)) {
        void finishRound(now() - startedAt, true);
      } else {
        setAscendingNext(selected + 1);
      }
      return;
    }

    const correct = value === challenge.answer;
    void finishRound(now() - startedAt + (correct ? 0 : 900 + level * 180), correct);
  }

  function tapPattern(index: number) {
    if (showPattern || !config || roundFinishedRef.current) return;
    if (selectedPattern.includes(index)) return;
    const next = [...selectedPattern, index];
    setSelectedPattern(next);
    if (next.length < pattern.length) return;
    const correct = pattern.every((cell) => next.includes(cell));
    void finishRound(now() - startedAt + (correct ? 0 : 1100), correct);
  }

  function tapSequence(sticker: string) {
    if (showSequence || roundFinishedRef.current) return;
    const next = [...sequenceInput, sticker];
    setSequenceInput(next);
    const currentIndex = next.length - 1;
    if (next[currentIndex] !== sequence[currentIndex]) {
      void finishRound(now() - startedAt + 1200, false);
      return;
    }
    if (next.length === sequence.length) void finishRound(now() - startedAt, true);
  }

  function tapCard(index: number) {
    if (flippedCards.includes(index) || matchedCards.includes(index) || flippedCards.length === 2) return;
    const nextFlipped = [...flippedCards, index];
    setFlippedCards(nextFlipped);
    if (nextFlipped.length !== 2) return;

    const nextMoves = cardMovesRef.current + 1;
    cardMovesRef.current = nextMoves;
    setCardMoves(nextMoves);

    schedule(() => {
      if (cards[nextFlipped[0]] === cards[nextFlipped[1]]) {
        const nextMatched = [...matchedCards, ...nextFlipped];
        setMatchedCards(nextMatched);
        if (nextMatched.length === cards.length) void finishRound(now() - startedAt, true);
      }
      setFlippedCards([]);
    }, [700, 550, 430, 320][level]);
  }

  function tapTile(index: number) {
    const empty = tiles.indexOf(0);
    const row = Math.floor(index / 4);
    const column = index % 4;
    const emptyRow = Math.floor(empty / 4);
    const emptyColumn = empty % 4;
    if (Math.abs(row - emptyRow) + Math.abs(column - emptyColumn) !== 1) return;

    const next = [...tiles];
    [next[index], next[empty]] = [next[empty], next[index]];
    setTiles(next);
    const nextMoves = puzzleMovesRef.current + 1;
    puzzleMovesRef.current = nextMoves;
    setPuzzleMoves(nextMoves);
    if (next.every((value, position) => value === (position === 15 ? 0 : position + 1))) {
      void finishRound(now() - startedAt, true);
    }
  }

  function handleTimeButton() {
    if (!challenge) return;
    if (!timeRunning) {
      setTimeRunning(true);
      setTimeStart(now());
      return;
    }
    const elapsed = now() - timeStart;
    const target = Number(challenge.answer) * 1000;
    setTimeRunning(false);
    void finishRound(Math.abs(elapsed - target), true);
  }

  function answerPeripheral(direction: PeripheralDirection) {
    if (!peripheralCanAnswer) return;
    const correct = direction === peripheralDirection;
    void finishRound(now() - startedAt + (correct ? 0 : 1000), correct);
  }

  function tapGoNoGo() {
    if (!goVisible || !goStimulus) return;
    const correct = goStimulus.shouldTap;
    void finishRound(now() - startedAt + (correct ? 0 : 1000), correct);
  }

  function answerNBack(answer: NBackStimulus['expected']) {
    const stimulus = nBackSequence[nBackIndex];
    if (!stimulus || roundFinishedRef.current) return;
    const correct = answer === stimulus.expected;
    const nextCorrect = nBackCorrect + (correct ? 1 : 0);
    const nextErrors = nBackErrors + (correct ? 0 : 1);
    const nextTimes = [...nBackResponseTimes, now() - startedAt];
    setNBackCorrect(nextCorrect);
    setNBackErrors(nextErrors);
    setNBackResponseTimes(nextTimes);

    if (nBackIndex >= nBackSequence.length - 1) {
      const accuracy = nextCorrect / nBackSequence.length;
      const penalty = Math.round((1 - accuracy) * 4000);
      void finishRound(average(nextTimes) + penalty, accuracy >= 0.7);
      return;
    }

    setNBackIndex((index) => index + 1);
    setStartedAt(now());
  }

  function goHome() {
    clearTimers();
    navigate('/', { replace: true });
  }

  function changeSettings() {
    clearTimers();
    setConfig(null);
    setPhase('setup');
    setOutcomes([]);
    setRound(1);
  }

  const handleBack = duelContext ? goHome : phase === 'setup' ? goHome : changeSettings;
  useTelegramBackButton(handleBack);

  useEffect(() => {
    if (phase !== 'playing' || startedAt <= 0 || id === 'time-estimation') return undefined;

    const updateElapsed = () => setElapsedMs(Math.max(0, now() - startedAt));
    updateElapsed();
    const interval = window.setInterval(updateElapsed, 100);
    return () => window.clearInterval(interval);
  }, [phase, startedAt, id]);

  useEffect(() => {
    if (duelContext && phase === 'setup' && !config) startGame(duelContext.config);
  }, [duelContext, phase, config]);

  useEffect(() => {
    if (phase === 'playing' && config && id) beginRound();
    return clearTimers;
    // Round changes intentionally create a fresh challenge.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, config, round, id]);

  if (!game || !id) {
    return (
      <Screen>
        <TopBar title={t('common.game')} onBack={goHome} />
        <Card><p className="text-sm text-mist-500">{t('common.notFound')}</p></Card>
      </Screen>
    );
  }

  const cardColumns = cards.length <= 8 ? 'grid-cols-4' : 'grid-cols-4';
  const oddColumns = challenge && challenge.options.length <= 9 ? 'grid-cols-3' : 'grid-cols-4';
  const ascendingColumns = challenge && challenge.options.length <= 9 ? 'grid-cols-3' : 'grid-cols-4';
  const patternColumns = patternGridSize === 9 ? 'grid-cols-3' : patternGridSize === 20 ? 'grid-cols-5' : 'grid-cols-4';
  const peripheralChoices = level < 2
    ? (['n', 'e', 's', 'w'] as PeripheralDirection[])
    : (Object.keys(DIRECTION_META) as PeripheralDirection[]);

  const progressValue = (() => {
    if (id === 'ascending-numbers' && challenge) return `${Math.min(ascendingNext - 1, Number(challenge.answer))}/${challenge.answer}`;
    if (id === 'odd-one-out' && challenge) return `${challenge.options.length}`;
    if (id === 'pattern-memory') return `${selectedPattern.length}/${pattern.length}`;
    if (id === 'sequence-memory') return `${sequenceInput.length}/${sequence.length}`;
    if (id === 'card-memory') return `${matchedPairs}/${totalPairs}`;
    if (id === 'fifteen-puzzle') return `${puzzlePlaced}/15`;
    if (id === 'dual-n-back') return `${Math.min(nBackIndex + 1, nBackSequence.length)}/${nBackSequence.length}`;
    return `${round}${config?.rounds === 'survival' ? '' : `/${config?.rounds ?? 1}`}`;
  })();

  const activityStat = (() => {
    if (id === 'ascending-numbers') return { label: t('gameplay.target'), value: String(ascendingNext) };
    if (id === 'odd-one-out' && challenge) return { label: t('gameplay.options'), value: String(challenge.options.length) };
    if (id === 'pattern-memory') return { label: t('gameplay.selected'), value: String(selectedPattern.length) };
    if (id === 'sequence-memory') return { label: t('gameplay.step'), value: String(sequenceInput.length) };
    if (id === 'card-memory') return { label: t('gameplay.turns'), value: String(cardMoves) };
    if (id === 'fifteen-puzzle') return { label: t('gameplay.moves'), value: String(puzzleMoves) };
    if (id === 'dual-n-back') return { label: t('result.correct'), value: String(nBackCorrect) };
    return { label: t('gameplay.level'), value: String(level + 1) };
  })();

  return (
    <Screen>
      <TopBar title={t(game.titleKey)} onBack={handleBack} />

      {phase === 'setup' && <GameSetupPanel gameId={id} onStart={startGame} />}

      {phase === 'playing' && config && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm text-mist-500">
            <span>{t('gameplay.round')} {round}{config.rounds === 'survival' ? '' : `/${config.rounds}`}</span>
            <span>{t(`difficulty.${config.difficulty}.title`)}</span>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <LiveStat
              icon="⏱️"
              label={t('gameplay.time')}
              value={id === 'time-estimation' ? t('gameplay.hiddenShort') : formatElapsedTime(elapsedMs)}
              accent={id === 'fifteen-puzzle'}
            />
            <LiveStat icon="📈" label={t('gameplay.progress')} value={progressValue} />
            <LiveStat icon="🎯" label={activityStat.label} value={activityStat.value} />
          </div>

          <Card className="min-h-[390px] overflow-hidden">
            {id === 'ascending-numbers' && challenge && (
              <div>
                <p className="mb-4 text-center text-sm text-mist-500">{t('gameplay.tapAscending')}</p>
                <div className={`mx-auto grid max-w-sm ${ascendingColumns} gap-3`}>
                  {challenge.options.map((option) => {
                    const completed = Number(option) < ascendingNext;
                    return (
                      <button
                        key={option}
                        type="button"
                        disabled={completed}
                        onClick={() => handleBasicAnswer(option)}
                        className={`aspect-square min-h-20 rounded-2xl border font-display text-3xl font-black tracking-tight shadow-card transition-transform active:scale-95 ${
                          completed
                            ? 'border-ink-700 bg-ink-900/40 text-mist-800'
                            : Number(option) === ascendingNext
                              ? 'border-violet-400/40 bg-ink-700 text-mist-100'
                              : 'border-ink-600 bg-ink-700 text-mist-100'
                        }`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {id === 'odd-one-out' && challenge && (
              <div>
                <p className="mb-4 text-center text-sm text-mist-500">{t('gameplay.findOddSticker')}</p>
                <div className={`mx-auto grid max-w-sm ${oddColumns} gap-3`}>
                  {challenge.options.map((option, index) => (
                    <button
                      key={`${index}-${option}`}
                      type="button"
                      onClick={() => handleBasicAnswer(String(index))}
                      className="aspect-square min-h-20 rounded-2xl border border-ink-600 bg-gradient-to-b from-ink-700 to-ink-800 text-5xl shadow-card transition-transform active:scale-95"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {id === 'pattern-memory' && (
              <div>
                <p className="mb-4 text-center text-sm text-mist-500">
                  {showPattern ? t('gameplay.remember') : t('gameplay.repeat')}
                </p>
                <div className={`mx-auto grid max-w-sm ${patternColumns} gap-2.5`}>
                  {Array.from({ length: patternGridSize }, (_, index) => {
                    const active = (showPattern && pattern.includes(index)) || selectedPattern.includes(index);
                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => tapPattern(index)}
                        className={`aspect-square min-h-12 rounded-xl border text-2xl transition-all ${
                          active
                            ? 'border-violet-300 bg-violet-500/35 shadow-glow'
                            : 'border-ink-600 bg-ink-700'
                        }`}
                      >
                        {active ? patternSticker : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {id === 'sequence-memory' && (
              <div className="flex min-h-[340px] flex-col items-center justify-center">
                <p className="mb-5 text-center text-sm text-mist-500">
                  {showSequence ? t('gameplay.rememberSequence') : t('gameplay.repeatSequence')}
                </p>
                {showSequence ? (
                  <div className="flex max-w-full flex-wrap justify-center gap-2">
                    {sequence.map((sticker, index) => (
                      <span key={`${sticker}-${index}`} className="flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-400/40 bg-violet-500/15 text-3xl">
                        {sticker}
                      </span>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="mb-6 flex min-h-14 flex-wrap justify-center gap-2">
                      {sequenceInput.map((sticker, index) => <span key={`${sticker}-${index}`} className="text-3xl">{sticker}</span>)}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {SEQUENCE_PAD.map((sticker) => (
                        <button key={sticker} type="button" onClick={() => tapSequence(sticker)} className="h-16 w-20 rounded-2xl border border-ink-600 bg-ink-700 text-3xl active:scale-95">
                          {sticker}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {id === 'card-memory' && (
              <div className={`grid ${cardColumns} gap-2.5`}>
                {cards.map((sticker, index) => {
                  const revealed = flippedCards.includes(index) || matchedCards.includes(index);
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => tapCard(index)}
                      className={`aspect-square min-h-16 rounded-2xl border text-3xl transition-all active:scale-95 ${
                        revealed
                          ? 'border-violet-400/50 bg-violet-500/15'
                          : 'border-ink-600 bg-gradient-to-b from-ink-700 to-ink-800'
                      }`}
                    >
                      {revealed ? sticker : '❔'}
                    </button>
                  );
                })}
              </div>
            )}

            {id === 'fifteen-puzzle' && (
              <div>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-mist-200">{t('gameplay.orderPuzzle')}</p>
                    <p className="mt-1 text-xs text-mist-500">{t('gameplay.puzzleHint')}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-gold-500/30 bg-gold-500/10 px-3 py-1.5 font-mono text-xs font-bold text-gold-300">
                    {puzzlePlaced}/15 {t('gameplay.inPlace')}
                  </span>
                </div>

                <div className="mx-auto grid max-w-[23rem] grid-cols-4 gap-2.5 rounded-3xl border border-[#D8A941]/45 bg-gradient-to-br from-[#2A1D3F] via-[#211633] to-[#151024] p-3.5 shadow-[0_18px_45px_-18px_rgba(0,0,0,0.8)]">
                  {tiles.map((number, index) => {
                    const placed = number !== 0 && number === index + 1;
                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => tapTile(index)}
                        aria-label={number === 0 ? t('gameplay.emptyCell') : String(number)}
                        className={`relative aspect-square rounded-2xl border font-display text-3xl font-black tracking-[-0.05em] transition-all duration-150 active:scale-95 ${
                          number === 0
                            ? 'border-dashed border-[#E6C77A]/20 bg-[#0F0A1D]/35'
                            : placed
                              ? 'border-[#F5C24C] bg-gradient-to-br from-[#FFF9E9] via-[#F4D995] to-[#E5B84E] text-[#24152F] shadow-[0_8px_22px_-10px_rgba(245,194,76,0.9)]'
                              : 'border-[#D7C6A1]/70 bg-gradient-to-br from-[#FFFDF8] via-[#EAE2D4] to-[#CDBEAA] text-[#21162F] shadow-[0_8px_20px_-12px_rgba(0,0,0,0.8)]'
                        }`}
                      >
                        {number || ''}
                        {placed && (
                          <span className="absolute right-1.5 top-1 text-[9px] font-bold tracking-normal text-[#7D5410]">◆</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-mist-500">
                    <span>{t('gameplay.progress')}</span>
                    <span className="font-mono text-mist-300">{Math.round((puzzlePlaced / 15) * 100)}%</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-700">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 to-gold-400 transition-[width] duration-300"
                      style={{ width: `${(puzzlePlaced / 15) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {id === 'time-estimation' && challenge && (
              <div className="flex min-h-[340px] flex-col items-center justify-center text-center">
                <p className="text-sm text-mist-500">{t('gameplay.estimateWithoutTimer')}</p>
                <p className="mt-5 font-mono text-7xl font-bold">{challenge.prompt}s</p>
                <Button className="mt-10 min-w-44" onClick={handleTimeButton}>
                  {timeRunning ? t('gameplay.stop') : t('gameplay.start')}
                </Button>
                {timeRunning && <p className="mt-4 animate-pulse text-xs text-violet-300">{t('gameplay.timerHidden')}</p>}
              </div>
            )}

            {id === 'peripheral-vision' && (
              <div>
                <p className="mb-3 text-center text-sm text-mist-500">{t('gameplay.keepEyesCenter')}</p>
                <div className="relative mx-auto h-72 max-w-sm overflow-hidden rounded-2xl border border-ink-600 bg-ink-900/50">
                  <div className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-violet-400/30 bg-violet-500/10 text-4xl text-violet-200">✚</div>
                  {peripheralVisible && (
                    <div
                      className="absolute flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl border border-gold-400/50 bg-gold-500/15 text-4xl shadow-glow"
                      style={{ left: DIRECTION_META[peripheralDirection].left, top: DIRECTION_META[peripheralDirection].top }}
                    >
                      {peripheralSticker}
                    </div>
                  )}
                  {!peripheralVisible && !peripheralCanAnswer && <p className="absolute inset-x-0 bottom-5 text-center text-xs text-mist-600">{t('gameplay.waitSticker')}</p>}
                </div>
                <div className={`mt-5 grid ${peripheralChoices.length === 4 ? 'grid-cols-4' : 'grid-cols-4'} gap-2`}>
                  {peripheralChoices.map((direction) => (
                    <button
                      key={direction}
                      type="button"
                      disabled={!peripheralCanAnswer}
                      onClick={() => answerPeripheral(direction)}
                      className="h-14 rounded-2xl border border-ink-600 bg-ink-700 text-2xl disabled:opacity-30 active:scale-95"
                    >
                      {DIRECTION_META[direction].arrow}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {id === 'go-no-go' && (
              <div className="flex min-h-[340px] flex-col items-center justify-center text-center">
                <div className="mb-5 rounded-xl border border-ink-600 bg-ink-900/50 px-4 py-2 text-xs text-mist-400">
                  GO: 🚀 🍏 ✅ 🐸 &nbsp; · &nbsp; NO-GO: 🛑 🍎 ❌ 🦊
                </div>
                <button
                  type="button"
                  onClick={tapGoNoGo}
                  disabled={!goVisible}
                  className={`flex h-56 w-56 items-center justify-center rounded-full border-4 text-8xl transition-all ${
                    goVisible
                      ? 'border-violet-400/50 bg-ink-700 shadow-glow active:scale-95'
                      : 'border-ink-700 bg-ink-900 text-transparent'
                  }`}
                >
                  {goVisible ? goStimulus?.sticker : '•'}
                </button>
                <p className="mt-5 text-sm text-mist-500">{goVisible ? t('gameplay.decideNow') : t('gameplay.waitSignal')}</p>
              </div>
            )}

            {id === 'dual-n-back' && nBackSequence[nBackIndex] && (
              <div className="text-center">
                <div className="flex items-center justify-between text-xs text-mist-500">
                  <span>{config.nBack ?? 2}-Back</span>
                  <span>{nBackIndex + 1}/{nBackSequence.length}</span>
                </div>
                <div className="mx-auto mt-5 grid w-56 grid-cols-3 gap-2.5">
                  {Array.from({ length: 9 }, (_, index) => (
                    <div
                      key={index}
                      className={`aspect-square rounded-xl border transition-colors ${
                        nBackSequence[nBackIndex].position === index
                          ? 'border-violet-300 bg-violet-500 shadow-glow'
                          : 'border-ink-600 bg-ink-700'
                      }`}
                    />
                  ))}
                </div>
                <div className="mt-5 text-5xl">{nBackSequence[nBackIndex].sound}</div>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  {(['position', 'sound', 'both', 'none'] as const).map((answer) => (
                    <button key={answer} type="button" onClick={() => answerNBack(answer)} className="h-14 rounded-2xl border border-ink-600 bg-ink-700 text-sm font-semibold active:scale-95">
                      {t(`gameplay.nback.${answer}`)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {['mental-math', 'twenty-four'].includes(id) && challenge && (
              <div className="flex min-h-[340px] flex-col items-center justify-center">
                <p className="text-center font-display text-3xl font-bold">{challenge.prompt}</p>
                {challenge.note && <p className="mt-2 text-sm text-gold-400">{challenge.note}</p>}
                <div className="mt-8 grid w-full grid-cols-2 gap-3">
                  {challenge.options.map((option) => (
                    <button key={option} type="button" onClick={() => handleBasicAnswer(option)} className="min-h-16 rounded-2xl border border-ink-600 bg-ink-700 px-3 text-base font-semibold active:scale-95">
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {feedback && <p className="text-center text-sm font-semibold text-violet-300">{feedback}</p>}
        </div>
      )}

      {phase === 'result' && config && (
        duelContext ? (
          <DuelGameResult
            context={duelContext}
            title={t(game.titleKey)}
            emoji={game.emoji}
            averageMs={averageMs}
            completedRounds={outcomes.length}
            correct={correctRounds}
            errors={errors}
            timeouts={timeouts}
            config={config}
            onHome={goHome}
          />
        ) : (
          <Card className="text-center">
            <div className="text-5xl">{game.emoji}</div>
            <h2 className="mt-4 font-display text-2xl font-bold">{t('result.title')}</h2>
            <p className="mt-5 font-mono text-5xl font-bold text-gold-400">{formatMs(averageMs)} ms</p>
            <p className="mt-2 text-sm text-mist-500">{outcomes.length} {t('gameplay.roundsCompleted')}</p>
            <div className="mt-5 grid grid-cols-3 gap-2">
              <ResultStat value={String(correctRounds)} label={t('result.correct')} />
              <ResultStat value={String(errors)} label={t('result.errors')} />
              <ResultStat value={String(timeouts)} label={t('result.timeouts')} />
            </div>
            <Button className="mt-6 w-full" onClick={() => void shareGameResult(t(game.titleKey), `${formatMs(averageMs)} ms`)}>
              📤 {t('result.shareResult')}
            </Button>
            <Button className="mt-3 w-full" onClick={() => startGame(config)}>{t('result.playAgainCta')}</Button>
            <Button className="mt-3 w-full" variant="secondary" onClick={changeSettings}>{t('result.changeSettings')}</Button>
            <Button className="mt-3 w-full" variant="ghost" onClick={goHome}>{t('result.homeCta')}</Button>
          </Card>
        )
      )}
    </Screen>
  );
}

function LiveStat({
  icon,
  label,
  value,
  accent = false,
}: {
  icon: string;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-2xl border px-2.5 py-3 text-center ${
      accent
        ? 'border-gold-500/30 bg-gold-500/10'
        : 'border-ink-600/60 bg-ink-800/80'
    }`}>
      <div className="text-base leading-none" aria-hidden="true">{icon}</div>
      <p className={`mt-2 font-mono text-sm font-bold tabular-nums ${
        accent ? 'text-gold-300' : 'text-mist-100'
      }`}>
        {value}
      </p>
      <p className="mt-1 truncate text-[9px] font-medium uppercase tracking-wide text-mist-500">
        {label}
      </p>
    </div>
  );
}

function ResultStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-ink-600 bg-ink-800 px-2 py-3">
      <p className="font-mono text-lg font-bold">{value}</p>
      <p className="mt-1 text-[9px] uppercase text-mist-500">{label}</p>
    </div>
  );
}
