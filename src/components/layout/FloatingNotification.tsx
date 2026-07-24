import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useNotificationStore } from '@/store/notificationStore';

export function FloatingNotification(){
 const navigate=useNavigate();const item=useNotificationStore(s=>s.items[0]);const [visible,setVisible]=useState(false);
 useEffect(()=>{if(!item)return;setVisible(true);const n=window.setTimeout(()=>setVisible(false),20000);return()=>clearTimeout(n)},[item?.id]);
 return <AnimatePresence>{visible&&item&&<motion.button initial={{opacity:0,y:-20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-20}} onClick={()=>navigate('/notifications')} className="fixed left-4 right-4 top-4 z-[70] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-violet-400/40 bg-ink-800/95 p-4 text-left shadow-glow backdrop-blur">
  <span className="text-2xl">{item.kind==='game'?'🎮':'👥'}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{item.title}</span><span className="block truncate text-xs text-mist-500">{item.message}</span></span><span className="text-violet-300">›</span>
 </motion.button>}</AnimatePresence>
}
