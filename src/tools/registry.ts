import type { ToolConfig } from '@/core/types';

/**
 * 工具注册中心
 * 采用中央注册表 + 声明式导出模式
 * - 第三方开发者只需实现 ToolConfig 接口并导出
 * - 核心系统通过注册中心统一管理工具的生命周期
 */
class ToolRegistry {
    private tools: Map<string, ToolConfig> = new Map();

    /**
     * 注册一个工具到注册中心
     * 如果工具 ID 已存在则发出警告并覆盖
     */
    register(tool: ToolConfig): void {
        if (this.tools.has(tool.id)) {
            console.warn(`[ToolRegistry] 工具 "${tool.id}" 已存在，将被覆盖。`);
        }
        this.tools.set(tool.id, tool);
    }

    /**
     * 批量注册多个工具
     */
    registerAll(tools: ToolConfig[]): void {
        tools.forEach((tool) => this.register(tool));
    }

    /**
     * 根据 ID 获取指定工具
     */
    getById(id: string): ToolConfig | undefined {
        return this.tools.get(id);
    }

    /**
     * 获取所有已注册工具列表
     */
    getAll(): ToolConfig[] {
        return Array.from(this.tools.values());
    }

    /**
     * 检查工具是否已注册
     */
    has(id: string): boolean {
        return this.tools.has(id);
    }

    /**
     * 注销一个工具
     */
    unregister(id: string): boolean {
        return this.tools.delete(id);
    }

    /**
     * 获取所有不重复的分类名称列表
     */
    getCategories(): string[] {
        const categories = new Set<string>();
        for (const tool of this.tools.values()) {
            categories.add(tool.category || '通用工具');
        }
        return Array.from(categories);
    }

    /**
     * 按分类获取工具列表
     */
    getByCategory(category: string): ToolConfig[] {
        return this.getAll().filter(t => (t.category || '通用工具') === category);
    }

    /**
     * 获取按分类分组的工具 Map
     */
    getGroupedByCategory(): Map<string, ToolConfig[]> {
        const grouped = new Map<string, ToolConfig[]>();
        for (const tool of this.tools.values()) {
            const cat = tool.category || '通用工具';
            if (!grouped.has(cat)) {
                grouped.set(cat, []);
            }
            grouped.get(cat)!.push(tool);
        }
        return grouped;
    }
}

// 导出全局单例
export const toolRegistry = new ToolRegistry();
