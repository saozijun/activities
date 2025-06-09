<template>
  <page-container>
    <a-card :bordered="false" class="search-card">
      <a-form :model="queryParam" >
        <a-row :gutter="[15, 0]">
          <a-col>
            <a-form-item label="活动名称">
              <a-input v-model:value="queryParam.activityName" placeholder="请输入活动名称" />
            </a-form-item>
          </a-col>
          <a-col>
            <a-form-item label="用户昵称">
              <a-input v-model:value="queryParam.userNickname" placeholder="请输入用户昵称" />
            </a-form-item>
          </a-col>
          <a-col>
            <span class="table-page-search-submitButtons">
              <a-button type="primary" @click="handleQuery">查询</a-button>
              <a-button style="margin-left: 8px" @click="handleReset">重置</a-button>
            </span>
          </a-col>
        </a-row>
      </a-form>
    </a-card>

    <a-card :bordered="false" class="table-card">
      <a-table
        :columns="columns"
        :data-source="data"
        :loading="loading"
        :pagination="false"
        row-key="id"
      >
        <template #bodyCell="{ column, text }">
            <template v-if="column.dataIndex === 'activity_price'">
              <span>¥{{ text }}</span>
            </template>
             <template v-else-if="column.dataIndex === 'created_at'">
              <span>{{ formatTime(text) }}</span>
            </template>
        </template>
      </a-table>
       <div class="pagination-wrapper">
        <a-pagination
          v-model:current="pagination.current"
          :total="pagination.total"
          :page-size="pagination.pageSize"
          show-size-changer
          @change="handleTableChange"
          @showSizeChange="onShowSizeChange"
        />
      </div>
    </a-card>
  </page-container>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue';
import { getRegistrationsPage } from '~/api/registration';
import dayjs from 'dayjs';

const loading = ref(false);
const data = ref([]);
const queryParam = reactive({
  activityName: '',
  userNickname: '',
});

const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
});

const columns = [
  { title: 'ID', dataIndex: 'id', key: 'id' },
  { title: '活动名称', dataIndex: 'activity_name', key: 'activity_name', ellipsis: true },
  { title: '用户昵称', dataIndex: 'user_nickname', key: 'user_nickname' },
  { title: '用户邮箱', dataIndex: 'user_email', key: 'user_email', ellipsis: true },
  { title: '活动价格', dataIndex: 'activity_price', key: 'activity_price' },
  { title: '报名时间', dataIndex: 'created_at', key: 'created_at' },
];

const fetchData = async () => {
  loading.value = true;
  try {
    const params = {
      pageNum: pagination.current,
      pageSize: pagination.pageSize,
      ...queryParam,
    };
    const { data: resData } = await getRegistrationsPage(params);
    data.value = resData.records;
    pagination.total = resData.total;
  } catch (error) {
    console.error('Failed to fetch registrations:', error);
  } finally {
    loading.value = false;
  }
};

const handleQuery = () => {
  pagination.current = 1;
  fetchData();
};

const handleReset = () => {
  queryParam.activityName = '';
  queryParam.userNickname = '';
  pagination.current = 1;
  fetchData();
};

const handleTableChange = (page, pageSize) => {
  pagination.current = page;
  pagination.pageSize = pageSize;
  fetchData();
};

const onShowSizeChange = (current, size) => {
    pagination.current = 1;
    pagination.pageSize = size;
    fetchData();
};

const formatTime = (time) => dayjs(time).format('YYYY-MM-DD HH:mm:ss');

onMounted(fetchData);
</script>

<style scoped>
.search-card {
  margin-bottom: 16px;
}
.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style> 