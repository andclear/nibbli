// ===== 预设文件解析器 =====
// 从 SillyTavern 预设 JSON 文件中提取按排序和启用状态过滤后的 prompt 条目列表

/**
 * 预设条目（最终输出）
 * 包含 name、content，以及已知系统标识符的 remark 备注
 */
export interface PresetEntry {
    /** 条目标识符，用于原文匹配 */
    identifier: string;
    name: string;
    content: string;
    /** 已知系统标识符的备注说明（非系统标识符时为 undefined） */
    remark?: string;
}

/**
 * 已知系统标识符 → 备注说明的映射表
 */
const SYSTEM_IDENTIFIER_REMARKS: Record<string, string> = {
    main: 'Main Prompt — 主提示词，控制 AI 的主要行为',
    nsfw: 'Auxiliary Prompt — 用于 NSFW 内容',
    jailbreak: 'Post-History Instructions — 后历史指令，用于 jailbreak 等',
    chatHistory: 'Chat History — 聊天历史',
    dialogueExamples: 'Chat Examples — 对话示例',
    worldInfoBefore: 'World Info (before) — 世界信息（在角色前）',
    worldInfoAfter: 'World Info (after) — 世界信息（在角色后）',
    enhanceDefinitions: 'Enhance Definitions — 增强定义',
    charDescription: 'Char Description — 角色描述',
    charPersonality: 'Char Personality — 角色性格',
    scenario: 'Scenario — 场景',
    personaDescription: 'Persona Description — 用户人设描述',
};

/**
 * 预设文件中 prompts 数组的原始条目结构
 */
interface RawPromptItem {
    identifier: string;
    name: string;
    content: string;
    enabled?: boolean;
    [key: string]: unknown;
}

/**
 * prompt_order 中单个排序条目
 */
interface OrderItem {
    identifier: string;
    enabled: boolean;
}

/**
 * prompt_order 数组中的一个分组
 */
interface PromptOrderGroup {
    character_id: number;
    order: OrderItem[];
}

/**
 * 从预设 JSON 文件中提取有效的 prompt 条目列表
 *
 * 逻辑：
 * 1. 读取根字段 `prompts`，提取每个条目的 identifier / name / content
 * 2. 读取根字段 `prompt_order`，确定排序和启用状态：
 *    - 如果只有一个 order 分组，直接使用
 *    - 如果有多个分组，使用 character_id === 100001 的那个
 * 3. 按 order 数组的顺序排列条目
 * 4. 排除 prompt_order.order 中 enabled === false 的条目
 * 5. 返回仅含 name 和 content 的条目列表
 */
export async function parsePresetFile(file: File): Promise<PresetEntry[]> {
    const text = await file.text();
    let json: Record<string, unknown>;
    try {
        json = JSON.parse(text);
    } catch {
        throw new Error('预设文件 JSON 解析失败');
    }

    // 提取 prompts 数组
    const prompts = json.prompts;
    if (!Array.isArray(prompts) || prompts.length === 0) {
        throw new Error('预设文件中未找到有效的 prompts 字段');
    }

    // 构建 identifier → 原始条目 的映射
    const promptMap = new Map<string, RawPromptItem>();
    for (const item of prompts as RawPromptItem[]) {
        // identifier 和 name 必须存在，content 允许为空字符串
        if (item.identifier && typeof item.name === 'string') {
            promptMap.set(item.identifier, item);
        }
    }

    // 提取 prompt_order
    const promptOrder = json.prompt_order;
    if (!Array.isArray(promptOrder) || promptOrder.length === 0) {
        throw new Error('预设文件中未找到有效的 prompt_order 字段');
    }

    // 确定使用哪个 order 分组
    let targetGroup: PromptOrderGroup;
    if (promptOrder.length === 1) {
        // 仅一个分组，直接使用
        targetGroup = promptOrder[0] as PromptOrderGroup;
    } else {
        // 多个分组，查找 character_id === 100001
        const found = (promptOrder as PromptOrderGroup[]).find(
            (g) => g.character_id === 100001
        );
        if (!found) {
            throw new Error('预设文件包含多个 prompt_order 分组，但未找到 character_id=100001 的分组');
        }
        targetGroup = found;
    }

    const orderList = targetGroup.order;
    if (!Array.isArray(orderList)) {
        throw new Error('prompt_order 中的 order 字段无效');
    }

    // 按 order 排序并过滤掉 enabled === false 的条目
    const result: PresetEntry[] = [];
    for (const orderItem of orderList) {
        // 跳过未启用的条目
        if (orderItem.enabled === false) {
            continue;
        }

        const prompt = promptMap.get(orderItem.identifier);
        if (prompt) {
            const entry: PresetEntry = {
                identifier: orderItem.identifier,
                name: prompt.name,
                content: prompt.content ?? '',
            };
            // 如果是已知系统标识符，附加备注说明
            const remark = SYSTEM_IDENTIFIER_REMARKS[orderItem.identifier];
            if (remark) {
                entry.remark = remark;
            }
            result.push(entry);
        }
    }

    return result;
}
