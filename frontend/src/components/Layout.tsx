import { NavLink, Outlet } from 'react-router-dom';
import {
    LayoutDashboard,
    ListChecks,
    FileSearch,
    Shield,
    Activity,
    TrendingUp,
    Building2,
    FolderOpen,
} from 'lucide-react';
import { useHealth } from '@/hooks/useApi';

const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Дашборд' },
    { to: '/lots', icon: ListChecks, label: 'Лоты' },
    { to: '/customers', icon: Building2, label: 'Заказчики' },
    { to: '/categories', icon: FolderOpen, label: 'Категории' },
    { to: '/price-analysis', icon: TrendingUp, label: 'Анализ по ценам' },
    { to: '/analyze', icon: FileSearch, label: 'Анализ текста' },
];

export default function Layout() {
    const { data: health } = useHealth();

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
                                Анализ рисков
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

                {/* Status Footer */}
                <div className="p-4 border-t border-[hsl(var(--border))]">
                    <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                        <Activity className="w-3.5 h-3.5" />
                        <span>API:</span>
                        {health?.status === 'ok' ? (
                            <span className="flex items-center gap-1 text-[hsl(var(--primary))]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--primary))] animate-pulse" />
                                Онлайн
                            </span>
                        ) : (
                            <span className="text-[hsl(var(--destructive))]">Офлайн</span>
                        )}
                    </div>
                    {health?.total_lots !== undefined && (
                        <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">
                            {health.total_lots.toLocaleString()} лотов в базе
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
