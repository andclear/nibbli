/**
 * 自定义插件加载器
 * 负责将用户上传的单文件 .js 插件解析为 ToolConfig 并注册到系统中
 * 同时处理从 IndexedDB 恢复已导入插件的逻辑
 *
 * 单文件格式：
 *   /*---CONFIG--- { JSON元数据 } ---END_CONFIG---*\/
 *   /*---PROMPT--- 纯文本提示词（支持 Markdown） ---END_PROMPT---*\/
 *   /*---EXECUTE--- return async function 的内部函数体代码 ---END_EXECUTE---*\/
 */

import type { ToolConfig, ToolInput } from '@/core/types';
import { db } from '@/core/db';
import type { CustomPlugin } from '@/core/db';
import { toolRegistry } from '@/tools/registry';

/** 自定义插件的固定分类名称 */
export const CUSTOM_CATEGORY = '自定义插件';

/**
 * 插件配置块的预期结构
 */
export interface PluginConfigFormat {
    id: string;
    name: string;
    description: string;
    version?: string;
    author?: string;
    category?: string;
    inputs: ToolInput[];
}

/**
 * 将函数体字符串（EXECUTE 块内容）安全地反序列化为可执行的异步函数
 *
 * 新约定格式（EXECUTE 块内直接写函数体，可使用 inputs / context / return）：
 *   var file = inputs.myFile;
 *   ...
 *   return result;
 *
 * 兼容旧格式（外层包一层 return async function）：
 *   return async function(inputs, context) { ... }
 */
export function deserializeExecute(executeScript: string): ToolConfig['execute'] {
    try {
        // 检测是否是旧格式（外层包一层 return async function）
        const isLegacyFormat = /^\s*return\s+async\s+function/.test(executeScript);

        if (isLegacyFormat) {
            // 旧格式：用 new Function 包裹，再调用取出函数
            const factory = new Function(executeScript);
            const fn = factory();
            if (typeof fn !== 'function') {
                throw new Error('执行脚本必须返回一个函数');
            }
            return fn as ToolConfig['execute'];
        } else {
            // 新格式（EXECUTE 块内容）：直接构造为 AsyncFunction
            // AsyncFunction 构造时等同于: async function(inputs, context) { <executeScript> }
            const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor as {
                new(...args: string[]): (...args: unknown[]) => Promise<unknown>;
            };
            const fn = new AsyncFunction('inputs', 'context', executeScript);
            return fn as ToolConfig['execute'];
        }
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`插件执行函数解析失败: ${msg}`);
    }
}

/**
 * 解析单个 .js 文件格式的插件
 *
 * 文件结构约定：
 *   CONFIG 块:  块注释包裹 JSON 元数据
 *   PROMPT 块:  以 ---PROMPT--- 开始，---END--- 结束（纯文本提示词）
 *   执行脚本:   剩余代码，return async function(inputs, context) { ... }
 */
