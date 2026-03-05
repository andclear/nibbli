import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Copy, CheckCircle2, Loader2, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import type { ToolSuggestionsResult, ToolSuggestion, CoreContext } from '@/core/types';

interface SuggestionsResultViewProps {
    result: ToolSuggestionsResult;
    /** 注入核心上下文，供采纳并优化二次调用使用 */
    coreContext: CoreContext;
}

/**
 * 单条建议卡片
 */
function SuggestionCard({
    suggestion,
    coreContext,
}: {
    suggestion: ToolSuggestion;
    coreContext: CoreContext;
}) {
    const [copiedProposed, setCopiedProposed] = useState(false);
    const [copiedRefined, setCopiedRefined] = useState(false);
    const [showOriginal, setShowOriginal] = useState(false);
    const [isRefining, setIsRefining] = useState(false);
    const [refinedContent, setRefinedContent] = useState<string | null>(null);
    const [refineError, setRefineError] = useState<string | null>(null);

    // 复制建议内容
    const handleCopyProposed = () => {
        navigator.clipboard.writeText(suggestion.proposed).then(() => {
            setCopiedProposed(true);
            toast.success('已复制建议内容');
            setTimeout(() => setCopiedProposed(false), 2000);
        });
    };

    // 复制采纳并优化结果
    const handleCopyRefined = () => {
        if (!refinedContent) return;
        navigator.clipboard.writeText(refinedContent).then(() => {
            setCopiedRefined(true);
            toast.success('已复制优化结果');
            setTimeout(() => setCopiedRefined(false), 2000);
        });
    };

    // 触发二次 AI 采纳并优化
    const handleRefine = async () => {
        if (!suggestion.refinePrompt) return;

        setIsRefining(true);
        setRefinedContent(null);
        setRefineError(null);
        try {
            const response = await coreContext.llmClient.chat.completions.create({
                model: coreContext.defaultModel,
                messages: [
                    { role: 'system', content: coreContext.systemPrompt || '你是一位专业的内容优化助手。' },
                    { role: 'user', content: suggestion.refinePrompt },
                ],
                temperature: 0.7,
            });
            const content = response.choices[0]?.message?.content ?? '';
            if (!content.trim()) {
                throw new Error('AI 返回了空内容，请重试');
            }
            setRefinedContent(content);
        } catch (err) {
            const msg = err instanceof Error ? err.message : '优化失败';
            setRefineError(msg);
            toast.error(msg);
        } finally {
            setIsRefining(false);
        }
    };

    return (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            {/* 卡片头部 */}
            <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b">
                <span className="font-semibold text-sm">{suggestion.label}</span>
                <div className="flex gap-2">
                    {/* 采纳并优化按钮仅在有 refinePrompt 时显示 */}
                    {suggestion.refinePrompt && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handleRefine}
                            disabled={isRefining}
                            className="h-7 text-xs gap-1"
                        >
                            {isRefining ? (
                                <>
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    <span className="animate-pulse">生成中...</span>
                                </>
                            ) : (
                                <>
                                    <Sparkles className="h-3 w-3" />
                                    采纳并优化
                                </>
                            )}
                        </Button>
                    )}
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCopyProposed}
                        className="h-7 text-xs gap-1"
                    >
                        {copiedProposed ? (
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                        ) : (
                            <Copy className="h-3 w-3" />
                        )}
                        {copiedProposed ? '已复制' : '复制建议'}
                    </Button>
                </div>
            </div>

            <div className="p-4 space-y-3">
                {/* 原文折叠区（有 original 时才显示） */}
                {suggestion.original && (
                    <div>
                        <button
                            onClick={() => setShowOriginal(v => !v)}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-1"
                        >
                            {showOriginal ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            {showOriginal ? '收起原文' : '查看原文'}
                        </button>
                        {showOriginal && (
                            <pre className="text-xs font-mono whitespace-pre-wrap break-all p-3 rounded-lg bg-muted/50 text-muted-foreground border border-dashed max-h-48 overflow-y-auto">
                                {suggestion.original}
                            </pre>
                        )}
                    </div>
                )}

                {/* 建议内容 */}
                <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">AI 建议内容</p>
                    <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
                        <article className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-p:leading-relaxed">
                            <ReactMarkdown>{suggestion.proposed}</ReactMarkdown>
                        </article>
                    </div>
                </div>

                {/* 采纳并优化结果（内联）*/}
                {refinedContent && (
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                ✨ 优化后结果
                            </p>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={handleCopyRefined}
                                className="h-6 text-xs gap-1"
                            >
                                {copiedRefined ? (
                                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                                ) : (
                                    <Copy className="h-3 w-3" />
                                )}
                                {copiedRefined ? '已复制' : '复制'}
                            </Button>
                        </div>
                        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 p-3">
                            <article className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-p:leading-relaxed">
                                <ReactMarkdown>{refinedContent}</ReactMarkdown>
                            </article>
                        </div>
                    </div>
                )}
                {/* 采纳并优化出错结果（内联）*/}
                {refineError && (
                    <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive whitespace-pre-wrap break-words">
                        <span className="font-semibold">优化出错：</span>{refineError}
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * 建议结果全局视图
 * 渲染摘要 + 建议卡片列表
 */
export function SuggestionsResultView({ result, coreContext }: SuggestionsResultViewProps) {
    return (
        <div className="flex flex-col gap-4 h-full overflow-y-auto p-2">
            {/* 整体摘要 */}
            {result.summary && (
                <div className="rounded-xl border bg-card p-4 shadow-sm">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        分析摘要
                    </p>
                    <article className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown>{result.summary}</ReactMarkdown>
                    </article>
                </div>
            )}

            {/* 建议计数 */}
            {result.suggestions.length > 0 && (
                <p className="text-xs text-muted-foreground px-1">
                    共 <span className="font-semibold text-foreground">{result.suggestions.length}</span> 条建议
                    {result.suggestions.some(s => s.refinePrompt) && (
                        <span className="ml-1">· 部分支持采纳并优化</span>
                    )}
                </p>
            )}

            {/* 建议卡片列表 */}
            {result.suggestions.map((suggestion) => (
                <SuggestionCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    coreContext={coreContext}
                />
            ))}

            {result.suggestions.length === 0 && (
                <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
                    暂无建议
                </div>
            )}
        </div>
    );
}
