import type { AxiosError, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import axios from 'axios'
import { notification } from 'ant-design-vue/es'
import { STORAGE_AUTHORIZE_KEY, useAuthorization } from '~/composables/authorization'
import router from '~/router'
export interface ResponseBody<T = any> {
  code: number
  data?: T
  message: string
}

const instance = axios.create({
  baseURL: import.meta.env.VITE_APP_BASE_API ?? '/',
  timeout: 60000,
})

const requestHandler = async (config: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> => {
  const token = useAuthorization()
  if (token.value)
    config.headers.set(STORAGE_AUTHORIZE_KEY, 'TOKEN ' + token.value)

  return config
}

const responseHandler = (response: any): ResponseBody<any> | AxiosResponse<any> | Promise<any> | any => {
  const { code, message } = response.data
  const token = useAuthorization()
  if (code === 200) {
    return response.data
  } else if (code === 401) {
    notification.error({
      message: '认证失败',
      description: message,
      duration: 2
    })
    token.value = null
    router.push('/login')
    return Promise.reject(response.data)
  } else {
    notification.error({
      message: '请求错误',
      description: message,
      duration: 2
    })
    return Promise.reject(response.data)
  }
}

const errorHandler = (error: AxiosError): Promise<any> => {
  const { data, statusText } = error.response as AxiosResponse<ResponseBody>
  notification?.error({
    message: '服务器错误',
    description: data?.message || statusText,
    duration: 3,
  })
  return Promise.reject(error)
}

instance.interceptors.request.use(requestHandler)

instance.interceptors.response.use(responseHandler, errorHandler)

export default instance

export const useGet = <R = any, T = any>(url: string, params?: T, config?: AxiosRequestConfig): Promise<ResponseBody<R>> => {
  return instance.request({
    url,
    params,
    method: 'GET',
    ...config,
  })
}

export const usePost = < R = any, T = any>(url: string, data?: T, config?: AxiosRequestConfig): Promise<ResponseBody<R>> => {
  return instance.request({
    url,
    data,
    method: 'POST',
    ...config,
  })
}

export const usePut = < R = any, T = any>(url: string, data?: T, config?: AxiosRequestConfig): Promise<ResponseBody<R>> => {
  return instance.request({
    url,
    data,
    method: 'PUT',
    ...config,
  })
}

export const useDelete = < R = any, T = any>(url: string, data?: T, config?: AxiosRequestConfig): Promise<ResponseBody<R>> => {
  return instance.request({
    url,
    data,
    method: 'DELETE',
    ...config,
  })
}
