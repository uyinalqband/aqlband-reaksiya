import { create } from '@/lib/zustand';
import { storage } from '@/lib/telegram';

export const AVATARS = ['🧠','⚡','🚀','🦊','🐼','🦁','🐯','🦉','🤖','👾','🎯','🏆'] as const;
const KEY='aqlband_avatar_v1';

interface AvatarState{avatar:string;hydrated:boolean;hydrate:()=>Promise<void>;setAvatar:(avatar:string)=>Promise<void>;}
export const useAvatarStore=create<AvatarState>((set)=>({
 avatar:'🧠',hydrated:false,
 hydrate:async()=>{try{const v=await storage.get(KEY);set({avatar:v && AVATARS.includes(v as typeof AVATARS[number]) ? v : '🧠',hydrated:true})}catch{set({hydrated:true})}},
 setAvatar:async avatar=>{if(!AVATARS.includes(avatar as typeof AVATARS[number]))return;set({avatar});await storage.set(KEY,avatar)}
}));
