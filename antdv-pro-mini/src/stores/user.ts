import type { MenuData } from '~@/layouts/basic-layout/typing'
import dynamicRoutes, { rootRoute, getRoutesByRole } from '~@/router/dynamic-routes'
import { genRoutes } from '~@/router/generate-route'
import { updateInfo, getInfo } from '~@/api/user/index'

export const useUserStore = defineStore('user', () => {
  const routerData = shallowRef()
  const menuData = shallowRef<MenuData>([])
  const baseURL = import.meta.env.VITE_APP_BASE_URL
  // 使用 useStorage 持久化存储用户信息
  const userInfo: any = useStorage('user-info', {})

  const avatar = computed(() => baseURL + userInfo.value.avatar )
  const nickname = computed(() => userInfo.value.nickname ?? userInfo.value.username)
  const generateRoutes = async () => {
    const role = userInfo.value.role || 'admin' // 获取用户角色
    const routes = getRoutesByRole(role) // 根据角色获取路由
    
    const currentRoute = {
      ...rootRoute,
      children: routes,
    }
    menuData.value = genRoutes(routes)
    return currentRoute
  }

  const generateDynamicRoutes = async () => {
    const routerDatas = await generateRoutes()
    routerData.value = routerDatas
    return routerDatas
  }

  // 从后端获取最新用户信息
  const fetchUserInfo = async () => {
    try {
      const { data } = await getInfo();
      userInfo.value = { ...userInfo.value, ...data };
    } catch (error) {
      console.error('Failed to fetch user info:', error);
      // 可以选择性地在这里添加错误处理，比如提示用户
    }
  }

  // 更新用户信息
  const updateAvatar = async (url: any) => {
    userInfo.value.avatarUrl = url
    await updateInfo(userInfo.value)
  }

  // 添加清除用户信息的方法
  const clearUserInfo = () => {
    userInfo.value = {}
  }

  return {
    routerData,
    menuData,
    generateDynamicRoutes,
    avatar,
    nickname,
    userInfo,
    clearUserInfo,
    updateAvatar,
    fetchUserInfo,
  }
})
