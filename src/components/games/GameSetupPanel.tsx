import { useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { getGameDefinition, type SoloGameId } from '@/features/games/catalog';
import { DEFAULT_GAME_SESSION, DIFFICULTIES, type Difficulty, type GameSessionConfig, type RoundSelection } from '@/features/games/session/config';

interface Props { gameId: SoloGameId; onStart:(config:GameSessionConfig)=>void; onFriendPlay?:(config:GameSessionConfig)=>void; }
const ROUNDS=[1,2,3,4,5,6,7,8,9,10] as const;

export function GameSetupPanel({gameId,onStart,onFriendPlay}:Props){
  const {t}=useTranslation();
  const game=getGameDefinition(gameId)!;
  const [rounds,setRounds]=useState<RoundSelection>(DEFAULT_GAME_SESSION.rounds);
  const [difficulty,setDifficulty]=useState<Difficulty>(DEFAULT_GAME_SESSION.difficulty);
  const [memorySize,setMemorySize]=useState(4);
  const [nBack,setNBack]=useState(2);
  const [puzzleShuffle,setPuzzleShuffle]=useState(40);
  const config={rounds,difficulty,memorySize,nBack,puzzleShuffle};

  return <div className="space-y-5">
    <div className="text-center">
      <div className="text-5xl">{game.emoji}</div>
      <h1 className="mt-3 font-display text-2xl font-bold">{t(game.titleKey)}</h1>
      <p className="mt-2 text-sm text-mist-500">{t(game.descriptionKey)}</p>
    </div>
    <Card>
      <h3 className="text-sm font-semibold">{t('setup.rounds')}</h3>
      <div className="mt-3 grid grid-cols-5 gap-2">
        {ROUNDS.map(n=><button key={n} onClick={()=>setRounds(n)} className={`h-10 rounded-xl border font-mono font-bold ${rounds===n?'border-violet-400 bg-violet-600':'border-ink-600 bg-ink-800'}`}>{n}</button>)}
      </div>
      <button onClick={()=>setRounds('survival')} className={`mt-2 h-11 w-full rounded-xl border text-sm font-semibold ${rounds==='survival'?'border-gold-400 bg-gold-500/15 text-gold-300':'border-ink-600 bg-ink-800 text-mist-400'}`}>♾️ {t('setup.survival')}</button>
    </Card>
    <Card>
      <h3 className="text-sm font-semibold">{t('setup.difficulty')}</h3>
      <div className="mt-3 space-y-2">
        {DIFFICULTIES.map(d=><button key={d} onClick={()=>setDifficulty(d)} className={`w-full rounded-xl border px-4 py-3 text-left ${difficulty===d?'border-violet-400 bg-violet-600/20':'border-ink-600 bg-ink-800'}`}>
          <p className="text-sm font-semibold">{t(`difficulty.${d}.title`)}</p>
          <p className="mt-1 text-xs text-mist-500">{t(`difficulty.${d}.description`)}</p>
        </button>)}
      </div>
    </Card>
    {game.customSetup==='memory'&&<Card><h3 className="text-sm font-semibold">{t('setup.memorySize')}</h3><input type="range" min="3" max="8" value={memorySize} onChange={(e: ChangeEvent<HTMLInputElement>)=>setMemorySize(Number(e.target.value))} className="mt-4 w-full"/><p className="mt-2 text-center font-mono text-gold-400">{memorySize}</p></Card>}
    {game.customSetup==='nback'&&<Card><h3 className="text-sm font-semibold">N-Back</h3><div className="mt-3 grid grid-cols-3 gap-2">{[1,2,3].map(n=><button key={n} onClick={()=>setNBack(n)} className={`h-11 rounded-xl border ${nBack===n?'border-violet-400 bg-violet-600':'border-ink-600'}`}>{n}-Back</button>)}</div></Card>}
    {game.customSetup==='puzzle'&&<Card><h3 className="text-sm font-semibold">{t('setup.shuffle')}</h3><input type="range" min="10" max="100" step="10" value={puzzleShuffle} onChange={(e: ChangeEvent<HTMLInputElement>)=>setPuzzleShuffle(Number(e.target.value))} className="mt-4 w-full"/><p className="mt-2 text-center font-mono text-gold-400">{puzzleShuffle}</p></Card>}
    <Card><h3 className="text-sm font-semibold">{t('setup.howTo')}</h3><p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-mist-400">{t(game.instructionsKey)}</p></Card>
    <Button className="w-full" onClick={()=>onStart(config)}>{t('setup.start')}</Button>
    {onFriendPlay&&<Button className="w-full" variant="secondary" onClick={()=>onFriendPlay(config)}>👥 {t('setup.friend')}</Button>}
  </div>
}
