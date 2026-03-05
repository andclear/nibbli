-- 小剧场数据表建表语句（在 Neon 控制台中执行）
-- 先创建序列，用于生成自增 ID
CREATE SEQUENCE IF NOT EXISTS stories_id_seq START 1;
-- 创建主表
CREATE TABLE IF NOT EXISTS stories (
    id TEXT PRIMARY KEY DEFAULT 'story_' || lpad(nextval('stories_id_seq')::TEXT, 5, '0'),
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    tags TEXT [] DEFAULT '{}',
    author TEXT DEFAULT '匿名',
    description TEXT DEFAULT '',
    content TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (
        status IN ('pending', 'approved', 'rejected', 'flagged')
    ),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- 创建索引以加速按分类和状态的查询
CREATE INDEX IF NOT EXISTS idx_stories_category ON stories (category);
CREATE INDEX IF NOT EXISTS idx_stories_status ON stories (status);
CREATE INDEX IF NOT EXISTS idx_stories_created_at ON stories (created_at DESC);
-- 复合索引：覆盖"已审核 + 按分类筛选 + 按时间倒序"的高频查询路径
CREATE INDEX IF NOT EXISTS idx_stories_status_category_created ON stories (status, category, created_at DESC);
-- 迁移：新增 reason 字段（AI 审核简要说明）
-- 如果表已存在，单独执行以下语句即可
ALTER TABLE stories
ADD COLUMN IF NOT EXISTS reason TEXT DEFAULT '';