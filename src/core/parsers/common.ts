/**
 * 通用解析辅助方法
 */

/**
 * 提取被 Markdown 代码块（如 ```json ... ```）包裹的 JSON 字符串
 * 应对 AI 返回结果可能带有 Markdown 标记导致 JSON.parse 失败的问题
 */
export function extractJsonFromMarkdown(text: string): string {
    const trimmed = text.trim();

    // 如果没有被反引号包裹，直接返回
    if (!trimmed.startsWith('```')) {
        return trimmed;
    }

    // 匹配 ```json（或只有 ```）和结尾的 ``` 之间的内容
    const match = trimmed.match(/^```(?:json|)\s*([\s\S]*?)\s*```$/i);

    if (match && match[1]) {
        return match[1].trim();
    }

    // 如果匹配失败但确实以 ``` 开头，尝试粗暴剥离第一行和最后一行
    const lines = trimmed.split('\n');
    if (lines.length > 2 && lines[0].startsWith('```') && lines[lines.length - 1].startsWith('```')) {
        return lines.slice(1, -1).join('\n').trim();
    }

    return trimmed;
}
