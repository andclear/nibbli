import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Copy, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import type { CoreContext, ToolSuggestionsResult } from '@/core/types';
import { SuggestionsResultView } from './SuggestionsResultView';
import { WorldInfoInteractiveCard } from './WorldInfoInteractiveCard';
import { StyleBundleDashboard } from './StyleBundleDashboard';
import { DoctorReportView, type DoctorReportData } from './DoctorReportView';
import { StudentReportView, type StudentReportData } from './StudentReportView';

interface ResultPreviewProps {
    result: unknown;
    error?: Error | null;
    /** 注入核心上下文，供建议卡片的采纳并优化二次调用使用 */
    coreContext?: CoreContext;
}

/** 判断结果是否为两阶段建议结果 */
function isSuggestionsResult(val: unknown): val is ToolSuggestionsResult {
    return (
        typeof val === 'object' &&
        val !== null &&
        (val as Record<string, unknown>)['_type'] === 'suggestions'
    );
}

export function ResultPreview({ result, error, coreContext }: ResultPreviewProps) {
    const [copied, setCopied] = React.useState(false);
    const [expanded, setExpanded] = React.useState(false);

    // 最大初始渲染字符数限制
    const INITIAL_MAX_LENGTH = 5000;

    const { contentString, isMarkdown } = React.useMemo(() => {
        if (result === undefined || result === null) {
            return { contentString: '', isMarkdown: false };
        }
        if (isSuggestionsResult(result)) {
            return { contentString: '', isMarkdown: false };
        }
        if (typeof result === 'string') {
            return { contentString: result, isMarkdown: true };
        }
        if (typeof result === 'object') {
            return { contentString: JSON.stringify(result, null, 2), isMarkdown: false };
        }
        return { contentString: String(result), isMarkdown: false };
    }, [result]);

    const { displayContent, regexDownloadData, worldInfoData, styleBundleData, doctorReportData, studentReportData } = React.useMemo(() => {
        const source = contentString;
        // 收集需要从原文中移除的区间 [start, end)
        const removals: Array<[number, number]> = [];

        /**
         * 健壮的宏 JSON 提取器
         * 原理：找到宏前缀后，用花括号计数定位完整的 JSON 对象边界，
         * 避免 JSON 内容中包含 ">>" 字符（如 Mermaid 的 "-->"）导致正则提前截断。
         * 不修改外部变量，而是记录需要移除的区间。
         */
        function extractMacroJson<T>(macroName: string): T | null {
            const prefix = `<<${macroName}:`;
            const startIdx = source.indexOf(prefix);
            if (startIdx === -1) return null;

            // 跳过前缀和空格，找到 JSON 起始的 '{'
            let jsonStart = startIdx + prefix.length;
            while (jsonStart < source.length && source[jsonStart] !== '{') jsonStart++;
            if (jsonStart >= source.length) return null;

            // 花括号计数器，跳过字符串内的花括号
            let depth = 0;
            let inString = false;
            let escape = false;
            let jsonEnd = jsonStart;

            for (let i = jsonStart; i < source.length; i++) {
                const ch = source[i];
                if (escape) { escape = false; continue; }
                if (ch === '\\' && inString) { escape = true; continue; }
                if (ch === '"') { inString = !inString; continue; }
                if (inString) continue;
                if (ch === '{') depth++;
                if (ch === '}') { depth--; if (depth === 0) { jsonEnd = i; break; } }
            }

            if (depth !== 0) return null;

            const jsonStr = source.substring(jsonStart, jsonEnd + 1);
            // 计算宏的完整区间（前缀 + JSON + 可能的尾部 ">>"）
            let macroEnd = jsonEnd + 1;
            while (macroEnd < source.length && source[macroEnd] === ' ') macroEnd++;
            if (source.substring(macroEnd, macroEnd + 2) === '>>') macroEnd += 2;
            removals.push([startIdx, macroEnd]);

            try {
                return JSON.parse(jsonStr) as T;
            } catch (e) {
                console.error(`解析宏 ${macroName} 失败`, e);
                return null;
            }
        }

        // 依次提取各工具宏
        const regexData = extractMacroJson<Record<string, unknown>>('NIBBLI_DOWNLOAD_REGEX_JSON');
        const pWorldInfoData = extractMacroJson<{ entries: Array<{ comment: string, content: string }>, initialSystemPrompt: string }>('NIBBLI_WORLD_INFO_INTERACTIVE');
        const pStyleBundleData = extractMacroJson<{ worldinfo: { key: string; content: string } | null; regex: string; html: string; original_text: string; formatted_original_text: string }>('NIBBLI_STYLE_BUNDLE');
        const pDoctorReportData = extractMacroJson<DoctorReportData>('NIBBLI_DOCTOR_REPORT');
        const pStudentReportData = extractMacroJson<StudentReportData>('NIBBLI_STUDENT_REPORT');

        // 从原文中一次性移除所有宏区间，生成 displayContent
        let text = source;
        if (removals.length > 0) {
            // 按起始位置倒序排列，从后向前移除以保持索引不变
            removals.sort((a, b) => b[0] - a[0]);
            for (const [start, end] of removals) {
                text = text.substring(0, start) + text.substring(end);
            }
            text = text.trim();
        }

        return {
            displayContent: text,
            regexDownloadData: regexData,
            worldInfoData: pWorldInfoData,
            styleBundleData: pStyleBundleData,
            doctorReportData: pDoctorReportData,
            studentReportData: pStudentReportData
        };
    }, [contentString]);

    const isLongContent = displayContent.length > INITIAL_MAX_LENGTH;
    const finalDisplay = (isLongContent && !expanded) ? displayContent.substring(0, INITIAL_MAX_LENGTH) + '\n\n... (内容过长已折叠)' : displayContent;

    // 当结果改变时重置展开状态
    React.useEffect(() => {
        setExpanded(false);
    }, [result]);

    if (error) {
        return (
            <div className="p-4 border border-red-200 bg-red-50 rounded-lg text-red-900 w-full h-full">
                <h3 className="text-lg font-bold mb-2">执行遇到错误</h3>
                <pre className="whitespace-pre-wrap text-sm">{error.message}</pre>
            </div>
        );
    }

    if (result === undefined || result === null) {
        return (
            <div className="flex items-center justify-center h-full min-h-[300px] text-muted-foreground border-2 border-dashed rounded-xl bg-muted/10">
                等待执行结果...
            </div>
        );
    }

    // 建议卡片渲染路径
    if (isSuggestionsResult(result) && coreContext) {
        return (
            <div className="flex flex-col h-full border rounded-xl bg-background overflow-hidden shadow-sm">
                <div className="flex items-center px-4 py-2 border-b bg-muted/30">
                    <span className="text-sm font-semibold text-muted-foreground">建议结果</span>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                    <SuggestionsResultView result={result} coreContext={coreContext} />
                </div>
            </div>
        );
    }

    // 交互式世界观卡片渲染路径 (独占式接管)
    if (worldInfoData && coreContext) {
        return (
            <div className="flex flex-col h-full border rounded-xl bg-background overflow-hidden shadow-sm">
                <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
                    <span className="text-sm font-semibold text-muted-foreground">档案记录板 (Archive Log)</span>
                </div>
                <div className="flex-1 overflow-y-auto bg-muted/10 p-4">
                    <WorldInfoInteractiveCard initialData={worldInfoData} coreContext={coreContext} />
                </div>
            </div>
        );
    }

    // 小皮医生卡片专属渲染路径 (独占式接管)
    if (doctorReportData) {
        return (
            <div className="flex flex-col h-full border rounded-xl bg-background overflow-hidden relative shadow-sm">
                <div className="flex-1 overflow-y-auto bg-muted/10 p-4 border-b">
                    <DoctorReportView data={doctorReportData} />
                </div>
            </div>
        );
    }

    // 小皮书童卡片专属渲染路径 (独占式接管)
    if (studentReportData) {
        return (
            <div className="flex flex-col h-full border rounded-xl bg-background overflow-hidden relative shadow-sm">
                <div className="flex-1 overflow-y-auto bg-muted/10 p-4 border-b">
                    <StudentReportView data={studentReportData} />
                </div>
            </div>
        );
    }

    const handleCopy = () => {
        navigator.clipboard.writeText(displayContent).then(() => {
            setCopied(true);
            toast.success('已复制到剪贴板');
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div className="flex flex-col h-full border rounded-xl bg-background overflow-hidden relative group shadow-sm">
            <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
                <span className="text-sm font-semibold text-muted-foreground">执行结果</span>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                    onClick={handleCopy}
                >
                    {copied ? (
                        <>
                            <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                            已复制
                        </>
                    ) : (
                        <>
                            <Copy className="mr-2 h-4 w-4" />
                            复制内容
                        </>
                    )}
                </Button>
            </div>
            <div className="flex-1 p-3 md:p-6 overflow-y-auto relative flex flex-col">
                {isMarkdown ? (
                    <article className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-muted/50 prose-pre:text-foreground prose-pre:whitespace-pre-wrap prose-pre:break-words">
                        <ReactMarkdown>{finalDisplay}</ReactMarkdown>
                    </article>
                ) : (
                    <pre className="text-sm font-mono whitespace-pre-wrap break-all">{finalDisplay}</pre>
                )}

                {styleBundleData && (
                    <StyleBundleDashboard bundleData={styleBundleData} />
                )}

                {isLongContent && !expanded && !worldInfoData && !styleBundleData && displayContent && (
                    <div className={`relative ${isLongContent && !expanded ? 'max-h-[800px] overflow-hidden' : ''} w-full pt-16 pb-2 bg-gradient-to-t from-background to-transparent flex justify-center mt-[-60px]`}>
                        <Button
                            variant="secondary"
                            size="sm"
                            className="shadow-md"
                            onClick={() => setExpanded(true)}
                        >
                            显示完整内容
                        </Button>
                    </div>
                )}

                {regexDownloadData && (
                    <div className="mt-8 pt-6 border-t border-border/50">
                        <RegexDownloadCard initialData={regexDownloadData} />
                    </div>
                )}
            </div>
        </div>
    );
}

// 提取的专属正则脚本下载编辑卡片组件
function RegexDownloadCard({ initialData }: { initialData: Record<string, unknown> }) {
    const defaultName = typeof initialData.scriptName === 'string' ? initialData.scriptName : '未命名正则脚本';
    const [scriptName, setScriptName] = React.useState(defaultName);

    const handleDownload = () => {
        const finalData = { ...initialData, scriptName };
        const blob = new Blob([JSON.stringify(finalData, null, 4)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        // 防乱码处理：使用 encodeURIComponent 保证多语言文件名不变形，或直接直接依赖系统保存
        a.download = `${scriptName}-regex.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('脚本已下载');
    };

    const handleCopyRegex = () => {
        if (initialData.findRegex) {
            navigator.clipboard.writeText(String(initialData.findRegex)).then(() => {
                toast.success('已复制正则表达式');
            });
        }
    };

    const handleCopyReplace = () => {
        if (initialData.replaceString !== undefined) {
            navigator.clipboard.writeText(String(initialData.replaceString)).then(() => {
                toast.success('已复制替换内容');
            });
        }
    };

    return (
        <div className="p-5 border rounded-lg bg-card shadow-sm space-y-4">
            <div className="flex items-center space-x-2">
                <span className="text-xl">🛠️</span>
                <h4 className="text-sm font-bold">保存并导出为酒馆正则脚本</h4>
            </div>
            <div className="flex items-end gap-3 max-w-lg">
                <div className="flex-1 space-y-1">
                    <label className="text-xs font-medium text-muted-foreground block">脚本名称 (可修改)</label>
                    <input
                        type="text"
                        value={scriptName}
                        onChange={(e) => setScriptName(e.target.value)}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                </div>
                <Button onClick={handleDownload} variant="default" className="shrink-0 h-9">
                    下载脚本 (.json)
                </Button>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                <Button onClick={handleCopyRegex} variant="outline" size="sm" className="h-8 text-xs">
                    <Copy className="mr-1.5 h-3 w-3" />
                    复制正则表达式
                </Button>
                <Button onClick={handleCopyReplace} variant="outline" size="sm" className="h-8 text-xs">
                    <Copy className="mr-1.5 h-3 w-3" />
                    复制替换内容
                </Button>
            </div>
        </div>
    );
}
