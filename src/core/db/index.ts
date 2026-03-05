import Dexie, { type Table } from 'dexie';

/**
 * 单条执行历史的结构
 * 记录每次工具执行的输入、输出和状态
 */
export interface ExecutionHistory {
    id?: number;          // 自增主键
    toolId: string;       // 使用了哪个工具 (例如 'lore_expander')
    timestamp: number;    // 执行时间戳
    inputs: Record<string, unknown>; // 用户当时的输入参数
    result: unknown;          // 执行结果 (文本或复杂 JSON)
    status: 'success' | 'error';
    errorMessage?: string;
}

/**
 * 键值对存储结构
 * 用于持久化系统级别的状态，比如 Zustand 的设置数据
 */
export interface KeyValue {
    key: string;
    value: string;
}

/**
 * 用户导入的自定义插件的持久化结构
 * 存储经过序列化的插件 JSON，以便应用加载时恢复注册
 */
export interface CustomPlugin {
    id: string;            // 插件 ID（与 ToolConfig.id 一致）
    name: string;          // 插件名称
    description: string;
    version: string;
    author?: string;       // 插件作者
    inputsJson: string;    // JSON.stringify(inputs)
    executeScript: string; // 用户提供的执行函数字符串
    systemPrompt: string;  // 系统提示词
    importedAt: number;    // 导入时间戳
}

/**
 * 用户已分享的小剧场本地记录
 * 存储 Vercel API 返回的 story ID，用于后续查询审核状态
 */
export interface SharedStory {
    id: string;            // 服务端返回的 story ID（如 story_00001）
    title: string;         // 小剧场标题（便于本地展示）
    sharedAt: number;      // 分享时间戳
}

/**
 * 核心数据库类
 * 基于 Dexie.js 封装的 IndexedDB 数据库
 */
export class NibbliDatabase extends Dexie {
    history!: Table<ExecutionHistory, number>;
    keyValue!: Table<KeyValue, string>;
    customPlugins!: Table<CustomPlugin, string>;
    sharedStories!: Table<SharedStory, string>;

    constructor() {
        super('NibbliDB');
        // V1 添加了 history; V2 添加了 keyValue; V3 添加了 customPlugins; V4 添加了 sharedStories
        this.version(1).stores({
            history: '++id, toolId, timestamp, status'
        });
        this.version(2).stores({
            history: '++id, toolId, timestamp, status',
            keyValue: 'key'
        });
        this.version(3).stores({
            history: '++id, toolId, timestamp, status',
            keyValue: 'key',
            customPlugins: 'id, importedAt'
        });
        this.version(4).stores({
            history: '++id, toolId, timestamp, status',
            keyValue: 'key',
            customPlugins: 'id, importedAt',
            sharedStories: 'id, sharedAt'
        });
    }
}

/**
 * 数据库全局单例
 */
export const db = new NibbliDatabase();
