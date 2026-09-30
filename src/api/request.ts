import axios from 'axios'

/**
 * 统一的 axios 实例
 *
 * 所有后端请求都从这里走，不要在页面或各模块里另建 axios 实例。
 * 阶段二接后端时，只要改 .env 里的 VITE_API_BASE_URL 就能切换地址。
 */
export const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  timeout: 15000,
})

/* 请求拦截：以后要加 token、统一加 header，都在这里改，不用改每个接口 */
request.interceptors.request.use((config) => config)

/* 响应拦截：统一剥掉外层包装 + 统一打印错误 */
request.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('[API 请求失败]', error?.config?.url, error?.message)
    return Promise.reject(error)
  },
)

/**
 * 类型安全的快捷方法 —— 阶段二写接口时用这两个
 *
 * 因为响应拦截器已经把 response.data 剥出来了，
 * 所以这里把类型直接对成业务类型，用起来更顺手：
 *
 *   return get<ImpurityResult>('/hall2/impurity')
 */
export const get = <T>(url: string, params?: object): Promise<T> =>
  request.get(url, { params }) as unknown as Promise<T>

export const post = <T>(url: string, data?: object): Promise<T> =>
  request.post(url, data) as unknown as Promise<T>