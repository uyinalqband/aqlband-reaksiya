import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/layout/Screen';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { AddFriendBar } from '@/components/friends/AddFriendBar';
import { FriendRequestsList } from '@/components/friends/FriendRequestsList';
import { useTelegramUser } from '@/hooks/useTelegramUser';
import { useOnlineStore } from '@/store/onlineStore';
import { AVATARS, useAvatarStore } from '@/store/avatarStore';
import { getFriendList } from '@/services/friendService';
import { getCheckersProfile } from '@/services/checkersPlatformService';
import { getProgression } from '@/services/progressionService';
import { getCheckersLeague, ratingProgress } from '@/features/checkers/rating';
import { getLevelProgress } from '@/features/progression/levels';
import { deleteCurrentAccount } from '@/services/accountService';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import type { FriendListEntry } from '@/types/friendship';
import type { CheckersRatingProfile } from '@/types/checkersPlatform';
import type { ProgressionSnapshot } from '@/types/progression';

export function ProfileScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useTelegramUser();
  const appUserId = useOnlineStore((state) => state.appUserId);
  const avatar = useAvatarStore((state) => state.avatar);
  const setAvatar = useAvatarStore((state) => state.setAvatar);

  const [picker, setPicker] = useState(false);
  const [friends, setFriends] = useState<FriendListEntry[]>([]);
  const [ratingProfile, setRatingProfile] = useState<CheckersRatingProfile | null>(null);
  const [progression, setProgression] = useState<ProgressionSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!appUserId || !isSupabaseConfigured) return;
    setLoading(true);
    try {
      const [friendRows, ratingData, progressionData] = await Promise.all([
        getFriendList(appUserId),
        getCheckersProfile(),
        getProgression(),
      ]);
      setFriends(friendRows);
      setRatingProfile(ratingData);
      setProgression(progressionData);
    } finally {
      setLoading(false);
    }
  }, [appUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const rating = ratingProfile?.rating ?? 1200;
  const league = getCheckersLeague(rating);
  const leagueProgress = ratingProgress(rating);
  const level = getLevelProgress(progression?.totalXp ?? 0);
  const winRate = useMemo(() => {
    const games = ratingProfile?.games ?? 0;
    return games > 0 ? ((ratingProfile?.wins ?? 0) / games) * 100 : 0;
  }, [ratingProfile]);

  const removeProfile = async () => {
    if (!window.confirm(t('profile.deleteConfirm'))) return;
    setDeleting(true);
    try {
      await deleteCurrentAccount();
      await useOnlineStore.getState().clearAccount(true);
      location.reload();
    } catch (error) {
      alert(error instanceof Error ? error.message : t('errors.generic'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Screen className="pb-28">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-300">
            {t('profile.title')}
          </p>
          <h1 className="mt-1 font-display text-3xl font-extrabold">
            {user?.firstName ?? 'AqlBand'}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-mist-400/10 bg-ink-800/75 text-xl"
          aria-label={t('nav.settings')}
        >
          ⚙️
        </button>
      </div>

      <Card className="mt-5">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setPicker((value) => !value)}
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl border border-violet-300/30 bg-gradient-to-br from-violet-500/20 to-emerald-500/10 text-4xl shadow-glow"
          >
            {avatar}
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-xl font-extrabold">
              {user?.firstName ?? 'AqlBand'}
            </p>
            <p className="mt-1 truncate text-sm text-mist-500">
              {user?.username ? `@${user.username}` : t('v2.player')}
            </p>
            <button
              type="button"
              onClick={() => setPicker((value) => !value)}
              className="mt-2 text-xs font-bold text-violet-300"
            >
              {t('profile.changeAvatar')}
            </button>
          </div>
        </div>

        {picker ? (
          <div className="mt-4 grid grid-cols-6 gap-2">
            {AVATARS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  void setAvatar(item);
                  setPicker(false);
                }}
                className={`aspect-square rounded-xl border text-2xl ${
                  avatar === item
                    ? 'border-violet-300 bg-violet-500/20'
                    : 'border-mist-400/10 bg-ink-900/55'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        ) : null}
      </Card>

      <section className="premium-border mt-4 rounded-3xl bg-gradient-to-br from-[#182B48] to-[#0C1624] p-5 shadow-card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold-300">
              🏆 {t('v2.overallRating')}
            </p>
            <p className="mt-1 font-mono text-4xl font-black text-mist-100">
              {rating}
            </p>
            <p className="mt-1 text-sm font-extrabold text-gold-300">
              {league.emoji} {league.name}
            </p>
          </div>
          <div className="rounded-2xl border border-mist-400/10 bg-black/15 px-3 py-2 text-right">
            <p className="text-[9px] uppercase tracking-wider text-mist-600">
              {t('v2.bestRating')}
            </p>
            <p className="font-mono text-xl font-bold text-mist-200">
              {ratingProfile?.peakRating ?? rating}
            </p>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/30">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-400 to-gold-400"
            style={{ width: `${leagueProgress.percent}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-mist-500">
          {leagueProgress.next
            ? `${leagueProgress.remaining} ${t('v2.ratingToNext')} — ${leagueProgress.next.name}`
            : t('v2.topLeague')}
        </p>
      </section>

      <Card className="mt-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">
              {t('v2.activityProgress')}
            </p>
            <h2 className="mt-1 font-display text-2xl font-extrabold">
              LEVEL {level.level}
            </h2>
          </div>
          <p className="font-mono text-sm font-bold text-gold-300">
            {(progression?.totalXp ?? 0).toLocaleString()} XP
          </p>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-ink-950">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-violet-400 to-gold-400"
            style={{ width: `${level.percent}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-mist-600">
          <span>{level.xpIntoLevel.toLocaleString()} XP</span>
          <span>{level.xpNeeded.toLocaleString()} XP</span>
        </div>
        <p className="mt-3 text-xs leading-5 text-mist-500">
          {t('v2.levelExplanation')}
        </p>
      </Card>

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-extrabold">
            {t('v2.checkersStats')}
          </h2>
          <button
            type="button"
            onClick={() => navigate('/history')}
            className="text-xs font-bold text-violet-300"
          >
            {t('v2.checkersHistory')} →
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <ProfileStat label={t('v2.matches')} value={String(ratingProfile?.games ?? 0)} />
          <ProfileStat label={t('v2.winRate')} value={`${winRate.toFixed(1)}%`} accent />
          <ProfileStat label={t('v2.wins')} value={String(ratingProfile?.wins ?? 0)} />
          <ProfileStat label={t('v2.losses')} value={String(ratingProfile?.losses ?? 0)} />
        </div>
      </section>

      <section className="mt-7">
        <h2 className="mb-3 font-display text-lg font-extrabold">
          {t('profile.friends')}
        </h2>
        {!isSupabaseConfigured || !appUserId ? (
          <Card>
            <p className="text-center text-sm text-mist-500">{t('profile.offline')}</p>
          </Card>
        ) : (
          <>
            <AddFriendBar myUserId={appUserId} onRequestSent={() => void load()} />
            <div className="mt-4">
              {loading ? (
                <p className="text-center text-sm text-mist-500">{t('common.loading')}</p>
              ) : (
                <FriendRequestsList entries={friends} onChanged={() => void load()} />
              )}
            </div>
          </>
        )}
      </section>

      <Button
        className="mt-10 w-full border-red-500/25 bg-red-500/10 text-red-300 shadow-none"
        variant="secondary"
        disabled={deleting}
        onClick={() => void removeProfile()}
      >
        {deleting ? t('profile.deleting') : t('profile.delete')}
      </Button>
    </Screen>
  );
}

function ProfileStat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="glass-panel rounded-2xl p-4">
      <p className={`font-mono text-2xl font-black ${accent ? 'text-emerald-300' : 'text-mist-100'}`}>
        {value}
      </p>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-mist-600">{label}</p>
    </div>
  );
}
