import { useState, useRef, useCallback } from 'react';
import { Upload, Send, Plus, FileUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { db } from '@/core/db';

/**
 * 预定义分类列表（与 TheaterPage 保持一致）
 */
const CATEGORIES = [
    '现代/日常',
    '情感/恋爱',
    '奇幻/魔法',
    '东方/玄幻',
    '科幻/未来',
    '悬疑/惊悚',
    '轻松/搞笑',
    '同人衍生',
    '跑团',
    '其他',
];

/**
 * 解析后的小剧场条目
 */
interface ParsedStory {
    title: string;
    category: string;
    description: string;
    content: string;
    tags?: string[];
}

interface Props {
    onShared: () => void;
}

/**
 * 解析 TXT 文件内容为小剧场条目数组
 */
function parseTxtContent(text: string): ParsedStory[] {
    const stories: ParsedStory[] = [];
    // 统一换行符：Windows(\r\n) 和旧 Mac(\r) 全部转为 \n，避免正则匹配失败
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    // 按 "### Title" 分割多个小剧场
    const blocks = normalized.split(/(?=^### Title)/m).filter(b => b.trim());

    for (const block of blocks) {
        const lines = block.split('\n');
        let title = '';
        let category = '';
        let desc = '';
        const contentLines: string[] = [];
        let inContent = false;

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('### Title')) continue;

            if (!inContent) {
                if (trimmed.startsWith('Title:')) {
                    title = trimmed.replace(/^Title:\s*/, '');
                } else if (trimmed.startsWith('Category:')) {
                    category = trimmed.replace(/^Category:\s*/, '');
                } else if (trimmed.startsWith('Desc:')) {
                    desc = trimmed.replace(/^Desc:\s*/, '');
                } else if (trimmed === '') {
                    // 空行后面是内容区
                    if (title) inContent = true;
                }
            } else {
                contentLines.push(line);
            }
        }

        if (title && contentLines.length > 0) {
            // TXT 批量上传时，category 作为 tag 存入，分类不指定
            const tags = category ? [category] : [];
            stories.push({
                title,
                category: 'null',
                description: desc,
                content: contentLines.join('\n').trim(),
                tags,
            });
        }
    }

    return stories;
}

export function ShareStoryDialog({ onShared }: Props) {
    const [open, setOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'upload' | 'manual'>('manual');
    const [submitting, setSubmitting] = useState(false);

    // 共享状态：署名（两个 Tab 通用）
    const [authorName, setAuthorName] = useState('');

    // 批量上传状态
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [parsedStories, setParsedStories] = useState<ParsedStory[]>([]);
    const [fileName, setFileName] = useState('');

    // 手动填写状态
    const [manualTitle, setManualTitle] = useState('');
    const [manualCategory, setManualCategory] = useState(CATEGORIES[0]);
    const [manualDesc, setManualDesc] = useState('');
    const [manualContent, setManualContent] = useState('');

    // 处理文件上传
    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith('.txt')) {
            toast.error('仅支持 TXT 格式文件');
            return;
        }

        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = () => {
            const text = reader.result as string;
            const parsed = parseTxtContent(text);
            setParsedStories(parsed);
            if (parsed.length === 0) {
                toast.error('未能从文件中解析出有效的小剧场内容');
            } else {
                toast.success(`成功解析 ${parsed.length} 个小剧场`);
            }
        };
        reader.readAsText(file);
    }, []);

    // 提交分享（注入署名）
    const handleSubmit = async (stories: ParsedStory[]) => {
        if (stories.length === 0 || !authorName.trim()) return;
        setSubmitting(true);
        try {
            // 为每条小剧场注入署名
            const storiesWithAuthor = stories.map(s => ({ ...s, author: authorName.trim() }));
            const res = await fetch('/api/share', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(storiesWithAuthor),
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `请求失败: ${res.status}`);
            }
            const data = await res.json();

            // 存入 IndexedDB
            for (const item of data.stories) {
                await db.sharedStories.put({
                    id: item.id,
                    title: item.title,
                    sharedAt: Date.now(),
                });
            }

            toast.success(`成功分享 ${data.count} 个小剧场！`);
            setOpen(false);
            onShared();
            // 重置状态
            setParsedStories([]);
            setFileName('');
            setManualTitle('');
            setManualDesc('');
            setManualContent('');
            setAuthorName('');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : '分享失败，请稍后重试');
        } finally {
            setSubmitting(false);
        }
    };

    // 处理拖拽
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (!file) return;
        if (!file.name.endsWith('.txt')) {
            toast.error('仅支持 TXT 格式文件');
            return;
        }
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = () => {
            const text = reader.result as string;
            const parsed = parseTxtContent(text);
            setParsedStories(parsed);
            if (parsed.length === 0) {
                toast.error('未能从文件中解析出有效的小剧场内容');
            } else {
                toast.success(`成功解析 ${parsed.length} 个小剧场`);
            }
        };
        reader.readAsText(file);
    }, []);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="w-full justify-start gap-2">
                    <Upload className="h-4 w-4" />
                    分享小剧场
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>分享小剧场</DialogTitle>
                    <DialogDescription>
                        通过批量上传或手动填写的方式分享你的剧本
                    </DialogDescription>
                </DialogHeader>

                {/* 署名（两个 Tab 共享） */}
                <div className="mb-4">
                    <label className="text-sm font-medium mb-1.5 block">署名 *</label>
                    <input
                        type="text"
                        value={authorName}
                        onChange={(e) => setAuthorName(e.target.value)}
                        placeholder="请输入您的署名"
                        className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                </div>

                {/* Tab 切换（手动填写在前） */}
                <div className="flex gap-1 bg-muted p-1 rounded-lg mb-4">
                    <button
                        onClick={() => setActiveTab('manual')}
                        className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'manual'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        <Plus className="h-3.5 w-3.5 inline mr-1.5" />
                        手动填写
                    </button>
                    <button
                        onClick={() => setActiveTab('upload')}
                        className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'upload'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        <FileUp className="h-3.5 w-3.5 inline mr-1.5" />
                        批量上传
                    </button>
                </div>

                {/* 手动填写 Tab（在前） */}
                {activeTab === 'manual' && (
                    <div className="space-y-4">
                        {/* 标题 */}
                        <div>
                            <label className="text-sm font-medium mb-1.5 block">标题 *</label>
                            <input
                                type="text"
                                value={manualTitle}
                                onChange={(e) => setManualTitle(e.target.value)}
                                placeholder="输入小剧场标题"
                                className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                        </div>

                        {/* 分类 */}
                        <div>
                            <label className="text-sm font-medium mb-1.5 block">分类 *</label>
                            <select
                                value={manualCategory}
                                onChange={(e) => setManualCategory(e.target.value)}
                                className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                            >
                                {CATEGORIES.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>

                        {/* 简介（必填） */}
                        <div>
                            <label className="text-sm font-medium mb-1.5 block">简介 *</label>
                            <input
                                type="text"
                                value={manualDesc}
                                onChange={(e) => setManualDesc(e.target.value)}
                                placeholder="请输入简介"
                                className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                        </div>

                        {/* 内容 */}
                        <div>
                            <label className="text-sm font-medium mb-1.5 block">内容 *</label>
                            <textarea
                                value={manualContent}
                                onChange={(e) => setManualContent(e.target.value)}
                                placeholder="粘贴或撰写小剧场内容..."
                                rows={8}
                                className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
                            />
                        </div>

                        <Button
                            onClick={() => handleSubmit([{
                                title: manualTitle,
                                category: manualCategory,
                                description: manualDesc,
                                content: manualContent,
                                tags: [manualCategory],
                            }])}
                            disabled={!authorName.trim() || !manualTitle || !manualDesc || !manualContent || submitting}
                            className="w-full"
                        >
                            <Send className="h-4 w-4 mr-2" />
                            {submitting ? '提交中...' : '分享小剧场'}
                        </Button>
                    </div>
                )}

                {/* 批量上传 Tab */}
                {activeTab === 'upload' && (
                    <div className="space-y-4">
                        {/* 格式说明（折叠） */}
                        <details className="text-xs text-muted-foreground bg-muted/50 rounded-lg">
                            <summary className="px-3 py-2 cursor-pointer select-none font-medium hover:text-foreground transition-colors">
                                参考格式（点击展开）
                            </summary>
                            <div className="px-3 pb-3 pt-1 space-y-2">
                                <p className="text-[10px]">
                                    （酒馆中推荐使用回声小剧场 - <a href="https://discord.com/channels/1291925535324110879/1449044528408428676/0" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">旅程社区获取</a>）
                                </p>
                                <pre className="bg-background/50 p-2 rounded text-[11px] font-mono leading-relaxed">
                                    {`### Title
Title: [标题]
Category: [分类]
Desc: [简介]

[Content]`}
                                </pre>
                            </div>
                        </details>

                        {/* 拖拽上传区 */}
                        <div
                            onDrop={handleDrop}
                            onDragOver={(e) => e.preventDefault()}
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors"
                        >
                            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2 opacity-50" />
                            <p className="text-sm text-muted-foreground">
                                {fileName ? `已选择：${fileName}` : '点击上传或拖拽 TXT 文件到此处'}
                            </p>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".txt"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                        </div>

                        {/* 解析预览 */}
                        {parsedStories.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-sm font-medium">解析结果（共 {parsedStories.length} 条）</p>
                                <div className="max-h-60 overflow-y-auto space-y-1.5">
                                    {parsedStories.map((s, i) => (
                                        <div key={i} className="text-xs bg-muted/30 p-2.5 rounded space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold truncate flex-1">{s.title}</span>
                                            </div>
                                            {s.description && (
                                                <p className="text-muted-foreground line-clamp-1">{s.description}</p>
                                            )}
                                            {s.tags && s.tags.length > 0 && (
                                                <div className="flex gap-1 flex-wrap">
                                                    {s.tags.map((tag, j) => (
                                                        <span key={j} className="bg-primary/10 text-primary px-1.5 py-0.5 rounded-full text-[10px]">{tag}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <Button
                            onClick={() => handleSubmit(parsedStories)}
                            disabled={!authorName.trim() || parsedStories.length === 0 || submitting}
                            className="w-full"
                        >
                            <Send className="h-4 w-4 mr-2" />
                            {submitting ? '提交中...' : `分享 ${parsedStories.length} 个小剧场`}
                        </Button>
                    </div>
                )}


            </DialogContent>
        </Dialog>
    );
}
