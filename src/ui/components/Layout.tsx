import { Outlet, Link, useLocation } from 'react-router-dom';
import { Settings, Home, History, Drama, Menu } from 'lucide-react';
import { Toaster } from 'sonner';
import { ThemeToggle } from './ThemeToggle';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

export function Layout() {
    const location = useLocation();

    const navItems = [
        { name: '首页', path: '/', icon: Home },
        { name: '小剧场', path: '/theater', icon: Drama },
        { name: '历史', path: '/history', icon: History },
        { name: '设置', path: '/settings', icon: Settings },
    ];

    return (
        <div className="min-h-screen relative flex flex-col bg-background text-foreground">
            {/* 顶部导航栏 */}
            <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container mx-auto px-4 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {/* 移动端汉堡菜单移到左侧 */}
                        <div className="md:hidden">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-9 w-9 -ml-2 mr-1">
                                        <Menu className="h-5 w-5" />
                                        <span className="sr-only">打开菜单</span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-48">
                                    {navItems.map((item) => {
                                        const Icon = item.icon;
                                        const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                                        return (
                                            <DropdownMenuItem key={item.path} asChild>
                                                <Link
                                                    to={item.path}
                                                    className={`w-full flex items-center gap-2 cursor-pointer ${isActive ? 'text-primary font-medium' : ''}`}
                                                >
                                                    <Icon className="h-4 w-4" />
                                                    {item.name}
                                                </Link>
                                            </DropdownMenuItem>
                                        );
                                    })}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        <Link to="/" className="flex items-center gap-2 font-bold text-lg">
                            <span className="text-2xl">🐰</span>
                            <span className="font-bold hidden sm:inline-block">小兔几</span>
                        </Link>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* 桌面端导航 */}
                        <nav className="hidden md:flex items-center gap-2">
                            {navItems.map((item) => {
                                const Icon = item.icon;
                                const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));

                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${isActive
                                            ? 'bg-primary/10 text-primary font-medium'
                                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                            }`}
                                    >
                                        <Icon className="h-4 w-4" />
                                        <span className="text-sm">{item.name}</span>
                                    </Link>
                                );
                            })}
                        </nav>

                        {/* 已将移动端汉堡菜单移至左侧 */}

                        {/* Discord 链接 */}
                        <a
                            href="https://discord.gg/atsXVr7ve8"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center h-9 w-9 rounded-md hover:bg-muted transition-colors"
                            title="加入我们的 Discord"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M19.7297 5.09349C18.2393 4.41402 16.6346 3.91104 14.9458 3.61204C14.7397 3.98777 14.509 4.46979 14.3438 4.86242C12.5539 4.60061 10.7811 4.60061 9.02534 4.86242C8.85303 4.46979 8.61528 3.98777 8.40915 3.61204C6.72031 3.91104 5.11566 4.41402 3.62534 5.09349C0.605273 9.53932 -0.309319 13.8817 0.0820067 18.17C2.08398 19.6269 4.02404 20.5181 5.92211 21.0967C6.38875 20.4674 6.80915 19.8001 7.17706 19.0967C6.48625 18.8415 5.8288 18.5284 5.20387 18.17C5.35821 18.0563 5.50543 17.9351 5.64573 17.8073C9.42398 19.5298 13.3884 19.5298 17.1196 17.8073C17.26 17.9351 17.4072 18.0563 17.5615 18.17C16.9366 18.5355 16.2792 18.8415 15.5883 19.1039C15.9634 19.8001 16.3837 20.4674 16.8504 21.0967C18.7485 20.5181 20.6885 19.6269 22.6905 18.17C23.1499 13.1652 21.8021 8.8797 19.7297 5.09349ZM8.01918 15.42C6.91497 15.42 6.00287 14.4041 6.00287 13.1466C6.00287 11.8891 6.89375 10.8804 8.01918 10.8804C9.15174 10.8804 10.0638 11.8962 10.0426 13.1466C10.0426 14.4041 9.15174 15.42 8.01918 15.42ZM15.3672 15.42C14.263 15.42 13.3508 14.4041 13.3508 13.1466C13.3508 11.8891 14.2418 10.8804 15.3672 10.8804C16.4998 10.8804 17.4119 11.8962 17.3906 13.1466C17.3906 14.4041 16.4998 15.42 15.3672 15.42Z" fill="#5865F2" />
                            </svg>
                        </a>

                        {/* 主题切换开关 */}
                        <div className="ml-1 pl-1 md:ml-2 md:pl-2 border-l border-border/50">
                            <ThemeToggle />
                        </div>
                    </div>
                </div>
            </header>

            {/* 主内容区 */}
            <main className="flex-1 container mx-auto px-4 py-6">
                <Outlet />
            </main>

            {/* 全局 Toast 容器 */}
            <Toaster position="top-center" richColors visibleToasts={5} gap={8} expand closeButton duration={3000} />
        </div>
    );
}
