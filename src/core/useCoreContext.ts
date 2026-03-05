import { useContext } from 'react';
import type { CoreContext } from './types';
import { Context } from './CoreContextSymbol'; // 接下来提取 Context 定义

/**
 * 业务组件或插件钩子：获取系统层核心对象
 */
export function useCoreContext(): CoreContext {
    const ctx = useContext(Context);
    if (!ctx) {
        throw new Error('useCoreContext 必须在 CoreContextProvider 内部使用');
    }
    return ctx;
}
