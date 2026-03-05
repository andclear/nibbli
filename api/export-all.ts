import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

/**
 * GET /api/export-all
 * 流式导出所有已审核通过的小剧场（TXT 格式）
 * 使用 Transfer-Encoding: chunked 以规避 Vercel 响应大小限制
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: '仅支持 GET 请求' });
    }

    try {
        const sql = neon(process.env.DATABASE_URL!);

        // 查询所有已审核通过的小剧场
        const rows = await sql`
            SELECT title, category, description, content
            FROM stories
            WHERE status = 'approved'
            ORDER BY created_at DESC
        `;

        // 生成时间戳文件名
        const d = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        const ts = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

        // 设置流式纯文本响应头
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(`小兔几_小剧场_${ts}.txt`)}"`);
        res.setHeader('Transfer-Encoding', 'chunked');

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const block = [
                '### Title',
                `Title: ${row.title}`,
                `Category: ${row.category || ''}`,
                `Desc: ${row.description || ''}`,
                '',
                row.content || '',
            ].join('\n');

            res.write(block);

            // 不同小剧场之间用一个空行分隔
            if (i < rows.length - 1) {
                res.write('\n\n');
            }
        }

        res.end();
    } catch (err) {
        console.error('导出小剧场失败:', err);
        if (!res.headersSent) {
            return res.status(500).json({ error: '服务器内部错误' });
        }
        res.end();
    }
}
