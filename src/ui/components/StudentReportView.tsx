import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    BookOpen, Sparkles, Puzzle, Wrench, Quote, GraduationCap, LayoutDashboard,
    ClipboardList, Star, Lightbulb, ArrowRight
} from 'lucide-react';

// ===== 数据类型 =====

export interface StudentReportData {
    report: {
        summary: {
            title: string;
            architecture_type: string;
            complexity_rating: string;
            tags: string[];
            one_sentence_review: string;
        };
        structure_blueprint: {
            mermaid_code: string;
            analysis: string;
            pros_and_cons: string;
        };
        mechanism_breakdown: Array<{
            name: string;
            source_identifier: string;
            how_it_works: string;
            why_it_matters: string;
        }>;
        stitching_guide: {
            description: string;
            recommendations: Array<{
                module_type: string;
                suggested_position: string;
                reasoning: string;
            }>;
        };
        brilliant_snippets: Array<{
            excerpt: string;
            source_identifier: string;
            technique: string;
            analysis: string;
        }>;
        learning_points: Array<{
            concept: string;
            actionable_lesson: string;
        }>;
    };
    /** identifier → 原始 content 映射 */
    originalTexts: Record<string, string>;
}

interface StudentReportViewProps {
    data: StudentReportData;
}

// ===== Mermaid 渲染组件 =====

function MermaidChart({ code }: { code: string }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [svgContent, setSvgContent] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        async function render() {
            try {
                const normalizedCode = sanitizeMermaidCode(code);

                const mermaid = (await import('mermaid')).default;
                mermaid.initialize({
                    startOnLoad: false,
                    theme: 'dark',
                    securityLevel: 'loose',
                    flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' },
                    themeVariables: {
                        fontSize: '16px',
                        fontFamily: 'system-ui, sans-serif',
                        primaryColor: '#374151',
                        primaryTextColor: '#e5e7eb',
                        primaryBorderColor: '#6b7280',
                        lineColor: '#9ca3af',
                        secondaryColor: '#1f2937',
                        tertiaryColor: '#111827',
                        nodeTextColor: '#f3f4f6',
                        clusterBkg: '#1e293b',
                        clusterBorder: '#475569',
                        titleColor: '#f1f5f9',
                    },
                });
                const id = 'mermaid-' + Math.random().toString(36).slice(2, 9);
                const { svg } = await mermaid.render(id, normalizedCode);
                if (!cancelled) {
                    setSvgContent(svg);
                    setError(null);
                }
            } catch (e) {
                if (!cancelled) {
                    console.error('Mermaid 渲染失败:', e);
                    setError('图表渲染失败，以下为原始结构描述');
                }
            }
        }
        render();
        return () => { cancelled = true; };
    }, [code]);

    if (error) {
        return (
            <div className="space-y-2">
                <div className="text-sm text-yellow-500/80">⚠️ {error}</div>
                <pre className="p-3 rounded-lg bg-muted/50 border text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">{code}</pre>
            </div>
        );
    }

    if (!svgContent) {
        return <div className="p-4 text-muted-foreground text-sm animate-pulse">正在渲染架构图...</div>;
    }

    return (
        <div
            ref={containerRef}
            className="w-full overflow-x-auto [&_svg]:mx-auto [&_svg]:max-w-full [&_.nodeLabel]:!text-sm [&_.cluster-label]:!text-base [&_text]:!fill-gray-200"
            style={{ minHeight: '200px' }}
            dangerouslySetInnerHTML={{ __html: svgContent }}
        />
    );
}

/**
 * 健壮的 Mermaid 代码预处理器
 * 逐行分析并修正 AI 生成的常见问题
 */
