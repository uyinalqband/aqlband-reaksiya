import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/layout/Screen';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ProgressionCard } from '@/components/profile/ProgressionCard';
import { AddFriendBar } from '@/components/friends/AddFriendBar';
import { FriendRequestsList } from '@/components/friends/FriendRequestsList';
import { useTelegramUser } from '@/hooks/useTelegramUser';
import { useOnlineStore } from '@/store/onlineStore';
import { AVATARS, useAvatarStore } from '@/store/avatarStore';
import { getFriendList } from '@/services/friendService';
import { deleteCurrentAccount } from '@/services/accountService';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import type { FriendListEntry } from '@/types/friendship';

export function ProfileScreen(){
 const {t}=useTranslation();const user=useTelegramUser();const appUserId=useOnlineStore(s=>s.appUserId);const avatar=useAvatarStore(s=>s.avatar);const setAvatar=useAvatarStore(s=>s.setAvatar);
 const [picker,setPicker]=useState(false);const [friends,setFriends]=useState<FriendListEntry[]>([]);const [loading,setLoading]=useState(false);const [deleting,setDeleting]=useState(false);
 const load=useCallback(async()=>{if(!appUserId||!isSupabaseConfigured)return;setLoading(true);try{setFriends(await getFriendList(appUserId))}finally{setLoading(false)}},[appUserId]);
 useEffect(()=>{void load()},[load]);
 const removeProfile=async()=>{if(!window.confirm(t('profile.deleteConfirm')))return;setDeleting(true);try{await deleteCurrentAccount();await useOnlineStore.getState().clearAccount(true);location.reload()}catch(e){alert(e instanceof Error?e.message:t('errors.generic'))}finally{setDeleting(false)}};
 return <Screen>
  <h1 className="font-display text-xl font-bold">{t('profile.title')}</h1>
  <Card className="mt-4">
   <div className="flex items-center gap-4"><button onClick={()=>setPicker(!picker)} className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-violet-500/50 bg-ink-700 text-3xl">{avatar}</button><div className="min-w-0 flex-1"><p className="truncate font-display text-lg font-semibold">{user?.firstName??'AqlBand'}</p>{user?.username&&<p className="text-sm text-mist-500">@{user.username}</p>}<button onClick={()=>setPicker(!picker)} className="mt-1 text-xs text-violet-300">{t('profile.changeAvatar')}</button></div></div>
   {picker&&<div className="mt-4 grid grid-cols-6 gap-2">{AVATARS.map(a=><button key={a} onClick={()=>{void setAvatar(a);setPicker(false)}} className={`aspect-square rounded-xl border text-2xl ${avatar===a?'border-violet-300 bg-violet-600/20':'border-ink-600 bg-ink-800'}`}>{a}</button>)}</div>}
  </Card>
  <ProgressionCard/>
  <div className="mt-6"><h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-mist-300">{t('profile.friends')}</h2>
   {!isSupabaseConfigured||!appUserId?<Card><p className="text-center text-sm text-mist-500">{t('profile.offline')}</p></Card>:<><AddFriendBar myUserId={appUserId} onRequestSent={()=>void load()}/><div className="mt-4">{loading?<p className="text-center text-sm text-mist-500">{t('common.loading')}</p>:<FriendRequestsList entries={friends} onChanged={()=>void load()}/>}</div></>}
  </div>
  <Button className="mt-10 w-full border-red-500/30 bg-red-500/10 text-red-300 shadow-none" variant="secondary" disabled={deleting} onClick={()=>void removeProfile()}>{deleting?t('profile.deleting'):t('profile.delete')}</Button>
 </Screen>
}
