import { useState, useEffect, useCallback } from 'react';
import { BookOpen, RefreshCw, Clock, CheckCircle2, XCircle, AlertCircle, Trash2 } from 'lucide-react';
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
import { db, type SharedStory } from '@/core/db';

/**
 * 状态显示映射
 */
const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    pending: {
        label: '待审核',
        color: 'text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-900/20',
        icon: <Clock className="h-3.5 w-3.5" />,
    },
    approved: {
        label: '已通过',
        color: 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20',
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    },
    rejected: {
        label: '未通过',
        color: 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20',
        icon: <XCircle className="h-3.5 w-3.5" />,
    },
    flagged: {
        label: '待审核',
        color: 'text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-900/20',
        icon: <AlertCircle className="h-3.5 w-3.5" />,
    },
    unknown: {
        label: '未知',
        color: 'text-muted-foreground bg-muted',
        icon: <AlertCircle className="h-3.5 w-3.5" />,
    },
    deleted: {
        label: '被移除',
        color: 'text-gray-500 bg-gray-100 dark:text-gray-400 dark:bg-gray-800/50',
        icon: <AlertCircle className="h-3.5 w-3.5" />,
    },
};

export function MySharesDialog() {
    const [open, setOpen] = useState(false);
    const [shares, setShares] = useState<(SharedStory & { status?: string })[]>([]);
    const [loading, setLoading] = useState(false);

    // 加载本地分享记录并查询状态
    const loadShares = useCallback(async () => {
        setLoading(true);
        try {
            // 从 IndexedDB 获取本地记录
            const localShares = await db.sharedStories.orderBy('sharedAt').reverse().toArray();

            if (localShares.length === 0) {
                setShares([]);
                setLoading(false);
                return;
            }

            // 批量查询远端状态
            const ids = localShares.map(s => s.id).join(',');
            try {
                const res = await fetch(`/api/check-status?ids=${encodeURIComponent(ids)}`);
                if (res.ok) {
                    const statusMap = await res.json();
                    // 如果本地有记录但后端 API 返回 unknown 说明已被删除
                    setShares(localShares.map(s => {
                        const apiStatus = statusMap[s.id] || 'unknown';
                        return {
                            ...s,
                            status: apiStatus === 'unknown' ? 'deleted' : apiStatus,
                        };
                    }));
                } else {
                    // API 请求失败时仍显示本地记录，状态标记为 unknown
                    setShares(localShares.map(s => ({ ...s, status: 'unknown' })));
                }
            } catch {
                // 网络错误时仍显示本地记录
                setShares(localShares.map(s => ({ ...s, status: 'unknown' })));
            }
        } catch (err) {
            console.error('加载分享记录失败:', err);
            toast.error('加载分享记录失败');
        } finally {
            setLoading(false);
        }
    }, []);

    // 清除分享历史
    const handleClearHistory = async () => {
        if (!window.confirm('确定要清除本地的所有分享历史记录吗？（注意：这不会删除已上传到云端的小剧场）')) {
            return;
        }
        try {
            await db.sharedStories.clear();
            setShares([]);
            toast.success('分享历史已清除');
        } catch (err) {
            console.error('清除历史失败:', err);
            toast.error('清除失败，请重试');
        }
    };

    // 对话框打开时加载数据
    useEffect(() => {
        if (open) {
            loadShares();
        }
    }, [open, loadShares]);

    // 格式化时间
    const formatTime = (timestamp: number) => {
        return new Date(timestamp).toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="w-full justify-start gap-2">
                    <BookOpen className="h-4 w-4" />
                    我的分享
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto" showCloseButton={false}>
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                        我的分享
                        <div className="flex items-center gap-1">
                            {shares.length > 0 && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={handleClearHistory}
                                    disabled={loading}
                                    className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                                    title="清除分享历史"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={loadShares}
                                disabled={loading}
                                className="h-8 w-8"
                                title="刷新状态"
                            >
                                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            </Button>
                        </div>
                    </DialogTitle>
                    <DialogDescription>
                        查看您已分享的小剧场列表及其审核状态
                    </DialogDescription>
                </DialogHeader>

                {/* 加载状态 */}
                {loading && (
                    <div className="flex justify-center py-8">
                        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                )}

                {/* 空状态 */}
                {!loading && shares.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                        <BookOpen className="h-8 w-8 text-muted-foreground mb-3 opacity-40" />
                        <p className="text-sm text-muted-foreground">暂无分享记录</p>
                        <p className="text-xs text-muted-foreground mt-1">分享的小剧场将在此处显示</p>
                    </div>
                )}

                {/* 分享列表表格 */}
                {!loading && shares.length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-muted/50">
                                    <th className="text-left px-3 py-2 font-medium">标题</th>
                                    <th className="text-left px-3 py-2 font-medium w-24">分享时间</th>
                                    <th className="text-center px-3 py-2 font-medium w-24">状态</th>
                                </tr>
                            </thead>
                            <tbody>
                                {shares.map((share) => {
                                    const statusInfo = STATUS_MAP[share.status || 'unknown'] || STATUS_MAP.unknown;
                                    return (
                                        <tr key={share.id} className="border-b last:border-b-0 hover:bg-muted/20">
                                            <td className="px-3 py-2">
                                                <span className="font-medium truncate block max-w-[180px]">{share.title}</span>
                                            </td>
                                            <td className="px-3 py-2 text-xs text-muted-foreground">
                                                {formatTime(share.sharedAt)}
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${statusInfo.color}`}>
                                                    {statusInfo.icon}
                                                    {statusInfo.label}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
