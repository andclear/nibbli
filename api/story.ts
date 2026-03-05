import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

/**
 * GET /api/story?id=xxx
 * 获取指定 ID 的已审核通过的小剧场详情
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: '仅支持 GET 请求' });
    }

    const { id } = req.query;
    if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: '必须提供有效的 id 参数' });
    }

    try {
        const sql = neon(process.env.DATABASE_URL!);

        const rows = await sql`
            SELECT id, title, category, tags, author, description, content, created_at
            FROM stories
            WHERE id = ${id} AND status = 'approved'
            LIMIT 1
        `;

        if (rows.length === 0) {
            return res.status(404).json({ error: '未找到该小剧场，或尚未审核通过' });
        }

        return res.status(200).json(rows[0]);
    } catch (err) {
        console.error(`获取小剧场详情 [${id}] 失败:`, err);
        return res.status(500).json({ error: '服务器内部错误' });
    }
}
