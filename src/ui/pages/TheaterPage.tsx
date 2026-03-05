import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Drama, Tag, User, Building2, Heart, Wand2, Flame, Rocket, HatGlasses, Laugh, FerrisWheel, Dice5, FolderOpen, CheckSquare, Square, Download, ChevronLeft, ChevronRight, X, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ShareStoryDialog } from '@/ui/components/ShareStoryDialog';
import { MySharesDialog } from '@/ui/components/MySharesDialog';
import { toast } from 'sonner';

/**
 * 小剧场数据结构（对应 API 返回）
 */
interface StoryItem {
    id: string;
    title: string;
    category: string;
    tags: string[];
    author: string;
    description: string;
    content?: string;
    created_at: string;
}

/** 每页显示条数 */
const PAGE_SIZE = 36;

/**
 * 预定义分类列表
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
 * 分类对应的 Lucide 图标
 */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
    '现代/日常': Building2,
    '情感/恋爱': Heart,
    '奇幻/魔法': Wand2,
    '东方/玄幻': Flame,
    '科幻/未来': Rocket,
    '悬疑/惊悚': HatGlasses,
    '轻松/搞笑': Laugh,
    '同人衍生': FerrisWheel,
    '跑团': Dice5,
    '其他': FolderOpen,
};

/** 获取分类图标组件 */
function CategoryIcon({ category, className }: { category: string; className?: string }) {
    const Icon = CATEGORY_ICONS[category] || FolderOpen;
    return <Icon className={className || 'h-4 w-4'} />;
}

/**
 * 将小剧场数组格式化为 TXT 字符串
 */
function formatStoriesToTxt(stories: StoryItem[]): string {
    return stories.map(s => [
        '### Title',
        `Title: ${s.title}`,
        `Category: ${s.category || ''}`,
        `Desc: ${s.description || ''}`,
        '',
        s.content || '',
    ].join('\n')).join('\n\n');
}

/**
 * 触发浏览器下载文本文件
 */
function downloadTxtFile(content: string, filename: string) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/** 生成时间戳字符串：年月日时分秒 */
/**
 * 带种子的伪随机数生成器（mulberry32）
 */
