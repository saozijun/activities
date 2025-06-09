<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useUserStore } from '~@/stores/user';
import basicSetting from './components/basic-setting.vue'
import securitySetting from './components/security-setting.vue'

const selectedKeys = ref(['1'])
const userStore = useUserStore()

const items = computed(() => {
  return [
    {
      key: '1',
      label: "基本设置",
      title: 'Navigation One',
    },
    {
      key: '2',
      label: "安全设置",
      title: 'Navigation Two',
    }
  ]
})

onMounted(() => {
  userStore.fetchUserInfo()
})
</script>

<template>
  <div class="box">
    <a-card>
    <a-row :gutter="24">
      <a-col :span="4" style="padding-left: 0;">
        <a-menu
          v-model:selected-keys="selectedKeys"
          style="width: 250px"
          mode="inline"
          :items="items"
        />
      </a-col>
      <a-col :span="20">
        <basicSetting v-if="selectedKeys[0] === '1'" />
        <securitySetting v-if="selectedKeys[0] === '2'" />
      </a-col>
    </a-row>
  </a-card>
  </div>
</template>

<style scoped lang="less">
.box{
  height: calc(100vh - 170px);
}
</style>
