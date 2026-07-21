import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { Screen } from '@/components/layout/Screen';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CheckIcon, GlobeIcon, TrashIcon, VibrateIcon, VolumeIcon } from '@/components/ui/icons';
import { useSettingsStore } from '@/store/settingsStore';
import { useStatsStore } from '@/store/statsStore';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/i18n';
import { APP_VERSION } from '@/lib/config';

const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  uz: 'O\u2018zbekcha',
  en: 'English',
  ru: '\u0420\u0443\u0441\u0441\u043a\u0438\u0439',
};

export function SettingsScreen() {
  const { t } = useTranslation();

  const language = useSettingsStore((s) => s.language);
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const hapticsEnabled = useSettingsStore((s) => s.hapticsEnabled);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const toggleSound = useSettingsStore((s) => s.toggleSound);
  const toggleHaptics = useSettingsStore((s) => s.toggleHaptics);
  const resetStats = useStatsStore((s) => s.reset);

  const [confirmingReset, setConfirmingReset] = useState(false);

  return (
    <Screen>
      <TopBar title={t('settings.title')} />

      <div className="space-y-6">
        <section>
          <SectionLabel icon={<GlobeIcon width={15} height={15} />} text={t('settings.language')} />
          <Card padded={false} className="divide-y divide-ink-600/50">
            {SUPPORTED_LANGUAGES.map((lng) => (
              <button
                key={lng}
                onClick={() => void setLanguage(lng)}
                className="flex w-full items-center justify-between px-4 py-3.5 text-left"
              >
                <span className="text-sm font-medium text-mist-100">{LANGUAGE_LABELS[lng]}</span>
                {language === lng && <CheckIcon width={18} height={18} className="text-gold-400" />}
              </button>
            ))}
          </Card>
        </section>

        <section>
          <Card padded={false} className="divide-y divide-ink-600/50">
            <ToggleRow
              icon={<VolumeIcon width={18} height={18} muted={!soundEnabled} />}
              label={t('settings.sound')}
              checked={soundEnabled}
              onToggle={() => void toggleSound()}
            />
            <ToggleRow
              icon={<VibrateIcon width={18} height={18} />}
              label={t('settings.haptics')}
              checked={hapticsEnabled}
              onToggle={() => void toggleHaptics()}
            />
          </Card>
        </section>

        <section>
          <Card>
            <button
              onClick={() => setConfirmingReset(true)}
              className="flex w-full items-center gap-3 text-left text-signal-early"
            >
              <TrashIcon width={18} height={18} />
              <span className="text-sm font-medium">{t('settings.resetStats')}</span>
            </button>
          </Card>
        </section>

        <p className="pt-2 text-center text-xs text-mist-700">{t('settings.version', { version: APP_VERSION })}</p>
      </div>

      <AnimatePresence>
        {confirmingReset && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-5 pb-8"
            onClick={() => setConfirmingReset(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-ink-600 bg-ink-800 p-5"
            >
              <p className="text-center text-sm text-mist-300">{t('settings.resetConfirm')}</p>
              <div className="mt-5 flex flex-col gap-2.5">
                <Button
                  variant="primary"
                  className="!bg-signal-early !from-signal-early !to-signal-early !border-signal-early/40"
                  onClick={() => {
                    void resetStats();
                    setConfirmingReset(false);
                  }}
                >
                  {t('settings.resetConfirmCta')}
                </Button>
                <Button variant="ghost" onClick={() => setConfirmingReset(false)}>
                  {t('settings.cancel')}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Screen>
  );
}

function SectionLabel({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="mb-3 flex items-center gap-2 text-mist-300">
      {icon}
      <h2 className="text-sm font-semibold uppercase tracking-wide">{text}</h2>
    </div>
  );
}

function ToggleRow({
  icon,
  label,
  checked,
  onToggle,
}: {
  icon: ReactNode;
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button onClick={onToggle} className="flex w-full items-center justify-between px-4 py-3.5">
      <span className="flex items-center gap-3 text-sm font-medium text-mist-100">
        <span className="text-mist-400">{icon}</span>
        {label}
      </span>
      <span
        className={`relative h-6 w-10 rounded-full transition-colors ${checked ? 'bg-violet-600' : 'bg-ink-600'}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-mist-100 transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  );
}
