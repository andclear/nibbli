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

    return new OpenAI({
        baseURL,
        apiKey,
        dangerouslyAllowBrowser: true,
        fetch: cleanFetch,
    });
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
