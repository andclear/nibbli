import { createContext } from 'react';
import type { CoreContext } from './types';

// 单独提取 Context 符号，供 Provider 和 Hook 共享
export const Context = createContext<CoreContext | null>(null);
