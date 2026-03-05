// ===== 聊天记录解析器 =====
// 支持 SillyTavern JSONL 格式的聊天记录解析

// ===== 类型定义 =====

/** 聊天消息 */
export interface ChatMessage {
    name: string;
    is_user: boolean;
    is_system: boolean;
    send_date: string;
    mes: string;
    extra?: Record<string, unknown>;
}

/** 聊天元数据（JSONL 第一行） */
export interface ChatMetadata {
    user_name: string;
    character_name: string;
    create_date: string;
    chat_metadata?: Record<string, unknown>;
}

/** 聊天记录完整数据 */
export interface ChatHistoryData {
    metadata: ChatMetadata;
    messages: ChatMessage[];
}

// ===== 解析函数 =====

/**
 * 从 JSONL 字符串解析聊天记录
 * JSONL 格式规范：
 *   - 第 1 行：元数据（user_name, character_name, create_date, chat_metadata）
 *   - 第 2 行起：每行一条消息（name, is_user, is_system, send_date, mes）
 */
export function parseChatHistoryFromString(jsonlString: string): ChatHistoryData {
    const lines = jsonlString.trim().split('\n').filter(line => line.trim());

    if (lines.length === 0) {
        throw new Error('聊天记录文件为空');
    }

    // 解析第一行元数据
    let metadata: ChatMetadata;
    try {
        metadata = JSON.parse(lines[0]);
    } catch {
        throw new Error('聊天记录第一行（元数据）JSON 格式不合法');
    }

    if (!metadata.user_name && !metadata.character_name) {
        throw new Error('聊天记录元数据缺少 user_name 或 character_name 字段');
    }

    // 解析后续消息行
    const messages: ChatMessage[] = [];
    for (let i = 1; i < lines.length; i++) {
        try {
            const msg = JSON.parse(lines[i]);
            messages.push({
                name: msg.name || '',
                is_user: !!msg.is_user,
                is_system: !!msg.is_system,
                send_date: msg.send_date || '',
                mes: msg.mes || '',
                extra: msg.extra,
            });
        } catch {
            // 跳过格式不合法的行，但记录警告
            console.warn(`聊天记录第 ${i + 1} 行 JSON 格式不合法，已跳过`);
        }
    }

    return {
        metadata: {
            user_name: metadata.user_name || '',
            character_name: metadata.character_name || '',
            create_date: metadata.create_date || '',
            chat_metadata: metadata.chat_metadata,
        },
        messages,
    };
}

/**
 * 从文件解析聊天记录
 */
export async function parseChatHistory(file: File): Promise<ChatHistoryData> {
    const text = await file.text();
    return parseChatHistoryFromString(text);
}

/**
 * 从消息内容中提取顶层 `<content>` 标签的内容
 * 顶层标签特征：`<content>` 和 `</content>` 各自独占一行（前后有换行符）
 * 内联引用（如 `<thinking>` 中 backtick 包裹的 `<content>`）不会独占一行
 */
function extractContentTag(mes: string): string {
    // 优先匹配独占一行的 <content> 标签（顶层标签）
    const match = mes.match(/[\r\n]<content>[\r\n]([\s\S]*?)[\r\n]<\/content>/);
    if (match) {
        return match[1].trim();
    }

    // 降级：如果没有独占行的 content 标签，尝试普通匹配
    const fallback = mes.match(/<content>([\s\S]*?)<\/content>/);
    if (fallback) {
        return fallback[1].trim();
    }

    return mes;
}

/**
 * 提取精简的聊天消息列表（仅保留核心字段，节省 token）
 * - 自动提取 `<content>` 标签中的内容
 * - 排除系统消息
 * @param data 完整聊天记录
 * @param options 可选过滤参数
 */
export function extractChatMessages(
    data: ChatHistoryData,
    options?: {
        /** 是否排除系统消息（默认 true） */
        excludeSystem?: boolean;
        /** 最大消息数量（从末尾截取） */
        maxMessages?: number;
        /** 仅包含指定角色的消息 */
        filterByName?: string;
    }
): Array<{ role: 'user' | 'assistant' | 'system'; name: string; content: string }> {
    let msgs = [...data.messages];

    // 默认排除系统消息
    const shouldExcludeSystem = options?.excludeSystem !== false;
    if (shouldExcludeSystem) {
        msgs = msgs.filter(m => !m.is_system);
    }

    // 过滤指定角色
    if (options?.filterByName) {
        msgs = msgs.filter(m => m.name === options.filterByName);
    }

    // 截取最后 N 条
    if (options?.maxMessages && msgs.length > options.maxMessages) {
        msgs = msgs.slice(-options.maxMessages);
    }

    return msgs.map(m => ({
        role: m.is_system ? 'system' as const : m.is_user ? 'user' as const : 'assistant' as const,
        name: m.name,
        content: extractContentTag(m.mes),
    }));
}

/**
 * 提取聊天记录摘要（精简格式，供插件直接使用）
 * 返回值仅包含：精简元数据 + 消息数量 + 聊天记录列表
 */
export function extractChatSummary(
    data: ChatHistoryData,
    options?: {
        excludeSystem?: boolean;
        maxMessages?: number;
    }
): {
    metadata: { user_name: string; character_name: string };
    messageCount: number;
    messages: Array<{ role: 'user' | 'assistant' | 'system'; name: string; content: string }>;
} {
    const messages = extractChatMessages(data, options);
    return {
        metadata: {
            user_name: data.metadata.user_name,
            character_name: data.metadata.character_name,
        },
        messageCount: data.messages.length,
        messages,
    };
}

