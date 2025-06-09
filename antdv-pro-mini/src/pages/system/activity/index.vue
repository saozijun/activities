<template>
  <div class="box">
    <a-card class="mb-4">
      <a-form :model="formModel">
        <a-row :gutter="[15, 0]">
          <a-col :span="6">
            <a-form-item label="活动名称">
              <a-input v-model:value="formModel.name" placeholder="请输入活动名称" />
            </a-form-item>
          </a-col>
          <a-col :span="18">
            <a-space class="flex justify-end w-full">
              <a-button :loading="loading" type="primary" @click="onSearch">查询</a-button>
              <a-button :loading="loading" @click="onReset">重置</a-button>
              <a-button type="primary" @click="openEditModal({})">
                <template #icon><PlusOutlined /></template>
                新增
              </a-button>
            </a-space>
          </a-col>
        </a-row>
      </a-form>
    </a-card>
    <a-table :columns="columns" :data-source="tableData" :pagination="false" :loading="loading">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'coverImage'">
          <a-image
            v-if="record.cover_image"
            :width="80"
            :src="`http://localhost:3000${record.cover_image}`"
            style="border-radius: 4px;"
          />
          <span v-else>无</span>
        </template>
        <template v-else-if="column.key === 'status'">
          <a-tag :color="record.status === 'published' ? 'green' : 'red'">
            {{ record.status === 'published' ? '已发布' : '草稿' }}
          </a-tag>
        </template>
        <template v-else-if="column.key === 'operation'">
          <a-button style="padding: 0;" type="link" @click="openEditModal(record)">编辑</a-button>
          <a-button type="link" @click="openAiModal(record)">AI 分析</a-button>
          <a-popconfirm title="确定删除吗?" @confirm="onDelete(record.id)">
            <a-button type="link" style="padding: 0;" danger>删除</a-button>
          </a-popconfirm>
        </template>
      </template>
    </a-table>
    <div class="pagination">
      <a-pagination v-model:current="formModel.pageNum" :total="total" @change="onPageChange" />
    </div>
    <Edit ref="editModalRef" @save-ok="getList" />
    <a-modal
      v-model:visible="aiModalVisible"
      title="活动 AI 分析"
      width="800px"
      :footer="null"
      @cancel="aiModalVisible = false"
    >
      <a-spin :spinning="aiLoading" tip="AI 正在分析中，请稍候...">
        <a-alert type="info" style="margin-bottom: 20px;">
          <template #message>
            请输入您对当前活动的优化想法或分析角度，AI 将根据您的输入，结合活动现有信息，生成一套优化后的活动方案。
          </template>
        </a-alert>
        <a-textarea 
          v-model:value="aiAnalysisPrompt"
          placeholder="例如：请让这个活动更适合大学生参与，增加一些社交元素。"
          :rows="4" 
        />
        <a-button type="primary" @click="handleRunAnalysis" :loading="aiLoading" style="margin-top: 16px;">
          生成建议
        </a-button>

        <div v-if="aiResult" style="margin-top: 20px;">
          <a-divider>AI 分析结果</a-divider>

          <a-card title="优化建议" style="margin-bottom: 20px;">
            <p>{{ aiResult.reasoning }}</p>
          </a-card>

          <a-descriptions title="建议方案" bordered :column="1">
            <a-descriptions-item label="活动名称">{{ aiResult.activityData.name }}</a-descriptions-item>
            <a-descriptions-item label="活动地点">{{ aiResult.activityData.location }}</a-descriptions-item>
            <a-descriptions-item label="价格">{{ aiResult.activityData.price }}</a-descriptions-item>
            <a-descriptions-item label="开始时间">{{ aiResult.activityData.start_time }}</a-descriptions-item>
            <a-descriptions-item label="结束时间">{{ aiResult.activityData.end_time }}</a-descriptions-item>
            <a-descriptions-item label="活动详情">
              <div v-html="aiResult.activityData.content"></div>
            </a-descriptions-item>
          </a-descriptions>
          <a-button type="primary" @click="applyAiResultToForm" style="margin-top: 16px;">
            一键应用到表单
          </a-button>
        </div>
      </a-spin>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, nextTick } from 'vue';
import { PlusOutlined } from '@ant-design/icons-vue';
import { message, Modal, notification } from 'ant-design-vue';
import { list, del, analyzeActivity } from '~/api/activity';
import Edit from './components/Edit.vue';
import dayjs from 'dayjs';

