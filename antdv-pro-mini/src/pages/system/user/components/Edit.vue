<template>
  <a-modal
    v-model:open="visible"
    :title="modelRef.id ? '编辑' : '新增'"
    :confirm-loading="confirmLoading"
    @ok="handleOk"
    :afterClose="afterClose"
  >
    <a-form
      ref="formRef"
      :model="modelRef"
      :rules="rules"
      :label-col="{style:{width: '60px'}}"
    >
      <a-form-item label="头像" name="avatar">
        <a-upload
          v-model:file-list="fileList"
          name="file"
          list-type="picture-card"
          class="avatar-uploader"
          :show-upload-list="false"
          :action="baseUrl + '/api/upload'"
          @change="handleUploadChange"
        >
          <img v-if="modelRef.avatar" :src="baseUrl + `${modelRef.avatar}`" alt="avatar" style="width: 100%" />
          <div v-else>
            <loading-outlined v-if="uploading"></loading-outlined>
            <plus-outlined v-else></plus-outlined>
            <div class="ant-upload-text">上传</div>
          </div>
        </a-upload>
      </a-form-item>
      <a-form-item label="昵称" name="nickname">
        <a-input v-model:value="modelRef.nickname" placeholder="请输入"/>
      </a-form-item>
      <a-form-item label="账号" name="username">
        <a-input v-model:value="modelRef.username" placeholder="请输入" :disabled="!!modelRef.id"/>
      </a-form-item>
      <a-form-item label="密码" name="password">
        <a-input-password v-model:value="modelRef.password" :placeholder="modelRef.id ? '留空则不修改密码' : '请输入'"/>
      </a-form-item>
      <a-form-item label="角色" name="role">
        <a-select v-model:value="modelRef.role" placeholder="请选择">
          <a-select-option v-for="(item) in roleList" :value="item.flag" :key="item.flag">{{item.name}}</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item label="邮箱" name="email">
        <a-input v-model:value="modelRef.email" type="email" placeholder="请输入"/>
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup>
import { ref, computed } from "vue";
import { message } from 'ant-design-vue';
import { save } from '~/api/user/index'
import { PlusOutlined, LoadingOutlined } from '@ant-design/icons-vue';

const formRef = ref();
const baseUrl = import.meta.env.VITE_APP_BASE_URL;
const visible = ref(false);
const confirmLoading = ref(false);
const emits = defineEmits(["saveOk"]);
const roleList = ref([
  { name: '管理员', flag: 'admin' },
  { name: '普通用户', flag: 'user' }
])
const fileList = ref([]);
const uploading = ref(false);

const modelRef = ref({
  nickname: "",
  username: "",
  password: "",
  email: "",
  role: "",
  avatar: "",
})

const rules = computed(() => {
  const baseRules = {
    nickname: [{ required: true, message: '请输入昵称', trigger: 'change' }],
    username: [{ required: true, message: '请输入账号', trigger: 'change' }],
    role: [{ required: true, message: '请选择角色', trigger: 'change' }],
    email: [{ required: true, message: '请输入邮箱', trigger: 'change' }],
  };
  if (!modelRef.value.id) {
    baseRules.password = [{ required: true, message: '请输入密码', trigger: 'change' }];
  }
  return baseRules;
});

const handleUploadChange = (info) => {
  if (info.file.status === 'uploading') {
    uploading.value = true;
    return;
  }
  if (info.file.status === 'done') {
    uploading.value = false;
    modelRef.value.avatar = info.file.response.data.url;
    message.success('上传成功');
  }
  if (info.file.status === 'error') {
    uploading.value = false;
    message.error('上传失败');
  }
};

const afterClose = () => {
  formRef.value?.resetFields();
  modelRef.value.avatar = '';
  fileList.value = [];
};

const handleOk = async () => {
  try {
    await formRef.value.validate();
    confirmLoading.value = true;
    await save(modelRef.value);
    message.success('操作成功');
    emits('saveOk');
    visible.value = false;
  } catch (error) {
    console.log(error);
  } finally {
    confirmLoading.value = false;
  }
};

const open = async (row) => {
  if (row.id) {
    modelRef.value = JSON.parse(JSON.stringify(row));
    modelRef.value.password = '';
  } else {
    modelRef.value = {
      nickname: "",
      username: "",
      password: "",
      email: "",
      role: "",
      avatar: "",
    };
  }
  visible.value = true;
};

defineExpose({
  open,
});
</script>

<style lang="less" scoped>
.ant-form{
  margin-top: 20px;
}
</style>