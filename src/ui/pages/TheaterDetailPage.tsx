import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCoreContext } from '@/core/useCoreContext';
import { Context } from '@/core/CoreContextSymbol';
import { ResultPreview } from '@/ui/components/ResultPreview';
import { ErrorBoundary } from '@/ui/components/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Copy, Loader2, Sparkles, User, Tag as TagIcon, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/useAppStore';
import type { CoreContext } from '@/core/types';

interface StoryDetail {
    id: string;
    title: string;
    category: string;
    author: string | null;
    description: string;
    content: string;
    created_at: string;
}

export function TheaterDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const coreContext = useCoreContext();
    const { defaultModel, selectedModels } = useAppStore();

    // 页面级模型选择（默认使用全局设定的默认模型）
    const [localModel, setLocalModel] = useState<string>(defaultModel);

    const [story, setStory] = useState<StoryDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [extraPrompt, setExtraPrompt] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState(false);

    // 生成结果的状态
    const [generateResult, setGenerateResult] = useState<unknown>(undefined);
    const [generateError, setGenerateError] = useState<Error | null>(null);

    useEffect(() => {
        if (!id) return;
        setLoading(true);
        fetch(`/api/story?id=${encodeURIComponent(id)}`)
            .then(async res => {
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data.error || '获取详情失败');
                }
                return res.json();
            })
            .then(data => {
                setStory(data);
                setError(null);
            })
            .catch(err => {
                console.error(err);
                setError(err.message);
            })
            .finally(() => {
                setLoading(false);
            });
    }, [id]);

    const handleCopy = (text: string, label: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text)
            .then(() => toast.success(`已复制${label}`))
            .catch(() => toast.error(`复制${label}失败`));
    };

    // 构建与工具执行一致的 enrichedContext
    const buildEnrichedContext = (): CoreContext => {
        const storeState = useAppStore.getState();
        let globalPrompt = storeState.globalPrompt || '';

        // 如果开启了禁词表，自动拼接到全局提示词后面
        if (storeState.enableBannedWords && storeState.globalBannedWords) {
            globalPrompt = globalPrompt
                ? `${globalPrompt}\n\n${storeState.globalBannedWords}`
                : storeState.globalBannedWords;
        }

        const model = localModel || defaultModel || '';

        return {
            ...coreContext,
            systemPrompt: '',
            globalPrompt: globalPrompt,
            defaultModel: model,
            parsers: coreContext.parsers,
        };
    };

    const handleGenerate = async () => {
        if (!story || !story.content) {
            toast.warning('小剧场内容为空，无法生成');
            return;
        }

        setIsGenerating(true);
        setGenerateResult('');
        setGenerateError(null);

        const enrichedContext = buildEnrichedContext();

        const systemMessage = `你是一个小剧场生成助手。请根据下方提供的小剧场提示词进行演绎。
如果有用户补充的提示信息，请优先遵循用户的补充设定。
重要规则：如果用户在补充信息中提供了user和char的名称，你必须在输出中直接使用这些名称，禁止使用{{user}}和{{char}}等占位符替代。
${enrichedContext.globalPrompt ? `\n${enrichedContext.globalPrompt}` : ''}

【小剧场内容】
${story.content}`;

        const userMessage = extraPrompt.trim()
            ? `【补充信息】\n${extraPrompt}\n\n请开始生成：`
            : `请开始生成：`;

        try {
            const stream = await enrichedContext.llmClient.chat.completions.create({
                model: enrichedContext.defaultModel,
                messages: [
                    { role: 'system', content: systemMessage },
                    { role: 'user', content: userMessage }
                ],
                stream: true,
                temperature: 0.7,
            });

            let fullText = '';
            for await (const chunk of stream) {
                const delta = chunk.choices[0]?.delta?.content || '';
                fullText += delta;
                setGenerateResult(fullText);
            }
            toast.success('生成完毕！');
        } catch (err: unknown) {
            console.error('生成失败:', err);
            setGenerateError(err instanceof Error ? err : new Error(String(err)));
            toast.error('生成过程出错，请查看日志或重试');
        } finally {
            setIsGenerating(false);
        }
    };

    // 将选中的模型注入到核心上下文中
    const effectiveContext = { ...coreContext, defaultModel: localModel || defaultModel };

    if (loading) {
        return (
            <div className="flex h-full min-h-[50vh] w-full items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">加载详情中...</span>
            </div>
        );
    }

    if (error || !story) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
                <h1 className="text-2xl font-bold text-red-500">无法加载小剧场</h1>
                <p className="text-muted-foreground">{error || '内容不存在或已被删除'}</p>
                <Button onClick={() => navigate('/theater')}>返回小剧场大厅</Button>
            </div>
        );
    }

    const content = (
        <div className="flex flex-col h-full space-y-6">
            {/* 顶部栏 */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start md:items-center space-x-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/theater')} className="shrink-0">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="min-w-0">
                        <h1 className="text-2xl font-bold truncate">小剧场详情</h1>
                        <p className="text-sm text-muted-foreground line-clamp-1 mt-1">{story.title}</p>
                    </div>
                </div>
                {/* 模型选择器 */}
                <div className="flex flex-wrap items-center gap-3 shrink-0">
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
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full min-h-[600px]">
                {/* 左侧：静态信息区 (占 1 份) */}
                <div className="lg:col-span-1 flex flex-col border rounded-xl bg-card text-card-foreground shadow-sm p-6 overflow-hidden">
                    <h2 className="text-lg font-semibold mb-6 border-b pb-2">设定面板</h2>

                    <div className="flex-1 overflow-y-auto space-y-5 pr-2 custom-scrollbar">
                        {/* 标题 */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                    <FileText className="h-3 w-3" /> 标题
                                </label>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted/50" onClick={() => handleCopy(story.title, '标题')} title="复制标题">
                                    <Copy className="h-3 w-3" />
                                </Button>
                            </div>
                            <div className="text-sm font-medium bg-muted/30 p-2.5 rounded-md border border-border/50 break-words">
                                {story.title}
                            </div>
                        </div>

                        {/* 作者 & 分类 */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                                    <User className="h-3 w-3" /> 作者
                                </label>
                                <div className="text-sm text-foreground/80 truncate px-1">
                                    {story.author || '匿名'}
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                                    <TagIcon className="h-3 w-3" /> 分类
                                </label>
                                <div className="text-sm text-foreground/80 truncate px-1">
                                    {story.category || '未分类'}
                                </div>
                            </div>
                        </div>

                        {/* 简介 */}
                        <div>
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                                简介
                            </label>
                            <div className="text-sm text-foreground/80 bg-muted/10 p-2.5 rounded-md leading-relaxed whitespace-pre-wrap">
                                {story.description || '无简介'}
                            </div>
                        </div>

                        {/* 内容 */}
                        <div className="flex flex-col">
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                    <FileText className="h-3 w-3" /> 核心小剧场内容
                                </label>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted/50" onClick={() => handleCopy(story.content, '内容')} title="复制内容">
                                    <Copy className="h-3 w-3" />
                                </Button>
                            </div>
                            <div className="text-sm text-foreground/80 bg-muted/30 p-3 rounded-md border border-border/50 whitespace-pre-wrap break-words font-mono text-xs overflow-y-auto max-h-[300px] select-text custom-scrollbar">
                                {story.content}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 右侧：生成与预览区 (占 2 份) */}
                <div className="lg:col-span-2 flex flex-col h-full gap-4">
                    {/* 输入控制区 */}
                    <div className="border rounded-xl bg-card text-card-foreground shadow-sm p-4 md:p-6 flex flex-col gap-4 shrink-0">
                        <div>
                            <label className="block text-sm font-medium mb-2">补充要求 (可选)</label>
                            <Textarea
                                value={extraPrompt}
                                onChange={(e) => setExtraPrompt(e.target.value)}
                                placeholder="可补充一些信息，如user和char的名称、性别或设定，使输出结果更贴合需要"
                                rows={3}
                                className="resize-y"
                                disabled={isGenerating}
                            />
                        </div>
                        <div className="flex justify-end">
                            <Button
                                onClick={handleGenerate}
                                disabled={isGenerating || !story.content}
                                className="min-w-[140px]"
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        生成中...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="mr-2 h-4 w-4" />
                                        生成小剧场
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* 结果预览区 */}
                    <div className="flex-1 min-h-[400px]">
                        <ErrorBoundary>
                            <ResultPreview
                                result={generateResult}
                                error={generateError}
                                coreContext={effectiveContext}
                            />
                        </ErrorBoundary>
                    </div>
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