function sanitizeMermaidCode(raw: string): string {
    // Mermaid 保留关键字集合
    const reservedSet = new Set(['style', 'class', 'click', 'linkstyle', 'classdef', 'callback']);

    // 第一步：确保 end / subgraph 在独立行（JSON 丢失换行的修复）
    let code = raw
        .replace(/([^\n])\b(end)\s*$/gim, '$1\n$2')           // ]end → ]\nend
        .replace(/\]\s*(end)\b/gi, ']\n$1')                    // 紧贴 ] 后的 end
        .replace(/([^\n])\b(subgraph)\b/gi, '$1\n$2');         // 确保 subgraph 前有换行

    // 强制从上到下
    code = code
        .replace(/^graph\s+(LR|RL|BT)/im, 'graph TD')
        .replace(/^flowchart\s+(LR|RL|BT)/im, 'flowchart TD')
        .replace(/direction\s+(LR|RL|BT)/gi, 'direction TB');

    // 第二步：逐行处理节点 ID 问题
    const lines = code.split('\n');
    const processed = lines.map(line => {
        const trimmed = line.trim();

        // 跳过指令行和空行
        if (!trimmed || trimmed.startsWith('graph ') || trimmed.startsWith('flowchart ') ||
            trimmed === 'end' || trimmed.startsWith('subgraph ') ||
            trimmed.startsWith('%%')) {
            return line;
        }

        // 替换数字开头的节点 ID（如 635c000a[...] 或 77c5503b）
        // 匹配模式：行首或箭头后的数字开头标识符
        let fixed = line.replace(/(?<=^|\s|-->|---|--)(\d[a-zA-Z0-9_]*)/g, 'n$1');

        // 替换保留字用作节点 ID 的情况
        // 匹配行首或箭头后的独立单词（后跟 [ 或 ( 或 --> 或空格等）
        fixed = fixed.replace(/(?<=^|\s|-->|---|--)([a-zA-Z_]\w*)(?=\s*[({[]|$|\s*-->)/g, (match) => {
            if (reservedSet.has(match.toLowerCase())) {
                return 'n_' + match;
            }
            return match;
        });

        return fixed;
    });

    return processed.join('\n');
}

// ===== 主组件 =====

export function StudentReportView({ data }: StudentReportViewProps) {
    const { report, originalTexts } = data;
    const [selectedOriginal, setSelectedOriginal] = useState<{ title: string; content: string } | null>(null);

    // 查找原文并弹窗
    const showOriginal = (identifier: string) => {
        const content = originalTexts[identifier];
        setSelectedOriginal({
            title: `原文: ${identifier}`,
            content: content ?? '未找到对应的原文内容'
        });
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto w-full pb-8">

            {/* ═══════ 1. 总览卡片 ═══════ */}
            <Card className="border-t-4 border-t-primary shadow-sm bg-gradient-to-b from-primary/5 to-transparent">
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-xl">
                        <BookOpen className="h-6 w-6 text-primary" />
                        {report.summary?.title || '预设分析报告'}
                    </CardTitle>
                    <p className="text-base text-foreground/90 font-medium pt-2 leading-relaxed">
                        {report.summary?.one_sentence_review}
                    </p>
                </CardHeader>
                <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-2 items-center mb-3">
                        <Badge variant="secondary" className="gap-1">
                            <LayoutDashboard className="w-3 h-3" />
                            {report.summary?.architecture_type}
                        </Badge>
                        <Badge variant="outline" className="gap-1">
                            <Star className="w-3 h-3" />
                            {report.summary?.complexity_rating}
                        </Badge>
                    </div>
                    {report.summary?.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                            {report.summary.tags.map((tag, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                    {tag}
                                </Badge>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ═══════ 2. 架构蓝图 + Mermaid ═══════ */}
            {report.structure_blueprint && (
                <Card className="border shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Puzzle className="h-5 w-5 text-indigo-500" />
                            架构蓝图
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Mermaid 图表 */}
                        {report.structure_blueprint.mermaid_code && (
                            <div className="p-4 rounded-lg bg-muted/30 border">
                                <MermaidChart code={report.structure_blueprint.mermaid_code} />
                            </div>
                        )}
                        {/* 结构分析 */}
                        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 leading-relaxed">
                            <ReactMarkdown>{report.structure_blueprint.analysis}</ReactMarkdown>
                        </div>
                        {/* 优劣势 */}
                        {report.structure_blueprint.pros_and_cons && (
                            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                <span className="font-semibold text-blue-700 dark:text-blue-400 block mb-1.5 text-sm">⚖️ 强项与注意点</span>
                                <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-0.5 text-sm">
                                    <ReactMarkdown>{report.structure_blueprint.pros_and_cons}</ReactMarkdown>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* ═══════ 3. 核心机制拆解 ═══════ */}
            {report.mechanism_breakdown?.length > 0 && (
                <Card className="border shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-amber-500" />
                            核心机制拆解
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {report.mechanism_breakdown.map((mech, idx) => (
                                <div
                                    key={idx}
                                    className="relative p-4 rounded-lg border bg-card hover:shadow-md transition-shadow"
                                >
                                    {/* 原文 Badge */}
                                    {mech.source_identifier && originalTexts[mech.source_identifier] !== undefined && (
                                        <div className="absolute top-3 right-3">
                                            <Badge
                                                variant="outline"
                                                className="cursor-pointer hover:bg-background/80 bg-background/50 shadow-sm transition-colors border-current/20 text-xs"
                                                onClick={() => showOriginal(mech.source_identifier)}
                                            >
                                                <ClipboardList className="w-3 h-3 mr-1 opacity-70" /> 原文
                                            </Badge>
                                        </div>
                                    )}
                                    <h4 className="font-semibold text-sm mb-2 pr-14 flex items-center gap-1.5">
                                        <span className="text-amber-500 font-bold">{idx + 1}.</span>
                                        {mech.name}
                                    </h4>
                                    <div className="text-sm text-muted-foreground space-y-2">
                                        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-0.5">
                                            <ReactMarkdown>{mech.how_it_works}</ReactMarkdown>
                                        </div>
                                        <div className="p-2 rounded bg-orange-500/10 border border-orange-500/15 text-xs">
                                            <span className="font-semibold text-orange-600 dark:text-orange-400">💡 没有它会怎样：</span>
                                            <div className="mt-0.5 prose prose-sm dark:prose-invert max-w-none prose-p:my-0">
                                                <ReactMarkdown>{mech.why_it_matters}</ReactMarkdown>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ═══════ 4. 改装指南 ═══════ */}
            {report.stitching_guide && (
                <Card className="border shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Wrench className="h-5 w-5 text-green-500" />
                            改装指南
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {report.stitching_guide.description}
                        </p>
                        {report.stitching_guide.recommendations?.map((rec, idx) => (
                            <div key={idx} className="p-3 rounded-lg border bg-green-500/5 border-green-500/20">
                                <div className="flex items-center gap-2 mb-1.5">
                                    <Badge variant="secondary" className="text-xs gap-1">
                                        <ArrowRight className="w-3 h-3" />
                                        {rec.module_type}
                                    </Badge>
                                    <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                                        → {rec.suggested_position}
                                    </span>
                                </div>
                                <p className="text-sm text-muted-foreground">{rec.reasoning}</p>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* ═══════ 5. 精彩片段 ═══════ */}
            {report.brilliant_snippets?.length > 0 && (
                <Card className="border shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Quote className="h-5 w-5 text-purple-500" />
                            精彩片段
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {report.brilliant_snippets.map((snippet, idx) => (
                            <div key={idx} className="relative p-4 rounded-lg border bg-purple-500/5 border-purple-500/20">
                                {/* 原文 Badge */}
                                {snippet.source_identifier && originalTexts[snippet.source_identifier] !== undefined && (
                                    <div className="absolute top-3 right-3">
                                        <Badge
                                            variant="outline"
                                            className="cursor-pointer hover:bg-background/80 bg-background/50 shadow-sm transition-colors border-current/20 text-xs"
                                            onClick={() => showOriginal(snippet.source_identifier)}
                                        >
                                            <ClipboardList className="w-3 h-3 mr-1 opacity-70" /> 原文
                                        </Badge>
                                    </div>
                                )}
                                <div className="mb-2">
                                    <Badge className="bg-purple-600/80 text-xs">{snippet.technique}</Badge>
                                </div>
                                <blockquote className="border-l-2 border-purple-500/50 pl-3 italic text-sm text-foreground/80 mb-2">
                                    &ldquo;{snippet.excerpt}&rdquo;
                                </blockquote>
                                <div className="text-sm text-muted-foreground prose prose-sm dark:prose-invert max-w-none prose-p:my-0.5">
                                    <ReactMarkdown>{snippet.analysis}</ReactMarkdown>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* ═══════ 6. 学习收获 ═══════ */}
            {report.learning_points?.length > 0 && (
                <Card className="border shadow-none bg-card">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                            <GraduationCap className="h-5 w-5 text-cyan-500" />
                            学习收获
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-3">
                            {report.learning_points.map((point, i) => (
                                <li key={i} className="flex gap-3 text-sm">
                                    <Lightbulb className="h-4 w-4 text-cyan-500 mt-0.5 shrink-0" />
                                    <div>
                                        <span className="font-semibold text-foreground">{point.concept}</span>
                                        <p className="text-muted-foreground mt-0.5 leading-relaxed">{point.actionable_lesson}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            )}

            {/* ═══════ 原文查看对话框 ═══════ */}
            <Dialog open={!!selectedOriginal} onOpenChange={(v) => !v && setSelectedOriginal(null)}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <BookOpen className="h-5 w-5" />
                            {selectedOriginal?.title}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="mt-4 p-4 rounded-md bg-muted/50 border font-mono text-sm whitespace-pre-wrap break-all">
                        {selectedOriginal?.content || '未提取到该部分的原文内容'}
                    </div>
                    <div className="flex justify-end mt-4">
                        <Button variant="outline" onClick={() => setSelectedOriginal(null)}>关闭</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
