import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { toolRegistry } from '@/tools';
import { DynamicToolForm } from '@/ui/components/DynamicToolForm';
import { ResultPreview } from '@/ui/components/ResultPreview';
import { PromptEditorDialog } from '@/ui/components/PromptEditorDialog';
import { ErrorBoundary } from '@/ui/components/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import type { ToolConfig } from '@/core/types';
import { useCoreContext } from '@/core/useCoreContext';
import { Context } from '@/core/CoreContextSymbol';
import { useAppStore } from '@/store/useAppStore';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

export function ToolDetailPage() {
    const { toolId } = useParams<{ toolId: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const coreContext = useCoreContext();
    const { defaultModel, selectedModels } = useAppStore();

    // 工具级别的模型选择，默认使用全局设置的默认模型
    const [localModel, setLocalModel] = useState<string>(defaultModel);

    // 直接根据 URL 参数派生出工具配置
    const tool: ToolConfig | null = toolId ? toolRegistry.getById(toolId) || null : null;



    // 从历史记录「重新执行」跳转时携带的预填数据
    const prefillInputs = (location.state as { prefillInputs?: Record<string, unknown> } | null)?.prefillInputs;

    const [result, setResult] = useState<unknown>(undefined);
    const [error, setError] = useState<Error | null>(null);

    // 双重保险：如果由其它途径进入到了通用的 tool 页面，则强制重定向
    useEffect(() => {
        if (toolId === 'qr_generator') {
            navigate('/quick-reply-generator', { replace: true });
        }
    }, [toolId, navigate]);

    if (!tool) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
                <h1 className="text-2xl font-bold">未找到该工具</h1>
                <p className="text-muted-foreground">工具 ID "{toolId}" 不存在或尚未注册。</p>
                <Button onClick={() => navigate('/')}>返回首页</Button>
            </div>
        );
    }

    const handleExecutionComplete = (res: unknown) => {
        setResult(res);
        setError(null);
    };

    // 将选中的模型注入到核心上下文中，使所有子组件使用本页面选择的模型
    const effectiveContext = { ...coreContext, defaultModel: localModel || defaultModel };

    const content = (
        <div className="flex flex-col h-full space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start md:items-center space-x-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="shrink-0">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="min-w-0">
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold truncate">{tool.name}</h1>
                            {tool.author && (
                                <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground ring-1 ring-inset ring-muted-foreground/20">
                                    by {tool.author}
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 md:line-clamp-1 mt-1">{tool.description}</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 shrink-0">
                    {/* 模型选择器 */}
                    <div className="w-[200px] md:w-[240px]">
                        <Select value={localModel} onValueChange={setLocalModel}>
                            <SelectTrigger className="h-9 w-full [&>span]:truncate [&>span]:pr-2">
                                <SelectValue placeholder="选择模型" />
                            </SelectTrigger>
                            <SelectContent>
                                {selectedModels.length > 0 ? (
                                    selectedModels.map(m => (
                                        <SelectItem key={m} value={m}>{m}</SelectItem>
                                    ))
                                ) : (
                                    <SelectItem value={defaultModel || 'none'} disabled>
                                        请先在设置中启用模型
                                    </SelectItem>
                                )}
                            </SelectContent>
                        </Select>
                    </div>
                    {/* 编辑提示词入口 */}
                    <PromptEditorDialog tool={tool} triggerVariant="button" />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full min-h-[600px]">
                {/* 左侧：动态表单区 (占 1 份) */}
                <div className="lg:col-span-1 flex flex-col border rounded-xl bg-card text-card-foreground shadow-sm p-6 overflow-y-auto">
                    <h2 className="text-lg font-semibold mb-6 border-b pb-2">参数配置</h2>
                    <ErrorBoundary>
                        <DynamicToolForm
                            config={tool}
                            onExecutionComplete={handleExecutionComplete}
                            initialValues={prefillInputs}
                        />
                    </ErrorBoundary>
                </div>

                {/* 右侧：结果预览区 (占 2 份) */}
                <div className="lg:col-span-2 flex flex-col h-full gap-3">
                    <ErrorBoundary>
                        <ResultPreview result={result} error={error} coreContext={effectiveContext} />
                    </ErrorBoundary>
                </div>
            </div>
        </div>
    );

    return (
        <Context.Provider value={effectiveContext}>
            {content}
        </Context.Provider>
    );
}
