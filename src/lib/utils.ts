import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * 合并 Tailwind CSS 类名的工具函数
 * 支持条件类名和冲突解决
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}
