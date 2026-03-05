import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Stethoscope, ClipboardList, AlertTriangle, Lightbulb, UserCheck, BookOpen, Quote, Sparkles } from 'lucide-react';

export interface DoctorReportData {
    report: {
        core_assessment: string;
        dimensions: Array<{
            name: string;
            status: string;
            issues: string;
            suggestions: string;
        }>;
        prescriptions: string[];
    };
    originalTexts: {
        characterInfo: string;
        worldBook: string;
        firstMessage: string;
        alternateGreetings: string;
        scenario: string;
    };
}

interface DoctorReportViewProps {
    data: DoctorReportData;
}

export function DoctorReportView({ data }: DoctorReportViewProps) {
    const { report, originalTexts } = data;
    const [selectedOriginal, setSelectedOriginal] = React.useState<{ title: string; content: string } | null>(null);

    // 根据维度名称映射图标和关联的原文
    const getDimensionConfig = (name: string) => {
        if (name.includes('设定') || name.includes('人设')) {
            return {
                icon: <UserCheck className="h-5 w-5 text-blue-500" />,
                title: '人设与初衷设定 原文',
                content: originalTexts.characterInfo + '\n\n【附加场景/世界设定】\n' + originalTexts.scenario,
                color: 'border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-900/10'
            };
        }
        if (name.includes('开场白')) {
            return {
                icon: <Quote className="h-5 w-5 text-purple-500" />,
                title: '开场白记录 原文',
                content: `【主开场白】\n${originalTexts.firstMessage}\n\n【备用开场白】\n${originalTexts.alternateGreetings}`,
                color: 'border-purple-200 bg-purple-50 dark:border-purple-900/50 dark:bg-purple-900/10'
            };
        }
        if (name.includes('世界观')) {
            return {
                icon: <BookOpen className="h-5 w-5 text-emerald-500" />,
                title: '世界书 (World Info) 原文',
                content: originalTexts.worldBook,
                color: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-900/10'
            };
        }
        if (name.includes('OOC')) {
            return {
                icon: <AlertTriangle className="h-5 w-5 text-orange-500" />,
                title: '全量人设信息 原文 (OOC排查参考)',
                content: originalTexts.characterInfo,
                color: 'border-orange-200 bg-orange-50 dark:border-orange-900/50 dark:bg-orange-900/10'
            };
        }
        return {
            icon: <ClipboardList className="h-5 w-5 text-gray-500" />,
            title: `${name} 相关原文`,
            content: originalTexts.characterInfo,
            color: 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/20'
        };
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto w-full pb-8">
            {/* 顶栏：诊断结论 */}
            <Card className="border-t-4 border-t-primary shadow-sm bg-gradient-to-b from-primary/5 to-transparent">
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-xl">
                        <Stethoscope className="h-6 w-6 text-primary" />
                        小皮医生诊断总览
                    </CardTitle>
                    <CardDescription className="text-base text-foreground/90 font-medium pt-2 leading-relaxed">
                        {report.core_assessment}
                    </CardDescription>
                </CardHeader>
            </Card>

            {/* 网格卡片：各维度诊断 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {report.dimensions?.map((dim, idx) => {
                    const config = getDimensionConfig(dim.name);
                    return (
                        <Card key={idx} className={`relative overflow-hidden ${config.color} transition-all hover:shadow-md`}>
                            {/* 点击查看原文 Badge */}
                            <div className="absolute top-3 right-3">
                                <Badge
                                    variant="outline"
                                    className="cursor-pointer hover:bg-background/80 bg-background/50 shadow-sm transition-colors border-current/20"
                                    onClick={() => setSelectedOriginal({ title: config.title, content: config.content })}
                                >
                                    <ClipboardList className="w-3 h-3 mr-1 opacity-70" /> 原文
                                </Badge>
                            </div>

                            <CardHeader className="pb-2">
                                <CardTitle className="text-base flex items-center gap-2">
                                    {config.icon} {dim.name}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm">
                                <div>
                                    <span className="font-semibold text-foreground/80 block mb-1">🏷️ 现状评估</span>
                                    <div className="text-muted-foreground leading-relaxed prose prose-sm dark:prose-invert prose-p:my-0">
                                        <ReactMarkdown>{dim.status}</ReactMarkdown>
                                    </div>
                                </div>
                                {dim.issues && dim.issues.trim() && dim.issues.trim() !== '无' && (
                                    <div className="bg-red-500/10 p-2 rounded-md border border-red-500/20">
                                        <span className="font-semibold text-red-700 dark:text-red-400 block mb-1 flex items-center gap-1">
                                            <AlertTriangle className="h-3.5 w-3.5" /> 发现问题
                                        </span>
                                        <div className="text-red-900/80 dark:text-red-200/80 leading-relaxed prose prose-sm dark:prose-invert prose-p:my-0">
                                            <ReactMarkdown>{dim.issues}</ReactMarkdown>
                                        </div>
                                    </div>
                                )}
                                {dim.suggestions && dim.suggestions.trim() && dim.suggestions.trim() !== '无' && (
                                    <div className="bg-green-500/10 p-2 rounded-md border border-green-500/20">
                                        <span className="font-semibold text-green-700 dark:text-green-400 block mb-1 flex items-center gap-1">
                                            <Lightbulb className="h-3.5 w-3.5" /> 优化建议
                                        </span>
                                        <div className="text-green-900/80 dark:text-green-200/80 leading-relaxed prose prose-sm dark:prose-invert prose-p:my-0">
                                            <ReactMarkdown>{dim.suggestions}</ReactMarkdown>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* 尾部：具体处方建议 List */}
            {report.prescriptions?.length > 0 && (
                <Card className="border shadow-none bg-card">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-yellow-500" />
                            医生处方 (行动指南)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-3">
                            {report.prescriptions.map((item, i) => (
                                <li key={i} className="flex gap-2 text-sm text-foreground/90">
                                    <span className="text-primary font-bold mt-0.5">{i + 1}.</span>
                                    <span className="leading-relaxed prose prose-sm dark:prose-invert prose-p:my-0 inline-block">
                                        <ReactMarkdown>{item}</ReactMarkdown>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            )}

            {/* 原文查看对话框 */}
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
