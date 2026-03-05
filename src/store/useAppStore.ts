import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';
import { db } from '@/core/db';

/**
 * 全局应用状态接口
 * 仅存放跨组件频繁读取的核心配置
 */
interface AppState {
    // AI 设置
    apiBaseUrl: string;
    apiKey: string;
    defaultModel: string;
    availableModels: string[]; // 从 API 获取的可用模型列表
    selectedModels: string[]; // 用户勾选启用的模型列表

    // UI 设置
    theme: 'theme-coffee' | 'theme-supabase' | 'theme-skyline';
    colorMode: 'light' | 'dark' | 'system';

    // 全局提示词
    globalPrompt: string;

    // 全局禁词表
    globalBannedWords: string;
    enableBannedWords: boolean;

    // 是否开启静默流式接收（防截断兜底策略的主控开关）
    enableSilentStream: boolean;

    // 行为
    setApiConfig: (baseUrl: string, key: string, defaultModel: string, selectedModels: string[]) => void;
    setAvailableModels: (models: string[]) => void;
    setTheme: (theme: AppState['theme']) => void;
    setColorMode: (mode: AppState['colorMode']) => void;
    setGlobalPrompt: (prompt: string) => void;
    setGlobalBannedWords: (words: string) => void;
    setEnableBannedWords: (enable: boolean) => void;
    setEnableSilentStream: (enable: boolean) => void;
}

/**
 * 自定义 Zustand 异步存储引擎，使用 Dexie (IndexedDB)
 */
const dexieStorage: StateStorage = {
    getItem: async (name: string): Promise<string | null> => {
        const record = await db.keyValue.get(name);
        return record ? record.value : null;
    },
    setItem: async (name: string, value: string): Promise<void> => {
        await db.keyValue.put({ key: name, value });
    },
    removeItem: async (name: string): Promise<void> => {
        await db.keyValue.delete(name);
    }
};

export const DEFAULT_GLOBAL_PROMPT = `始终使用{{user}}代表用户，使用{{char}}代表角色。
始终使用简体中文进行回复`;

export const DEFAULT_GLOBAL_BANNED_WORDS = `**禁用词汇（绝对禁令）**：
严禁在输出中使用以下词汇、概念或其同义词。
- **神学类（反上帝情结）**：神明、神祇、信徒、教徒、崇拜、膜拜、祭坛、神迹、神谕、救赎、圣光、天使、祭品、信仰、虔诚。
- **捕食类（反兽性）**：猎人、猎物、捕食、狩猎、困兽、幼兽、小兽、藏品、艺术家（指物化语境中）、玩弄。
- **夸张矫揉造作类（反套路）**：绝望、沙哑、喟叹、尖叫、白光、肉刃、撕裂、低吼、玩味、一丝、不容置疑、不容置喙、宣告。
- **禁用表象/意象**：石子（多指向湖中投掷）、涟漪、针、羽毛、手术刀、火山、火花、燃烧。
- **不必要的角色**：老师/教师、导师、学生/学徒、国王、骑士、公主。`;

/**
 * 全局状态管理 Store
 * 使用 persist 中间件与 Dexie 结合，自动持久化到 IndexedDB
 */
export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
            apiBaseUrl: '',
            apiKey: '',
            defaultModel: '',  // 留空，让用户首次使用时自行配置
            availableModels: [],
            selectedModels: [],

            theme: 'theme-coffee',
            colorMode: 'system',

            globalPrompt: DEFAULT_GLOBAL_PROMPT,
            globalBannedWords: DEFAULT_GLOBAL_BANNED_WORDS,
            enableBannedWords: true,

            enableSilentStream: false,
            setApiConfig: (apiBaseUrl, apiKey, defaultModel, selectedModels) =>
                set({ apiBaseUrl, apiKey, defaultModel, selectedModels }),
            setAvailableModels: (availableModels) => set({ availableModels }),
            setTheme: (theme) => set({ theme }),
            setColorMode: (mode) => set({ colorMode: mode }),
            setGlobalPrompt: (prompt) => set({ globalPrompt: prompt }),
            setGlobalBannedWords: (words) => set({ globalBannedWords: words }),
            setEnableBannedWords: (enable) => set({ enableBannedWords: enable }),
            setEnableSilentStream: (enable) => set({ enableSilentStream: enable }),
        }),
        {
            name: 'nibbli-global-settings', // IndexedDB 表中的 key
            storage: createJSONStorage(() => dexieStorage),
        }
    )
);
