import { Routes, Route } from 'react-router-dom';
import { Layout } from './ui/components/Layout';
import { CoreContextProvider } from './core/CoreContextProvider';
import { ThemeProvider } from './ui/components/ThemeProvider';
import { useEffect, useState } from 'react';
import { restoreCustomPlugins } from './core/pluginLoader';
import { ErrorBoundary } from './ui/components/ErrorBoundary';
import { HomePage } from './ui/pages/HomePage';
import { SettingsPage } from './ui/pages/SettingsPage';
import { ToolDetailPage } from './ui/pages/ToolDetailPage';
import { TheaterPage } from './ui/pages/TheaterPage';
import { TheaterDetailPage } from './ui/pages/TheaterDetailPage';
import { HistoryPage } from './ui/pages/HistoryPage';
import { QuickReplyGeneratorPage } from './ui/pages/QuickReplyGeneratorPage';
import { PluginDocPage } from './ui/pages/PluginDocPage';

/**
 * 临时占位组件
 */
function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <h1 className="text-3xl font-bold mb-4">{title}</h1>
      <p className="text-muted-foreground">页面开发中...</p>
    </div>
  );
}

/**
 * 应用路由挂载点
 */
function App() {
  const [pluginsRestored, setPluginsRestored] = useState(false);

  useEffect(() => {
    restoreCustomPlugins().then(() => {
      setPluginsRestored(true);
    });
  }, []);

  if (!pluginsRestored) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <p className="text-muted-foreground animate-pulse">正在加载插件系统...</p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <CoreContextProvider>
        <ThemeProvider>
          <Routes>
            {/* 独立全屏页面（不使用 Layout 包裹，新标签页中打开） */}
            <Route path="/plugin-doc" element={<PluginDocPage />} />

            <Route element={<Layout />}>
              {/* 实际页面 */}
              <Route path="/" element={<HomePage />} />
              <Route path="/settings" element={<SettingsPage />} />

              {/* 具体工具页和其它页 */}
              <Route path="/tool/:toolId" element={<ToolDetailPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/theater" element={<TheaterPage />} />
              <Route path="/theater/:id" element={<TheaterDetailPage />} />
              <Route path="/quick-reply-generator" element={<QuickReplyGeneratorPage />} />

              {/* 404 捕获 */}
              <Route path="*" element={<PlaceholderPage title="404 - 页面未找到" />} />
            </Route>
          </Routes>
        </ThemeProvider>
      </CoreContextProvider>
    </ErrorBoundary>
  );
}

export default App;
