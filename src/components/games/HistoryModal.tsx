import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { useGameHistoryStore } from '@/store/gameHistoryStore';
import { formatAttemptResult, getGamePresentation } from '@/features/history/gameCatalog';

export function HistoryModal({onClose}:{onClose:()=>void}){
 const {t}=useTranslation();
 const attempts=useGameHistoryStore(s=>s.attempts).slice(0,30);
 return <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/65 p-3 backdrop-blur-sm" onClick={onClose}>
  <Card className="max-h-[82vh] w-full max-w-md overflow-hidden" onClick={e=>e.stopPropagation()}>
   <div className="flex items-center justify-between"><div><h2 className="font-display text-xl font-bold">{t('history.title')}</h2><p className="text-xs text-mist-500">{t('history.limit')}</p></div><button onClick={onClose} className="h-9 w-9 rounded-full bg-ink-700">✕</button></div>
   <div className="mt-4 max-h-[65vh] space-y-2 overflow-y-auto pr-1">
    {attempts.length===0?<p className="py-8 text-center text-sm text-mist-500">{t('history.empty')}</p>:attempts.map(a=>{const g=getGamePresentation(a.gameId); return <div key={a.id} className="rounded-xl border border-ink-600 bg-ink-900/60 p-3">
      <div className="flex items-center gap-3"><span className="text-2xl">{g.emoji}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{g.title.startsWith('games.')?t(g.title):g.title}</p><p className="text-[11px] text-mist-500">{new Date(a.playedAt).toLocaleString()}</p></div><span className="font-mono text-sm font-bold text-gold-400">{formatAttemptResult(a)}</span></div>
      {a.meta&&<div className="mt-2 flex flex-wrap gap-1">{Object.entries(a.meta).slice(0,6).map(([k,v])=><span key={k} className="rounded bg-ink-700 px-2 py-1 text-[10px] text-mist-400">{k}: {String(v)}</span>)}</div>}
    </div>})}
   </div>
  </Card>
 </div>
}
