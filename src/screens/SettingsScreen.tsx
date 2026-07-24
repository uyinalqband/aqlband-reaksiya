import { useState, type ChangeEvent, type MouseEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { Screen } from '@/components/layout/Screen';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  CheckIcon,
  GlobeIcon,
  TrashIcon,
  VibrateIcon,
  VolumeIcon,
} from '@/components/ui/icons';
import { useSettingsStore } from '@/store/settingsStore';
import { useGameHistoryStore } from '@/store/gameHistoryStore';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/i18n';
import { APP_VERSION } from '@/lib/config';
import { checkersMusic } from '@/lib/checkersMusic';

const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  uz: 'O‘zbekcha',
  en: 'English',
  ru: 'Русский',
};

export function SettingsScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const language = useSettingsStore((state) => state.language);
  const soundEnabled = useSettingsStore((state) => state.soundEnabled);
  const musicEnabled = useSettingsStore((state) => state.musicEnabled);
  const musicVolume = useSettingsStore((state) => state.musicVolume);
  const hapticsEnabled = useSettingsStore((state) => state.hapticsEnabled);
  const setLanguage = useSettingsStore((state) => state.setLanguage);
  const toggleSound = useSettingsStore((state) => state.toggleSound);
  const toggleMusic = useSettingsStore((state) => state.toggleMusic);
  const setMusicVolume = useSettingsStore((state) => state.setMusicVolume);
  const toggleHaptics = useSettingsStore((state) => state.toggleHaptics);
  const resetStats = useGameHistoryStore((state) => state.reset);

  const [confirmingReset, setConfirmingReset] = useState(false);

  const handleMusicToggle = async () => {
    checkersMusic.unlock();
    await toggleMusic();
    const nextEnabled = !musicEnabled;
    checkersMusic.configure(nextEnabled, musicVolume);
  };

  return (
    <Screen>
      <TopBar title={t('settings.title')} onBack={() => navigate(-1)} />

      <section className="premium-border relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#172947] via-[#101B2A] to-[#08101A] p-5">
        <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-violet-500/20 blur-3xl" />
        <p className="relative text-xs font-bold uppercase tracking-[0.18em] text-violet-300">
          {t('settings.personalization')}
        </p>
        <h1 className="relative mt-1 font-display text-2xl font-extrabold text-mist-100">
          {t('settings.title')}
        </h1>
        <p className="relative mt-2 text-sm leading-6 text-mist-500">
          {t('settings.subtitle')}
        </p>
      </section>

      <div className="mt-5 space-y-5">
        <section>
          <SectionLabel
            icon={<GlobeIcon width={15} height={15} />}
            text={t('settings.language')}
          />
          <Card padded={false} className="divide-y divide-ink-600/50 overflow-hidden">
            {SUPPORTED_LANGUAGES.map((lng) => (
              <button
                key={lng}
                type="button"
                onClick={() => void setLanguage(lng)}
                className="flex w-full items-center justify-between px-4 py-4 text-left"
              >
                <span className="text-sm font-semibold text-mist-100">
                  {LANGUAGE_LABELS[lng]}
                </span>
                {language === lng ? (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                    <CheckIcon width={17} height={17} />
                  </span>
                ) : null}
              </button>
            ))}
          </Card>
        </section>

        <section>
          <SectionLabel icon={<span>🎧</span>} text={t('settings.audio')} />
          <Card padded={false} className="divide-y divide-ink-600/50 overflow-hidden">
            <ToggleRow
              icon={<VolumeIcon width={18} height={18} muted={!soundEnabled} />}
              label={t('settings.sound')}
              description={t('settings.soundDescription')}
              checked={soundEnabled}
              onToggle={() => void toggleSound()}
            />
            <ToggleRow
              icon={<span className="text-base">🎼</span>}
              label={t('settings.music')}
              description={t('settings.musicDescription')}
              checked={musicEnabled}
              onToggle={() => void handleMusicToggle()}
            />

            <div className="px-4 py-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-semibold text-mist-100">
                  {t('settings.musicVolume')}
                </span>
                <span className="font-mono text-sm font-bold text-gold-300">
                  {Math.round(musicVolume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(musicVolume * 100)}
                disabled={!musicEnabled}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  const volume = Number(event.target.value) / 100;
                  checkersMusic.unlock();
                  checkersMusic.configure(musicEnabled, volume);
                  void setMusicVolume(volume);
                }}
                className="mt-4 w-full accent-violet-500 disabled:opacity-40"
                aria-label={t('settings.musicVolume')}
              />
            </div>

            <ToggleRow
              icon={<VibrateIcon width={18} height={18} />}
              label={t('settings.haptics')}
              description={t('settings.hapticsDescription')}
              checked={hapticsEnabled}
              onToggle={() => void toggleHaptics()}
            />
          </Card>
        </section>

        <section>
          <SectionLabel icon={<span>🛡️</span>} text={t('settings.data')} />
          <Card>
            <button
              type="button"
              onClick={() => setConfirmingReset(true)}
              className="flex w-full items-center gap-3 text-left text-signal-early"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
                <TrashIcon width={18} height={18} />
              </span>
              <span>
                <span className="block text-sm font-semibold">
                  {t('settings.resetStats')}
                </span>
                <span className="mt-1 block text-xs text-mist-600">
                  {t('settings.resetStatsDescription')}
                </span>
              </span>
            </button>
          </Card>
        </section>

        <p className="pt-2 text-center text-xs text-mist-700">
          {t('settings.version', { version: APP_VERSION })}
        </p>
      </div>

      <AnimatePresence>
        {confirmingReset ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-5 pb-8 backdrop-blur-sm"
            onClick={() => setConfirmingReset(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              onClick={(event: MouseEvent<HTMLDivElement>) =>
                event.stopPropagation()
              }
              className="w-full max-w-sm rounded-3xl border border-ink-600 bg-ink-800 p-5 shadow-card"
            >
              <p className="text-center text-sm leading-6 text-mist-300">
                {t('settings.resetConfirm')}
              </p>
              <div className="mt-5 flex flex-col gap-2.5">
                <Button
                  className="!border-signal-early/40 !bg-signal-early !from-signal-early !to-signal-early"
                  onClick={() => {
                    void resetStats();
                    setConfirmingReset(false);
                  }}
                >
                  {t('settings.resetConfirmCta')}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setConfirmingReset(false)}
                >
                  {t('settings.cancel')}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </Screen>
  );
}

function SectionLabel({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="mb-3 flex items-center gap-2 text-mist-300">
      {icon}
      <h2 className="text-xs font-bold uppercase tracking-[0.16em]">
        {text}
      </h2>
    </div>
  );
}

function ToggleRow({
  icon,
  label,
  description,
  checked,
  onToggle,
}: {
  icon: ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink-900/60 text-mist-400">
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-mist-100">
            {label}
          </span>
          <span className="mt-1 block text-xs leading-5 text-mist-600">
            {description}
          </span>
        </span>
      </span>
      <span
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-violet-600' : 'bg-ink-600'
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-mist-100 shadow transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </span>
    </button>
  );
}
