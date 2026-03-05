import OpenAI from 'openai';
import { toast } from 'sonner';

/**
 * 自定义 LLM 错误类
 */
export class LLMError extends Error {
    code: 'NETWORK_ERROR' | 'UNAUTHORIZED' | 'RATE_LIMITED' | 'TIMEOUT' | 'UNKNOWN';
    originalError?: unknown;

    constructor(
        code: 'NETWORK_ERROR' | 'UNAUTHORIZED' | 'RATE_LIMITED' | 'TIMEOUT' | 'UNKNOWN',
        message: string,
        originalError?: unknown
    ) {
        super(message);
        this.name = 'LLMError';
        this.code = code;
        this.originalError = originalError;
    }
}

/**
 * 带有统一错误拦截包装的执行器
 * @param execution Fn 需要执行的 OpenAI 调用
 * @returns T 返回调用结果
 * @throws LLMError 抛出标准化后的自定义错误
 */
export async function withErrorHandling<T>(execution: () => Promise<T>): Promise<T> {
    try {
        return await execution();
    } catch (err: unknown) {
        const error = err as Error & { status?: number };

        // 处理 OpenAI 返回的一般 HTTP 状态码错误
        if (error instanceof OpenAI.APIError) {
            const status = error.status;

            if (status === 401) {
                const msg = 'API 密钥无效或已过期，请在设置中检查您的 API Key。';
                toast.error(msg);
                throw new LLMError('UNAUTHORIZED', msg, error);
            }

            if (status === 429) {
                const msg = '请求过于频繁或额度耗尽，请稍后重试。';
                toast.error(msg);
                throw new LLMError('RATE_LIMITED', msg, error);
            }

            if (status === 404) {
                const msg = '所选模型或接口地址不存在，请检查 API Base URL 和模型名称。';
                toast.error(msg);
                throw new LLMError('UNKNOWN', msg, error);
            }

            // 未匹配的 HTTP 错误
            toast.error(`API 请求失败: ${error.message} (HTTP ${status})`);
            throw new LLMError('UNKNOWN', error.message, error);
        }

        // 处理网络层面的错误 (fetch error / 跨域)
        const errorMsg = error.message?.toLowerCase() || '';
        if (errorMsg.includes('failed to fetch') || errorMsg.includes('network error')) {
            const msg = '无法连接到 API 服务器。可能原因：地址不通、网络异常或目标接口未配置 CORS 跨域许可。';
            toast.error(msg);
            throw new LLMError('NETWORK_ERROR', msg, error);
        }

        // 处理超时 (前端传入的超时引发)
        if (errorMsg.includes('timeout') || errorMsg.includes('aborted')) {
            const msg = 'API 请求超时，请检查网络或更换更快的接口地址。';
            toast.error(msg);
            throw new LLMError('TIMEOUT', msg, error);
        }

        // 兜底
        toast.error(`未知错误: ${error.message || '发生意外的系统错误'}`);
        throw new LLMError('UNKNOWN', error.message || '未知错误', error);
    }
}
