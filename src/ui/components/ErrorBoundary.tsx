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
 * 判断是否为浏览器扩展（翻译插件、Grammarly 等）干扰 React DOM 导致的错误
 * 这类错误无法通过 React 状态重置恢复，只能刷新页面
 */
function isDOMConflictError(error: Error): boolean {
    const msg = error.message || '';
    return (
        msg.includes('removeChild') ||
        msg.includes('insertBefore') ||
        msg.includes('appendChild') ||
        msg.includes('not a child of this node') ||
        msg.includes('Failed to execute') && msg.includes('on \'Node\'')
    );
}

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

        // 浏览器扩展导致的 DOM 冲突错误，自动刷新页面恢复
        if (isDOMConflictError(error)) {
            console.warn('检测到 DOM 冲突（可能由浏览器翻译扩展等引起），自动刷新恢复...');
            window.location.reload();
        }
    }

    private handleReset = () => {
        // DOM 已损坏的情况下，重置 state 无法修复，直接刷新页面
        window.location.reload();
    };

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="flex flex-col items-center justify-center p-8 text-center h-full min-h-[300px] bg-destructive/5 rounded-xl border border-destructive/20 m-4">
                    <div className="bg-destructive/10 p-4 rounded-full mb-4">
                        <AlertTriangle className="h-10 w-10 text-destructive" />
                    </div>
                    <h2 className="text-xl font-bold mb-2">组件渲染发生错误</h2>
                    <p className="text-muted-foreground mb-6 max-w-[500px]">
                        {this.state.error?.message || '发生了一个意外的渲染错误。'}
                    </p>
                    <p className="text-xs text-muted-foreground mb-4">
                        提示：如果您正在使用浏览器翻译扩展，请将本站设为"不翻译"以避免此问题。
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

