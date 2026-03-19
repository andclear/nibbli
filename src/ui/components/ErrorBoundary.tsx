import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
    children?: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * 判断是否为资源加载失败（部署新版本后旧资源不存在）导致的错误
 * 包括 MIME type 错误和 chunk 加载失败
 */
function isAssetLoadError(error: Error): boolean {
    const msg = error.message || '';
    return (
        msg.includes('MIME type') ||
        msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('Loading chunk') ||
        msg.includes('Loading CSS chunk') ||
        msg.includes('is not valid JavaScript')
    );
}

/**
 * 判断是否为浏览器扩展干扰 React DOM 导致的错误
 */
function isDOMConflictError(error: Error): boolean {
    const msg = error.message || '';
    return (
        msg.includes('removeChild') ||
        msg.includes('insertBefore') ||
        msg.includes('appendChild') ||
        msg.includes('not a child of this node') ||
        msg.includes('Failed to execute') && msg.includes("on 'Node'")
    );
}

/** 防止无限刷新的 sessionStorage key */
const AUTO_RELOAD_KEY = 'eb_auto_reload';

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ErrorBoundary 捕获到错误:', error, errorInfo);

        // 资源加载失败或 DOM 冲突：自动刷新页面恢复（仅一次，防止无限循环）
        if (isAssetLoadError(error) || isDOMConflictError(error)) {
            const lastReload = sessionStorage.getItem(AUTO_RELOAD_KEY);
            const now = Date.now();
            // 距离上次自动刷新不足 30 秒，不再刷新（防止循环）
            if (!lastReload || now - Number(lastReload) > 30000) {
                sessionStorage.setItem(AUTO_RELOAD_KEY, String(now));
                console.warn('检测到资源加载问题，自动刷新恢复...');
                window.location.reload();
                return;
            }
        }
    }

    private handleReset = () => {
        window.location.reload();
    };

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            const error = this.state.error;
            const isAsset = error ? isAssetLoadError(error) : false;

            return (
                <div className="flex flex-col items-center justify-center p-8 text-center h-full min-h-[300px] bg-destructive/5 rounded-xl border border-destructive/20 m-4">
                    <div className="bg-destructive/10 p-4 rounded-full mb-4">
                        <AlertTriangle className="h-10 w-10 text-destructive" />
                    </div>
                    <h2 className="text-xl font-bold mb-2">
                        {isAsset ? '页面资源加载失败' : '组件渲染发生错误'}
                    </h2>
                    <p className="text-muted-foreground mb-6 max-w-[500px]">
                        {isAsset
                            ? '网站刚刚更新了新版本，请刷新页面加载最新资源。'
                            : (error?.message || '发生了一个意外的渲染错误。')
                        }
                    </p>
                    <Button onClick={this.handleReset} variant="outline" className="gap-2">
                        <RefreshCcw className="h-4 w-4" />
                        刷新页面
                    </Button>
                </div>
            );
        }

        return this.props.children;
    }
}
