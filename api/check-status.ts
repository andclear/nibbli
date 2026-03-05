import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

/**
 * GET /api/check-status?ids=story_00001,story_00002,story_00003
 * 批量查询小剧场的审核状态
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: '仅支持 GET 请求' });
    }

    try {
        const { ids } = req.query;

        if (!ids || typeof ids !== 'string') {
            return res.status(400).json({ error: '请提供 ids 参数（逗号分隔）' });
        }

        const idList = ids.split(',').map(id => id.trim()).filter(Boolean);

        if (idList.length === 0) {
            return res.status(400).json({ error: 'ids 参数不能为空' });
        }

        const sql = neon(process.env.DATABASE_URL!);

        // 查询所有匹配的 ID 及其状态
        const rows = await sql`
            SELECT id, status, title
            FROM stories
            WHERE id = ANY(${idList})
        `;

        // 构造 { id: status } 的映射
        const statusMap: Record<string, string> = {};
        for (const row of rows) {
            statusMap[row.id] = row.status;
        }

        // 对于不存在于数据库中的 ID，标记为 unknown
        for (const id of idList) {
            if (!statusMap[id]) {
                statusMap[id] = 'unknown';
            }
        }

        return res.status(200).json(statusMap);
    } catch (err) {
        console.error('查询状态失败:', err);
        return res.status(500).json({ error: '服务器内部错误' });
    }
}
