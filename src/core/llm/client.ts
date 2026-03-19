import OpenAI from 'openai';

/**
 * 创建 OpenAI 客户端实例
 * 配置 dangerouslyAllowBrowser: true 以允许浏览器端直连
 */
export function createLLMClient(baseURL: string, apiKey: string): OpenAI {
    // 自定义 fetch 包装器：在请求发出前物理删除 SDK 自动注入的遥测请求头
    // 这些 x-stainless-* 非标准头会触发浏览器 CORS 预检失败
    const cleanFetch: typeof fetch = (input, init) => {
        if (init?.headers) {
            const headers = new Headers(init.headers);
            // 遍历并删除所有 x-stainless- 前缀的头
            const toDelete: string[] = [];
            headers.forEach((_value, key) => {
                if (key.toLowerCase().startsWith('x-stainless-')) {
                    toDelete.push(key);
                }
            });
            toDelete.forEach(key => headers.delete(key));
            init.headers = headers;
        }
        return fetch(input, init);
    };

    const client = new OpenAI({
        baseURL,
        apiKey,
        dangerouslyAllowBrowser: true,
        fetch: cleanFetch,
    });

    // 拦截 create 方法以提高极端 API（如 Minimax, o1）的兼容性
    const originalCreate = client.chat.completions.create.bind(client.chat.completions);

    // @ts-expect-error 动态覆盖类的方法以实现兼容性拦截
    client.chat.completions.create = async (body, options) => {
        let response: Awaited<ReturnType<typeof originalCreate>>;
        try {
            response = await originalCreate(body, options);
        } catch (error: unknown) {
            const err = error as Error & { status?: number }; // OpenAI API Error object usually contains status

            // 只要 API 抛出 400 (Bad Request) 或 422 (Unprocessable Entity) 参数错误，
            // 且原始请求中包含了 system 角色，我们就统一当作“特定参数不兼容”进行降级重试。
            const isParameterError = err?.status === 400 || err?.status === 422;
            const hasSystemRole = body.messages?.some(m => m.role === 'system');

            if (isParameterError && hasSystemRole) {
                console.warn(`[兼容性回退] API 返回 ${err?.status} 参数错误，可能是对 System 角色限制导致的。尝试降级 Payload...`, err?.message);
                const fallbackBody = { ...body };

                type MessageType = typeof fallbackBody.messages[number];
                const fallbackMsgs: MessageType[] = [];
                let sysStrs: string[] = [];

                for (const m of fallbackBody.messages) {
                    if (m.role === 'system') {
                        sysStrs.push(String(m.content));
                    } else if (m.role === 'user') {
                        if (sysStrs.length > 0) {
                            fallbackMsgs.push({
                                role: 'user',
                                content: `[System Instructions]\n${sysStrs.join('\n\n')}\n\n[User Input]\n${m.content}`
                            } as MessageType);
                            sysStrs = []; // 清空已合并的 system
                        } else {
                            fallbackMsgs.push(m);
                        }
                    } else {
                        fallbackMsgs.push(m);
                    }
                }

                if (sysStrs.length > 0) {
                    fallbackMsgs.push({ role: 'user', content: sysStrs.join('\n\n') } as MessageType);
                }
                fallbackBody.messages = fallbackMsgs;

                // O1 等模型不支持调整温度
                delete fallbackBody.temperature;

                // 携带兼容参数发起第二次隐式重试
                response = await originalCreate(fallbackBody, options);
            } else {
                throw error;
            }
        }

        // --- 全局后处理：移除输出中的思维链标签 ---
        // 仅处理非流式的完整文本返回（工具调用通常都是这种格式）
        if (!body.stream && response && 'choices' in response && Array.isArray((response as unknown as Record<string, unknown>).choices)) {
            for (const choice of (response as unknown as Record<string, unknown>).choices as Record<string, unknown>[]) {
                if (choice.message && typeof choice.message === 'object' && 'content' in choice.message && typeof choice.message.content === 'string') {
                    let text = choice.message.content;
                    // 1. 匹配并移除完整的 <think>...</think> 或 <thinking>...</thinking> 及其后的多余空行
                    text = text.replace(/<(think|thinking)>[\s\S]*?<\/\1>\n*/gi, '');
                    // 2. 兜底处理：如果遇到极长思考导致被 max_tokens 截断（只有开头标签没有结尾），直接截掉标签及后面所有内容
                    text = text.replace(/<(think|thinking)>[\s\S]*$/gi, '');
                    (choice.message as Record<string, unknown>).content = text.trim();
                }
            }
        }

        return response;
    };

    return client;
}

import { withErrorHandling } from './errorHandler';

/**
 * 获取可用模型列表
 * 用户填写自定义地址和 API Key 后，可调用此接口获取真实模型列表
 */
export async function fetchAvailableModels(client: OpenAI): Promise<string[]> {
    return withErrorHandling(async () => {
        const models: string[] = [];
        for await (const model of client.models.list()) {
            models.push(model.id);
        }
        return models.sort();
    });
}
