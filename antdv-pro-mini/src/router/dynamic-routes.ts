import type { RouteRecordRaw } from 'vue-router'
export const ROOT_ROUTE_REDIRECT_PATH = '/analysis'
import { useUserStore } from '~@/stores/user'
import { useAppStore } from '~@/stores/app'

const Layout = () => import('~/layouts/index.vue')
const basicRouteMap = {
  // iframe模式下使用
  Iframe: () => import('~/pages/common/iframe.vue'),
  // 一般用于存在子集的页面
  RouteView: () => import('~/pages/common/route-view.vue'),
}

// 定义不同角色的路由
const adminRoutes = [
  {
    path: '/analysis',
    name: 'Analysis',
    component: () => import('~/pages/analysis/index.vue'),
    meta: {
      title: '工作台',
      icon: 'FundProjectionScreenOutlined',
      roles: ['admin']
    },
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('~/pages/system/settings/index.vue'),
    meta: {
      title: '个人中心',
      hideInMenu: true,
      roles: ['admin', 'user'] // 所有角色可见
    },
  },
  {
    path: '/activities/list',
    name: 'ActivityList',
    component: () => import('~/pages/activities/index.vue'),
    meta: {
      title: '活动列表',
      roles: ['user']
    },
  },
  {
    path: '/activities/:id',
    name: 'ActivityDetail',
    component: () => import('~/pages/activities/detail.vue'),
    meta: {
      title: '活动详情',
      hideInMenu: true,
      roles: ['user']
    },
  },
  {
    path: '/my-registrations',
    name: 'MyRegistrations',
    component: () => import('~/pages/activities/registrations.vue'),
    meta: {
      title: '我的报名',
      roles: ['user']
    },
  },
  {
    path: '/my-collections',
    name: 'MyCollections',
    component: () => import('~/pages/activities/collections.vue'),
    meta: {
      title: '我的收藏',
      roles: ['user']
    },
  },
  {
    path: '/system',
    redirect: '/system/role',
    name: 'System',
    meta: {
      title: '系统管理',
      icon: 'SettingOutlined',
      roles: ['admin'] // 仅管理员可见
    },
    component: basicRouteMap.RouteView,
    children: [
      {
        path: '/system/user',
        name: 'User',
        component: () => import('~/pages/system/user/index.vue'),
        meta: {
          title: '用户管理',
          roles: ['admin']
        },
      },
      {
        path: '/system/activity',
        name: 'Activity',
        component: () => import('~/pages/system/activity/index.vue'),
        meta: {
          title: '活动管理',
          roles: ['admin']
        },
      },
      {
        path: '/system/category',
        name: 'AdminCategory',
        component: () => import('~/pages/system/category/index.vue'),
        meta: {
          title: '分类管理',
          roles: ['admin']
        },
      },
      {
        path: '/system/registration',
        name: 'AdminRegistration',
        component: () => import('~/pages/system/registration/index.vue'),
        meta: {
          title: '报名管理',
          roles: ['admin']
        },
      },
      {
        path: '/system/chat',
        name: 'AdminChat',
        component: () => import('~/pages/admin/chat.vue'),
        meta: {
          title: '用户咨询',
          roles: ['admin']
        },
      },
    ],
  }
]

export const rootRoute: RouteRecordRaw = {
  path: '/',
  name: 'rootPath',
  redirect: () => {
    const userStore = useUserStore()
    if (userStore.userInfo.role === 'admin') {
      return ROOT_ROUTE_REDIRECT_PATH
    } else if (userStore.userInfo.role === 'user') {
      return '/activities/list'
    } else {
      return '/login'
    }
  },
  component: Layout,
  children: [],
}

// 根据角色过滤路由
const filterRoutesByRole = (routes: any[], role: string) => {
  return routes.filter(route => {
    if (route.meta && route.meta.roles) {
      return route.meta.roles.includes(role)
    }
    return true
  }).map(route => {
    if (route.children) {
      route.children = filterRoutesByRole(route.children, role)
    }
    return route
  })
}

// 导出路由
export default adminRoutes as RouteRecordRaw[]

// 导出获取角色路由的方法
export const getRoutesByRole = (role: string) => {
  return filterRoutesByRole(adminRoutes, role) as RouteRecordRaw[]
}

