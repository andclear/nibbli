import { useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { toolRegistry } from '@/tools';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogClose,
} from '@/components/ui/dialog';
import {
    ArrowRight,
    Wrench,
    Upload,
    Trash2,
    LayoutGrid,
    Puzzle,
    FileText,
    Sparkles,
    Globe,
    Users,
    BookOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import {
    importPlugin,
    removeCustomPlugin,
    CUSTOM_CATEGORY,
} from '@/core/pluginLoader';
import { PromptEditorDialog } from '@/ui/components/PromptEditorDialog';
import type { ToolConfig } from '@/core/types';

/** 分类图标映射 */
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
    '全部': <LayoutGrid className="h-4 w-4" />,
    '文本处理': <FileText className="h-4 w-4" />,
    '角色卡': <Users className="h-4 w-4" />,
    '世界观': <Globe className="h-4 w-4" />,
    '创意生成': <Sparkles className="h-4 w-4" />,
    '知识百科': <BookOpen className="h-4 w-4" />,
    [CUSTOM_CATEGORY]: <Puzzle className="h-4 w-4" />,
    '通用工具': <Wrench className="h-4 w-4" />,
};

/** 获取分类的图标，找不到时用默认 */
function getCategoryIcon(category: string) {
    return CATEGORY_ICONS[category] || <Wrench className="h-4 w-4" />;
}

