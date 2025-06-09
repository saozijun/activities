<script setup lang="ts">
import { ref, reactive } from 'vue';
import { message } from 'ant-design-vue';
import { changePassword } from '~/api/user/index';

const modalVisible = ref(false);
const formRef = ref(null);
const confirmLoading = ref(false);

const formState = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
});

const rules = {
  oldPassword: [{ required: true, message: '请输入旧密码' }],
  newPassword: [{ required: true, message: '请输入新密码' }],
  confirmPassword: [
    { required: true, message: '请再次输入新密码' },
    {
      validator: (rule, value) => {
        if (value && value !== formState.newPassword) {
          return Promise.reject('两次输入的密码不一致');
        }
        return Promise.resolve();
      },
    },
  ],
};

const showModal = () => {
  modalVisible.value = true;
};

const handleOk = async () => {
  try {
    await formRef.value.validate();
    confirmLoading.value = true;
    await changePassword({
      oldPassword: formState.oldPassword,
      newPassword: formState.newPassword,
    });
    message.success('密码修改成功');
    handleCancel();
  } catch (error) {
    // 错误已在请求拦截器中处理
    console.error(error);
  } finally {
    confirmLoading.value = false;
  }
};

const handleCancel = () => {
  modalVisible.value = false;
  formRef.value.resetFields();
};

const data = ref([
    {
      title: "账户密码",
      desc:  "定期修改密码可以提高账户安全性",
    }
]);
</script>

<template>
  <a-card title="安全设置" :bordered="false">
    <a-list item-layout="horizontal" :data-source="data">
      <template #renderItem="{ item }">
        <a-list-item>
          <a-list-item-meta :description="item.desc">
            <template #title>
              <p>{{ item.title }}</p>
            </template>
          </a-list-item-meta>
          <template #actions>
             <a-button type="link" @click="showModal">
              修改
            </a-button>
          </template>
        </a-list-item>
      </template>
    </a-list>
  </a-card>

  <a-modal
    v-model:open="modalVisible"
    title="修改密码"
    @ok="handleOk"
    :confirm-loading="confirmLoading"
    @cancel="handleCancel"
  >
    <a-form ref="formRef" :model="formState" :rules="rules" layout="vertical">
      <a-form-item label="旧密码" name="oldPassword">
        <a-input-password v-model:value="formState.oldPassword" placeholder="请输入旧密码" />
      </a-form-item>
      <a-form-item label="新密码" name="newPassword">
        <a-input-password v-model:value="formState.newPassword" placeholder="请输入新密码" />
      </a-form-item>
      <a-form-item label="确认新密码" name="confirmPassword">
        <a-input-password v-model:value="formState.confirmPassword" placeholder="请再次输入新密码" />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<style scoped lang="less">
:deep(.ant-card-body) {
  padding-left: 0 !important;
}
</style>
