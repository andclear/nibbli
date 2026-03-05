import { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';

/**
 * 监听 Zustand Store 中的 UI 设置并挂载相应的 className 到 html 根元素
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const { theme, colorMode } = useAppStore();

    useEffect(() => {
        const root = window.document.documentElement;

        // 清除之前的主题类名
        root.classList.remove('theme-coffee', 'theme-supabase', 'theme-skyline', 'light', 'dark');

        // 处理亮暗模式
        if (colorMode === 'system') {
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            root.classList.add(systemTheme);
        } else {
            root.classList.add(colorMode);
        }

        // 挂载颜色主题
        root.classList.add(theme);

    }, [theme, colorMode]);

    // 监听系统主题变化
    useEffect(() => {
        if (colorMode !== 'system') return;

        const root = window.document.documentElement;
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        const handleChange = (e: MediaQueryListEvent) => {
            root.classList.remove('light', 'dark');
            root.classList.add(e.matches ? 'dark' : 'light');
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [colorMode]);

    return <>{children}</>;
}
