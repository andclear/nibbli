import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

/**
 * 单条小剧场的提交数据结构
 */
interface StorySubmission {
    title: string;
    category: string;
    description?: string;
    content: string;
    author?: string;
    tags?: string[];
}

/**
 * POST /api/share
 * 接收小剧场数据，写入 Neon 数据库，返回生成的 ID
 * 支持单条或批量提交（数组形式）
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: '仅支持 POST 请求' });
    }

    try {
        const sql = neon(process.env.DATABASE_URL!);
        const body = req.body;

        // 统一处理为数组
        const submissions: StorySubmission[] = Array.isArray(body) ? body : [body];

        // 校验必填字段
        for (const item of submissions) {
            if (!item.title || !item.category || !item.content) {
                return res.status(400).json({
                    error: '每条小剧场必须包含 title、category 和 content 字段'
                });
            }
        }

        // 逐条插入并收集返回的 ID
        const results: { id: string; title: string }[] = [];
        for (const item of submissions) {
            const rows = await sql`
                INSERT INTO stories (title, category, description, content, author, tags)
                VALUES (
                    ${item.title},
                    ${item.category},
                    ${item.description || ''},
                    ${item.content},
                    ${item.author || '匿名'},
                    ${item.tags || []}
                )
                RETURNING id, title
            `;
            if (rows.length > 0) {
                results.push({ id: rows[0].id, title: rows[0].title });
            }
        }

        return res.status(201).json({
            success: true,
            count: results.length,
            stories: results
        });
    } catch (err) {
        console.error('分享小剧场失败:', err);
        return res.status(500).json({ error: '服务器内部错误' });
    }
}
