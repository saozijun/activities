<script setup lang="ts">
  import zhCN from 'ant-design-vue/es/locale/zh_CN';
  import dayjs from 'dayjs';
  import 'dayjs/locale/zh-cn';
  dayjs.locale('zh-cn');
  const appStore = useAppStore()
</script>

<template>
  <a-config-provider :locale="zhCN" :theme="appStore.theme">
    <a-app><RouterView /></a-app>
  </a-config-provider>
</template>
