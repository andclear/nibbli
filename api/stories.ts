import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

/**
 * GET /api/stories
 * 获取所有已审核通过的小剧场列表
 * 查询参数：category（可选，按分类筛选）
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: '仅支持 GET 请求' });
    }

    try {
        const sql = neon(process.env.DATABASE_URL!);
        const { category } = req.query;

        let rows;
        if (category && typeof category === 'string') {
            rows = await sql`
                SELECT id, title, category, tags, author, description, content, created_at
                FROM stories
                WHERE status = 'approved' AND category = ${category}
                ORDER BY created_at DESC
            `;
        } else {
            rows = await sql`
                SELECT id, title, category, tags, author, description, content, created_at
                FROM stories
                WHERE status = 'approved'
                ORDER BY created_at DESC
            `;
        }

        return res.status(200).json(rows);
    } catch (err) {
        console.error('获取小剧场列表失败:', err);
        return res.status(500).json({ error: '服务器内部错误' });
    }
}
