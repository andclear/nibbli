/**
 * 提示词及插件编辑对话框
 * 支持查看和修改任意工具的系统提示词，保存到 IndexedDB 中
 * 对于用户自定义插件，提供额外的 JSON 源码编辑能力
 */

import { useState, useEffect } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Pencil, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/core/db';
import type { ToolConfig } from '@/core/types';
import { CUSTOM_CATEGORY, updateCustomPlugin } from '@/core/pluginLoader';

/** IndexedDB 中工具专属 prompt 覆写的 key 前缀 */
const PROMPT_KEY_PREFIX = 'tool-prompt:';

interface PromptEditorDialogProps {
    tool: ToolConfig;
    /** 触发打开弹框的按钮样式模式 */
    triggerVariant?: 'icon' | 'button';
    /** 编辑保存后的回调 */
    onSaved?: () => void;
}

export function PromptEditorDialog({ tool, triggerVariant = 'button', onSaved }: PromptEditorDialogProps) {
    const [isOpen, setIsOpen] = useState(false);

    // 提示词状态
    const [prompt, setPrompt] = useState('');
    const [optionPrompts, setOptionPrompts] = useState<Record<string, string>>({});
    const [activePromptTab, setActivePromptTab] = useState<string>('main');
    const [isOverridden, setIsOverridden] = useState(false);

    // 自定义插件 JSON 编辑支持
    const [activeTab, setActiveTab] = useState<'prompt' | 'json'>('prompt');
    const [isCustomPlugin, setIsCustomPlugin] = useState(false);
    const [jsonContent, setJsonContent] = useState('');

    const [saving, setSaving] = useState(false);

    const defaultPrompt = tool.systemPrompt || '';

    // 打开弹窗时从数据库加载数据
    useEffect(() => {
        if (isOpen) {
            // 获取内置的默认选项 Prompt
            const defaultOptionPrompts: Record<string, string> = {};
            tool.inputs.forEach(input => {
                if (input.type === 'select' && input.options) {
                    input.options.forEach(opt => {
                        if (opt.prompt) {
                            defaultOptionPrompts[`${input.name}:${opt.value}`] = opt.prompt;
                        }
                    });
                }
            });

            // 1. 加载提示词覆写
            db.keyValue.get(`${PROMPT_KEY_PREFIX}${tool.id}`).then((record) => {
                if (record) {
                    try {
                        const parsed = JSON.parse(record.value);
                        if (parsed.main !== undefined) {
                            setPrompt(parsed.main);
                            setOptionPrompts(parsed.options || {});
                        } else {
                            // 向后兼容旧的纯字符串覆写
                            setPrompt(record.value);
                            setOptionPrompts(defaultOptionPrompts);
                        }
                    } catch {
                        // 如果解析 JSON 失败，说明存的是旧的纯字符串
                        setPrompt(record.value);
                        setOptionPrompts(defaultOptionPrompts);
                    }
                    setIsOverridden(true);
                } else {
                    setPrompt(defaultPrompt);
                    setOptionPrompts(defaultOptionPrompts);
                    setIsOverridden(false);
                }
                setActivePromptTab('main');
            });

            // 2. 如果是自定义插件，加载其原始 JSON 结构
            if (tool.category === CUSTOM_CATEGORY) {
                setIsCustomPlugin(true);
                db.customPlugins.get(tool.id).then((plugin) => {
                    if (plugin) {
                        try {
                            const parsedInputs = JSON.parse(plugin.inputsJson);
                            const sourceObj = {
                                id: plugin.id,
                                name: plugin.name,
                                description: plugin.description,
                                version: plugin.version,
                                inputs: parsedInputs,
                                executeScript: plugin.executeScript
                            };
                            setJsonContent(JSON.stringify(sourceObj, null, 2));
                        } catch (err) {
                            console.error('解析自定义插件 JSON 结构失败:', err);
                        }
                    }
                });
            } else {
                setIsCustomPlugin(false);
                setActiveTab('prompt'); // 强制重置 Tab
            }
        }
    }, [isOpen, tool.id, defaultPrompt, tool.category, tool.inputs]);

    const handleSave = async () => {
        // 分支 1：正在编辑 JSON 页面时点击保存
        if (activeTab === 'json' && isCustomPlugin) {
            setSaving(true);
            try {
                // 从 JSON 内容和当前提示词重构单文件 .js 格式
                const parsed = JSON.parse(jsonContent);
                const configBlock = JSON.stringify({
                    id: parsed.id,
                    name: parsed.name,
                    description: parsed.description,
                    version: parsed.version,
                    author: parsed.author,
                    inputs: parsed.inputs,
                }, null, 4);

                let jsFileContent = `/*---CONFIG---\n${configBlock}\n---END_CONFIG---*/\n\n/*---PROMPT---\n${prompt}\n---END_PROMPT---*/\n\n`;

                // 将所有有内容的 Option Prompt 追加到 .js 文件中
                for (const [key, val] of Object.entries(optionPrompts)) {
                    if (val && val.trim()) {
                        const [fieldName, optionVal] = key.split(':');
                        jsFileContent += `/*---PROMPT_${fieldName}_${optionVal}---\n${val}\n---END_PROMPT---*/\n\n`;
                    }
                }

                jsFileContent += `/*---EXECUTE---\n${parsed.executeScript}\n---END_EXECUTE---*/`;
                await updateCustomPlugin(tool.id, jsFileContent);
                toast.success('由于自定义插件底层结构已更新，刷新生效');
                window.dispatchEvent(new Event('custom-plugins-updated'));
                // 强制刷新页面或发出通知使重新渲染首页，确保改动被全局捕获
                setTimeout(() => window.location.reload(), 1500);
            } catch (err) {
                toast.error(err instanceof Error ? err.message : '更新 JSON 失败');
            } finally {
                setSaving(false);
            }
            return;
        }

        // 分支 2：保存提示词覆写
        setSaving(true);
        try {
            await db.keyValue.put({
                key: `${PROMPT_KEY_PREFIX}${tool.id}`,
                value: JSON.stringify({ main: prompt, options: optionPrompts }),
            });
            setIsOverridden(true);
            toast.success('提示词已保存');
            window.dispatchEvent(new Event(`prompt-updated:${tool.id}`));
            onSaved?.();
            setIsOpen(false);
        } catch {
            toast.error('保存失败');
        } finally {
            setSaving(false);
        }
    };

    const handleRestore = async () => {
        setSaving(true);
        try {
            await db.keyValue.delete(`${PROMPT_KEY_PREFIX}${tool.id}`);
            setPrompt(defaultPrompt);

            // 重置 option prompts为默认值
            const defaultOptionPrompts: Record<string, string> = {};
            tool.inputs.forEach(input => {
                if (input.type === 'select' && input.options) {
                    input.options.forEach(opt => {
                        if (opt.prompt) {
                            defaultOptionPrompts[`${input.name}:${opt.value}`] = opt.prompt;
                        }
                    });
                }
            });
            setOptionPrompts(defaultOptionPrompts);

            setIsOverridden(false);
            toast.success('已恢复为默认提示词');
            window.dispatchEvent(new Event(`prompt-updated:${tool.id}`));
            onSaved?.();
        } catch {
            toast.error('恢复失败');
        } finally {
            setSaving(false);
        }
    };

    const handleOptionPromptChange = (val: string) => {
        setOptionPrompts(prev => ({ ...prev, [activePromptTab]: val }));
    };

    const handleRestoreCurrentTab = () => {
        if (activePromptTab === 'main') {
            setPrompt(defaultPrompt);
        } else {
            // 从 tool.inputs 重新寻找该选项的默认提示词
            let defaultOptPrompt = '';
            tool.inputs.forEach(input => {
                if (input.type === 'select' && input.options) {
                    input.options.forEach(opt => {
                        if (`${input.name}:${opt.value}` === activePromptTab && opt.prompt) {
                            defaultOptPrompt = opt.prompt;
                        }
                    });
                }
            });
            setOptionPrompts(prev => ({ ...prev, [activePromptTab]: defaultOptPrompt }));
        }
        toast.info('已在输入框中填入系统默认内容，点击保存生效');
    };

    // 抽离的提示词编辑区域渲染函数
    const renderPromptEditor = () => {
        // 构建选项标签栏
        const tabs = [{ id: 'main', label: '主系统指令' }];
        tool.inputs.forEach(input => {
            if (input.type === 'select' && input.options) {
                if (input.allowOptionPromptEdit === false) return;
                input.options.forEach(opt => {
                    tabs.push({
                        id: `${input.name}:${opt.value}`,
                        label: `${input.label}: ${opt.label}`
                    });
                });
            }
        });

        return (
            <>
                {tabs.length > 1 && (
                    <div className="flex flex-wrap gap-2 mb-2 pb-2 border-b border-border/50">
                        {tabs.map(t => (
                            <Button
                                key={t.id}
                                variant={activePromptTab === t.id ? 'default' : 'secondary'}
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => setActivePromptTab(t.id)}
                            >
                                {t.label}
                            </Button>
                        ))}
                    </div>
                )}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                            {activePromptTab === 'main' ? '系统提示词' : '选项专属提示词'}
                        </span>
                        {isOverridden && activePromptTab === 'main' && (
                            <span className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded">
                                已自定义
                            </span>
                        )}
                        {optionPrompts[activePromptTab] && activePromptTab !== 'main' && (
                            <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-1.5 py-0.5 rounded">
                                已配置附加规则
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {isOverridden && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1 text-xs h-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={handleRestore}
                                disabled={saving}
                                title="直接清除保存好的自定义配置并恢复初始状态"
                            >
                                <RotateCcw className="h-3 w-3" />
                                彻底重置
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                            onClick={handleRestoreCurrentTab}
                            disabled={saving}
                            title="将下方编辑框中的文字填回为系统原版"
                        >
                            恢复默认内容
                        </Button>
                    </div>
                </div>

                <Textarea
                    value={activePromptTab === 'main' ? prompt : (optionPrompts[activePromptTab] || '')}
                    onChange={(e) => activePromptTab === 'main' ? setPrompt(e.target.value) : handleOptionPromptChange(e.target.value)}
                    rows={12}
                    className="font-mono text-sm resize-y"
                    placeholder="在此输入提示词。留空则代表该选项不增加额外的附加指令..."
                />

                {defaultPrompt && !isOverridden && activePromptTab === 'main' && (
                    <p className="text-xs text-muted-foreground">
                        当前使用的是工具内置的默认系统提示词。
                    </p>
                )}
                {!defaultPrompt && activePromptTab === 'main' && (
                    <p className="text-xs text-muted-foreground">
                        该工具没有内置默认提示词。您可以在此添加自定义系统级别的主导提示词。
                    </p>
                )}
                {activePromptTab !== 'main' && (
                    <p className="text-xs text-muted-foreground">
                        当前正编辑选项的独立提示词。当本选项被勾选时，这段内容将被<strong>追加</strong>到系统提示词上。
                    </p>
                )}
            </>
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {triggerVariant === 'icon' ? (
                    <button
                        className="p-1 rounded-md hover:bg-muted transition-colors"
                        title="高级编辑"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                ) : (
                    <Button variant="outline" size="sm" className="gap-2">
                        <Pencil className="h-3.5 w-3.5" />
                        编辑配置
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
                <DialogHeader className="shrink-0">
                    <DialogTitle>编辑配置 — {tool.name}</DialogTitle>
                    <DialogDescription>
                        {isCustomPlugin
                            ? '您可以覆写当前工具的系统提示词，或直接从底层修改其 JSON 定义。'
                            : '修改系统提示词后，该工具的所有 API 调用将使用您的自定义版本。修改仅影响当前工具，不影响其他工具。'}
                    </DialogDescription>
                </DialogHeader>

                {/* 内容区限制最大高度并支持滚动 */}
                <div className="flex-1 overflow-y-auto pr-2 py-4">
                    {isCustomPlugin ? (
                        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'prompt' | 'json')} className="w-full">
                            <TabsList className="mb-4">
                                <TabsTrigger value="prompt">提示词 (Prompt)</TabsTrigger>
                                <TabsTrigger value="json">插件代码 (JSON)</TabsTrigger>
                            </TabsList>
                            <TabsContent value="prompt" className="space-y-3 mt-0">
                                {renderPromptEditor()}
                            </TabsContent>
                            <TabsContent value="json" className="mt-0 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">插件底层定义 (包含 inputs 及 executeScript)</span>
                                </div>
                                <Textarea
                                    value={jsonContent}
                                    onChange={(e) => setJsonContent(e.target.value)}
                                    rows={18}
                                    className="font-mono text-xs resize-y whitespace-pre"
                                    placeholder="填入合乎规范的插件 JSON 定义..."
                                    spellCheck={false}
                                />
                                <p className="text-xs text-amber-500/80 mt-2">
                                    注意：在此页签点保存，修改的将是插件的底层结构，页面可能将自动重新加载以载入新定义的组件。
                                </p>
                            </TabsContent>
                        </Tabs>
                    ) : (
                        <div className="space-y-3">
                            {renderPromptEditor()}
                        </div>
                    )}
                </div>

                <DialogFooter className="shrink-0 pt-4 border-t mt-auto">
                    <DialogClose asChild>
                        <Button variant="ghost">取消</Button>
                    </DialogClose>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? '保存中...' : '保存'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
