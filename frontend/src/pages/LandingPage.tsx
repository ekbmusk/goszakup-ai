import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    ArrowRight, Shield, TrendingUp, Brain, Network,
    Search, ChevronRight, Github, BarChart3, FileSearch,
    AlertTriangle, CheckCircle, Zap, Lock
} from 'lucide-react';
import { Marquee } from '@/components/ui/marquee';

const statValues = ['2 059', '91%', '10+', '999', '<1 с'];

const featureKeys = [
    { titleKey: 'feat1Title', descKey: 'feat1Desc', Icon: Brain, color: 'border-emerald-500/20', bg: 'rgba(16,185,129,0.06)' },
    { titleKey: 'feat2Title', descKey: 'feat2Desc', Icon: Shield, color: 'border-green-500/20', bg: 'rgba(34,197,94,0.06)' },
    { titleKey: 'feat3Title', descKey: 'feat3Desc', Icon: Network, color: 'border-teal-500/20', bg: 'rgba(20,184,166,0.06)' },
    { titleKey: 'feat4Title', descKey: 'feat4Desc', Icon: TrendingUp, color: 'border-emerald-500/20', bg: 'rgba(16,185,129,0.06)' },
    { titleKey: 'feat5Title', descKey: 'feat5Desc', Icon: FileSearch, color: 'border-green-500/20', bg: 'rgba(34,197,94,0.06)' },
    { titleKey: 'feat6Title', descKey: 'feat6Desc', Icon: BarChart3, color: 'border-teal-500/20', bg: 'rgba(20,184,166,0.06)' },
];

const stepKeys = [
    { num: '01', Icon: Search, titleKey: 'step1Title', descKey: 'step1Desc' },
    { num: '02', Icon: Brain, titleKey: 'step2Title', descKey: 'step2Desc' },
    { num: '03', Icon: AlertTriangle, titleKey: 'step3Title', descKey: 'step3Desc' },
    { num: '04', Icon: CheckCircle, titleKey: 'step4Title', descKey: 'step4Desc' },
];

const G = 'hsl(142,71%,45%)';
const G2 = 'hsl(142,71%,65%)';

function StatsMarquee({ t }: { t: (key: string) => string }) {
    const labelKeys = ['stat1Label', 'stat2Label', 'stat3Label', 'stat4Label', 'stat5Label'];
    return (
        <div className="border-y border-white/8 bg-[hsl(160,10%,4%)]">
            <Marquee
                className="py-4 [--duration:42s] [--gap:4rem]"
                pauseOnHover
                repeat={5}
            >
                {statValues.map((val, i) => (
                    <div className="flex items-center gap-3 whitespace-nowrap" key={i}>
                        <span className="font-black font-mono text-sm tracking-wider" style={{ color: G }}>
                            {val}
                        </span>
                        <span className="font-medium text-xs text-white/45 uppercase tracking-[0.2em]">
                            {t(`landing.${labelKeys[i]}`)}
                        </span>
                        <span className="text-white/15 px-2">·</span>
                    </div>
                ))}
            </Marquee>
        </div>
    );
}

