import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from '@/pages/Home'
import Template from '@/pages/Template'
import FieldLossDetail from '@/pages/hall2/FieldLoss/Detail'
import FieldLossFactors from '@/pages/hall2/FieldLoss/Factors'
import Hall1RouteDetail from '@/pages/hall1/Route/Detail'
import { AREA_GROUPS } from '@/router/routes'

/**
 * 路由不需要在这里手动加。
 * 所有区域页面都从 src/router/routes.ts 的 AREA_GROUPS 自动生成，
 * 新增页面请去那里加一条记录。
 */
const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />

        {/* 六个区域的所有模块页面，由配置自动展开 */}
        {AREA_GROUPS.flatMap((group) =>
          group.modules.map((m) => (
            <Route key={m.path} path={m.path} element={<m.Component />} />
          )),
        )}

        <Route path="/hall1/route/:nodeId" element={<Hall1RouteDetail />} />

        {/* 开发样板页，不是展厅内容，上线前删掉这行 */}
        <Route path="/template" element={<Template />} />

        {/* 2-1 的详情子页面，不进首页导航，由总览页按钮跳转进入 */}
        <Route path="/hall2/field-loss/detail" element={<FieldLossDetail />} />
        <Route path="/hall2/field-loss/factors" element={<FieldLossFactors />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App