function mulberry32(seed: number) {
    return function () {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

/**
 * 每日洗牌：使用当天日期作为种子，同一天内顺序固定，每天自动变化
 */
function dailyShuffle<T>(arr: T[]): T[] {
    if (arr.length <= 1) return arr;
    const d = new Date();
    const daySeed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    const rand = mulberry32(daySeed);
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function getTimestamp(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export function TheaterPage() {
    const navigate = useNavigate();
    const [stories, setStories] = useState<StoryItem[]>([]);
    const [activeCategory, setActiveCategory] = useState('全部');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // 分页状态
    const [currentPage, setCurrentPage] = useState(1);

    // 选择模式状态
    const [selectMode, setSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // 导出全部加载状态
    const [exportingAll, setExportingAll] = useState(false);

    // 从 API 获取已审核通过的小剧场列表
    const fetchStories = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/stories');
            if (!res.ok) throw new Error(`请求失败: ${res.status}`);

            // 校验响应是否为 JSON（本地 vite dev 会返回 TS 源码）
            const contentType = res.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                throw new Error('API 尚未就绪。请使用 `npx vercel dev` 启动本地开发服务器，或部署至 Vercel 后访问。');
            }

            const data = await res.json();
            setStories(data);
        } catch (err) {
            console.error('获取小剧场列表失败:', err);
            setError(err instanceof Error ? err.message : '无法加载小剧场列表，请稍后重试');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStories();
    }, [fetchStories]);

    // 统计每个分类有内容的数量
    const categoryCounts = CATEGORIES.reduce((acc, cat) => {
        acc[cat] = stories.filter(s => s.category === cat).length;
        return acc;
    }, {} as Record<string, number>);

    // 只显示有内容的分类
    const visibleCategories = CATEGORIES.filter(cat => categoryCounts[cat] > 0);

    // 每日洗牌 + 按分类筛选
    const shuffledStories = useMemo(() => dailyShuffle(stories), [stories]);
    const filteredStories = activeCategory === '全部'
        ? shuffledStories
        : shuffledStories.filter(s => s.category === activeCategory);

    // 分页计算
    const totalPages = Math.max(1, Math.ceil(filteredStories.length / PAGE_SIZE));
    const safePage = Math.min(currentPage, totalPages);
    const pagedStories = useMemo(() => {
        const start = (safePage - 1) * PAGE_SIZE;
        return filteredStories.slice(start, start + PAGE_SIZE);
    }, [filteredStories, safePage]);

    // 切换分类时重置页码和选择
    const handleCategoryChange = (cat: string) => {
        setActiveCategory(cat);
        setCurrentPage(1);
        setSelectMode(false);
        setSelectedIds(new Set());
    };

    // 切换选择模式
    const toggleSelectMode = () => {
        if (selectMode) {
            setSelectedIds(new Set());
        }
        setSelectMode(!selectMode);
    };

    // 切换单个卡片选中
    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // 全选当前页
    const selectAllPage = () => {
        setSelectedIds(new Set(pagedStories.map(s => s.id)));
    };

    // 导出选中的小剧场
    const handleExportSelected = () => {
        const selected = stories.filter(s => selectedIds.has(s.id));
        if (selected.length === 0) {
            toast.error('请先选择要导出的小剧场');
            return;
        }
        const txt = formatStoriesToTxt(selected);
        downloadTxtFile(txt, `小兔几_小剧场_${getTimestamp()}.txt`);
        toast.success(`已导出 ${selected.length} 个小剧场`);
    };

    // 导出全部（流式）
    const handleExportAll = async () => {
        setExportingAll(true);
        try {
            const res = await fetch('/api/export-all');
            if (!res.ok) throw new Error(`导出失败: ${res.status}`);
            const text = await res.text();
            downloadTxtFile(text, `小兔几_小剧场_${getTimestamp()}.txt`);
            toast.success('已导出全部小剧场');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : '导出失败，请稍后重试');
        } finally {
            setExportingAll(false);
        }
    };

    return (
        <div className="flex flex-col md:flex-row gap-6 min-h-[calc(100vh-120px)]">
            {/* ===== 左侧分类导航栏 ===== */}
            <aside className="w-48 shrink-0 space-y-1 border-r pr-4 bg-muted/20 rounded-l-xl px-3 py-4 hidden md:block">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2 mb-2">
                    剧场分类
                </h3>

                {/* "全部" 分类 */}
                <button
                    onClick={() => handleCategoryChange('全部')}
                    className={`
                        w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors
                        ${activeCategory === '全部'
                            ? 'bg-primary text-primary-foreground font-medium'
                            : 'hover:bg-muted text-foreground'}
                    `}
                >
                    <Drama className="h-4 w-4" />
                    全部
                    <span className="ml-auto text-xs opacity-70">{stories.length}</span>
                </button>

                {/* 各个有内容的分类 */}
                {visibleCategories.map((cat) => (
                    <button
                        key={cat}
                        onClick={() => handleCategoryChange(cat)}
                        className={`
                            w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors
                            ${activeCategory === cat
                                ? 'bg-primary text-primary-foreground font-medium'
                                : 'hover:bg-muted text-foreground'}
                        `}
                    >
                        <CategoryIcon category={cat} className="h-4 w-4" />
                        <span className="truncate">{cat}</span>
                        <span className="ml-auto text-xs opacity-70">{categoryCounts[cat]}</span>
                    </button>
                ))}

                {/* 底部操作按钮 */}
                <div className="pt-4 border-t mt-4 space-y-2">
                    <ShareStoryDialog onShared={fetchStories} />
                    <MySharesDialog />
                </div>
            </aside>

            {/* ===== 右侧内容区 ===== */}
            <main className="flex-1 min-w-0">
                {/* 移动端分类选择器 + 操作按钮 */}
                <div className="md:hidden mb-4 space-y-3">
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        <button
                            onClick={() => handleCategoryChange('全部')}
                            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${activeCategory === '全部'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground'
                                }`}
                        >
                            全部 ({stories.length})
                        </button>
                        {visibleCategories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => handleCategoryChange(cat)}
                                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${activeCategory === cat
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-muted-foreground'
                                    }`}
                            >
                                <CategoryIcon category={cat} className="h-3 w-3 inline" /> {cat} ({categoryCounts[cat]})
                            </button>
                        ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <ShareStoryDialog onShared={fetchStories} />
                        <MySharesDialog />
                    </div>
                </div>

                {/* 标题区 + 操作按钮 */}
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6 mt-2 md:mt-0">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">
                            {activeCategory === '全部'
                                ? <span className="inline-flex items-center gap-2"><Drama className="h-6 w-6" /> 小剧场</span>
                                : <span className="inline-flex items-center gap-2"><CategoryIcon category={activeCategory} className="h-6 w-6" /> {activeCategory}</span>}
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            {activeCategory === '全部'
                                ? '探索社区分享的精彩剧本与场景'
                                : `${activeCategory}分类下共 ${filteredStories.length} 个剧场`}
                        </p>
                    </div>
                    {/* 右侧操作按钮组 */}
                    {!loading && !error && filteredStories.length > 0 && (
                        <div className="flex items-center gap-2">
                            <Button
                                variant={selectMode ? 'default' : 'outline'}
                                size="sm"
                                onClick={toggleSelectMode}
                            >
                                {selectMode ? <X className="h-3.5 w-3.5 mr-1" /> : <CheckSquare className="h-3.5 w-3.5 mr-1" />}
                                {selectMode ? '取消' : '选择'}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleExportAll}
                                disabled={exportingAll}
                            >
                                <Download className="h-3.5 w-3.5 mr-1" />
                                {exportingAll ? '导出中...' : '导出全部'}
                            </Button>
                        </div>
                    )}
                </div>

                {/* 选择模式工具栏 */}
                {selectMode && (
                    <div className="flex items-center gap-3 mb-4 p-3 bg-muted/50 rounded-lg border">
                        <span className="text-sm font-medium">已选 {selectedIds.size} 项</span>
                        <Button variant="ghost" size="sm" onClick={selectAllPage}>
                            全选本页
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                            清除选择
                        </Button>
                        <div className="flex-1" />
                        <Button
                            size="sm"
                            onClick={handleExportSelected}
                            disabled={selectedIds.size === 0}
                        >
                            <Download className="h-3.5 w-3.5 mr-1" />
                            导出选中 ({selectedIds.size})
                        </Button>
                    </div>
                )}

                {/* 加载状态 */}
                {loading && (
                    <div className="flex flex-col justify-center items-center h-64">
                        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
                        <p className="text-sm text-muted-foreground">正在加载小剧场...</p>
                    </div>
                )}

                {/* 错误状态 */}
                {error && !loading && (
                    <div className="flex flex-col justify-center items-center h-64 border-2 border-dashed rounded-lg bg-destructive/5">
                        <p className="text-sm text-destructive font-medium">{error}</p>
                        <button
                            onClick={fetchStories}
                            className="mt-3 text-xs text-primary hover:underline"
                        >
                            点击重试
                        </button>
                    </div>
                )}

                {/* 空状态 */}
                {!loading && !error && filteredStories.length === 0 && (
                    <div className="flex flex-col justify-center items-center h-64 border-2 border-dashed rounded-lg bg-muted/20">
                        <Drama className="h-8 w-8 text-muted-foreground mb-3 opacity-40" />
                        <p className="text-sm font-medium text-muted-foreground">
                            {activeCategory === '全部'
                                ? '暂无小剧场内容，快来分享第一个吧！'
                                : `「${activeCategory}」分类暂无内容`}
                        </p>
                    </div>
                )}

                {/* 卡片网格 */}
                {!loading && !error && pagedStories.length > 0 && (
                    <div className="grid gap-3 grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {pagedStories.map((story) => {
                            const isSelected = selectedIds.has(story.id);
                            return (
                                <div
                                    key={story.id}
                                    onClick={() => {
                                        if (selectMode) {
                                            toggleSelect(story.id);
                                        } else {
                                            navigate(`/theater/${story.id}`);
                                        }
                                    }}
                                    className={`
                                        group relative border rounded-lg p-4 bg-card hover:shadow-md hover:border-primary/30 transition-all duration-200
                                        cursor-pointer flex flex-col
                                        ${isSelected ? 'ring-2 ring-primary border-primary/50 bg-primary/5' : ''}
                                    `}
                                >
                                    {/* 选择 checkbox */}
                                    {selectMode && (
                                        <div className="absolute top-2 right-2">
                                            {isSelected
                                                ? <CheckSquare className="h-4 w-4 text-primary" />
                                                : <Square className="h-4 w-4 text-muted-foreground" />}
                                        </div>
                                    )}

                                    {/* 标题 */}
                                    <h3 className={`font-semibold text-sm leading-tight group-hover:text-primary transition-colors line-clamp-1 mb-2 ${selectMode ? 'pr-6' : ''}`}>
                                        {story.title}
                                    </h3>

                                    {/* 描述（固定两行空间） */}
                                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-3 min-h-[2.5em]">
                                        {story.description || '暂无简介'}
                                    </p>

                                    {/* 底部区域：标签 + 作者/分类，始终贴底对齐 */}
                                    <div className="mt-auto">
                                        {/* 标签 */}
                                        {story.tags && story.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mb-3">
                                                {story.tags.slice(0, 3).map((tag, i) => (
                                                    <span
                                                        key={i}
                                                        className="inline-flex items-center gap-0.5 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full"
                                                    >
                                                        <Tag className="h-2.5 w-2.5" />
                                                        {tag}
                                                    </span>
                                                ))}
                                                {story.tags.length > 3 && (
                                                    <span className="text-[10px] text-muted-foreground">
                                                        +{story.tags.length - 3}
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {/* 底部信息 */}
                                        <div className="flex items-center justify-between pt-2 border-t border-border/50">
                                            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                                                <User className="h-3 w-3" />
                                                <span className="truncate max-w-[80px]">{story.author || '匿名'}</span>
                                            </span>
                                            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                                                <CategoryIcon category={story.category} className="h-3 w-3" />
                                                {story.category}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* 分页控件 */}
                {!loading && !error && filteredStories.length > PAGE_SIZE && (
                    <div className="flex items-center justify-center gap-3 mt-6 pt-4 border-t">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={safePage <= 1}
                        >
                            <ChevronLeft className="h-4 w-4" />
                            上一页
                        </Button>
                        <span className="text-sm text-muted-foreground">
                            第 {safePage} / {totalPages} 页
                            <span className="ml-2 text-xs">（共 {filteredStories.length} 条）</span>
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={safePage >= totalPages}
                        >
                            下一页
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                )}
            </main>
        </div>
    );
}
