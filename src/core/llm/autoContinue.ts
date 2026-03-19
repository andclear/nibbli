import OpenAI from 'openai';
import { useAppStore } from '@/store/useAppStore';

/**
 * 静默流式接收拦截器
 * 用户勾选"流式输出"时：后台以 stream 方式接收所有 chunk，拼装完毕后伪装为普通 completion 返回
 * 用户取消勾选时：直接使用非流式请求
 *
 * @param originalCreate 原始的 chat.completions.create 绑定方法
 * @param params 请求参数
 * @param options 网络层控制信息
 */
export async function runWithSilentStream(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    originalCreate: any,
    params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
    options?: OpenAI.RequestOptions
): Promise<OpenAI.Chat.Completions.ChatCompletion> {

    // 实时读取用户是否勾选了流式输出
    const enableStream = useAppStore.getState().enableSilentStream ?? true;

    if (!enableStream) {
        // 用户关闭了流式：直接走原始非流式请求
        return originalCreate(params, options);
    }

    // 用户开启了流式：后台静默接收所有 chunk 后拼装
    const streamParams = { ...params, stream: true };
    const stream = await originalCreate(streamParams, options);

    let fullContent = '';
    let finishReason: string | null = 'stop';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let baseChunk: any = null;

    for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || '';
        fullContent += delta;
        if (chunk.choices[0]?.finish_reason) {
            finishReason = chunk.choices[0].finish_reason;
        }
        if (!baseChunk) {
            baseChunk = { ...chunk };
        }
    }

    // 后处理：移除可能存在的模型思维链（<think>...</think> 或 <thinking>...</thinking>）
    fullContent = fullContent.replace(/<(think|thinking)>[\s\S]*?<\/\1>\n*/gi, '');
    fullContent = fullContent.replace(/<(think|thinking)>[\s\S]*$/gi, '');
    fullContent = fullContent.trim();

    // 将流式碎片伪装为标准的非流式 ChatCompletion 格式返回
    const completion: OpenAI.Chat.Completions.ChatCompletion = {
        id: baseChunk?.id || 'chatcmpl-silent',
        object: 'chat.completion',
        created: baseChunk?.created || Math.floor(Date.now() / 1000),
        model: baseChunk?.model || params.model,
        choices: [{
            index: 0,
            message: { role: 'assistant', content: fullContent, refusal: null },
            finish_reason: (finishReason || 'stop') as 'stop' | 'length',
            logprobs: null,
        }],
        usage: undefined,
    };

    return completion;
}
