import type { ToolConfig } from '@/core/types';

export const textOptimizerTool: ToolConfig = {
    id: 'text_optimizer',
    name: '文本内容优化',
    description: '通过 AI 优化文本内容，精简 Token，提升对 AI 的可读性和精准度。',
    version: '1.0.0',
    category: '角色设定',
    author: '老婆宝',
    systemPrompt: `Please optimize/rewrite the following text based on the system instruction.

Objectives:
1. Reduce token usage (Be concise).
2. Increase precision and clarity.
3. Improve readability for AI comprehension.

Rules:
1. Use {{char}} for character name and {{user}} for user name.
2. Strictly PRESERVE the original format (e.g. "Name: Content", newlines, spacing).
3. Do NOT change any code blocks or code snippets.
4. Maintain the original newline style.

Output directly without any explanation or markdown code block.`,
    inputs: [
        {
            name: 'text',
            label: '需要优化的内容',
            type: 'text',
            required: true,
            description: '在此输入需要优化的原始文本内容...'
        }
    ],
    execute: async (inputs, context) => {
        const text = inputs.text as string;

        if (!text || !text.trim()) {
            throw new Error('请输入需要优化的内容');
        }

        if (!context.defaultModel) {
            throw new Error('请先在设置中配置默认模型');
        }

        // 全局提示词追加
        let activePrompt = context.systemPrompt;
        if (context.globalPrompt) {
            activePrompt += '\n\n[全局附加指令]\n' + context.globalPrompt;
        }

        context.toast('正在努力优化内容中...');

        const userMessage = `Text to optimize:\n${text}`;

        const response = await context.llmClient.chat.completions.create({
            model: context.defaultModel,
            messages: [
                { role: 'system', content: activePrompt },
                { role: 'user', content: userMessage }
            ],
            temperature: 0.7
        });

        let result = response.choices[0]?.message?.content || '';
        if (!result) {
            throw new Error('AI 返回了空内容，请重试');
        }

        // 移除可能的 markdown code block 包装（如 ``` ... ```）
        result = result.replace(/^```[\w-]*\n/i, '').replace(/\n```$/i, '');

        return result;
    }
};
