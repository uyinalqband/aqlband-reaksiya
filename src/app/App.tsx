import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { HomeScreen } from '@/screens/HomeScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { LeaderboardScreen } from '@/screens/LeaderboardScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { NotificationsScreen } from '@/screens/NotificationsScreen';
import { DuelScreen } from '@/screens/DuelScreen';
import { ReactionScreen } from '@/screens/games/ReactionScreen';
import { EmojiFindScreen } from '@/screens/games/EmojiFindScreen';
import { NumberMemoryScreen } from '@/screens/games/NumberMemoryScreen';
import { StroopTestScreen } from '@/screens/games/StroopTestScreen';
import { CognitiveGameScreen } from '@/screens/games/CognitiveGameScreen';
import { BottomNav } from '@/components/layout/BottomNav';
import { FloatingNotification } from '@/components/layout/FloatingNotification';
import { NotificationSync } from '@/components/layout/NotificationSync';
import { initTelegramApp, getTelegramLanguageCode } from '@/lib/telegram';
import { normalizeLanguage } from '@/i18n';
import { useGameHistoryStore } from '@/store/gameHistoryStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useOnlineStore } from '@/store/onlineStore';
import { useAvatarStore } from '@/store/avatarStore';
import { useNotificationStore } from '@/store/notificationStore';
import { useTelegramUser } from '@/hooks/useTelegramUser';
import { useEnsureUser } from '@/hooks/useEnsureUser';

const TAB_ROOTS=new Set(['/','/notifications','/profile','/settings']);
function AnimatedRoutes(){
 const location=useLocation();const tab=TAB_ROOTS.has(location.pathname);
 return <><div style={{paddingBottom:tab?'calc(4.5rem + env(safe-area-inset-bottom,0px))':0}}><AnimatePresence mode="wait" initial={false}><Routes location={location} key={location.pathname}>
  <Route path="/" element={<HomeScreen/>}/>
  <Route path="/games/reaction" element={<ReactionScreen/>}/>
  <Route path="/games/emoji-find" element={<EmojiFindScreen/>}/>
  <Route path="/games/number-memory" element={<NumberMemoryScreen/>}/>
  <Route path="/games/stroop-test" element={<StroopTestScreen/>}/>
  <Route path="/games/emoji" element={<Navigate to="/games/emoji-find" replace/>}/>
  <Route path="/games/stroop" element={<Navigate to="/games/stroop-test" replace/>}/>
  <Route path="/games/:gameId" element={<CognitiveGameScreen/>}/>
  <Route path="/leaderboard" element={<LeaderboardScreen/>}/>
  <Route path="/notifications" element={<NotificationsScreen/>}/>
  <Route path="/profile" element={<ProfileScreen/>}/>
  <Route path="/settings" element={<SettingsScreen/>}/>
  <Route path="/duel" element={<DuelScreen/>}/>
  <Route path="/play" element={<Navigate to="/games/reaction" replace/>}/>
  <Route path="*" element={<Navigate to="/" replace/>}/>
 </Routes></AnimatePresence></div>{tab&&<BottomNav/>}<NotificationSync/><FloatingNotification/></>
}
function Boot(){return <div className="flex min-h-screen items-center justify-center bg-ink-900"><div className="h-12 w-12 animate-pulse rounded-full bg-violet-500 shadow-glow"/></div>}
export default function App(){
 const [ready,setReady]=useState(false);const user=useTelegramUser();useEnsureUser(ready?user:null);
 const hydrateHistory=useGameHistoryStore(s=>s.hydrate);const hydrateSettings=useSettingsStore(s=>s.hydrate);const hydrateRank=useOnlineStore(s=>s.hydrateLastKnownRank);
 const hydrateAvatar=useAvatarStore(s=>s.hydrate);const hydrateNotifications=useNotificationStore(s=>s.hydrate);
 useEffect(()=>{initTelegramApp();const language=normalizeLanguage(getTelegramLanguageCode());const failsafe=setTimeout(()=>setReady(true),4000);void Promise.all([hydrateHistory(),hydrateSettings(language),hydrateRank(),hydrateAvatar(),hydrateNotifications()]).finally(()=>{clearTimeout(failsafe);setReady(true)});return()=>clearTimeout(failsafe)},[hydrateHistory,hydrateSettings,hydrateRank,hydrateAvatar,hydrateNotifications]);
 if(!ready)return <Boot/>;return <BrowserRouter><div className="min-h-screen bg-ink-900 text-mist-100"><AnimatedRoutes/></div></BrowserRouter>
}
