import { Routes, Route } from 'react-router-dom';
import { Layout } from './ui/components/Layout';
import { CoreContextProvider } from './core/CoreContextProvider';
import { ThemeProvider } from './ui/components/ThemeProvider';
import { useEffect, useState, Suspense, lazy } from 'react';
import { restoreCustomPlugins } from './core/pluginLoader';
import { Loader2 } from 'lucide-react';
import { ErrorBoundary } from './ui/components/ErrorBoundary';

const HomePage = lazy(() => import('./ui/pages/HomePage').then(module => ({ default: module.HomePage })));
const SettingsPage = lazy(() => import('./ui/pages/SettingsPage').then(module => ({ default: module.SettingsPage })));
const ToolDetailPage = lazy(() => import('./ui/pages/ToolDetailPage').then(module => ({ default: module.ToolDetailPage })));
const TheaterPage = lazy(() => import('./ui/pages/TheaterPage').then(module => ({ default: module.TheaterPage })));
const TheaterDetailPage = lazy(() => import('./ui/pages/TheaterDetailPage').then(module => ({ default: module.TheaterDetailPage })));
const HistoryPage = lazy(() => import('./ui/pages/HistoryPage').then(module => ({ default: module.HistoryPage })));
const QuickReplyGeneratorPage = lazy(() => import('./ui/pages/QuickReplyGeneratorPage').then(module => ({ default: module.QuickReplyGeneratorPage })));
const PluginDocPage = lazy(() => import('./ui/pages/PluginDocPage').then(module => ({ default: module.PluginDocPage })));


/**
 * 局部 Loading 组件，在异步加载页面 JS chunk 时显示
 */
function PageFallback() {
  return (
    <div className="flex h-full min-h-[50vh] w-full items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      <span className="ml-2 text-sm text-muted-foreground">正在加载模块...</span>
    </div>
  );
}

/**
 * 临时占位组件，直到页面实现完成
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
          <Suspense fallback={<PageFallback />}>
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
          </Suspense>
        </ThemeProvider>
      </CoreContextProvider>
    </ErrorBoundary>
  );
}

export default App;
