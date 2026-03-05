import type { ToolConfig } from '@/core/types';

/**
 * 虚拟工具定义：快速回复生成器
 * 这个工具只负责在“酒馆脚本”分类下提供一个展示卡片，
 * 实际的执行逻辑（execute）永远不会被调用，因为我们在 HomePage 中
 * 拦截了它的点击，直接将其路由到全屏定制化页面 /quick-reply-generator。
 */
export const qrGeneratorTool: ToolConfig = {
    id: 'qr_generator',
    name: '快速回复生成器',
    category: '酒馆脚本',
    author: '老婆宝',
    description: '通过简单的图形界面配置，生成 SillyTavern 快速回复 (Quick Reply) v2 格式的 JSON 文件。提供所见即所得的预览效果，无需 AI 即可直接配置使用。',
    version: '1.0.0',
    inputs: [],
    execute: async () => {
        // 这里的逻辑永远不会执行，被外层路由拦截
        throw new Error('此工具为独立页面应用，不应触发标准执行流程。');
    }
};
