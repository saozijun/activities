<template>
  <page-container>
    <a-card :bordered="false">
      <a-form :model="formModel">
        <a-row :gutter="[15, 0]">
          <a-col :span="12">
             <a-button type="primary" @click="handleEdit()">
              <template #icon><PlusOutlined /></template>
              新建分类
            </a-button>
          </a-col>
        </a-row>
      </a-form>
    </a-card>
    <a-card :bordered="false" class="table-card">
       <a-table
        :columns="columns"
        :data-source="data"
        :loading="loading"
        row-key="id"
        :pagination="false"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'operation'">
            <a-button type="link" @click="handleEdit(record)">编辑</a-button>
            <a-popconfirm
              title="确定删除这个分类吗？"
              ok-text="是"
              cancel-text="否"
              @confirm="handleDelete(record.id)"
            >
              <a-button type="link" danger>删除</a-button>
            </a-popconfirm>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal
      v-model:visible="modalVisible"
      :title="isEdit ? '编辑分类' : '新建分类'"
      @ok="handleOk"
      @cancel="handleCancel"
    >
      <a-form ref="formRef" :model="formState" :rules="rules" layout="vertical">
        <a-form-item label="分类名称" name="name">
          <a-input v-model:value="formState.name" placeholder="请输入分类名称" />
        </a-form-item>
      </a-form>
    </a-modal>
  </page-container>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue';
import { getCategories, saveCategory, deleteCategory } from '~/api/category';
import { message } from 'ant-design-vue';
import { PlusOutlined } from '@ant-design/icons-vue';

const loading = ref(false);
const data = ref([]);
const formModel = ref({});
const columns = [
  { title: 'ID', dataIndex: 'id', key: 'id' },
  { title: '分类名称', dataIndex: 'name', key: 'name' },
  { title: '操作', key: 'operation', width: 200},
];

const modalVisible = ref(false);
const isEdit = ref(false);
const formRef = ref(null);
const formState = reactive({
  id: null,
  name: '',
});
const rules = {
  name: [{ required: true, message: '请输入分类名称' }],
};

const fetchData = async () => {
  loading.value = true;
  try {
    const res = await getCategories();
    data.value = res.data;
  } catch (error) {
    message.error('获取分类列表失败');
  } finally {
    loading.value = false;
  }
};

const handleEdit = (record) => {
  isEdit.value = !!record;
  if (record) {
    Object.assign(formState, record);
  } else {
    formState.id = null;
    formState.name = '';
  }
  modalVisible.value = true;
};

const handleDelete = async (id) => {
  try {
    const res = await deleteCategory(id);
    if(res.success){
      message.success('删除成功');
      fetchData();
    } else {
      message.error(res.message);
    }
  } catch (error) {
    message.error('删除失败: ' + error.message);
  }
};

const handleOk = async () => {
  try {
    await formRef.value.validate();
    const res = await saveCategory({ ...formState });
    if(res.success){
       message.success('保存成功');
      modalVisible.value = false;
      fetchData();
    } else {
      message.error(res.message);
    }
  } catch (error) { }
};

const handleCancel = () => {
  formRef.value.resetFields();
  modalVisible.value = false;
};

onMounted(fetchData);
</script>

<style scoped>
.table-card {
  margin-top: 16px;
}
</style> 