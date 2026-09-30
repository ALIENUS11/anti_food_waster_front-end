import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConfigProvider } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import zhCN from 'antd/locale/zh_CN'
import { antdTheme } from '@/theme/antd'
import { registerEchartsTheme } from '@/theme/echarts'
import App from './App.tsx'
import './index.css'

// 注册 ECharts 统一主题（全局只需一次）
registerEchartsTheme()

// React Query 全局配置 —— 所有接口调用都通过它管理加载 / 缓存 / 重试
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // 展厅场景不需要切窗口就刷新
      retry: 1,
      staleTime: 30_000,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* ConfigProvider 给所有 AntD 组件套上项目主题，不需要给组件单独写样式 */}
    <ConfigProvider theme={antdTheme} locale={zhCN}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ConfigProvider>
  </StrictMode>,
)