export function parsePluginJsFile(fileContent: string): {
    config: PluginConfigFormat;
    systemPrompt: string;
    executeScript: string;
} {
    // 1. 提取 CONFIG 块（在块注释中）
    const configRegex = /\/\*---CONFIG---([\s\S]*?)---END_CONFIG---\*\//;
    const configMatch = fileContent.match(configRegex);
    if (!configMatch) {
        throw new Error(
            '未找到配置块。\n' +
            '请在文件开头添加：/*---CONFIG--- { ... JSON配置 ... } ---END_CONFIG---*/'
        );
    }

    let configJson: Record<string, unknown>;
    try {
        configJson = JSON.parse(configMatch[1].trim());
    } catch {
        throw new Error('CONFIG 块中的 JSON 格式不合法，请检查语法。');
    }

    // 校验必需字段
    if (!configJson.id || typeof configJson.id !== 'string') {
        throw new Error('CONFIG 中缺少必需的 "id" 字段');
    }
    if (!configJson.name || typeof configJson.name !== 'string') {
        throw new Error('CONFIG 中缺少必需的 "name" 字段');
    }
    if (!configJson.description || typeof configJson.description !== 'string') {
        throw new Error('CONFIG 中缺少必需的 "description" 字段');
    }
    if (!Array.isArray(configJson.inputs)) {
        throw new Error('CONFIG 中缺少必需的 "inputs" 字段（数组类型）');
    }

    // 校验每个 input 的基本结构
    for (const input of configJson.inputs as unknown[]) {
        const inp = input as Record<string, unknown>;
        if (!inp.name || !inp.label || !inp.type) {
            throw new Error('inputs 中的字段定义不完整，每个字段必须包含 name、label、type');
        }
        const validTypes = ['string', 'text', 'number', 'boolean', 'file', 'select'];
        if (!validTypes.includes(inp.type as string)) {
            throw new Error(`inputs 中字段 "${inp.name}" 的 type "${inp.type}" 不合法，支持: ${validTypes.join(', ')}`);
        }
    }

    const config: PluginConfigFormat = {
        id: configJson.id as string,
        name: configJson.name as string,
        description: configJson.description as string,
        version: (configJson.version as string) || '1.0.0',
        author: (configJson.author as string) || undefined,
        category: (configJson.category as string) || undefined,
        inputs: configJson.inputs as ToolInput[],
    };

    // 2. 提取 PROMPT 块（纯文本区域，包含在 /*---PROMPT--- 和 ---END_PROMPT---*/ 之间）
    const promptRegex = /\/\*---PROMPT---([\s\S]*?)---END_PROMPT---\*\//;
    const promptMatch = fileContent.match(promptRegex);
    let systemPrompt = promptMatch ? promptMatch[1].trim() : '';

    // 为了向前兼容未包含在注释中的旧版格式（备用正则表达式）
    const legacyPromptRegex = /---PROMPT---([\s\S]*?)---END---/;
    let actualPromptRegex = promptRegex;

    if (!promptMatch) {
        const legacyMatch = fileContent.match(legacyPromptRegex);
        if (legacyMatch) {
            systemPrompt = legacyMatch[1].trim();
            actualPromptRegex = legacyPromptRegex;
        }
    }

    // 2.5 提取 Option 专属 PROMPT 块
    // 格式：/*---PROMPT_字段名_选项值--- [内容] ---END_PROMPT---*/
    const optionPromptRegex = /\/\*---PROMPT_([a-zA-Z0-9_]+)_([a-zA-Z0-9_-]+)---([\s\S]*?)---END_PROMPT---\*\//g;
    let optionMatch;
    while ((optionMatch = optionPromptRegex.exec(fileContent)) !== null) {
        const fieldName = optionMatch[1];
        const optionVal = optionMatch[2];
        const optPrompt = optionMatch[3].trim();

        // 寻找到对应的 input -> option，并将 prompt 挂载上去
        const input = config.inputs?.find(i => i.name === fieldName);
        if (input && input.options) {
            const opt = input.options.find(o => String(o.value) === optionVal);
            if (opt) {
                opt.prompt = optPrompt;
            }
        }
    }

    // 3. 提取 EXECUTE 块（新格式：/*---EXECUTE--- 函数体 ---END_EXECUTE---*/）
    const executeRegex = /\/\*---EXECUTE---([\s\S]*?)---END_EXECUTE---\*\//;
    const executeMatch = fileContent.match(executeRegex);
    let executeScript = executeMatch ? executeMatch[1].trim() : '';

    // 向前兼容旧格式：去掉 CONFIG 和 PROMPT 块后剩余的顶层代码
    if (!executeScript) {
        executeScript = fileContent
            .replace(configRegex, '')
            .replace(actualPromptRegex, '')
            .replace(/\/\*\s*eslint-disable[^*]*\*\//g, '') // 去掉 eslint-disable 注释
            .trim();
    }

    if (!executeScript) {
        throw new Error(
            '未找到执行脚本代码。\n' +
            '请在文件中添加:\n' +
            '/*---EXECUTE---\n' +
            'var result = ...;\n' +
            'return result;\n' +
            '---END_EXECUTE---*/'
        );
    }

    return { config, systemPrompt, executeScript };
}

/**
 * 从单个 .js 文件导入插件（唯一的导入入口）
 */
export async function importPlugin(jsContent: string): Promise<ToolConfig> {
    const { config, systemPrompt, executeScript } = parsePluginJsFile(jsContent);

    // 反序列化执行函数
    const executeFn = deserializeExecute(executeScript);

    // 构造 ToolConfig
    const toolConfig: ToolConfig = {
        id: config.id,
        name: config.name,
        description: config.description,
        version: config.version || '1.0.0',
        author: config.author,
        category: CUSTOM_CATEGORY,
        systemPrompt,
        inputs: config.inputs,
        execute: executeFn,
    };

    // 注册到全局注册中心
    toolRegistry.register(toolConfig);

    // 持久化到 IndexedDB
    const record: CustomPlugin = {
        id: config.id,
        name: config.name,
        description: config.description,
        version: config.version || '1.0.0',
        author: config.author,
        inputsJson: JSON.stringify(config.inputs),
        executeScript,
        systemPrompt,
        importedAt: Date.now(),
    };
    await db.customPlugins.put(record);

    return toolConfig;
}

/**
 * 更新已存在的自定义插件（通过重新上传 .js 文件）
 */
export async function updateCustomPlugin(pluginId: string, jsContent: string): Promise<ToolConfig> {
    const existing = await db.customPlugins.get(pluginId);
    if (!existing) {
        throw new Error('未找到原自定义插件数据');
    }

    const { config, systemPrompt, executeScript } = parsePluginJsFile(jsContent);
    const executeFn = deserializeExecute(executeScript);

    const toolConfig: ToolConfig = {
        id: config.id,
        name: config.name,
        description: config.description,
        version: config.version || '1.0.0',
        author: config.author,
        category: CUSTOM_CATEGORY,
        systemPrompt,
        inputs: config.inputs,
        execute: executeFn,
    };

    toolRegistry.register(toolConfig);

    // 覆盖旧记录
    existing.name = config.name;
    existing.description = config.description;
    existing.version = config.version || '1.0.0';
    existing.author = config.author;
    existing.inputsJson = JSON.stringify(config.inputs);
    existing.executeScript = executeScript;
    existing.systemPrompt = systemPrompt;

    await db.customPlugins.put(existing);

    return toolConfig;
}

/**
 * 从 IndexedDB 恢复所有已导入的自定义插件
 * 应在应用启动时调用
 */
export async function restoreCustomPlugins(): Promise<number> {
    const plugins = await db.customPlugins.toArray();
    let count = 0;

    for (const plugin of plugins) {
        try {
            const inputs: ToolInput[] = JSON.parse(plugin.inputsJson);
            const executeFn = deserializeExecute(plugin.executeScript);

            const toolConfig: ToolConfig = {
                id: plugin.id,
                name: plugin.name,
                description: plugin.description,
                version: plugin.version,
                author: plugin.author,
                category: CUSTOM_CATEGORY,
                systemPrompt: plugin.systemPrompt || '',
                inputs,
                execute: executeFn,
            };

            toolRegistry.register(toolConfig);
            count++;
        } catch (err) {
            console.error(`[PluginLoader] 恢复插件 "${plugin.id}" 失败:`, err);
        }
    }

    return count;
}

/**
 * 删除一个已导入的自定义插件
 */
export async function removeCustomPlugin(pluginId: string): Promise<void> {
    toolRegistry.unregister(pluginId);
    await db.customPlugins.delete(pluginId);
}

/**
 * 获取所有已持久化的自定义插件 ID 列表
 */
export async function getCustomPluginIds(): Promise<string[]> {
    const plugins = await db.customPlugins.toArray();
    return plugins.map(p => p.id);
}
