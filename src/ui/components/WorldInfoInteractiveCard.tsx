import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Copy, Loader2, Send, MessageSquarePlus } from 'lucide-react';
import { toast } from 'sonner';
import type { CoreContext } from '@/core/types';

interface WorldInfoEntry {
    comment: string;
    content: string;
}

interface Props {
    initialData: {
        entries: WorldInfoEntry[];
        initialSystemPrompt: string;
    };
    coreContext: CoreContext;
}

export function WorldInfoInteractiveCard({ initialData, coreContext }: Props) {
    const [entries, setEntries] = useState<WorldInfoEntry[]>(initialData.entries);
    const [isGenerating, setIsGenerating] = useState(false);
    const [userInput, setUserInput] = useState('');
    const [entryCount, setEntryCount] = useState('1');

    const handleCopy = (text: string, title?: string) => {
        navigator.clipboard.writeText(text).then(() => {
            toast.success(`已复制${title ? `：${title}` : '内容'}`);
        });
    };

    const handleAppendGeneration = async () => {
        if (!userInput.trim()) {
            toast.error('请输入追加要求的补充说明！');
            return;
        }

        if (!coreContext.defaultModel) {
            toast.error('未配置默认执行模型。');
            return;
        }

        setIsGenerating(true);
        toast('正在追加测算...请耐心等待');

        try {
            // 利用曾有的 SystemPrompt 作为骨架，替换目前数量
            let systemPrompt = initialData.initialSystemPrompt.replace(/Please generate EXACTLY \d entries/, `Please generate EXACTLY ${entryCount} entries`);

            // 构建记忆上下文
            let priorContext = "### Already Established Archives (DO NOT REPEAT):\n";
            entries.forEach(e => {
                priorContext += `- **${e.comment}**\n${e.content}\n\n`;
            });
            priorContext += "\n--- IMPORTANT: You must stay STRICTLY within the SAME exact world setting established above. The upcoming entries MUST NOT redefine or repeat any concepts already created. You must strictly follow the user's specific request below to generate new, distinct entries for THIS specific world.\n";

            systemPrompt += "\n\n" + priorContext;

            const response = await coreContext.llmClient.chat.completions.create({
                model: coreContext.defaultModel,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userInput.trim() }
                ],
                temperature: 0.7,
            });

            const content = response.choices[0]?.message?.content || '';
            const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i) || content.match(/(\[[\s\S]*?\])/);

            if (!jsonMatch) {
                throw new Error("AI未能返回标准JSON数组格式!");
            }
            const newEntries: WorldInfoEntry[] = JSON.parse(jsonMatch[1]);

            setEntries(prev => [...prev, ...newEntries]);
            setUserInput('');
            toast.success(`成功追加 ${newEntries.length} 条设定!`);

        } catch (e: unknown) {
            console.error("Append World Info Error:", e);
            toast.error(`追加生成失败: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="flex flex-col space-y-6">
            <div className="space-y-4">
                {entries.map((entry, idx) => (
                    <div key={idx} className="bg-card border border-border shadow-sm rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-muted/40 border-b">
                            <h3 className="text-base font-bold text-foreground">📌 {entry.comment}</h3>
                            <div className="flex flex-wrap items-center gap-2">
                                <Button variant="ghost" size="sm" onClick={() => handleCopy(entry.comment, '标题文本')}>
                                    <Copy className="w-4 h-4 mr-1.5 opacity-70" />
                                    <span className="text-xs">复制标题</span>
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleCopy(entry.content, '条目设定主体')}>
                                    <Copy className="w-4 h-4 mr-1.5 opacity-70" />
                                    <span className="text-xs">复制正文</span>
                                </Button>
                            </div>
                        </div>
                        <div className="p-4">
                            <article className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed">
                                <ReactMarkdown>{entry.content}</ReactMarkdown>
                            </article>
                        </div>
                    </div>
                ))}
            </div>

            <div className="sticky bottom-0 mt-4 border rounded-xl bg-background shadow-lg p-5">
                <div className="flex flex-col space-y-4">
                    <div className="flex items-center gap-2">
                        <MessageSquarePlus className="w-5 h-5 text-primary" />
                        <h4 className="text-sm font-bold">延伸探究</h4>
                        <span className="text-xs text-muted-foreground mr-auto">基于上方已有资料，挖掘此世界观的其他侧面细节。</span>
                        <div className="flex items-center space-x-2">
                            <label className="text-xs">追加生成条数:</label>
                            <select
                                value={entryCount}
                                onChange={(e) => setEntryCount(e.target.value)}
                                className="h-8 rounded-md border text-sm px-2 bg-background focus:ring-1 focus:outline-none"
                            >
                                <option value="1">1条</option>
                                <option value="2">2条</option>
                                <option value="3">3条</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex items-stretch gap-3">
                        <div className="flex-1 flex flex-col justify-center">
                            <textarea
                                value={userInput}
                                onChange={(e) => setUserInput(e.target.value)}
                                placeholder="输入想要追问或展开阐述的新方向..."
                                className="w-full h-full min-h-[60px] p-3 text-sm bg-transparent border rounded-lg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                                onKeyDown={(e) => {
                                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAppendGeneration();
                                    }
                                }}
                            />
                        </div>
                        <Button
                            onClick={handleAppendGeneration}
                            disabled={isGenerating || !userInput.trim()}
                            className="h-auto min-h-[60px] px-6 shrink-0"
                        >
                            {isGenerating ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <><Send className="h-4 w-4 mr-2" /> 深入发掘</>
                            )}
                        </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground opacity-60 text-right w-full m-0">
                        提示: 支持按 Cmd/Ctrl + Enter 快捷发送请求。生成结果将自动拼接到上方列表中。
                    </p>
                </div>
            </div>
        </div>
    );
}
