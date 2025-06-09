<template>
  <a-modal v-model:open="visible" :title="modelRef.id ? '编辑活动' : '新增活动'" @ok="handleOk" @cancel="handleCancel" width="800px">
    <a-form ref="formRef" :model="modelRef" :rules="rules" layout="vertical">
      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item label="活动名称" name="name">
            <a-input v-model:value="modelRef.name" placeholder="请输入活动名称" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="活动分类" name="categoryId">
            <a-select v-model:value="modelRef.categoryId" placeholder="请选择分类">
              <a-select-option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.name }}</a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
      </a-row>
      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item label="开始时间" name="startTime">
            <a-date-picker v-model:value="modelRef.startTime" show-time format="YYYY-MM-DD HH:mm:ss" style="width: 100%;" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="结束时间" name="endTime">
            <a-date-picker v-model:value="modelRef.endTime" show-time format="YYYY-MM-DD HH:mm:ss" style="width: 100%;" />
          </a-form-item>
        </a-col>
      </a-row>
      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item label="活动价格" name="price">
            <a-input-number v-model:value="modelRef.price" :min="0" prefix="¥" style="width: 100%" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="活动状态" name="status">
            <a-radio-group v-model:value="modelRef.status">
              <a-radio value="draft">草稿</a-radio>
              <a-radio value="published">发布</a-radio>
            </a-radio-group>
          </a-form-item>
        </a-col>
      </a-row>
      <a-form-item label="活动地点" name="location">
        <a-input v-model:value="modelRef.location" placeholder="请输入活动地点" />
      </a-form-item>
      <a-form-item label="活动封面" name="coverImage">
        <a-upload
          v-model:file-list="fileList"
          name="file"
          list-type="picture-card"
          class="avatar-uploader"
          :show-upload-list="false"
          action="http://localhost:3000/api/upload"
          @change="handleUploadChange"
        >
          <img v-if="modelRef.coverImage" :src="`http://localhost:3000${modelRef.coverImage}`" alt="cover" style="width: 100%" />
          <div v-else>
            <loading-outlined v-if="uploading"></loading-outlined>
            <plus-outlined v-else></plus-outlined>
            <div class="ant-upload-text">上传</div>
          </div>
        </a-upload>
      </a-form-item>
      <a-form-item label="活动内容" name="content">
        <div ref="editorRef" style="border: 1px solid #ccc"></div>
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { message } from 'ant-design-vue';
import { save, getCategories } from '~/api/activity';
import E from 'wangeditor';
import dayjs from 'dayjs';
import { PlusOutlined, LoadingOutlined } from '@ant-design/icons-vue';

const emits = defineEmits(['save-ok']);
const visible = ref(false);
const formRef = ref(null);
const editorRef = ref(null);
let editor = null;
const fileList = ref([]);
const uploading = ref(false);

const modelRef = ref({
  id: null,
  name: '',
  categoryId: null,
  startTime: null,
  endTime: null,
  location: '',
  status: 'draft',
  content: '',
  coverImage: '',
  price: 0,
});

const categories = ref([]);

const rules = {
  name: [{ required: true, message: '请输入活动名称' }],
  categoryId: [{ required: true, message: '请选择活动分类' }],
  startTime: [{ required: true, message: '请选择开始时间' }],
  endTime: [{ required: true, message: '请选择结束时间' }],
  location: [{ required: true, message: '请输入活动地点' }],
  price: [{ required: true, message: '请输入活动价格' }],
  coverImage: [{ required: true, message: '请上传活动封面' }],
  status: [{ required: true, message: '请选择活动状态' }],
  content: [{ required: true, message: '请输入活动内容' }],
};

const handleUploadChange = (info) => {
  if (info.file.status === 'uploading') {
    uploading.value = true;
    return;
  }
  if (info.file.status === 'done') {
    uploading.value = false;
    modelRef.value.coverImage = info.file.response.data.url;
    message.success('上传成功');
  }
  if (info.file.status === 'error') {
    uploading.value = false;
    message.error('上传失败');
  }
};

const initEditor = () => {
  editor = new E(editorRef.value);
  editor.config.onchange = (html) => {
    modelRef.value.content = html;
  };
  editor.create();
};

const open = async (record) => {
  visible.value = true;
  const { data } = await getCategories();
  categories.value = data;
  console.log(record);
  
  if (record.id) {
    modelRef.value = { 
      ...record,
      startTime: record.start_time ? dayjs(record.start_time) : null,
      endTime: record.end_time ? dayjs(record.end_time) : null,
      categoryId: record.category_id,
      coverImage: record.cover_image,
      price: record.price,
    };
  } else {
    modelRef.value = {
      id: null,
      name: '',
      categoryId: null,
      startTime: null,
      endTime: null,
      location: '',
      status: 'draft',
      content: '',
      coverImage: '',
      price: 0,
    };
  }
  fileList.value = [];
  
  nextTick(() => {
    if (!editor) {
      initEditor();
    }
    editor.txt.html(modelRef.value.content || '');
  });
};

const handleOk = async () => {
  try {
    await formRef.value.validate();
    const params = {
      ...modelRef.value,
      startTime: modelRef.value.startTime ? dayjs(modelRef.value.startTime).format('YYYY-MM-DD HH:mm:ss') : null,
      endTime: modelRef.value.endTime ? dayjs(modelRef.value.endTime).format('YYYY-MM-DD HH:mm:ss') : null,
    };
    await save(params);
    message.success('保存成功');
    emits('save-ok');
    handleCancel();
  } catch (error) {
    console.error(error);
  }
};

const handleCancel = () => {
  visible.value = false;
  formRef.value.resetFields();
  modelRef.value.coverImage = '';
  fileList.value = [];
  if (editor) {
    editor.destroy();
    editor = null;
  }
};

onBeforeUnmount(() => {
  if (editor) {
    editor.destroy();
    editor = null;
  }
});

defineExpose({ open });
</script> 