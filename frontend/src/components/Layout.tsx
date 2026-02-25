import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    LayoutDashboard,
    ListChecks,
    FileSearch,
    Shield,
    Activity,
    TrendingUp,
    Building2,
    FolderOpen,
    LineChart,
    Network,
    Languages,
} from 'lucide-react';
import { useHealth } from '@/hooks/useApi';
export default function Layout() {
    const { t, i18n } = useTranslation();
    const { data: health } = useHealth();

    const navItems = [
        { to: '/', icon: LayoutDashboard, label: t('nav.dashboard') },
        { to: '/lots', icon: ListChecks, label: t('nav.lots') },
        { to: '/compare', icon: FileSearch, label: t('nav.compare') },
        { to: '/customers', icon: Building2, label: t('nav.customers') },
        { to: '/categories', icon: FolderOpen, label: t('nav.categories') },
        { to: '/price-analysis', icon: TrendingUp, label: t('nav.priceAnalysis') },
        { to: '/timeline', icon: LineChart, label: t('nav.timeline') },
        { to: '/network', icon: Network, label: t('nav.network') },
        { to: '/analyze', icon: FileSearch, label: t('nav.analyzeText') },
    ];

    const toggleLang = () => {
        const next = i18n.language === 'ru' ? 'kz' : 'ru';
        i18n.changeLanguage(next);
        localStorage.setItem('lang', next);
    };

    return (
        <div className="flex h-screen overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 flex-shrink-0 border-r border-[hsl(var(--border))] bg-[hsl(var(--card))] flex flex-col">
                {/* Logo */}
                <div className="p-5 border-b border-[hsl(var(--border))]">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-[hsl(var(--primary))] flex items-center justify-center">
                            <Shield className="w-5 h-5 text-black" />
                        </div>
                        <div>
                            <h1 className="text-base font-bold tracking-tight">
                                <span className="gradient-text">Goszakup</span>
                                <span className="text-[hsl(var(--foreground))]">AI</span>
                            </h1>
                            <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                                {t('nav.riskAnalysis')}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-3 space-y-1">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.to === '/'}
                            className={({ isActive }) =>
                                `sidebar-link ${isActive ? 'active' : ''}`
                            }
                        >
                            <item.icon className="w-[18px] h-[18px]" />
                            {item.label}
                        </NavLink>
                    ))}
                </nav>

                {/* Language Switcher + Status Footer */}
                <div className="p-4 border-t border-[hsl(var(--border))] space-y-3">
                    {/* Lang toggle */}
                    <div className="flex items-center gap-2">
                        <Languages className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
                        <div className="flex rounded-md overflow-hidden border border-[hsl(var(--border))] text-xs">
                            <button
                                onClick={() => { i18n.changeLanguage('ru'); localStorage.setItem('lang', 'ru'); }}
                                className={`px-3 py-1 font-semibold transition-colors ${i18n.language === 'ru'
                                    ? 'bg-[hsl(var(--primary))] text-black'
                                    : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                                    }`}
                            >
                                RU
                            </button>
                            <button
                                onClick={() => { i18n.changeLanguage('kz'); localStorage.setItem('lang', 'kz'); }}
                                className={`px-3 py-1 font-semibold transition-colors ${i18n.language === 'kz'
                                    ? 'bg-[hsl(var(--primary))] text-black'
                                    : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                                    }`}
                            >
                                KZ
                            </button>
                        </div>
                    </div>

                    {/* API Status */}
                    <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                        <Activity className="w-3.5 h-3.5" />
                        <span>{t('common.apiStatus')}</span>
                        {health?.status === 'ok' ? (
                            <span className="flex items-center gap-1 text-[hsl(var(--primary))]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--primary))] animate-pulse" />
                                {t('common.online')}
                            </span>
                        ) : (
                            <span className="text-[hsl(var(--destructive))]">{t('common.offline')}</span>
                        )}
                    </div>
                    {health?.total_lots !== undefined && (
                        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                            {t('common.lotsInDb', { count: health.total_lots })}
                        </p>
                    )}
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto scrollbar-none">
                <div className="p-6 max-w-7xl mx-auto">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
