import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TopBar } from '@/components/layout/TopBar';
import { SignalDisc } from '@/components/game/SignalDisc';
import { Button } from '@/components/ui/Button';
import { RotateIcon } from '@/components/ui/icons';
import { useReactionGame } from '@/features/game/useReactionGame';
import { useTelegramBackButton } from '@/hooks/useTelegramBackButton';
import { useStatsStore } from '@/store/statsStore';

export function PlayScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { phase, resultMs, start, registerTap, reset } = useReactionGame();
  const addAttempt = useStatsStore((s) => s.addAttempt);
  const snapshot = useStatsStore((s) => s.snapshot());
  const startedRef = useRef(false);

  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      start();
    }
  }, [start]);

  const goHome = useCallback(() => navigate('/'), [navigate]);
  useTelegramBackButton(goHome);

  useEffect(() => {
    if (phase !== 'result' || resultMs === null) return;
    const previousBest = snapshot.best;
    void addAttempt(resultMs).then(() => {
      const isNewBest = previousBest === null || resultMs < previousBest;
      navigate('/result', { state: { timeMs: resultMs, isNewBest }, replace: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, resultMs]);

  const handleSurfaceTap = useCallback(() => {
    if (phase === 'countdown' || phase === 'go') {
      registerTap();
    }
  }, [phase, registerTap]);

  const discLabel =
    phase === 'go'
      ? t('game.goHint')
      : phase === 'countdown' || phase === 'armed'
        ? t('game.waiting')
        : phase === 'tooSoon'
          ? t('game.tooSoonTitle')
          : phase === 'timeout'
            ? t('game.timeoutTitle')
            : undefined;

  const discSublabel =
    phase === 'countdown' || phase === 'armed' ? t('game.armedHint') : phase === 'go' ? t('game.tapAnywhere') : undefined;

  const isRetryable = phase === 'tooSoon' || phase === 'timeout';

  return (
    <div
      onPointerDown={handleSurfaceTap}
      className="flex min-h-full w-full select-none flex-col px-5"
      style={{
        touchAction: 'manipulation',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.25rem)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)',
      }}
    >
      <TopBar title={t('game.prepareTitle')} onBack={goHome} />

      <div className="flex flex-1 flex-col items-center justify-center gap-8">
        <SignalDisc phase={phase} label={discLabel} sublabel={discSublabel} />

        {!isRetryable && (
          <p className="max-w-[15rem] text-center text-sm text-mist-500">{t('game.prepareDesc')}</p>
        )}

        {phase === 'tooSoon' && (
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="max-w-[16rem] text-sm text-mist-500">{t('game.tooSoonDesc')}</p>
            <Button
              icon={<RotateIcon width={18} height={18} />}
              onClick={(e) => {
                e.stopPropagation();
                reset();
                start();
              }}
            >
              {t('game.tooSoonCta')}
            </Button>
          </div>
        )}

        {phase === 'timeout' && (
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="max-w-[16rem] text-sm text-mist-500">{t('game.timeoutDesc')}</p>
            <Button
              icon={<RotateIcon width={18} height={18} />}
              onClick={(e) => {
                e.stopPropagation();
                reset();
                start();
              }}
            >
              {t('game.tooSoonCta')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