const editModalRef = ref(null);
const loading = ref(false);
const tableData = ref([]);
const total = ref(0);
const formModel = ref({
  pageNum: 1,
  pageSize: 10,
  name: '',
});

const formRef = ref();
const category_name = ref('');
const activityCategories = ref([]);
const editingActivity = ref(null);

const aiModalVisible = ref(false);
const aiAnalysisPrompt = ref('');
const aiResult = ref(null);
const aiLoading = ref(false);
const currentActivityForAI = ref(null);

onMounted(() => {
  getList();
});

const getList = async () => {
  loading.value = true;
  try {
    const { data } = await list(formModel.value);
    total.value = data.total;
    tableData.value = data.records.map((item, i) => ({
      ...item,
      index: (formModel.value.pageNum - 1) * formModel.value.pageSize + i + 1,
      start_time: item.start_time ? dayjs(item.start_time).format('YYYY-MM-DD HH:mm') : '-',
      end_time: item.end_time ? dayjs(item.end_time).format('YYYY-MM-DD HH:mm') : '-',
    }));
  } catch (error) {
    console.error(error);
  } finally {
    loading.value = false;
  }
};

const onSearch = () => {
  formModel.value.pageNum = 1;
  getList();
};

const onReset = () => {
  formModel.value = { pageNum: 1, pageSize: 10, name: '' };
  getList();
};

const onPageChange = () => {
  getList();
};

const onDelete = async (id) => {
  try {
    await del({ id });
    message.success('删除成功');
    getList();
  } catch (error) {
    console.error(error);
  }
};

const openEditModal = (record) => {
  editModalRef.value.open(record);
};

const openAiModal = (record) => {
  currentActivityForAI.value = record;
  aiModalVisible.value = true;
  aiResult.value = null;
  aiAnalysisPrompt.value = '';
};

const handleRunAnalysis = async () => {
  if (!aiAnalysisPrompt.value.trim()) {
    message.warning('请输入您的分析要求');
    return;
  }
  aiLoading.value = true;
  aiResult.value = null;
  try {
    const res = await analyzeActivity(currentActivityForAI.value, aiAnalysisPrompt.value);
    if (res.success) {
      aiResult.value = res.data;
      notification.success({ message: '分析完成' });
    } else {
      notification.error({ message: '分析失败', description: res.message });
    }
  } catch (error) {
    notification.error({ message: '分析失败', description: error.message });
  } finally {
    aiLoading.value = false;
  }
};

const applyAiResultToForm = () => {
  if (!aiResult.value || !aiResult.value.activityData) {
    message.error('没有可应用的分析结果');
    return;
  }

  const originalActivity = currentActivityForAI.value;
  const aiData = aiResult.value.activityData;

  // 1. 合并AI数据和原始数据，以AI数据为准，但保留原始数据中的必要字段
  const finalData = { ...originalActivity, ...aiData };
  
  // 2. 调用子组件的 open 方法，传递最终数据
  editModalRef.value.open(finalData);

  // 3. 关闭AI弹窗
  aiModalVisible.value = false;
};

const handleEdit = (record) => {
  modalVisible.value = true;
  isEdit.value = true;
  const category = activityCategories.value.find(c => c.id === record.category_id);
  category_name.value = category ? category.name : '';
  editingActivity.value = record;
  
  nextTick(() => {
    Object.assign(formState, { ...record });
    if (editor.value) {
      editor.value.setHtml(record.content || '');
    }
  });
};

const columns = [
  { title: '序号', dataIndex: 'index', key: 'index', width: 80 },
  { title: '封面', key: 'coverImage', width: 120 },
  { title: '活动名称', dataIndex: 'name', key: 'name' },
  { title: '分类', dataIndex: 'category_name', key: 'category' },
  { title: '地点', dataIndex: 'location', key: 'location', ellipsis: true },
  { title: '价格', dataIndex: 'price', key: 'price', width: 100, customRender: ({ text }) => `¥ ${text || '0.00'}` },
  { title: '开始时间', dataIndex: 'start_time', key: 'startTime' },
  { title: '结束时间', dataIndex: 'end_time', key: 'endTime' },
  { title: '状态', dataIndex: 'status', key: 'status' },
  { title: '操作', key: 'operation', fixed: 'right', width: 200 },
];
</script>

<style lang="less" scoped>
.box {
  height: calc(100vh - 170px);
}
:deep(.ant-form-item) {
  margin-bottom: 0;
}
.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}
</style> 