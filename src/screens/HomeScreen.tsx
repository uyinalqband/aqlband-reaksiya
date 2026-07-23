import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Screen } from '@/components/layout/Screen';
import { HistoryModal } from '@/components/games/HistoryModal';
import { GAMES } from '@/features/games/catalog';
import { computeUnifiedMsStats, getBestDurationValue, useGameHistoryStore } from '@/store/gameHistoryStore';
import { formatMs } from '@/features/games/session/metrics';
import { useTelegramUser } from '@/hooks/useTelegramUser';

export function HomeScreen(){
 const {t}=useTranslation();const navigate=useNavigate();const user=useTelegramUser();const attempts=useGameHistoryStore(s=>s.attempts);
 const stats=useMemo(()=>computeUnifiedMsStats(attempts),[attempts]);const [history,setHistory]=useState(false);
 return <Screen>
  <div><h1 className="font-display text-2xl font-bold">{user?.firstName??'AqlBand'}</h1><p className="mt-1 text-sm text-mist-500">{t('home.question')}</p></div>
  <div className="mt-6 grid grid-cols-2 gap-3">
   {GAMES.map(game=>{const best=getBestDurationValue(attempts,game.id);return <motion.button key={game.id} whileTap={{scale:.96}} onClick={()=>navigate(game.route)} className="flex min-h-[145px] flex-col items-start rounded-2xl border border-ink-600/60 bg-ink-800/80 p-4 text-left">
    <div className="flex w-full items-start justify-between"><span className="text-3xl">{game.emoji}</span><span className="text-mist-700">›</span></div>
    <p className="mt-3 font-display text-sm font-semibold">{t(game.titleKey)}</p><p className="mt-1 line-clamp-2 text-xs text-mist-500">{t(game.descriptionKey)}</p>
    <p className="mt-auto pt-3 font-mono text-xs font-semibold text-gold-400">{best!==null?`${formatMs(best)} ms`:'—'}</p>
   </motion.button>})}
  </div>
  <div className="mt-6 grid grid-cols-4 gap-2">
   <Mini label={t('home.statBest')} value={stats.best!==null?formatMs(stats.best):'—'} onClick={()=>setHistory(true)} accent/>
   <Mini label={t('home.statAverage')} value={stats.average!==null?formatMs(stats.average):'—'} onClick={()=>setHistory(true)}/>
   <Mini label={t('home.statAttempts')} value={String(stats.totalAttempts)} onClick={()=>setHistory(true)}/>
   <Mini label={t('nav.leaderboard')} value="🏆" onClick={()=>navigate('/leaderboard')} accent/>
  </div>
  {history&&<HistoryModal onClose={()=>setHistory(false)}/>}
 </Screen>
}
function Mini({label,value,onClick,accent}:{label:string;value:string;onClick:()=>void;accent?:boolean}){return <button onClick={onClick} className="flex h-[4.8rem] flex-col items-center justify-center rounded-xl border border-ink-600/60 bg-ink-800/80 px-1"><span className={`font-mono text-base font-bold ${accent?'text-gold-400':''}`}>{value}</span><span className="mt-1 text-[9px] uppercase text-mist-500">{label}</span></button>}
