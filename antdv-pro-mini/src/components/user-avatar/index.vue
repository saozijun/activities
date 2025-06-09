<script setup lang="ts">
import { LogoutOutlined, UserOutlined } from '@ant-design/icons-vue'
import { storeToRefs } from 'pinia'
import { notification } from 'ant-design-vue';
const router = useRouter()
const { avatar, nickname } = storeToRefs(useUserStore())
const logout = () => {
  const token = useAuthorization()
  const userStore = useUserStore()
  const multiTabStore = useMultiTab()
  
  // 清除 token
  token.value = null
  
  // 清除用户信息
  userStore.clearUserInfo()
  
  // 清除标签页
  multiTabStore.clear()
  
  notification.success({
    message: '退出成功',
    description: '期待您的下次使用',
    duration: 2
  })
  // 跳转到登录页
  router.push('/login')
}
</script>

<template>
  <a-dropdown>
    <span hover="bg-[var(--hover-color)]" flex items-center h-48px px-12px cursor-pointer class="transition-all-300">
      <a-avatar :src="avatar" mr-8px size="small" />
      <span class="anticon">{{ nickname }}</span>
    </span>
    <template #overlay>
      <a-menu>
        <a-menu-item key="0">
          <template #icon>
            <UserOutlined />
          </template>
          <RouterLink to="/settings">
            个人中心
          </RouterLink>
        </a-menu-item>
        <a-menu-divider />
        <a-menu-item key="3" @click="logout">
          <template #icon>
            <LogoutOutlined />
          </template>
          退出登录
        </a-menu-item>
      </a-menu>
    </template>
  </a-dropdown>
</template>
