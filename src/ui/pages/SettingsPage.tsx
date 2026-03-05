import { useState, useEffect } from 'react';
import { useAppStore, DEFAULT_GLOBAL_PROMPT, DEFAULT_GLOBAL_BANNED_WORDS } from '@/store/useAppStore';
import { fetchAvailableModels, createLLMClient } from '@/core/llm/client';
import { db } from '@/core/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, ChevronDown, Trash2 } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';

const THEMES = [
    { id: 'theme-coffee', name: '咖啡时光' },
    { id: 'theme-supabase', name: '你好小绿' },
    { id: 'theme-skyline', name: '紫色韵味' },
] as const;

export function SettingsPage() {
    const store = useAppStore();

    // ----- API 配置状态 -----
    const [baseUrl, setBaseUrl] = useState(store.apiBaseUrl);
    const [apiKey, setApiKey] = useState(store.apiKey);
    const [selectedModels, setSelectedModels] = useState<string[]>(store.selectedModels || []);
    const [defaultModel, setDefaultModel] = useState(store.defaultModel);
    const [availableModels, setAvailableModels] = useState<string[]>(store.availableModels || []);

    const [showPassword, setShowPassword] = useState(false);
    const [isLoadingModels, setIsLoadingModels] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [modelTestStatus, setModelTestStatus] = useState<Record<string, 'testing' | 'success' | 'error'>>({});
    const [isModelListExpanded, setIsModelListExpanded] = useState(false);
    const [customModelInput, setCustomModelInput] = useState('');

    const [lastFetchedBaseUrl, setLastFetchedBaseUrl] = useState(store.apiBaseUrl);
    const [lastFetchedApiKey, setLastFetchedApiKey] = useState(store.apiKey);

    // 全局提示词状态
    const [globalPrompt, setGlobalPrompt] = useState(store.globalPrompt || '');
    const [globalBannedWords, setGlobalBannedWords] = useState(store.globalBannedWords || '');
    const [enableBannedWords, setEnableBannedWords] = useState(store.enableBannedWords);

    // 修复：Zustand 异步存储水合时 useState 初始值为空
    // 当 store 水合完成后，同步本地状态
    useEffect(() => {
        if (store.globalPrompt) {
            setGlobalPrompt(store.globalPrompt);
        }
        if (store.globalBannedWords) {
            setGlobalBannedWords(store.globalBannedWords);
        }
        setEnableBannedWords(store.enableBannedWords);
    }, [store.globalPrompt, store.globalBannedWords, store.enableBannedWords]);

    // 初始化时，如没有 BaseURL 且是从 store 里读不到，先留空

    // ----- 主题配置状态 -----
    const [theme, setTheme] = useState(store.theme);

    // ----- 动作 -----
    const handleFetchModels = async () => {
        if (!baseUrl || !apiKey) {
            toast.error('请先填写 API 地址和密钥');
            return;
        }

        setIsLoadingModels(true);
        try {
            const tempClient = createLLMClient(baseUrl, apiKey);
            const modelsList = await fetchAvailableModels(tempClient);

            setAvailableModels(modelsList);
            store.setAvailableModels(modelsList);

            setLastFetchedBaseUrl(baseUrl);
            setLastFetchedApiKey(apiKey);

            toast.success(`成功获取 ${modelsList.length} 个可用模型`);

            // 自动把新获取的模型加入"已选择"列表，或者至少让用户去勾选
            if (selectedModels.length === 0 && modelsList.length > 0) {
                setSelectedModels([modelsList[0]]);
                setDefaultModel(modelsList[0]);
            }
        } catch (error: unknown) {
            // 错误已在 withErrorHandling 拦截
            const err = error as Error;
            console.error('Fetch models error:', err);
        } finally {
            setIsLoadingModels(false);
            setIsModelListExpanded(true);
        }
    };

    const handleTestAPI = async () => {
        if (!baseUrl || !apiKey) {
            toast.error('请填写完整的 API 配置');
            return;
        }
        if (selectedModels.length === 0) {
            toast.error('请先拉取并勾选至少一个模型用于检测');
            return;
        }

        setIsTesting(true);
        toast.info(`开始检测 ${selectedModels.length} 个可用模型...`);

        // 重置所有选中模型的状态为 testing
        const initialStatus: Record<string, 'testing'> = {};
        for (const m of selectedModels) {
            initialStatus[m] = 'testing';
        }
        setModelTestStatus(initialStatus);

        let successCount = 0;
        const tempClient = createLLMClient(baseUrl, apiKey);

        for (const model of selectedModels) {
            try {
                // 直接使用 SDK 调用，捕获异常以更新该模型的状态
                const response = await tempClient.chat.completions.create({
                    model: model,
                    messages: [{ role: 'user', content: 'hello' }],
                    max_tokens: 5,
                });

                if (response.choices && response.choices.length > 0) {
                    setModelTestStatus(prev => ({ ...prev, [model]: 'success' }));
                    successCount++;
                } else {
                    setModelTestStatus(prev => ({ ...prev, [model]: 'error' }));
                }
            } catch (error: unknown) {
                setModelTestStatus(prev => ({ ...prev, [model]: 'error' }));
                // 如果遇到认证错误，说明全部都会挂，直接终止
                if ((error as { status?: number })?.status === 401) {
                    toast.error('API 密钥无效，已终止剩余检测。');
                    break;
                }
            }
        }

        setIsTesting(false);
        if (successCount === selectedModels.length) {
            toast.success(`检测完成！${successCount} 个全部连通。`);
        } else {
            toast.warning(`检测完成：${successCount} 成功，${selectedModels.length - successCount} 失败（或中止）。`);
        }
    };

    const toggleModelSelection = (model: string) => {
        setSelectedModels(prev => {
            if (prev.includes(model)) {
                const next = prev.filter(m => m !== model);
                // 取消勾选时，如果当前默认模型被移除，必须挑一个新的
                if (defaultModel === model) {
                    setDefaultModel(next.length > 0 ? next[0] : '');
                }
                return next;
            } else {
                const next = [...prev, model];
                // 只要一勾选新模型，如果之前没有默认模型，立刻替补成默认模型
                if (!defaultModel) setDefaultModel(model);
                return next;
            }
        });
    };

    const handleAddCustomModel = () => {
        const modelName = customModelInput.trim();
        if (!modelName) {
            toast.error('请输入自定义模型名称');
            return;
        }
        if (availableModels.includes(modelName)) {
            toast.error('该模型已存在可用列表中');
            return;
        }

        // 加入可用列表（放最前）
        const newAvailable = [modelName, ...availableModels];
        setAvailableModels(newAvailable);
        store.setAvailableModels(newAvailable); // 同步持久化到 IndexedDB

        setLastFetchedBaseUrl(baseUrl);
        setLastFetchedApiKey(apiKey);

        // 自动勾选并放最前
        const newSelected = [modelName, ...selectedModels];
        setSelectedModels(newSelected);

        // 若没有默认模型则设为默认
        const newDefault = defaultModel || modelName;
        if (!defaultModel) {
            setDefaultModel(modelName);
        }

        // 立即持久化完整的 API 配置（含新模型），无需用户手动点保存
        store.setApiConfig(baseUrl, apiKey, newDefault, newSelected);

        setCustomModelInput('');
        toast.success(`自定义模型 ${modelName} 已添加并自动保存`);
    };

    // 派生属性：将选中的模型排在列表首位，其它模型按原顺序排列
    const sortedModels = [...availableModels].sort((a, b) => {
        const aSelected = selectedModels.includes(a);
        const bSelected = selectedModels.includes(b);
        if (aSelected && !bSelected) return -1;
        if (!aSelected && bSelected) return 1;
        return 0; // 都不选或都选，维持原序
    });

    const handleSaveAPI = () => {
        if (!baseUrl || !apiKey) {
            toast.error('API 地址和密钥是必填项');
            return;
        }

        const isApiChanged = baseUrl !== store.apiBaseUrl || apiKey !== store.apiKey;
        const hasFetched = baseUrl === lastFetchedBaseUrl && apiKey === lastFetchedApiKey;

        let finalSelectedModels = selectedModels;
        let finalDefaultModel = defaultModel;

        if (isApiChanged && !hasFetched) {
            // 用户修改了 API 地址或密钥，但并没有为新的配置重新拉取列表或添加自定义模型
            // 清空归属于旧配置的模型，防止模型名称在不同 API 下无效
            finalSelectedModels = [];
            finalDefaultModel = '';
            setSelectedModels([]);
            setDefaultModel('');
            setAvailableModels([]);
            store.setAvailableModels([]);
            toast.info('检测到 API 已更换，旧的模型列表已清空，请重新拉取模型。');
        } else {
            // 在保存没被清空时，检测一下当前的 defaultModel 是否真的有效（在选中的列表中）
            // 例如由于某些边界条件（比如老用户没选中就存了），保底给它修好
            if (finalSelectedModels.length > 0 && (!finalDefaultModel || !finalSelectedModels.includes(finalDefaultModel))) {
                finalDefaultModel = finalSelectedModels[0];
                setDefaultModel(finalDefaultModel);
            } else if (finalSelectedModels.length === 0) {
                finalDefaultModel = '';
                setDefaultModel('');
            }
        }

        store.setApiConfig(baseUrl, apiKey, finalDefaultModel, finalSelectedModels);
        toast.success(isApiChanged && !hasFetched ? 'API 配置已保存并重置模型状态' : 'API 配置已保存');

        // 保存后，当前配置即为已验证的基础配置
        setLastFetchedBaseUrl(baseUrl);
        setLastFetchedApiKey(apiKey);
    };

    const handleSaveTheme = () => {
        store.setTheme(theme);
        toast.success('主题设置已保存');
    };

    return (
        <div className="max-w-3xl mx-auto py-6">
            <h1 className="text-3xl font-bold mb-6">系统设置</h1>

            <Tabs defaultValue="api" className="w-full">
                <TabsList className="mb-4">
                    <TabsTrigger value="api">API 设置</TabsTrigger>
                    <TabsTrigger value="prompt">全局提示词</TabsTrigger>
                    <TabsTrigger value="theme">主题设置</TabsTrigger>
                    <TabsTrigger value="data">清理数据</TabsTrigger>
                </TabsList>

                <TabsContent value="api">
                    <Card>
                        <CardHeader>
                            <CardTitle>AI 模型配置</CardTitle>
                            <CardDescription>
                                您的 API Key 仅保存在浏览器本地，绝不会上传到任何第三方服务器。
                                支持兼容 OpenAI 接口格式的所有大模型服务。
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="baseUrl">API 基础地址 (Base URL)</Label>
                                <Input
                                    id="baseUrl"
                                    placeholder="如: https://api.openai.com/v1"
                                    value={baseUrl}
                                    onChange={(e) => setBaseUrl(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="apiKey">API 密钥 (API Key)</Label>
                                <div className="relative">
                                    <Input
                                        id="apiKey"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="sk-..."
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        autoComplete="off"
                                        className="pr-10"
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="absolute right-0 top-0 h-full w-9 hover:bg-transparent"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t">
                                <div
                                    className="flex items-center justify-between cursor-pointer group"
                                    onClick={() => setIsModelListExpanded(!isModelListExpanded)}
                                >
                                    <div className="flex items-center space-x-2">
                                        <Label className="cursor-pointer group-hover:text-primary transition-colors">可用模型列表</Label>
                                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isModelListExpanded ? 'rotate-180' : ''}`} />
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleFetchModels();
                                        }}
                                        disabled={isLoadingModels}
                                    >
                                        {isLoadingModels && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        {isLoadingModels ? '拉取中...' : '拉取 / 刷新模型列表'}
                                    </Button>
                                </div>

                                {isModelListExpanded && (
                                    <div className="space-y-4">
                                        <div className="flex items-center space-x-2">
                                            <Input
                                                placeholder="输入自定义模型名称，例如: my-custom-model-2"
                                                value={customModelInput}
                                                onChange={(e) => setCustomModelInput(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleAddCustomModel()}
                                                className="flex-1"
                                            />
                                            <Button variant="secondary" onClick={handleAddCustomModel}>
                                                手动添加
                                            </Button>
                                        </div>

                                        {availableModels.length > 0 ? (
                                            <div className="flex flex-col gap-2 border rounded-md p-4 max-h-[400px] overflow-y-auto bg-muted/20">
                                                {sortedModels.map(m => {
                                                    const isSelected = selectedModels.includes(m);
                                                    const isDefault = defaultModel === m;
                                                    return (
                                                        <div
                                                            key={m}
                                                            onClick={() => toggleModelSelection(m)}
                                                            className={`flex items-start justify-between space-x-4 border rounded-md p-3 cursor-pointer transition-colors ${isSelected ? 'bg-primary/5 border-primary/20' : 'bg-background hover:bg-muted/50'
                                                                }`}
                                                        >
                                                            <div className="flex items-start space-x-3 flex-1 pointer-events-none">
                                                                <Checkbox
                                                                    id={`model-${m}`}
                                                                    checked={isSelected}
                                                                    onCheckedChange={() => { }}
                                                                    className="mt-1"
                                                                />
                                                                <label
                                                                    htmlFor={`model-${m}`}
                                                                    className="text-sm font-medium leading-relaxed break-all cursor-pointer"
                                                                >
                                                                    {m}
                                                                </label>
                                                            </div>
                                                            <div className="flex-shrink-0 flex items-center gap-3">
                                                                {modelTestStatus[m] === 'testing' && <span title="测试中..."><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></span>}
                                                                {modelTestStatus[m] === 'success' && <div className="h-2.5 w-2.5 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]" title="检测通过" />}
                                                                {modelTestStatus[m] === 'error' && <div className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]" title="连通失败" />}

                                                                {isSelected && (
                                                                    <Button
                                                                        variant={isDefault ? 'default' : 'outline'}
                                                                        size="sm"
                                                                        className={`h-7 px-3 text-xs ${isDefault ? '' : 'text-muted-foreground'}`}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setDefaultModel(m);
                                                                        }}
                                                                    >
                                                                        {isDefault ? '当前默认' : '设为默认'}
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="text-sm text-muted-foreground bg-muted/30 p-4 rounded-md text-center">
                                                暂无列表，请先输入 API 信息并点击上方"拉取"，或通过输入框手动指定。
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                        <CardFooter className="flex justify-between border-t pt-6 bg-muted/10">
                            <Button variant="secondary" onClick={handleTestAPI} disabled={isTesting}>
                                {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {isTesting ? '检测中...' : '一键连通性检测'}
                            </Button>
                            <Button onClick={handleSaveAPI}>
                                保存 API 配置
                            </Button>
                        </CardFooter>
                    </Card>
                </TabsContent>

                <TabsContent value="prompt">
                    <Card>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <div className="flex justify-between items-center mb-1">
                                    <Label className="text-base text-foreground font-medium">全局附加指令</Label>

                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                                        onClick={() => setGlobalPrompt(DEFAULT_GLOBAL_PROMPT)}
                                    >
                                        恢复默认
                                    </Button>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                    ℹ️ 全局提示词会以 <code className="bg-muted px-1 rounded">[全局附加指令]</code> 的形式追加到每个工具的系统提示词末尾。
                                </span>
                                <textarea
                                    value={globalPrompt}
                                    onChange={(e) => setGlobalPrompt(e.target.value)}
                                    rows={5}
                                    className="w-full rounded-md border bg-background p-3 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                                    placeholder={"例如：\n- 始终使用{{user}}代表用户，使用{{char}}代表角色。\n- 要求输出内容简洁明了，避免冗余"}
                                />
                            </div>

                            {/* 禁词表区域 */}
                            <div className="space-y-3 pt-4 border-t">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <div className="flex items-center gap-3">
                                            <Label className="text-base font-medium">全局禁词表</Label>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                                                onClick={() => setGlobalBannedWords(DEFAULT_GLOBAL_BANNED_WORDS)}
                                            >
                                                恢复默认
                                            </Button>
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                            强制拒绝所有工具使用特定的词汇或意象（如娇妻文学、过度夸张语境等）。
                                        </div>
                                    </div>
                                    <Switch
                                        checked={enableBannedWords}
                                        onCheckedChange={setEnableBannedWords}
                                    />
                                </div>
                                <textarea
                                    value={globalBannedWords}
                                    onChange={(e) => setGlobalBannedWords(e.target.value)}
                                    rows={8}
                                    className={`w-full rounded-md border p-3 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring transition-colors ${enableBannedWords ? 'bg-background' : 'bg-muted/50 text-muted-foreground opacity-70'
                                        }`}
                                    placeholder={"输入禁词列表..."}
                                    disabled={!enableBannedWords}
                                />
                            </div>
                        </CardContent>
                        <CardFooter className="flex justify-end border-t pt-6 bg-muted/10">
                            <Button onClick={() => {
                                store.setGlobalPrompt(globalPrompt);
                                store.setGlobalBannedWords(globalBannedWords);
                                store.setEnableBannedWords(enableBannedWords);
                                toast.success('全局提示词及禁词表已保存');
                            }}>保存所有内容</Button>
                        </CardFooter>
                    </Card>
                </TabsContent>

                <TabsContent value="theme">
                    <Card>
                        <CardHeader>
                            <CardTitle>外观设置</CardTitle>
                            <CardDescription>
                                个性化您的小兔几面板色彩风格。
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {THEMES.map(t => (
                                    <div
                                        key={t.id}
                                        onClick={() => setTheme(t.id)}
                                        className={`relative cursor-pointer rounded-lg border-2 p-4 flex flex-col items-center transition-all ${theme === t.id ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border hover:border-primary/50'
                                            }`}
                                    >
                                        {theme === t.id && (
                                            <div className="absolute top-2 right-2 flex items-center justify-center p-0.5 rounded-full bg-primary text-primary-foreground shadow-sm">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check">
                                                    <path d="M20 6 9 17l-5-5" />
                                                </svg>
                                            </div>
                                        )}
                                        <div className="font-medium mt-1">{t.name}</div>
                                        <div className="text-xs text-muted-foreground mt-1">{t.id}</div>

                                        {/* 微缩主题配色预览卡块 (硬编码演示当前主题的色彩倾向) */}
                                        <div className="mt-4 flex gap-1 w-full justify-center">
                                            <div className={`h-4 w-4 rounded-full ${t.id === 'theme-coffee' ? 'bg-[#5e3a2e]' :
                                                t.id === 'theme-supabase' ? 'bg-[#10b981]' :
                                                    'bg-[#7c3aed]'
                                                }`}></div>
                                            <div className="h-4 w-8 rounded bg-muted"></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                        <CardFooter className="flex justify-end border-t pt-6 bg-muted/10">
                            <Button onClick={handleSaveTheme}>应用外观</Button>
                        </CardFooter>
                    </Card>
                </TabsContent>

                <TabsContent value="data">
                    <Card>
                        <CardHeader>
                            <CardTitle>清理本地数据</CardTitle>
                            <CardDescription>
                                清理浏览器中储存的所有本地数据，包括 API 配置、导入的插件、执行历史、提示词编辑等。
                                该操作不可撤销。
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button variant="destructive" className="gap-2">
                                        <Trash2 className="h-4 w-4" />
                                        清理本地数据
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-sm">
                                    <DialogHeader>
                                        <DialogTitle>确认清理所有本地数据？</DialogTitle>
                                        <DialogDescription>
                                            此操作将删除浏览器中储存的所有数据，包括 API 配置、导入的插件、执行历史等。
                                            <strong>该操作不可撤销，页面将自动刷新。</strong>
                                        </DialogDescription>
                                    </DialogHeader>
                                    <DialogFooter>
                                        <Button
                                            variant="destructive"
                                            onClick={async () => {
                                                try {
                                                    await db.delete();
                                                    localStorage.clear();
                                                    toast.success('本地数据已全部清除，即将刷新页面...');
                                                    setTimeout(() => window.location.reload(), 1000);
                                                } catch {
                                                    toast.error('清理失败，请重试');
                                                }
                                            }}
                                        >
                                            确认清理
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
