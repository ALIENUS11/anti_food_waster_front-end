import { theme, type ThemeConfig } from 'antd'

/**
 * Ant Design 主题 —— 把 index.css 里的设计令牌同步给 AntD 组件（浅色主题）
 *
 * 为什么必须做这一步：
 *   Tailwind 只管我们自己写的 className，管不到 AntD 组件（Select / Table / Modal / Slider ...）。
 *   如果不配，AntD 组件会用默认蓝色和默认圆角，跟页面风格对不上。
 *   配完之后，AntD 组件自动就是项目主色 + 统一圆角，不需要给它们写任何覆盖样式。
 *
 * 改颜色请先改 index.css，再同步改这里（两处保持一致）。
 */
export const antdTheme: ThemeConfig = {
  /* 浅色主题用 defaultAlgorithm；如需切回深色，改成 theme.darkAlgorithm 并同步 index.css */
  algorithm: theme.defaultAlgorithm,

  token: {
    /* 主色 */
    colorPrimary: '#1668DC',
    colorInfo: '#1668DC',
    colorLink: '#1668DC',
    /* 语义色 */
    colorSuccess: '#16A34A',
    colorWarning: '#D97706',
    colorError: '#DC2626',
    /* 背景 */
    colorBgBase: '#F5F7FA',
    colorBgContainer: '#FFFFFF',
    colorBgElevated: '#FFFFFF',
    colorBgLayout: '#F5F7FA',
    /* 边框 */
    colorBorder: '#E3E8EF',
    colorBorderSecondary: '#EEF2F7',
    /* 文字 */
    colorText: '#0F172A',
    colorTextSecondary: '#475569',
    colorTextTertiary: '#64748B',
    colorTextQuaternary: '#CBD5E1',
    /* 字体 */
    fontFamily:
      'system-ui, "PingFang SC", "Microsoft YaHei", "Source Han Sans SC", sans-serif',
    fontSize: 16,
    /* 圆角 */
    borderRadius: 8,
    borderRadiusLG: 12,
    borderRadiusSM: 6,
    /* 高度 */
    controlHeight: 40,
    /* 阴影：浅色主题要用真实投影 */
    boxShadow: '0 1px 2px rgba(15,23,42,.04), 0 4px 12px rgba(15,23,42,.06)',
    boxShadowSecondary: '0 2px 8px rgba(15,23,42,.08)',
  },

  components: {
    Table: {
      headerBg: '#EEF2F7',
      headerColor: '#475569',
      rowHoverBg: '#F5F7FA',
      borderColor: '#E3E8EF',
      cellPaddingBlock: 14,
    },
    Modal: {
      contentBg: '#FFFFFF',
      headerBg: '#FFFFFF',
    },
    Select: {
      optionSelectedBg: 'rgba(22,104,220,0.08)',
    },
    Slider: {
      railBg: '#E3E8EF',
      railHoverBg: '#CBD5E1',
    },
  },
}