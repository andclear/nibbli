import React, { useMemo } from 'react';
import type { CoreContext } from './types';
import { useAppStore } from '@/store/useAppStore';
import { createLLMClient } from './llm/client';
import { db } from './db';
import { toast } from 'sonner';
import { runWithSilentStream } from './llm/autoContinue';
import { Context } from './CoreContextSymbol';
import {
    parseCharaCard,
    extractCharaFields,
    parseChatHistory,
    extractChatMessages,
    extractChatSummary,
    extractJsonFromMarkdown,
    parsePresetFile,
} from './parsers';

/**
 * 全局 CoreContext 提供者
 * 将底层 LLM 客户端、数据库单例、通知能力、解析器进行组装
 */
export function CoreContextProvider({ children }: { children: React.ReactNode }) {
    const store = useAppStore();

    const llmClient = useMemo(() => {
        const baseURL = store.apiBaseUrl || 'https://api.openai.com/v1';
        const apiKey = store.apiKey || 'NONE';
        const client = createLLMClient(baseURL, apiKey);

        // 代理拦截默认的 chat 生成方法
        const originalCreate = client.chat.completions.create.bind(client.chat.completions);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (client.chat.completions as any).create = async (params: any, options?: any) => {
            // 从 Store 实时读取全局提示词并自动注入
            const currentGlobalPrompt = useAppStore.getState().globalPrompt;
            if (currentGlobalPrompt && params.messages) {
                const globalMsg = {
                    role: 'system' as const,
                    content: `[全局附加指令]\n${currentGlobalPrompt}`,
                };
                // 将全局提示词插入到第一条 system 消息之后（如果有的话），否则插入最前面
                const firstNonSystemIdx = params.messages.findIndex(
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (m: any) => m.role !== 'system'
                );
                const insertIdx = firstNonSystemIdx > 0 ? firstNonSystemIdx : params.messages.length > 0 ? 1 : 0;
                params = {
                    ...params,
                    messages: [
                        ...params.messages.slice(0, insertIdx),
                        globalMsg,
                        ...params.messages.slice(insertIdx),
                    ],
                };
            }

            // 如果插件显式要求了 stream: true（意味着它自己接管流的渲染），直接放行
            if (params.stream) {
                return originalCreate(params, options);
            }
            // 否则，代理到静默流式接收的 wrapper（根据用户偏好决定是否启用流式）
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return runWithSilentStream(originalCreate, params, options) as any;
        };

        return client;
    }, [store.apiBaseUrl, store.apiKey]);

    const value = useMemo<CoreContext>(
        () => ({
            llmClient,
            db,
            toast: (msg: string, type: 'success' | 'error' = 'success') => {
                if (type === 'success') toast.success(msg);
                else toast.error(msg);
            },
            systemPrompt: '',   // 由 DynamicToolForm 在执行时动态覆写
            globalPrompt: '',   // 由 DynamicToolForm 在执行时动态覆写
            defaultModel: '',   // 由 DynamicToolForm 在执行时动态覆写
            parsers: {
                parseCharaCard,
                extractCharaFields,
                parseChatHistory,
                extractChatMessages,
                extractChatSummary,
                extractJsonFromMarkdown,
                parsePresetFile,
            },
        }),
        [llmClient]
    );

    return <Context.Provider value={value}>{children}</Context.Provider>;
}