export function HomePage() {
    const [activeCategory, setActiveCategory] = useState('全部');
    const [, setRefreshKey] = useState(0); // 触发重渲染的计数器

    // 触发组件重渲染
    const refreshTools = useCallback(() => {
        setRefreshKey(k => k + 1);
    }, []);

    // 直接从 registry 派生工具列表（避免 useEffect 中同步 setState）
    const tools = toolRegistry.getAll();
    const categories = toolRegistry.getCategories();

    // 按分类过滤
    const filteredTools = activeCategory === '全部'
        ? tools
        : tools.filter(t => (t.category || '通用工具') === activeCategory);

    // 判断工具是否为自定义插件
    const isCustomPlugin = (tool: ToolConfig) => tool.category === CUSTOM_CATEGORY;

    // 删除自定义插件
    const handleRemovePlugin = async (toolId: string) => {
        try {
            await removeCustomPlugin(toolId);
            toast.success('插件已删除');
            refreshTools();
        } catch {
            toast.error('删除插件失败');
        }
    };

    return (
        <div className="flex flex-col md:flex-row gap-6 min-h-[calc(100vh-120px)]">
            {/* ===== 左侧分类导航栏 ===== */}
            <aside className="hidden md:block w-48 shrink-0 space-y-1 border-r pr-4 bg-muted/20 rounded-l-xl px-3 py-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2 mb-2">
                    工具分类
                </h3>

                {/* "全部" 分类 */}
                <button
                    onClick={() => setActiveCategory('全部')}
                    className={`
                        w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors
                        ${activeCategory === '全部'
                            ? 'bg-primary text-primary-foreground font-medium'
                            : 'hover:bg-muted text-foreground'}
                    `}
                >
                    <LayoutGrid className="h-4 w-4" />
                    全部
                    <span className="ml-auto text-xs opacity-70">{tools.length}</span>
                </button>

                {/* 各个分类 */}
                {categories.map((cat) => {
                    const count = toolRegistry.getByCategory(cat).length;
                    return (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`
                                w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors
                                ${activeCategory === cat
                                    ? 'bg-primary text-primary-foreground font-medium'
                                    : 'hover:bg-muted text-foreground'}
                            `}
                        >
                            {getCategoryIcon(cat)}
                            <span className="truncate">{cat}</span>
                            <span className="ml-auto text-xs opacity-70">{count}</span>
                        </button>
                    );
                })}

                {/* 导入插件入口 */}
                <div className="pt-4 border-t mt-4">
                    <ImportPluginDialog onImported={refreshTools} />
                </div>
            </aside>

            {/* ===== 右侧工具卡片区 ===== */}
            <main className="flex-1 min-w-0">
                {/* 移动端分类选择器 */}
                <div className="md:hidden mb-4 space-y-3">
                    <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                        <button
                            onClick={() => setActiveCategory('全部')}
                            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${activeCategory === '全部'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                }`}
                        >
                            全部 ({tools.length})
                        </button>
                        {categories.map(cat => {
                            const count = toolRegistry.getByCategory(cat).length;
                            return (
                                <button
                                    key={cat}
                                    onClick={() => setActiveCategory(cat)}
                                    className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${activeCategory === cat
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                        }`}
                                >
                                    {getCategoryIcon(cat)} {cat} ({count})
                                </button>
                            );
                        })}
                    </div>
                    {/* 导入插件入口 */}
                    <div className="flex">
                        <ImportPluginDialog onImported={refreshTools} />
                    </div>
                </div>

                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">
                            {activeCategory === '全部' ? '探索工具' : activeCategory}
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            {activeCategory === '全部'
                                ? '选择一个功能模块开始您的创作之旅'
                                : `${activeCategory}分类下共 ${filteredTools.length} 个工具`}
                        </p>
                    </div>
                </div>

                {filteredTools.length === 0 ? (
                    <div className="flex flex-col justify-center items-center h-64 border-2 border-dashed rounded-lg bg-muted/20">
                        <Wrench className="h-8 w-8 text-muted-foreground mb-3 opacity-40" />
                        <p className="text-sm font-medium text-muted-foreground">
                            {activeCategory === CUSTOM_CATEGORY
                                ? '暂无自定义插件，点击左侧「导入插件」添加'
                                : '当前分类暂无工具'}
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {filteredTools.map((tool) => (
                            <div
                                key={tool.id}
                                className="group relative border rounded-lg p-4 bg-card hover:shadow-md hover:border-primary/30 transition-all duration-200"
                            >
                                {/* 右上角操作区：悬浮时显示编辑 + 删除 */}
                                <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                    <PromptEditorDialog tool={tool} triggerVariant="icon" />
                                    {isCustomPlugin(tool) && (
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                handleRemovePlugin(tool.id);
                                            }}
                                            className="p-1 rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors"
                                            title="删除此插件"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>

                                <Link to={tool.id === 'qr_generator' ? '/quick-reply-generator' : `/tool/${tool.id}`} className="block space-y-2">
                                    <div className="flex items-center justify-between mb-2 pr-14">
                                        <h3 className="font-semibold text-sm leading-tight group-hover:text-primary transition-colors truncate">
                                            {tool.name}
                                        </h3>
                                        {/* 作者信息移至标题同行右侧 */}
                                        {tool.author && (
                                            <span className="text-[10px] text-muted-foreground/80 flex items-center gap-1 shrink-0 bg-muted/30 px-1.5 py-0.5 rounded">
                                                <Users className="h-3 w-3" />
                                                <span className="truncate max-w-[80px]">{tool.author}</span>
                                            </span>
                                        )}
                                    </div>

                                    {/* 描述 */}
                                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                        {tool.description}
                                    </p>

                                    {/* 底部信息：分类图标 + 版本 + 箭头 */}
                                    <div className="flex items-center justify-between pt-2">
                                        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                                            {getCategoryIcon(tool.category || '通用工具')}
                                            {tool.category || '通用工具'}
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                                v{tool.version}
                                            </span>
                                            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                                        </div>
                                    </div>
                                </Link>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}

/**
 * 导入插件对话框组件 - 仅支持单 .js 文件
 */
function ImportPluginDialog({ onImported }: { onImported: () => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [jsContent, setJsContent] = useState('');
    const [jsFileName, setJsFileName] = useState('');
    const [importing, setImporting] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const handleImport = async () => {
        if (!jsContent.trim()) { toast.error('请先上传或粘贴 .js 插件文件内容'); return; }
        setImporting(true);
        try {
            const tool = await importPlugin(jsContent);
            toast.success(`插件「${tool.name}」导入成功！`);
            setJsContent(''); setJsFileName(''); setIsOpen(false); onImported();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : '导入失败');
        } finally { setImporting(false); }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="w-full gap-2">
                    <Upload className="h-4 w-4" />
                    导入插件
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>导入第三方插件</DialogTitle>
                    <DialogDescription>
                        上传或粘贴一个 <strong>.js</strong> 插件文件，包含配置、提示词和执行脚本。
                    </DialogDescription>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <BookOpen className="h-3 w-3" />
                        不知道怎么写？
                        <a
                            href="/plugin-doc"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline underline-offset-2 hover:text-primary/80"
                        >
                            查看插件开发文档
                        </a>
                    </p>
                </DialogHeader>

                <div className="space-y-3 py-4">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">插件文件（.js）</span>
                        {jsFileName && <span className="text-xs text-green-600">✓ {jsFileName}</span>}
                    </div>
                    <input ref={fileRef} type="file" accept=".js" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setJsFileName(file.name);
                        const reader = new FileReader();
                        reader.onload = () => setJsContent(reader.result as string);
                        reader.readAsText(file);
                    }} className="hidden" />
                    <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="w-full gap-2">
                        <Upload className="h-3.5 w-3.5" />
                        选择 .js 文件
                    </Button>
                    <textarea
                        value={jsContent}
                        onChange={(e) => setJsContent(e.target.value)}
                        placeholder={'或直接粘贴 .js 内容...\n\n/*---CONFIG---\n{\n    "id": "my_tool",\n    "name": "工具名",\n    "description": "描述",\n    "author": "作者",\n    "inputs": [...]\n}\n---END_CONFIG---*/\n\n/*---PROMPT---\n提示词（支持 Markdown）\n---END_PROMPT---*/\n\n/*---EXECUTE---\nreturn "你的执行代码的返回值";\n---END_EXECUTE---*/'}
                        rows={10}
                        className="w-full rounded-md border bg-muted/30 p-2 text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                        一个文件包含全部内容。提示词区域支持完整 Markdown，包括反引号，无需转义。
                    </p>
                </div>

                <DialogFooter>
                    <DialogClose asChild><Button variant="ghost">取消</Button></DialogClose>
                    <Button onClick={handleImport} disabled={importing || !jsContent.trim()}>
                        {importing ? '导入中...' : '确认导入'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

