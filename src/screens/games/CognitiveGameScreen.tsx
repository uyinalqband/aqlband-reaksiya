import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/layout/Screen';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { GameSetupPanel } from '@/components/games/GameSetupPanel';
import { getGameDefinition, type SoloGameId } from '@/features/games/catalog';
import { difficultyIndex, shouldFinishSession, type GameSessionConfig } from '@/features/games/session/config';
import { useGameHistoryStore } from '@/store/gameHistoryStore';
import { haptics } from '@/lib/telegram';

type Phase='setup'|'playing'|'result';
type Challenge={prompt:string;options:string[];answer:string;note?:string;kind?:string};
const pick=<T,>(items:T[])=>items[Math.floor(Math.random()*items.length)];
const shuffle=<T,>(items:T[])=>[...items].sort(()=>Math.random()-.5);
const now=()=>performance.now();

function makeChallenge(gameId:SoloGameId,level:number,round:number):Challenge{
 if(gameId==='odd-one-out'){
  const pairs=[['●','○'],['■','□'],['▲','△'],['◆','◇'],['⬆️','⬇️'],['🙂','🙃']];
  const [common,odd]=pick(pairs); const count=9+level*4; const index=Math.floor(Math.random()*count);
  return {prompt:'',options:Array.from({length:count},(_,i)=>i===index?odd:common),answer:String(index),kind:'grid'};
 }
 if(gameId==='go-no-go'){
  const go=Math.random()>.32; return {prompt:go?'🟢':'🔴',options:['tap'],answer:go?'tap':'wait',note:go?'GO':'NO-GO',kind:'gonogo'};
 }
 if(gameId==='mental-math'){
  const max=[10,25,60,120][level]; const a=2+Math.floor(Math.random()*max); const b=2+Math.floor(Math.random()*max);
  const ops=level<2?['+','-']:['+','-','×']; const op=pick(ops);
  const value=op==='+'?a+b:op==='-'?a-b:a*b;
  const opts=shuffle([value,value+1+level,value-1-level,value+3+level]).map(String);
  return {prompt:`${a} ${op} ${b} = ?`,options:opts,answer:String(value)};
 }
 if(gameId==='sequence-memory'){
  const symbols=['⬆️','➡️','⬇️','⬅️']; const length=3+level+Math.floor(round/3);
  const seq=Array.from({length},()=>pick(symbols)); const next=pick(symbols);
  return {prompt:`${seq.join('  ')}  ?`,options:symbols,answer:next,note:`${seq.join('')} → ${next}`};
 }
 if(gameId==='time-estimation'){
  const target=[2,3,4,5][level]; return {prompt:String(target),options:['start'],answer:String(target),kind:'time'};
 }
 if(gameId==='peripheral-vision'){
  const arrows=['↖','↑','↗','←','→','↙','↓','↘']; const ans=pick(arrows);
  return {prompt:'•',options:arrows,answer:ans,note:ans,kind:'peripheral'};
 }
 if(gameId==='twenty-four'){
  const sets=[
   {n:'6  6  6  6',a:'6+6+6+6',o:['6+6+6+6','6×6-6-6','(6+6)×2','6×6÷6+6']},
   {n:'3  3  8  8',a:'8÷(3-8÷3)',o:['8÷(3-8÷3)','8+8+3+3','8×3+8÷3','(8-3)×(8-3)']},
   {n:'1  5  5  5',a:'5×(5-1÷5)',o:['5×(5-1÷5)','5+5+5+1','(5-1)×5+5','5×5-5+1']},
   {n:'4  4  7  7',a:'(7-4)×(7+1)',o:['(7-4)×(7+1)','7+7+4+4','7×4-7+4','(7-4)×7+4']},
  ]; const s=pick(sets); return {prompt:s.n,options:shuffle(s.o),answer:s.a,note:'= 24'};
 }
 if(gameId==='dual-n-back'){
  const cells=['1','2','3','4','5','6','7','8','9']; const letters=['A','B','C','D'];
  const pos=pick(cells),letter=pick(letters),match=Math.random()>.5;
  return {prompt:`${pos}|${letter}`,options:['position','sound','both','none'],answer:match?pick(['position','sound','both']):'none',kind:'nback'};
 }
 if(gameId==='ascending-numbers'){
  const count=6+level*3; return {prompt:'1',options:shuffle(Array.from({length:count},(_,i)=>String(i+1))),answer:String(count),kind:'ascending'};
 }
 return {prompt:'?',options:['1','2','3','4'],answer:'1'};
}

