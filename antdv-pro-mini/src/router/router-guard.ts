import router from '~/router'
import { useAuthorization } from '~/composables/authorization'
router.beforeEach(async (to, from, next) => {
  const token = useAuthorization()
  // 处理未登录情况
  if (to.path !== '/login' && !token.value) {
    next('/login')
    return
  }

  // 已登录但访问登录页，重定向到首页
  if (to.path === '/login' && token.value) {
    next('/')
    return
  }

  // 获取用户信息
  const userStore = useUserStore()
  const appStore = useAppStore()
  if (userStore.userInfo.role === 'admin') {
    appStore.changeSettingLayout('layout', 'side');
  } else {
    appStore.changeSettingLayout('layout', 'top');
  } 
  // 如果没有路由数据，重新生成
  if (!userStore.routerData) {
    try {
      const currentRoute = await userStore.generateDynamicRoutes()
      await router.addRoute(currentRoute)
      // 使用 replace 进行重定向，保留目标路由
      next({ ...to, replace: true })
      return
    } catch (error) {
      console.error('生成动态路由失败:', error)
      // 发生错误时清除登录状态并返回登录页
      token.value = null
      userStore.clearUserInfo()
      next('/login')
      return
    }
  }

  next()
})

router.afterEach((to) => {
  // TODO
  const title = to.meta?.title
  if (title)
    document.title = title as string
})
