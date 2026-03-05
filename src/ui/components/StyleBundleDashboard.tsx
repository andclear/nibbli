import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Code2, Play, Download, Settings, FileText, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface StyleBundleData {
    worldinfo: {
        key: string;
        content: string;
    } | null;
    regex: string;
    html: string;
    original_text: string;
    formatted_original_text: string;
}

interface Props {
    bundleData: StyleBundleData;
}

// 独立的隔离iframe组件，专门用来渲染危险或不确定的用户自定义布局代码，且能做到自适应高度
function SandboxIframe({ htmlContent }: { htmlContent: string }) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [blobUrl, setBlobUrl] = useState<string>('');

    useEffect(() => {
        // 模拟酒馆核心宏替换机制（ST Macros Mocker）以提高沙盒对于未净化文本模板的容错性，防止原生语法报错
        let safeContent = String(htmlContent);
        safeContent = safeContent.replace(/\{\{\$RANDOM\}\}/g, () => Math.random().toString(36).substring(2, 6));
        safeContent = safeContent.replace(/\{\{user\}\}/gi, "Player");
        safeContent = safeContent.replace(/\{\{char\}\}/gi, "Character");
        safeContent = safeContent.replace(/\{\{original_text\}\}/gi, "Origin Text Content");

        // 构建完整的基础 HTML 文档包裹，确保内部的排版干净且默认带有一些 reset 样式
        // 将沙盒内外做完全切断防止影响宿主Nibbli，只开放脚本执行能力以便支持特效
        const baseHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { margin: 0; padding: 16px; font-family: system-ui, -apple-system, sans-serif; background: transparent; overflow-y: hidden; color: #e2e8f0; }
        * { box-sizing: border-box; }
        /* 提供部分酒馆通用的全局覆盖属性兼容AI */
        details { cursor: pointer; }
    </style>
    <script>
        // 优化：监听高度变化并发送准确的内容高度而非包含多余边距的高度
        const sendHeight = () => {
            const body = document.body;
            const html = document.documentElement;
            // 获取实际元素占用的精确高度
            const height = Math.max(body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight);
            window.parent.postMessage({ type: 'iframeHeight', height }, '*');
        };
        const resizeObserver = new ResizeObserver(sendHeight);
        window.addEventListener('load', () => {
            resizeObserver.observe(document.body);
            sendHeight(); // 初始也发一次
        });
    </script>
</head>
<body>
    ${safeContent}
</body>
</html>`;

        const blob = new Blob([baseHtml], { type: 'text/html' });
        const url = URL.createObjectURL(blob);

        let isActive = true;
        // 使用 setTimeout 避开 React StrictMode 下同步状态更改的警告
        setTimeout(() => {
            if (isActive) {
                setBlobUrl(url);
            }
        }, 0);

        return () => {
            isActive = false;
            URL.revokeObjectURL(url);
        };
    }, [htmlContent]);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'iframeHeight' && iframeRef.current) {
                // 不再额外增加过多 buffer，贴合实际内容
                iframeRef.current.style.height = `${event.data.height}px`;
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    if (!blobUrl) return null;

    return (
        <iframe
            ref={iframeRef}
            src={blobUrl}
            sandbox="allow-scripts allow-same-origin allow-modals allow-popups"
            className="w-full border-none transition-all duration-300"
            style={{ minHeight: '60px' }} // 降低默认占高的存在感
            title="Style Render Sandbox"
        />
    );
}

export function StyleBundleDashboard({ bundleData }: Props) {
    const [viewMode, setViewMode] = useState<'render' | 'apply'>('apply');

    // 计算实际应用后的产出 HTML (模拟酒馆内的正则替换行为)
    const renderAppliedText = () => {
        try {
            if (!bundleData.regex || !bundleData.html) return bundleData.formatted_original_text;
            // 构建匹配模式全局执行替换 (模拟 ST 的 runOnEdit或发送时的行为)
            const regex = new RegExp(bundleData.regex, 'g');
            // 将含有触发标签的原文本通过引擎格式化为目标带风格的内容
            return bundleData.formatted_original_text.replace(regex, bundleData.html);
        } catch (e) {
            console.error("沙盒内正则替换执行失败:", e);
            return bundleData.formatted_original_text;
        }
    };

    const handleCopy = (text: string, title?: string) => {
        if (!text) {
            toast.error('空内容无法复制');
            return;
        }
        navigator.clipboard.writeText(text).then(() => {
            toast.success(`已复制${title ? `：${title}` : '内容'}`);
        });
    };

    const handleDownloadRegex = () => {
        const regexJsonStr = `{
    "id": "${crypto.randomUUID()}",
    "scriptName": "样式引擎_${new Date().getTime()}",
    "findRegex": ${JSON.stringify(bundleData.regex)},
    "replaceString": ${JSON.stringify(bundleData.html)},
    "trimStrings": [],
    "placement": [1, 2],
    "disabled": false,
    "markdownOnly": true,
    "promptOnly": false,
    "runOnEdit": true,
    "substituteRegex": 0,
    "minDepth": null,
    "maxDepth": null
}`;
        // 下方代码使用原生方式下放给用户
        const blob = new Blob([regexJsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `SillyTavern_Regex_StyleEngine.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("已完成正则包独立下载");
    };

    return (
        <div className="flex flex-col space-y-6 max-w-[800px]">
            {/* 顶层区域： 实时沙盒渲染区 */}
            <div className="bg-card border border-border rounded-xl shadow-lg overflow-hidden flex flex-col">
                <div className="flex items-center justify-between p-3 bg-muted/30 border-b">
                    <div className="flex items-center space-x-2">
                        <Play className="w-4 h-4 text-purple-500" />
                        <span className="text-sm font-bold opacity-80">实时效果呈现沙盒</span>
                    </div>
                    <div className="flex bg-muted p-1 rounded-md border text-xs">
                        <button
                            className={`px-3 py-1.5 rounded-sm transition-all ${viewMode === 'apply' ? 'bg-background shadow-sm text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}
                            onClick={() => setViewMode('apply')}
                        >
                            实际应用模式
                        </button>
                        <button
                            className={`px-3 py-1.5 rounded-sm transition-all ${viewMode === 'render' ? 'bg-background shadow-sm text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}
                            onClick={() => setViewMode('render')}
                        >
                            纯代码渲染
                        </button>
                    </div>
                </div>
                {/* 优化：在移动端减少 padding 避免内部被挤压得太窄；移除过高的 min-h 限制 */}
                <div className="relative p-2 sm:p-6 bg-[#1e1e1e]" style={{ backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
                    <SandboxIframe htmlContent={viewMode === 'apply' ? renderAppliedText() : bundleData.html} />
                </div>
            </div >

            {/* 核心配件分发区：分为左右双列陈列配置指导 */}
            < div className="grid grid-cols-1 md:grid-cols-2 gap-4" >

                {/* 左列：引擎部分 (世界书与正则) */}
                < div className="space-y-4" >
                    <div className="bg-card border rounded-xl overflow-hidden shadow-sm flex flex-col">
                        <div className="bg-emerald-500/10 border-b p-3 flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <Settings className="w-4 h-4 text-emerald-500" />
                                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">正则替换引擎</span>
                            </div>
                            <Button size="sm" variant="outline" className="h-7 text-xs border-emerald-500/30 hover:bg-emerald-500/10" onClick={handleDownloadRegex}>
                                <Download className="w-3.5 h-3.5 mr-1" />
                                下载组装包
                            </Button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold opacity-70 flex justify-between">
                                    <span>匹配模式 (Regex)</span>
                                    <span className="text-emerald-500 cursor-pointer hover:underline" onClick={() => handleCopy(bundleData.regex, '匹配模式')}>提取</span>
                                </label>
                                <code className="block p-2 bg-muted/50 rounded-md text-[11px] font-mono break-all text-muted-foreground border">
                                    {bundleData.regex}
                                </code>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold opacity-70 flex justify-between">
                                    <span>样式代码 (HTML)</span>
                                    <span className="text-emerald-500 cursor-pointer hover:underline" onClick={() => handleCopy(bundleData.html, '样式代码')}>提取</span>
                                </label>
                                <div className="p-2 bg-muted/50 rounded-md text-[11px] font-mono text-muted-foreground border max-h-32 overflow-y-auto whitespace-pre-wrap">
                                    {bundleData.html}
                                </div>
                            </div>
                        </div>
                    </div>
                </div >

                {/* 右列：指导部分 (世界书与应用排版样例) */}
                < div className="space-y-4" >
                    {/* 世界书部分 */}
                    < div className="bg-card border rounded-xl overflow-hidden shadow-sm flex flex-col" >
                        <div className="bg-purple-500/10 border-b p-3 flex items-center">
                            <FileText className="w-4 h-4 text-purple-500 mr-2" />
                            <span className="text-sm font-bold text-purple-600 dark:text-purple-400">生成动作世界书规则</span>
                        </div>
                        <div className="p-4 space-y-4">
                            {bundleData.worldinfo ? (
                                <>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold opacity-70 flex justify-between">
                                            <span>世界书名称</span>
                                            <span className="text-purple-500 cursor-pointer hover:underline" onClick={() => handleCopy(bundleData.worldinfo?.key || '', '世界书名称')}>复制</span>
                                        </label>
                                        <div className="text-sm px-3 py-2 bg-muted/50 rounded-md border font-medium">
                                            {bundleData.worldinfo.key}
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold opacity-70 flex justify-between">
                                            <span>世界书正文</span>
                                            <span className="text-purple-500 cursor-pointer hover:underline" onClick={() => handleCopy(bundleData.worldinfo?.content || '', '世界书正文')}>复制</span>
                                        </label>
                                        <div className="p-2 bg-muted/50 rounded-md text-sm border max-h-40 overflow-y-auto whitespace-pre-wrap leading-relaxed text-muted-foreground">
                                            {bundleData.worldinfo.content}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="py-6 flex flex-col items-center justify-center opacity-60 text-sm space-y-2">
                                    <CheckCircle2 className="w-6 h-6" />
                                    <p>无需特设世界书</p>
                                    <p className="text-xs text-center">当前采用简单触发机制，依靠原生正则已达转换目的。</p>
                                </div>
                            )}
                        </div>
                    </div >
                </div >

                {/* 副列整排：映射对照与应用测试文本 */}
                < div className="col-span-1 md:col-span-2 bg-card border rounded-xl overflow-hidden shadow-sm" >
                    <div className="bg-muted/40 border-b p-3 flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <Code2 className="w-4 h-4 text-amber-500 opacity-80" />
                            <span className="text-sm font-bold opacity-80">代码变量映射对照档</span>
                        </div>
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-500/10" onClick={() => handleCopy(bundleData.formatted_original_text, '测试用应用文本')}>
                            <Copy className="w-3.5 h-3.5 mr-1" />
                            复制应用文本
                        </Button>
                    </div>
                    <div className="p-4 text-sm text-foreground/80 space-y-3">
                        <div>
                            <p className="text-xs font-bold mb-1 opacity-70">带完整正则触发结构的应用文本 (Formatted Original Text):</p>
                            <pre className="p-3 bg-foreground/5 dark:bg-black/40 rounded-lg text-[12px] font-mono break-words whitespace-pre-wrap border overflow-x-auto">
                                {bundleData.formatted_original_text}
                            </pre>
                        </div>
                    </div>
                </div >
            </div >
        </div >
    );
}