export function CognitiveGameScreen(){
 const {gameId=''}=useParams(); const navigate=useNavigate(); const {t}=useTranslation();
 const game=getGameDefinition(gameId); const id=game?.id;
 const addAttempt=useGameHistoryStore(s=>s.addAttempt);
 const [phase,setPhase]=useState<Phase>('setup'); const [config,setConfig]=useState<GameSessionConfig|null>(null);
 const [round,setRound]=useState(1); const [times,setTimes]=useState<number[]>([]); const [challenge,setChallenge]=useState<Challenge|null>(null);
 const [started,setStarted]=useState(0); const [feedback,setFeedback]=useState(''); const [ascendingNext,setAscendingNext]=useState(1);
 const [timeRunning,setTimeRunning]=useState(false); const [timeStart,setTimeStart]=useState(0); const [pattern,setPattern]=useState<number[]>([]);
 const [selected,setSelected]=useState<number[]>([]); const [showPattern,setShowPattern]=useState(false); const [cards,setCards]=useState<string[]>([]);
 const [flipped,setFlipped]=useState<number[]>([]); const [matched,setMatched]=useState<number[]>([]); const [tiles,setTiles]=useState<number[]>([]);
 const timeout=useRef<number|null>(null);

 const level=config?difficultyIndex(config.difficulty,round):1;
 const avg=times.length?Math.round(times.reduce((a,b)=>a+b,0)/times.length):0;

 const beginRound=()=>{
  if(!id||!config)return; setFeedback(''); setAscendingNext(1); setSelected([]); setFlipped([]); setMatched([]);
  if(id==='pattern-memory'){
   const size=9+level*7; const count=Math.min(size,3+level+Math.floor(round/2));
   const pat=shuffle(Array.from({length:size},(_,i)=>i)).slice(0,count); setPattern(pat); setShowPattern(true); setStarted(now());
   timeout.current=window.setTimeout(()=>{setShowPattern(false);setStarted(now())},1000+Math.max(0,1200-level*250)); return;
  }
  if(id==='card-memory'){
   const pairCount=3+level; const icons=['🍎','🚀','⭐','🎯','🐼','🌙','⚡','🎵'].slice(0,pairCount);
   setCards(shuffle([...icons,...icons])); setStarted(now()); return;
  }
  if(id==='fifteen-puzzle'){
   let a=[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,0]; let empty=15;
   const moves=config.puzzleShuffle??40;
   for(let i=0;i<moves;i++){const r=Math.floor(empty/4),c=empty%4;const opts:number[]=[];if(r)opts.push(empty-4);if(r<3)opts.push(empty+4);if(c)opts.push(empty-1);if(c<3)opts.push(empty+1);const j=pick(opts);[a[empty],a[j]]=[a[j],a[empty]];empty=j}
   setTiles(a); setStarted(now()); return;
  }
  const nextChallenge=makeChallenge(id,level,round); setChallenge(nextChallenge); setStarted(now());
  if(id==='go-no-go') timeout.current=window.setTimeout(()=>{ void finishRound(800+level*120, nextChallenge.answer!=='wait'); },800+level*120);
 };
 const start=(c:GameSessionConfig)=>{setChallenge(null);setConfig(c);setRound(1);setTimes([]);setPhase('playing')};
 useEffect(()=>{if(phase==='playing'&&config){beginRound()}},[phase,config,round]);
 useEffect(()=>()=>{if(timeout.current)window.clearTimeout(timeout.current)},[]);

 const finishRound=async(ms:number,failed=false)=>{
  if(!config||!id)return; haptics.impact(failed?'heavy':'light'); const next=[...times,Math.max(1,Math.round(ms))];setTimes(next);
  const done=shouldFinishSession(config,round,failed);
  if(done){const value=Math.round(next.reduce((a,b)=>a+b,0)/next.length);await addAttempt({gameId:id,value,metric:'duration_ms',meta:{rounds:next.length,difficulty:config.difficulty,failed}});setPhase('result');}
  else {window.setTimeout(()=>setRound(r=>r+1),450)}
 };
 const answer=(value:string)=>{
  if(!challenge||!id)return;
  if(id==='ascending-numbers'){
   const n=Number(value); if(n!==ascendingNext){void finishRound(now()-started+900,true);return}
   if(n===Number(challenge.answer)){void finishRound(now()-started);return} setAscendingNext(n+1);return;
  }
  if(id==='time-estimation'){
   if(!timeRunning){setTimeRunning(true);setTimeStart(now());return}
   const elapsed=now()-timeStart,target=Number(challenge.answer)*1000;setTimeRunning(false);void finishRound(Math.abs(elapsed-target));return;
  }
  if(id==='go-no-go'){
   if(timeout.current)window.clearTimeout(timeout.current); const ok=value===challenge.answer;void finishRound(now()-started+(ok?0:800),!ok);return;
  }
  const ok=value===challenge.answer;void finishRound(now()-started+(ok?0:800),!ok&&config?.rounds==='survival');
 };
 const tapPattern=(i:number)=>{
  if(showPattern||!config)return; const next=selected.includes(i)?selected.filter(x=>x!==i):[...selected,i];setSelected(next);
  if(next.length===pattern.length){const ok=pattern.every(x=>next.includes(x));void finishRound(now()-started+(ok?0:1000),!ok&&config.rounds==='survival')}
 };
 const tapCard=(i:number)=>{
  if(flipped.includes(i)||matched.includes(i)||flipped.length===2)return;const next=[...flipped,i];setFlipped(next);
  if(next.length===2){window.setTimeout(()=>{if(cards[next[0]]===cards[next[1]]){const m=[...matched,...next];setMatched(m);if(m.length===cards.length)void finishRound(now()-started)}setFlipped([])},450)}
 };
 const tapTile=(i:number)=>{
  const e=tiles.indexOf(0),r=Math.floor(i/4),c=i%4,er=Math.floor(e/4),ec=e%4;if(Math.abs(r-er)+Math.abs(c-ec)!==1)return;
  const n=[...tiles];[n[i],n[e]]=[n[e],n[i]];setTiles(n);if(n.every((v,idx)=>v===(idx===15?0:idx+1)))void finishRound(now()-started);
 };

 if(!game||!id)return <Screen><TopBar title="Game"/><p>{t('common.notFound')}</p></Screen>;
 return <Screen>
  <TopBar title={t(game.titleKey)} onBack={()=>navigate('/')} />
  {phase==='setup'&&<GameSetupPanel gameId={id} onStart={start}/>}
  {phase==='playing'&&<div className="space-y-5">
   <div className="flex items-center justify-between text-sm text-mist-500"><span>{t('gameplay.round')} {round}</span><span>{t(`difficulty.${config?.difficulty}.title`)}</span></div>
   <Card className="min-h-[330px]">
    {id==='pattern-memory'&&<div><p className="mb-4 text-center text-sm text-mist-500">{showPattern?t('gameplay.remember'):t('gameplay.repeat')}</p><div className={`grid gap-2 ${level>1?'grid-cols-4':'grid-cols-3'}`}>{Array.from({length:9+level*7},(_,i)=><button key={i} onClick={()=>tapPattern(i)} className={`aspect-square rounded-lg border ${showPattern&&pattern.includes(i)||selected.includes(i)?'border-violet-300 bg-violet-500':'border-ink-600 bg-ink-700'}`}/>)}</div></div>}
    {id==='card-memory'&&<div className="grid grid-cols-4 gap-2">{cards.map((c,i)=><button key={i} onClick={()=>tapCard(i)} className="aspect-square rounded-xl border border-ink-600 bg-ink-700 text-2xl">{flipped.includes(i)||matched.includes(i)?c:'?'}</button>)}</div>}
    {id==='fifteen-puzzle'&&<div className="grid grid-cols-4 gap-1 rounded-xl bg-gold-700 p-2">{tiles.map((n,i)=><button key={i} onClick={()=>tapTile(i)} className={`aspect-square rounded border font-mono text-xl font-bold ${n===0?'border-transparent bg-transparent':'border-mist-700 bg-mist-300 text-ink-900'}`}>{n||''}</button>)}</div>}
    {!['pattern-memory','card-memory','fifteen-puzzle'].includes(id)&&challenge&&<div className="flex min-h-[290px] flex-col items-center justify-center">
      {id==='peripheral-vision'?<><div className="text-5xl">•</div><div className="mt-8 grid grid-cols-4 gap-3">{challenge.options.map(o=><button key={o} onClick={()=>answer(o)} className="h-12 w-12 rounded-full border border-ink-600 bg-ink-700 text-xl">{o}</button>)}</div></>:
      id==='odd-one-out'?<div className="grid grid-cols-4 gap-2">{challenge.options.map((o,i)=><button key={i} onClick={()=>answer(String(i))} className="aspect-square rounded-lg border border-ink-600 bg-ink-700 text-2xl">{o}</button>)}</div>:
      id==='ascending-numbers'?<div className="grid grid-cols-4 gap-2">{challenge.options.map(o=><button key={o} onClick={()=>answer(o)} className={`aspect-square rounded-lg border font-mono text-lg font-bold ${Number(o)<ascendingNext?'opacity-20':'border-ink-600 bg-ink-700'}`}>{o}</button>)}</div>:
      id==='go-no-go'?<button onClick={()=>answer('tap')} className="flex h-52 w-52 items-center justify-center rounded-full border-4 border-ink-600 bg-ink-700 text-7xl">{challenge.prompt}</button>:
      id==='time-estimation'?<div className="text-center"><p className="text-6xl font-bold">{challenge.prompt}s</p><Button className="mt-8" onClick={()=>answer('start')}>{timeRunning?t('gameplay.stop'):t('gameplay.start')}</Button></div>:
      id==='dual-n-back'?<NBack prompt={challenge.prompt} options={challenge.options} onAnswer={answer}/>:
      <><p className="text-center font-display text-3xl font-bold">{challenge.prompt}</p>{challenge.note&&<p className="mt-2 text-sm text-mist-500">{challenge.note}</p>}<div className="mt-8 grid w-full grid-cols-2 gap-3">{challenge.options.map(o=><button key={o} onClick={()=>answer(o)} className="min-h-14 rounded-xl border border-ink-600 bg-ink-700 px-3 text-sm font-semibold">{o}</button>)}</div></>}
    </div>}
   </Card>
   {feedback&&<p className="text-center text-sm">{feedback}</p>}
  </div>}
  {phase==='result'&&<Card className="text-center"><div className="text-5xl">{game.emoji}</div><h2 className="mt-4 font-display text-2xl font-bold">{t('result.title')}</h2><p className="mt-5 font-mono text-5xl font-bold text-gold-400">{avg} ms</p><p className="mt-2 text-sm text-mist-500">{times.length} {t('gameplay.roundsCompleted')}</p><Button className="mt-6 w-full" onClick={()=>{setPhase('setup');setConfig(null)}}>{t('result.playAgainCta')}</Button><Button className="mt-3 w-full" variant="secondary" onClick={()=>navigate('/')}>{t('result.homeCta')}</Button></Card>}
 </Screen>
}

function NBack({prompt,options,onAnswer}:{prompt:string;options:string[];onAnswer:(v:string)=>void}){
 const [pos,letter]=prompt.split('|');
 return <div className="w-full text-center"><p className="text-sm text-mist-500">Position + Sound</p><div className="mx-auto mt-4 grid w-52 grid-cols-3 gap-2">{Array.from({length:9},(_,i)=><div key={i} className={`aspect-square rounded-lg border ${String(i+1)===pos?'border-violet-300 bg-violet-500':'border-ink-600 bg-ink-700'}`}/>)}</div><p className="mt-5 text-4xl font-bold">{letter}</p><div className="mt-6 grid grid-cols-2 gap-2">{options.map(o=><button key={o} onClick={()=>onAnswer(o)} className="h-12 rounded-xl border border-ink-600 bg-ink-700 text-sm capitalize">{o}</button>)}</div></div>
}
