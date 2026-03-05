// ===== 全局核心接口契约 =====

/**
 * 工具输入字段类型
 * 决定 UI 层渲染成哪种表单组件
 */
export type ToolInputType = 'string' | 'text' | 'number' | 'boolean' | 'file' | 'select';

/**
 * 工具输入字段定义
 * 声明工具需要的 UI 字段，供动态表单渲染引擎使用
 */
export interface ToolInput {
    name: string;           // 字段键名
    label: string;          // UI 标签文字
    type: ToolInputType;    // 决定渲染成 Input 还是 Textarea
    required?: boolean;
    defaultValue?: unknown;
    options?: Array<{ label: string; value: string | number; prompt?: string }>; // 仅 select 有效
    allowOptionPromptEdit?: boolean; // 是否允许用户在 UI 自定义此 select 每个选项的提示词，默认为 true
    description?: string;
    accept?: string;        // 仅 file 有效，如 ".png,.json"
}

/**
 * 核心上下文
 * 注入给工具的执行环境，包含 AI 客户端、数据库操作和通知能力
 */
export interface CoreContext {
    llmClient: import('openai').OpenAI; // 注入全局配置好的 AI 客户端
    db: import('./db').NibbliDatabase; // 注入数据库操作能力
    toast: (msg: string, type?: 'success' | 'error') => void;
    systemPrompt: string;   // 当前工具的系统提示词（优先使用本地覆写，否则用默认值）
    globalPrompt: string;   // 全局附加提示词（追加到所有 API 调用中）
    defaultModel: string;   // 用户当前选定的默认模型名称
    parsers: {
        /** 智能解析角色卡文件（自动识别 JSON/PNG 格式） */
        parseCharaCard: (file: File) => Promise<import('./parsers/charaCardParser').CharaCardData>;
        /** 按模式提取精简字段 */
        extractCharaFields: (
            card: import('./parsers/charaCardParser').CharaCardData,
            mode: import('./parsers/charaCardParser').ExtractMode
        ) => import('./parsers/charaCardParser').ExtractedCharaData;
        /** 解析 JSONL 聊天记录文件 */
        parseChatHistory: (file: File) => Promise<import('./parsers/chatHistoryParser').ChatHistoryData>;
        /** 提取精简的聊天消息列表 */
        extractChatMessages: (
            data: import('./parsers/chatHistoryParser').ChatHistoryData,
            options?: { excludeSystem?: boolean; maxMessages?: number; filterByName?: string }
        ) => Array<{ role: 'user' | 'assistant' | 'system'; name: string; content: string }>;
        /** 提取聊天记录摘要（精简元数据 + 消息数量 + 消息列表） */
        extractChatSummary: (
            data: import('./parsers/chatHistoryParser').ChatHistoryData,
            options?: { excludeSystem?: boolean; maxMessages?: number }
        ) => {
            metadata: { user_name: string; character_name: string };
            messageCount: number;
            messages: Array<{ role: 'user' | 'assistant' | 'system'; name: string; content: string }>;
        };
        /** 安全提取 Markdown 里的 JSON 字符串 */
        extractJsonFromMarkdown: typeof import('./parsers').extractJsonFromMarkdown;
        /** 解析预设文件，按排序和启用状态过滤后返回 prompt 条目列表 */
        parsePresetFile: (file: File) => Promise<import('./parsers/presetParser').PresetEntry[]>;
    };
}

/**
 * 工具配置接口
 * 所有工具插件必须实现此接口，系统通过读取此接口自动完成 UI 渲染、数据收集和逻辑执行
 */
export interface ToolConfig {
    id: string;             // 唯一英文 ID
    name: string;           // 工具中文名
    description: string;    // 功能描述
    version: string;
    author?: string;        // 插件作者
    category?: string;      // 工具分类（如 '文本处理'、'角色卡'、'世界观'），未指定则归入 '通用工具'
    systemPrompt?: string;  // 默认系统提示词（用户可在 UI 中编辑覆写，恢复默认时回到此值）
    inputs: ToolInput[];    // 声明需要的 UI 字段
    // 核心执行逻辑
    execute: (inputValues: Record<string, unknown>, context: CoreContext) => Promise<unknown>;
}

// ===== 两阶段工具调用类型 =====

/**
 * 单条建议项
 * 工具在第一阶段分析后，返回包含此结构的数组
 */
export interface ToolSuggestion {
    /** 建议的唯一标识（同一次结果内唯一） */
    id: string;
    /** 建议标题，显示在卡片头部（如"条目：开场白"） */
    label: string;
    /** 原始内容，供用户对比查看（可为空） */
    original?: string;
    /** AI 建议的新内容（用户可复制此字段） */
    proposed: string;
    /**
     * 采纳建议并二次优化的 prompt（可选）
     * 携带原文 + 修改意见触发 AI 生成最终优化后的内容
     * 有此字段时，UI 会显示「采纳并优化」按钮，点击发起第二次 AI 调用
     */
    refinePrompt?: string;
}

/**
 * 两阶段工具调用的返回体
 * 工具的 execute 函数 return 此对象时，UI 将渲染建议卡片（而非纯文本）
 */
export interface ToolSuggestionsResult {
    /** 魔法字段，触发建议卡片渲染逻辑 */
    _type: 'suggestions';
    /** 整体摘要说明（支持 Markdown） */
    summary: string;
    /** 建议列表 */
    suggestions: ToolSuggestion[];
}

