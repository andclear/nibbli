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

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        // 更新 state 使下一次渲染能够显示降级后的 UI
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ErrorBoundary 捕获到错误:', error, errorInfo);
    }

    private handleReset = () => {
        this.setState({ hasError: false, error: null });
        // 如果是全局边界，可能需要重载页面
        // window.location.reload();
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
                    <Button onClick={this.handleReset} variant="outline" className="gap-2">
                        <RefreshCcw className="h-4 w-4" />
                        尝试恢复
                    </Button>
                </div>
            );
        }

        return this.props.children;
    }
}
