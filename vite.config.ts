import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin, loadEnv } from "vite"
import { VitePWA } from "vite-plugin-pwa"

/**
 * 本地开发用 API 中间件插件
 * 直连 Neon 数据库，从 .env 读取 DATABASE_URL
 */
function localApiPlugin(): Plugin {
  let dbUrl: string | undefined;

  return {
    name: 'local-api',
    configResolved(config) {
      // 从 .env 文件加载环境变量
      const env = loadEnv(config.mode, config.root, '');
      dbUrl = env.DATABASE_URL;
      if (!dbUrl) {
        console.warn('\n⚠️  未找到 DATABASE_URL 环境变量，请在 .env 文件中配置。小剧场 API 将不可用。\n');
      }
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // 仅拦截 /api/ 开头的请求
        if (!req.url?.startsWith('/api/')) return next();
        if (!dbUrl) {
          res.statusCode = 503;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: '未配置 DATABASE_URL，请在项目根目录创建 .env 文件' }));
          return;
        }

        // 动态导入 neon（避免在无 DATABASE_URL 时报错）
        const { neon } = await import('@neondatabase/serverless');
        const sql = neon(dbUrl);
        res.setHeader('Content-Type', 'application/json');

        try {
          // GET /api/stories
          if ((req.url === '/api/stories' || req.url?.startsWith('/api/stories?')) && req.method === 'GET') {
            const url = new URL(req.url, 'http://localhost');
            const category = url.searchParams.get('category');
            let rows;
            if (category) {
              rows = await sql`SELECT id, title, category, tags, author, description, content, created_at FROM stories WHERE status = 'approved' AND category = ${category} ORDER BY created_at DESC`;
            } else {
              rows = await sql`SELECT id, title, category, tags, author, description, content, created_at FROM stories WHERE status = 'approved' ORDER BY created_at DESC`;
            }
            res.end(JSON.stringify(rows));
            return;
          }

          // GET /api/story
          if (req.url?.startsWith('/api/story?') && req.method === 'GET') {
            const url = new URL(req.url, 'http://localhost');
            const id = url.searchParams.get('id');
            if (!id) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: '请提供 id 参数' }));
              return;
            }
            const rows = await sql`SELECT id, title, category, tags, author, description, content, created_at FROM stories WHERE id = ${id} AND status = 'approved' LIMIT 1`;
            if (rows.length === 0) {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: '未找到该小剧场，或尚未审核通过' }));
              return;
            }
            res.end(JSON.stringify(rows[0]));
            return;
          }

          // GET /api/check-status
          if (req.url?.startsWith('/api/check-status') && req.method === 'GET') {
            const url = new URL(req.url, 'http://localhost');
            const ids = url.searchParams.get('ids');
            if (!ids) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: '请提供 ids 参数' }));
              return;
            }
            const idList = ids.split(',').map(id => id.trim()).filter(Boolean);
            const rows = await sql`SELECT id, status FROM stories WHERE id = ANY(${idList})`;
            const statusMap: Record<string, string> = {};
            for (const row of rows) statusMap[row.id] = row.status;
            for (const id of idList) if (!statusMap[id]) statusMap[id] = 'unknown';
            res.end(JSON.stringify(statusMap));
            return;
          }

          // POST /api/share
          if (req.url === '/api/share' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
              try {
                const data = JSON.parse(body);
                const items = Array.isArray(data) ? data : [data];
                const results: { id: string; title: string }[] = [];
                for (const item of items) {
                  if (!item.title || !item.category || !item.content) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: '每条小剧场必须包含 title、category 和 content' }));
                    return;
                  }
                  const rows = await sql`INSERT INTO stories (title, category, description, content, author, tags) VALUES (${item.title}, ${item.category}, ${item.description || ''}, ${item.content}, ${item.author || '匿名'}, ${item.tags || []}) RETURNING id, title`;
                  if (rows.length > 0) results.push({ id: rows[0].id, title: rows[0].title });
                }
                res.statusCode = 201;
                res.end(JSON.stringify({ success: true, count: results.length, stories: results }));
              } catch (err) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: '处理请求失败: ' + (err instanceof Error ? err.message : String(err)) }));
              }
            });
            return;
          }

          // GET /api/export-all（流式导出全部小剧场为 TXT）
          if (req.url === '/api/export-all' && req.method === 'GET') {
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename="stories_all.txt"');
            const rows = await sql`SELECT title, category, description, content FROM stories WHERE status = 'approved' ORDER BY created_at DESC`;
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
              if (i < rows.length - 1) res.write('\n\n');
            }
            res.end();
            return;
          }

          // 未匹配的 API 路径
          res.statusCode = 404;
          res.end(JSON.stringify({ error: '未找到该 API 路由' }));
        } catch (err) {
          console.error('API 错误:', err);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: '服务器内部错误: ' + (err instanceof Error ? err.message : String(err)) }));
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    localApiPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: '小兔几',
        short_name: '小兔几',
        description: '小兔几 — ST工具箱',
        theme_color: '#18181b',
        background_color: '#18181b',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // 缓存页面资源，支持离线访问
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // 排除 API 请求的缓存
        navigateFallbackDenylist: [/^\/api\//],
        // 自动清理旧版本缓存，避免旧资源路径导致 MIME type 错误
        cleanupOutdatedCaches: true,
        // 新 Service Worker 立即接管，不等待旧页面关闭
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
