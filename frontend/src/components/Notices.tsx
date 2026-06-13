import { useTranslation } from 'react-i18next';
import { Wrench, AlertTriangle, Scale } from 'lucide-react';

/** Тонкая «бегущая» полоса о технических работах. */
export function MaintenanceBar() {
    const { t } = useTranslation();
    return (
        <div
            role="status"
            className="flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-amber-200"
        >
            <Wrench className="w-4 h-4 flex-shrink-0 animate-pulse" />
            <p className="text-xs sm:text-sm leading-snug">
                <span className="font-bold uppercase tracking-wide">{t('disclaimer.maintenanceTitle')}.</span>{' '}
                <span className="text-amber-200/80">{t('disclaimer.maintenanceText')}</span>
            </p>
        </div>
    );
}

/** Крупный дисклеймер: система лишь анализирует, приговор — за государством. */
export function DisclaimerBanner() {
    const { t } = useTranslation();
    return (
        <div
            role="alert"
            className="relative overflow-hidden rounded-2xl border-2 border-red-500/40 bg-red-500/[0.07] p-5 sm:p-6"
        >
            <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-red-500/15">
                    <AlertTriangle className="h-6 w-6 text-red-400" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-base sm:text-lg font-extrabold leading-tight text-red-200">
                        {t('disclaimer.title')}
                    </h2>
                    <ul className="space-y-1.5 text-sm leading-relaxed text-red-100/85">
                        <li className="flex gap-2">
                            <span className="text-red-400">•</span>
                            <span>{t('disclaimer.p1')}</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-red-400">•</span>
                            <span className="font-semibold text-red-100">{t('disclaimer.p2')}</span>
                        </li>
                        <li className="flex gap-2">
                            <Scale className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-300" />
                            <span>{t('disclaimer.p3')}</span>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
}

/** Блок уведомлений для верха страниц приложения. */
export function TopNotices() {
    return (
        <div className="mb-6 space-y-3">
            <MaintenanceBar />
            <DisclaimerBanner />
        </div>
    );
}