export default function LandingPage() {
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();

    const riskLevels = [
        { level: 'LOW', label: t('common.riskLow'), color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/30' },
        { level: 'MED', label: t('common.riskMedium'), color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/30' },
        { level: 'HIGH', label: t('common.riskHigh'), color: 'text-orange-400', bg: 'bg-orange-400/10 border-orange-400/30' },
        { level: 'CRIT', label: t('common.riskCritical'), color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/30' },
    ];

    const navLinks = [
        { label: t('nav.dashboard'), path: '/dashboard' },
        { label: t('nav.lots'), path: '/lots' },
        { label: t('nav.customers'), path: '/customers' },
        { label: t('nav.categories'), path: '/categories' },
        { label: t('nav.priceAnalysis'), path: '/price-analysis' },
        { label: t('nav.analyzeText'), path: '/analyze' },
    ];

    return (
        <div className="min-h-screen bg-[hsl(160,10%,4%)] text-white overflow-x-hidden">

            {/* ── Navbar ─────────────────────────────────── */}
            <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 sm:px-10 border-b border-white/5 bg-black/50 backdrop-blur-xl">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ background: `linear-gradient(135deg, ${G} 0%, hsl(142,71%,28%) 100%)` }}>
                        <Shield className="text-black" style={{ width: 17, height: 17 }} />
                    </div>
                    <div>
                        <p className="text-white font-bold text-base leading-none tracking-tight">GoszakupAI</p>
                        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase leading-none mt-0.5" style={{ color: G }}>
                            Risk Intelligence
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex gap-0.5 bg-white/5 rounded-lg p-1 border border-white/10">
                        {(['ru', 'kz'] as const).map((lang) => (
                            <button
                                key={lang}
                                onClick={() => { i18n.changeLanguage(lang); localStorage.setItem('lang', lang); }}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${i18n.language === lang ? 'text-black' : 'text-white/50 hover:text-white'}`}
                                style={i18n.language === lang ? { background: G } : {}}
                            >
                                {lang.toUpperCase()}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:brightness-110"
                        style={{ background: G, color: '#000' }}
                    >
                        {t('landing.enterBtn')} <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                </div>
            </nav>

            {/* ── Hero ─────────────────────────────────────── */}
            <section className="relative flex min-h-screen flex-col justify-end overflow-hidden pt-20">
                <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1800&q=80)' }}
                >
                    <div className="absolute inset-0"
                        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.80) 0%, rgba(0,0,0,0.50) 35%, rgba(0,5,2,0.94) 100%)' }} />
                    <div className="absolute inset-0 opacity-8 pointer-events-none"
                        style={{ backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 2px, ${G}06 2px, ${G}06 4px)` }} />
                </div>

                {/* Glows */}
                <div className="absolute top-1/3 left-1/3 w-96 h-96 rounded-full opacity-8 blur-3xl pointer-events-none" style={{ background: G }} />
                <div className="absolute bottom-1/3 right-1/5 w-64 h-64 rounded-full opacity-6 blur-3xl pointer-events-none" style={{ background: 'hsl(142,71%,28%)' }} />

                {/* Hero content */}
                <div className="relative z-10 w-full px-6 pb-20 sm:px-12 lg:px-20">
                    <div className="flex flex-col gap-10 lg:flex-row lg:items-end max-w-7xl">
                        {/* Left */}
                        <div className="flex-1 space-y-6">
                            <div className="inline-flex items-center gap-2 border rounded-full px-4 py-1.5 text-xs font-semibold backdrop-blur-sm"
                                style={{ borderColor: `${G}40`, background: `${G}12`, color: G }}>
                                <Zap className="w-3 h-3" />
                                {t('landing.badge')}
                            </div>

                            <h1 className="font-black leading-[1.02] tracking-tighter" style={{ fontSize: 'clamp(2.8rem, 7vw, 6rem)' }}>
                                <span className="text-white">{t('landing.heroTitle1')} </span>
                                <span style={{ background: `linear-gradient(135deg, ${G} 0%, ${G2} 50%, #fff 100%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                                    {t('landing.heroTitle2')}
                                </span>
                                <br />
                                <span className="text-white/90">{t('landing.heroTitle3')}</span>
                                <br />
                                <span style={{ background: `linear-gradient(90deg, ${G} 0%, ${G2} 100%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                                    {t('landing.heroTitle4')}
                                </span>
                            </h1>

                            <div className="flex flex-wrap items-center gap-3">
                                <button
                                    onClick={() => navigate('/dashboard')}
                                    className="group flex items-center gap-0 font-bold text-base transition-all hover:brightness-110 shadow-2xl"
                                    style={{ background: G, color: '#000', boxShadow: `0 0 40px ${G}40` }}
                                >
                                    <span className="px-7 py-4">{t('landing.enterBtn')}</span>
                                    <span className="border-l border-black/20 px-4 py-4 group-hover:translate-x-0.5 transition-transform">
                                        <ArrowRight className="w-5 h-5" />
                                    </span>
                                </button>
                                <button
                                    onClick={() => navigate('/analyze')}
                                    className="flex items-center gap-2 px-7 py-4 font-semibold text-sm border backdrop-blur-sm transition-all hover:border-white/30 hover:bg-white/5"
                                    style={{ borderColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.8)' }}
                                >
                                    <FileSearch className="w-4 h-4" />
                                    {t('landing.checkTzBtn')}
                                </button>
                            </div>

                            <div className="flex flex-wrap gap-2 pt-1">
                                {riskLevels.map((r) => (
                                    <span key={r.level} className={`inline-flex items-center gap-1.5 border px-3 py-1 rounded-full text-xs font-bold ${r.bg} ${r.color}`}>
                                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                        {r.label}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Right live card */}
                        <div className="lg:w-72 xl:w-80 hidden lg:block">
                            <div className="rounded-2xl border backdrop-blur-xl p-5 space-y-4"
                                style={{ background: 'rgba(0,0,0,0.65)', borderColor: `${G}25` }}>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-white/50 font-medium uppercase tracking-wider">{t('landing.liveCard')}</span>
                                    <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: G }}>
                                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                                        Live
                                    </span>
                                </div>
                                <div>
                                    <p className="text-sm text-white font-semibold leading-snug">Бумага для офисного оборудования</p>
                                    <p className="text-xs text-white/40 mt-0.5">172314.500.000092</p>
                                </div>
                                <div className="flex items-center justify-between border-t border-white/8 pt-3">
                                    <div className="text-center">
                                        <p className="text-2xl font-black text-orange-400">74.2</p>
                                        <p className="text-[10px] text-white/40 uppercase tracking-wider">{t('landing.riskScore')}</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-2xl font-black" style={{ color: G }}>+329%</p>
                                        <p className="text-[10px] text-white/40 uppercase tracking-wider">{t('landing.fromMedian')}</p>
                                    </div>
                                    <div className="text-center">
                                        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-orange-400/10 text-orange-400 border border-orange-400/30">
                                            {t('common.riskHigh').toUpperCase()}
                                        </span>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    {['R11: Критическое завышение цены', 'R05: Прямой запрет аналогов'].map((rule) => (
                                        <div key={rule} className="flex items-start gap-2 text-xs text-white/50">
                                            <AlertTriangle className="w-3 h-3 text-orange-400 flex-shrink-0 mt-0.5" />
                                            <span>{rule}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Stats Marquee (between hero and features) ── */}
            <StatsMarquee t={t} />

            {/* ── Features Grid ──────────────────────────── */}
            <section className="relative px-6 py-24 sm:px-12 lg:px-20 overflow-hidden">
                <div className="absolute inset-0 opacity-4 pointer-events-none"
                    style={{ background: `radial-gradient(ellipse 60% 50% at 50% 0%, ${G}, transparent)` }} />

                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16 space-y-3">
                        <div className="inline-flex items-center gap-2 border rounded-full px-4 py-1.5 text-xs font-semibold"
                            style={{ borderColor: `${G}30`, color: G, background: `${G}10` }}>
                            {t('landing.featuresTag')}
                        </div>
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
                            {t('landing.featuresTitle1')}<br />
                            <span style={{ background: `linear-gradient(90deg, ${G} 0%, ${G2} 100%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                                {t('landing.featuresTitle2')}
                            </span>
                        </h2>
                        <p className="text-white/45 max-w-xl mx-auto text-base">{t('landing.featuresSub')}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {featureKeys.map((f) => (
                            <div key={f.titleKey}
                                className={`group relative rounded-2xl border p-6 transition-all duration-300 hover:scale-[1.015] cursor-default ${f.color}`}
                                style={{ background: f.bg, backgroundColor: 'rgba(255,255,255,0.015)' }}>
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                                    style={{ background: `${G}14`, border: `1px solid ${G}22` }}>
                                    <f.Icon className="w-5 h-5" style={{ color: G }} />
                                </div>
                                <h3 className="text-white font-bold text-base mb-2">{t(`landing.${f.titleKey}`)}</h3>
                                <p className="text-white/48 text-sm leading-relaxed">{t(`landing.${f.descKey}`)}</p>
                                <div className="absolute bottom-5 right-5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <ChevronRight className="w-4 h-4" style={{ color: G }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── How It Works ───────────────────────────── */}
            <section className="px-6 py-24 sm:px-12 lg:px-20 border-t border-white/5">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16 space-y-3">
                        <div className="inline-flex items-center gap-2 border rounded-full px-4 py-1.5 text-xs font-semibold"
                            style={{ borderColor: `${G}30`, color: G, background: `${G}10` }}>
                            {t('landing.stepsTag')}
                        </div>
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
                            {t('landing.stepsTitle1')}<br />
                            <span style={{ background: `linear-gradient(90deg, ${G} 0%, ${G2} 100%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                                {t('landing.stepsTitle2')}
                            </span>
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                        {stepKeys.map((step, i) => (
                            <div key={step.num} className="relative space-y-4">
                                {i < stepKeys.length - 1 && (
                                    <div className="hidden lg:block absolute top-8 left-full w-full h-px z-0"
                                        style={{ background: `linear-gradient(to right, ${G}35, transparent)` }} />
                                )}
                                <div className="relative z-10 flex items-center gap-3">
                                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
                                        style={{ background: `linear-gradient(135deg, ${G}18 0%, ${G}06 100%)`, border: `1px solid ${G}28` }}>
                                        <step.Icon className="w-7 h-7" style={{ color: G }} />
                                    </div>
                                    <span className="text-5xl font-black text-white/5 select-none leading-none">{step.num}</span>
                                </div>
                                <h3 className="text-white font-bold text-lg">{t(`landing.${step.titleKey}`)}</h3>
                                <p className="text-white/45 text-sm leading-relaxed">{t(`landing.${step.descKey}`)}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── CTA Banner ─────────────────────────────── */}
            <section className="px-6 py-20 sm:px-12 lg:px-20">
                <div className="max-w-5xl mx-auto rounded-3xl p-10 sm:p-14 relative overflow-hidden"
                    style={{ background: `linear-gradient(135deg, ${G}16 0%, ${G}05 100%)`, border: `1px solid ${G}22` }}>
                    <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-15 blur-3xl pointer-events-none" style={{ background: G }} />
                    <div className="relative flex flex-col lg:flex-row items-center justify-between gap-8">
                        <div className="space-y-3 text-center lg:text-left">
                            <div className="flex items-center justify-center lg:justify-start gap-2 mb-2">
                                <Lock className="w-4 h-4" style={{ color: G }} />
                                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: G }}>{t('landing.ctaFree')}</span>
                            </div>
                            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white leading-tight">{t('landing.ctaTitle')}</h2>
                            <p className="text-white/50 text-base">{t('landing.ctaSub')}</p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
                            <button
                                onClick={() => navigate('/dashboard')}
                                className="flex items-center gap-2 px-8 py-4 font-bold text-base transition-all hover:brightness-110"
                                style={{ background: G, color: '#000', boxShadow: `0 0 25px ${G}30` }}
                            >
                                {t('landing.enterBtn')} <ArrowRight className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => navigate('/analyze')}
                                className="flex items-center gap-2 px-8 py-4 font-semibold text-sm border transition-all hover:bg-white/5"
                                style={{ borderColor: `${G}38`, color: 'rgba(255,255,255,0.72)' }}
                            >
                                <FileSearch className="w-4 h-4" />
                                {t('landing.checkTzBtn')}
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Footer ─────────────────────────────────── */}
            <footer className="border-t border-white/6 px-6 py-10 sm:px-12 lg:px-20">
                <div className="max-w-7xl mx-auto">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8 mb-8">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                                style={{ background: `linear-gradient(135deg, ${G} 0%, hsl(142,71%,28%) 100%)` }}>
                                <Shield className="text-black" style={{ width: 16, height: 16 }} />
                            </div>
                            <div>
                                <p className="text-white font-bold leading-none">GoszakupAI</p>
                                <p className="text-xs text-white/35 mt-0.5">{t('landing.footerSub')}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-10 gap-y-3 text-sm">
                            {navLinks.map((link) => (
                                <button
                                    key={link.path}
                                    onClick={() => navigate(link.path)}
                                    className="text-left text-white/38 hover:text-white transition-colors"
                                >
                                    {link.label}
                                </button>
                            ))}
                        </div>

                        <a
                            href="https://github.com/ekbmusk/goszakup-ai"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm text-white/55 hover:text-white hover:border-white/20 transition-all"
                            style={{ borderColor: 'rgba(255,255,255,0.1)' }}
                        >
                            <Github className="w-4 h-4" />
                            GitHub
                        </a>
                    </div>

                    <div className="border-t border-white/5 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <p className="text-xs text-white/28">© 2025 GoszakupAI · {t('landing.footerCopy')}</p>
                        <div className="flex items-center gap-4 text-xs text-white/28">
                            <span>{t('landing.footerData')}</span>
                            <span>·</span>
                            <span>{t('landing.footerStack')}</span>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
