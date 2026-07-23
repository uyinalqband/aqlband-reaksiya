import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HomeIcon, ProfileIcon, SettingsIcon } from '@/components/ui/icons';
import { useNotificationStore } from '@/store/notificationStore';
import { haptics } from '@/lib/telegram';

function Bell({active}:{active:boolean}){return <span className={`text-xl ${active?'text-violet-400':'text-mist-500'}`}>🔔</span>}
export function BottomNav(){
 const {t}=useTranslation();const navigate=useNavigate();const location=useLocation();const unread=useNotificationStore(s=>s.items.filter(i=>!i.read).length);
 const tabs:{path:string;label:string;icon:(a:boolean)=>ReactNode}[]=[
  {path:'/',label:t('nav.home'),icon:a=><HomeIcon width={22} height={22} className={a?'text-violet-400':'text-mist-500'}/>},
  {path:'/notifications',label:t('nav.notifications'),icon:a=><span className="relative"><Bell active={a}/>{unread>0&&<span className="absolute -right-2 -top-1 rounded-full bg-red-500 px-1 text-[8px] text-white">{unread}</span>}</span>},
  {path:'/profile',label:t('nav.profile'),icon:a=><ProfileIcon width={22} height={22} className={a?'text-violet-400':'text-mist-500'}/>},
  {path:'/settings',label:t('nav.settings'),icon:a=><SettingsIcon width={22} height={22} className={a?'text-violet-400':'text-mist-500'}/>},
 ];
 return <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-600/60 bg-ink-800/95 backdrop-blur"><div className="mx-auto flex max-w-md">{tabs.map(tab=>{const active=location.pathname===tab.path;return <button key={tab.path} onClick={()=>{haptics.selection();navigate(tab.path)}} className="flex flex-1 flex-col items-center gap-1 py-2.5">{tab.icon(active)}<span className={`text-[10px] ${active?'text-violet-400':'text-mist-500'}`}>{tab.label}</span></button>})}</div></nav>
}
