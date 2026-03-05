import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '@/core/db';
import { toolRegistry } from '@/tools';
import type { ExecutionHistory } from '@/core/db';
import { ResultPreview } from '@/ui/components/ResultPreview';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    History,
    RotateCcw,
    Trash2,
    ChevronDown,
    ChevronUp,
    CheckCircle2,
    XCircle,
    Clock,
    Inbox,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCoreContext } from '@/core/useCoreContext';

/** 格式化相对时间 */
function formatRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} 天前`;
    if (hours > 0) return `${hours} 小时前`;
    if (minutes > 0) return `${minutes} 分钟前`;
    return '刚刚';
}

/** 格式化完整时间 */
function formatDateTime(timestamp: number): string {
    return new Date(timestamp).toLocaleString('zh-CN', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
}

/** 单条历史记录卡片 */
function HistoryCard({
    record,
    toolName,
    onRerun,
    onDelete,
}: {
    record: ExecutionHistory;
    toolName: string;
    onRerun: () => void;
    onDelete: () => void;
}) {
    const coreContext = useCoreContext();
    const [expanded, setExpanded] = useState(false);

    return (
        <div className={`border rounded-xl bg-card overflow-hidden transition-all shadow-sm ${expanded ? 'shadow-md' : ''}`}>
            {/* 卡片头部：点击展开/收起（用 div 避免 button 嵌套 button） */}
            <div
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors text-left cursor-pointer"
                role="button"
                tabIndex={0}
                onClick={() => setExpanded(v => !v)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(v => !v); } }}
            >
                <div className="flex items-center gap-3 min-w-0">
                    {/* 状态图标 */}
                    {record.status === 'success' ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    ) : (
                        <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                    )}

                    {/* 工具名称 */}
                    <span className="font-semibold text-sm truncate">{toolName}</span>

                    {/* 状态徽章 */}
                    <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${record.status === 'success'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                        }`}>
                        {record.status === 'success' ? '成功' : '失败'}
                    </span>
                </div>

                <div className="flex items-center gap-3 shrink-0 ml-3">
                    <span className="text-xs text-muted-foreground flex items-center gap-1" title={formatDateTime(record.timestamp)}>
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(record.timestamp)}
                    </span>
                    <button
                        className="p-1 rounded-md text-muted-foreground/50 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                        title="删除此条记录"
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    {expanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                </div>
            </div>

            {/* 展开详情区 */}
            {expanded && (
                <div className="border-t">
                    {/* 操作栏 */}
                    <div className="flex items-center justify-between px-4 py-2 bg-muted/20">
                        <span className="text-xs text-muted-foreground">{formatDateTime(record.timestamp)}</span>
                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                            >
                                <Trash2 className="h-3 w-3" />
                                删除
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1.5"
                                onClick={(e) => { e.stopPropagation(); onRerun(); }}
                            >
                                <RotateCcw className="h-3 w-3" />
                                重新执行
                            </Button>
                        </div>
                    </div>

                    {/* 输入参数 */}
                    <div className="px-4 py-3 border-t">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">输入参数</p>
                        <div className="space-y-1.5">
                            {Object.entries(record.inputs).map(([key, val]) => {
                                // File 对象序列化后为空对象，需提示
                                const displayVal = val instanceof File
                                    ? `[文件: ${val.name}]`
                                    : typeof val === 'string'
                                        ? val || '（空）'
                                        : JSON.stringify(val);
                                return (
                                    <div key={key} className="flex gap-2 text-xs">
                                        <span className="font-mono text-muted-foreground shrink-0">{key}:</span>
                                        <span className="break-all text-foreground/80 line-clamp-3">{displayVal}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* 执行结果 */}
                    <div className="px-4 pb-4 border-t pt-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">执行结果</p>
                        {record.status === 'error' ? (
                            <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 p-3 text-sm text-red-700 dark:text-red-400">
                                {record.errorMessage || '未知错误'}
                            </div>
                        ) : (
                            <div className="min-h-[120px] max-h-[400px] overflow-y-auto">
                                <ResultPreview result={record.result} coreContext={coreContext} />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * 历史记录页面
 */
export function HistoryPage() {
    const navigate = useNavigate();
    const [records, setRecords] = useState<ExecutionHistory[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterTool, setFilterTool] = useState<string>('__all__');
    const [filterStatus, setFilterStatus] = useState<string>('__all__');
    const [clearDialogOpen, setClearDialogOpen] = useState(false);
    const [clearing, setClearing] = useState(false);

    // 获取所有执行记录（按时间倒序）
    const loadRecords = async () => {
        setLoading(true);
        try {
            const all = await db.history.orderBy('timestamp').reverse().toArray();
            setRecords(all);
        } catch (err) {
            console.error('加载历史记录失败:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRecords();
    }, []);

    // 工具 ID → 名称映射
    const toolNameMap = useMemo(() => {
        const map: Record<string, string> = {};
        for (const r of records) {
            if (!map[r.toolId]) {
                const tool = toolRegistry.getById(r.toolId);
                map[r.toolId] = tool?.name ?? r.toolId;
            }
        }
        return map;
    }, [records]);

    // 去重工具选项
    const toolOptions = useMemo(() => {
        const seen = new Set<string>();
        const opts: { id: string; name: string }[] = [];
        for (const r of records) {
            if (!seen.has(r.toolId)) {
                seen.add(r.toolId);
                opts.push({ id: r.toolId, name: toolNameMap[r.toolId] ?? r.toolId });
            }
        }
        return opts;
    }, [records, toolNameMap]);

    // 筛选后的记录
    const filteredRecords = useMemo(() => {
        return records.filter(r => {
            if (filterTool !== '__all__' && r.toolId !== filterTool) return false;
            if (filterStatus !== '__all__' && r.status !== filterStatus) return false;
            return true;
        });
    }, [records, filterTool, filterStatus]);

    // 重新执行：跳转并携带历史 inputs
    const handleRerun = (record: ExecutionHistory) => {
        navigate(`/tool/${record.toolId}`, {
            state: { prefillInputs: record.inputs },
        });
    };

    // 清空历史
    const handleClearAll = async () => {
        setClearing(true);
        try {
            await db.history.clear();
            setRecords([]);
            toast.success('历史记录已清空');
            setClearDialogOpen(false);
        } catch {
            toast.error('清空失败，请重试');
        } finally {
            setClearing(false);
        }
    };

    // 删除单条记录
    const handleDeleteSingle = async (id: number) => {
        try {
            await db.history.delete(id);
            setRecords(prev => prev.filter(r => r.id !== id));
            toast.success('已删除该条记录');
        } catch {
            toast.error('删除失败，请重试');
        }
    };

    return (
        <div className="space-y-6">
            {/* 页面标题栏 */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <History className="h-6 w-6" />
                        执行历史
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        共 {records.length} 条记录
                        {filteredRecords.length !== records.length && `，当前筛选显示 ${filteredRecords.length} 条`}
                    </p>
                </div>

                {records.length > 0 && (
                    <Button
                        variant="destructive"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => setClearDialogOpen(true)}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                        清空全部
                    </Button>
                )}
            </div>

            {/* 筛选栏 */}
            {records.length > 0 && (
                <div className="flex gap-3 flex-wrap">
                    <Select value={filterTool} onValueChange={setFilterTool}>
                        <SelectTrigger className="w-44 h-8 text-sm">
                            <SelectValue placeholder="按工具筛选" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__all__">全部工具</SelectItem>
                            {toolOptions.map(opt => (
                                <SelectItem key={opt.id} value={opt.id}>{opt.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="w-36 h-8 text-sm">
                            <SelectValue placeholder="按状态筛选" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__all__">全部状态</SelectItem>
                            <SelectItem value="success">✅ 成功</SelectItem>
                            <SelectItem value="error">❌ 失败</SelectItem>
                        </SelectContent>
                    </Select>

                    {(filterTool !== '__all__' || filterStatus !== '__all__') && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => { setFilterTool('__all__'); setFilterStatus('__all__'); }}
                        >
                            重置筛选
                        </Button>
                    )}
                </div>
            )}

            {/* 内容区 */}
            {loading ? (
                <div className="flex items-center justify-center py-20 text-muted-foreground">
                    <div className="flex flex-col items-center gap-3">
                        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                        <p className="text-sm">加载中...</p>
                    </div>
                </div>
            ) : filteredRecords.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                    <Inbox className="h-12 w-12 text-muted-foreground/30 mb-4" />
                    <p className="text-base font-medium text-muted-foreground">
                        {records.length === 0 ? '暂无执行记录' : '没有符合条件的记录'}
                    </p>
                    <p className="text-sm text-muted-foreground/70 mt-1">
                        {records.length === 0
                            ? '执行任意工具后，记录会出现在这里'
                            : '尝试调整筛选条件'}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredRecords.map(record => (
                        <HistoryCard
                            key={record.id}
                            record={record}
                            toolName={toolNameMap[record.toolId] ?? record.toolId}
                            onRerun={() => handleRerun(record)}
                            onDelete={() => handleDeleteSingle(record.id!)}
                        />
                    ))}
                </div>
            )}

            {/* 清空确认弹窗 */}
            <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>确认清空历史？</DialogTitle>
                        <DialogDescription>
                            此操作将删除全部 <strong>{records.length}</strong> 条执行记录，且无法撤销。
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setClearDialogOpen(false)} disabled={clearing}>
                            取消
                        </Button>
                        <Button variant="destructive" onClick={handleClearAll} disabled={clearing}>
                            {clearing ? '清空中...' : '确认清空'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
