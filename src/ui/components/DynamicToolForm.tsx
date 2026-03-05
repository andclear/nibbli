import { useState, useEffect } from 'react';
import { useCoreContext } from '@/core/useCoreContext';
import type { ToolConfig, CoreContext } from '@/core/types';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Play, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/core/db';
import { useAppStore } from '@/store/useAppStore';

/** IndexedDB 中工具专属 prompt 覆写的 key 前缀 */
const PROMPT_KEY_PREFIX = 'tool-prompt:';

/** 获取本地存储的工具提示词覆写（如果有的话） */
async function getPromptOverride(toolId: string): Promise<string | null> {
    const record = await db.keyValue.get(`${PROMPT_KEY_PREFIX}${toolId}`);
    return record ? record.value : null;
}

interface DynamicToolFormProps {
    config: ToolConfig;
    onExecutionComplete: (result: unknown) => void;
    /** 按钮就绪后回调，将 retry 函数传给父组件（用于实现重新生成） */
    onRetryReady?: (retryFn: () => void) => void;
    /** 预填表单初始值，优先级高于 defaultValue（历史重新执行时使用） */
    initialValues?: Record<string, unknown>;
}

export function DynamicToolForm({ config, onExecutionComplete, onRetryReady, initialValues }: DynamicToolFormProps) {
    const coreContext = useCoreContext();

    // 提取初始值： initialValues 优先，否则用 defaultValue
    const defaultValues: Record<string, unknown> = {};
    config.inputs.forEach((input) => {
        if (initialValues && initialValues[input.name] !== undefined) {
            defaultValues[input.name] = initialValues[input.name];
        } else if (input.defaultValue !== undefined) {
            defaultValues[input.name] = input.defaultValue;
        } else if (input.type === 'boolean') {
            defaultValues[input.name] = false;
        } else {
            defaultValues[input.name] = '';
        }
    });

    const [formValues, setFormValues] = useState<Record<string, unknown>>(defaultValues);
    const [isExecuting, setIsExecuting] = useState(false);
    const [hasExecuted, setHasExecuted] = useState(false);
    const [executeError, setExecuteError] = useState<string | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const [promptOverride, setPromptOverride] = useState<string | null>(null);
    const [optionPromptsOverride, setOptionPromptsOverride] = useState<Record<string, string>>({});
    const [promptLoaded, setPromptLoaded] = useState(false);

    // 获取并解构流式组合开关状态
    const { enableSilentStream, setEnableSilentStream } = useAppStore();

    // 启动时读取本地 prompt 覆写
    useEffect(() => {
        getPromptOverride(config.id).then((override) => {
            if (override) {
                try {
                    const parsed = JSON.parse(override);
                    if (parsed.main !== undefined) {
                        setPromptOverride(parsed.main);
                        setOptionPromptsOverride(parsed.options || {});
                    } else {
                        setPromptOverride(override);
                        setOptionPromptsOverride({});
                    }
                } catch {
                    setPromptOverride(override);
                    setOptionPromptsOverride({});
                }
            } else {
                setPromptOverride(null);
                setOptionPromptsOverride({});
            }
            setPromptLoaded(true);
        });
    }, [config.id]);

    // 监听外部刷新信号（当用户在详情页编辑了 prompt 后刷新本组件的缓存）
    // 通过自定义事件 'prompt-updated:{toolId}' 来做
    useEffect(() => {
        const handler = () => {
            getPromptOverride(config.id).then((override) => {
                if (override) {
                    try {
                        const parsed = JSON.parse(override);
                        if (parsed.main !== undefined) {
                            setPromptOverride(parsed.main);
                            setOptionPromptsOverride(parsed.options || {});
                        } else {
                            setPromptOverride(override);
                            setOptionPromptsOverride({});
                        }
                    } catch {
                        setPromptOverride(override);
                        setOptionPromptsOverride({});
                    }
                } else {
                    setPromptOverride(null);
                    setOptionPromptsOverride({});
                }
            });
        };
        window.addEventListener(`prompt-updated:${config.id}`, handler);
        return () => window.removeEventListener(`prompt-updated:${config.id}`, handler);
    }, [config.id]);

    // 将「重新提交」方法暴露给父组件（用于实现「重新生成」按钮）
    useEffect(() => {
        if (!onRetryReady) return;
        onRetryReady(() => {
            // 触发一个合成 submit 事件到表单
            const form = document.querySelector<HTMLFormElement>(`[data-tool-form="${config.id}"]`);
            form?.requestSubmit();
        });
        // 仅在 onRetryReady 或 config.id 变化时重新注册
    }, [onRetryReady, config.id]);

    const handleValueChange = (name: string, value: unknown) => {
        setFormValues((prev) => ({ ...prev, [name]: value }));
        // 清除其对应的错误提示
        if (errors[name]) {
            setErrors((prev) => {
                const next = { ...prev };
                delete next[name];
                return next;
            });
        }
    };

    const handleFileChange = (name: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleValueChange(name, file);
        } else {
            handleValueChange(name, null);
        }
    };

    const validateForm = () => {
        const newErrors: Record<string, string> = {};
        for (const input of config.inputs) {
            if (input.required) {
                const val = formValues[input.name];
                if (val === undefined || val === null || val === '') {
                    newErrors[input.name] = '该选项为必填项';
                }
            }
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            toast.error('表单填写不完整，请检查标红必填项');
            return;
        }

        if (!promptLoaded) {
            toast.error('提示词配置尚未加载完成，请稍候重试');
            return;
        }

        setExecuteError(null);
        setIsExecuting(true);
        const timestamp = Date.now();
        let result: unknown = null;
        let status: 'success' | 'error' = 'success';
        let errorMsg = '';

        // 构建带有 prompt 注入的上下文
        let effectiveSystemPrompt = promptOverride ?? config.systemPrompt ?? '';

        // 汇集当前所选各 option 专有的附加提示词
        let appendedOptionPrompts = '';
        for (const input of config.inputs) {
            if (input.type === 'select' && input.options) {
                const selectedVal = formValues[input.name];

                // 1. 优先使用用户在编辑器里自定义的覆盖规则
                const overrideOptPrompt = optionPromptsOverride[`${input.name}:${selectedVal}`];
                if (overrideOptPrompt && overrideOptPrompt.trim()) {
                    appendedOptionPrompts += `\n\n${overrideOptPrompt}`;
                    continue;
                }

                // 2. 否则使用插件原生自带的 options.prompt
                const opt = input.options.find(o => o.value === selectedVal);
                if (opt && opt.prompt && opt.prompt.trim()) {
                    appendedOptionPrompts += `\n\n${opt.prompt}`;
                }
            }
        }

        if (appendedOptionPrompts) {
            effectiveSystemPrompt += appendedOptionPrompts;
        }

        const storeState = useAppStore.getState();
        let globalPrompt = storeState.globalPrompt || '';

        // 如果开启了禁词表，自动拼接到全局提示词后面
        if (storeState.enableBannedWords && storeState.globalBannedWords) {
            globalPrompt = globalPrompt
                ? `${globalPrompt}\n\n${storeState.globalBannedWords}`
                : storeState.globalBannedWords;
        }

        const defaultModel = coreContext.defaultModel || storeState.defaultModel || '';

        const enrichedContext: CoreContext = {
            ...coreContext,
            systemPrompt: effectiveSystemPrompt,
            globalPrompt: globalPrompt,
            defaultModel: defaultModel,
            parsers: coreContext.parsers, // 解析器直接透传
        };

        try {
            result = await config.execute(formValues, enrichedContext);
            onExecutionComplete(result);
            toast.success('执行成功');
        } catch (error: unknown) {
            const err = error as Error;
            status = 'error';
            errorMsg = err.message || '未知错误';
            result = error;
            setExecuteError(errorMsg);
            console.error('工具执行失败:', err);
        } finally {
            setIsExecuting(false);
            setHasExecuted(true);

            // 写入历史
            try {
                await coreContext.db.history.add({
                    toolId: config.id,
                    timestamp,
                    inputs: { ...formValues },
                    result: result,
                    status: status,
                    errorMessage: status === 'error' ? errorMsg : undefined,
                });
            } catch (dbErr) {
                console.error('写入数据库历史失败:', dbErr);
            }
        }
    };

    const renderInputControl = (input: typeof config.inputs[0]) => {
        const value = formValues[input.name];
        const hasError = !!errors[input.name];

        switch (input.type) {
            case 'string':
                return (
                    <Input
                        value={(value as string) || ''}
                        onChange={(e) => handleValueChange(input.name, e.target.value)}
                        className={hasError ? 'border-red-500' : ''}
                    />
                );
            case 'text':
                return (
                    <Textarea
                        value={(value as string) || ''}
                        onChange={(e) => handleValueChange(input.name, e.target.value)}
                        rows={15}
                        className={hasError ? 'border-red-500' : ''}
                    />
                );
            case 'number':
                return (
                    <Input
                        type="number"
                        value={((value ?? '') as string | number)}
                        onChange={(e) => handleValueChange(input.name, Number(e.target.value))}
                        className={hasError ? 'border-red-500' : ''}
                    />
                );
            case 'boolean':
                return (
                    <div className="flex items-center space-x-2 mt-2">
                        <Checkbox
                            checked={value as boolean}
                            onCheckedChange={(checked) => handleValueChange(input.name, !!checked)}
                        />
                        <Label className="text-sm cursor-pointer">{input.label}</Label>
                    </div>
                );
            case 'file': {
                const fileObj = value as File | undefined | null;
                return (
                    <div className="flex items-center gap-3">
                        <Button
                            asChild
                            variant="outline"
                            className={hasError ? 'border-red-500 text-red-500 hover:text-red-600 hover:bg-red-50 cursor-pointer' : 'cursor-pointer'}
                        >
                            <label htmlFor={`file-input-${input.name}`}>
                                选择文件
                            </label>
                        </Button>
                        <span className="text-sm text-muted-foreground truncate max-w-[250px]" title={fileObj ? fileObj.name : ''}>
                            {fileObj ? fileObj.name : '未选择任何文件'}
                        </span>
                        <input
                            id={`file-input-${input.name}`}
                            type="file"
                            accept={input.accept}
                            className="hidden"
                            onChange={(e) => handleFileChange(input.name, e)}
                        />
                    </div>
                );
            }
            case 'select':
                return (
                    <Select
                        value={(value as string) || ''}
                        onValueChange={(val) => handleValueChange(input.name, val)}
                    >
                        <SelectTrigger className={hasError ? 'border-red-500' : ''}>
                            <SelectValue placeholder="请选择..." />
                        </SelectTrigger>
                        <SelectContent>
                            {input.options?.map((opt) => (
                                <SelectItem key={opt.value} value={String(opt.value)}>
                                    {opt.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                );
            default:
                return null;
        }
    };

    return (
        <form data-tool-form={config.id} onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
                {config.inputs.map((input) => (
                    <div key={input.name} className="flex flex-col space-y-1.5">
                        {input.type !== 'boolean' && (
                            <Label className="font-semibold text-sm">
                                {input.label}
                                {input.required && <span className="text-red-500 ml-1">*</span>}
                            </Label>
                        )}
                        {renderInputControl(input)}
                        {input.description && (
                            <p className="text-xs text-muted-foreground mt-1">{input.description}</p>
                        )}
                        {errors[input.name] && (
                            <p className="text-xs text-red-500">{errors[input.name]}</p>
                        )}
                    </div>
                ))}
            </div>

            <div className="pt-4 border-t border-border/50">
                <div className="flex items-start space-x-3 mb-6">
                    <Checkbox
                        id="enableSilentStream"
                        checked={enableSilentStream}
                        onCheckedChange={(val) => setEnableSilentStream(!!val)}
                        className="mt-0.5"
                    />
                    <div className="grid gap-1.5 leading-none">
                        <Label htmlFor="enableSilentStream" className="cursor-pointer font-medium text-sm">
                            流式输出（仍是一次性显示）
                        </Label>
                    </div>
                </div>

                <Button type="submit" className="w-full" disabled={isExecuting}>
                    {isExecuting ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            <span className="animate-pulse">执行中...</span>
                        </>
                    ) : hasExecuted ? (
                        <>
                            <RotateCcw className="mr-2 h-4 w-4" />
                            重新执行
                        </>
                    ) : (
                        <>
                            <Play className="mr-2 h-4 w-4" />
                            执行任务
                        </>
                    )}
                </Button>

                {/* 执行结果报错信息内联提示 */}
                {executeError && (
                    <div className="mt-3 p-3 text-sm bg-destructive/10 text-destructive rounded-md border border-destructive/20 whitespace-pre-wrap break-words">
                        <span className="font-semibold">执行出错：</span>{executeError}
                    </div>
                )}
            </div>
        </form>
    );
}
