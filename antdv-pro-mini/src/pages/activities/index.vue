<template>
  <div class="activity-page">
    <div class="page-header">
      <h1>探索精彩活动</h1>
      <p>发现你身边的下一个激动人心的事件</p>
    </div>

    <div class="filter-bar">
      <div class="filter-group">
        <button 
          v-for="cat in [{id: 'all', name: '全部'}, ...categories]" 
          :key="cat.id" 
          :class="['filter-btn', { active: selectedCategory === cat.id }]"
          @click="onCategoryChange(cat.id)"
        >
          {{ cat.name }}
        </button>
      </div>
    </div>
    
    <div v-if="loading" class="loading-state">
      <a-spin size="large" />
    </div>
    <div v-else-if="activities.length === 0" class="empty-state">
      <p>暂无此类活动</p>
    </div>
    <div v-else class="activity-grid">
      <div v-for="item in activities" :key="item.id" class="activity-card" @click="goToDetail(item.id)">
        <div class="card-cover">
          <img :alt="item.name" :src="`http://localhost:3000${item.cover_image}`" />
          <div class="price-tag">{{ parseFloat(item.price) === 0 ? '免费' : `¥${item.price}` }}</div>
        </div>
        <div class="card-body">
          <h3 class="card-title">{{ item.name }}</h3>
          <p class="card-info"><CalendarOutlined /> {{ formatTime(item.start_time) }}</p>
          <p class="card-info"><EnvironmentOutlined /> {{ item.location }}</p>
        </div>
      </div>
    </div>

    <div class="pagination-wrapper" v-if="pagination.total > pagination.pageSize">
      <a-pagination v-bind="pagination" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { getPublicActivities, getCategories } from '~/api/activity';
import { CalendarOutlined, EnvironmentOutlined } from '@ant-design/icons-vue';
import dayjs from 'dayjs';

const router = useRouter();
const loading = ref(true);
const activities = ref([]);
const categories = ref([]);
const selectedCategory = ref('all');

const pagination = reactive({
  current: 1,
  pageSize: 8,
  total: 0,
  onChange: (page) => {
    pagination.current = page;
    fetchActivities();
  },
});

const fetchCategories = async () => {
  try {
    const { data } = await getCategories();
    categories.value = data;
  } catch (error) {}
};

const fetchActivities = async () => {
  loading.value = true;
  try {
    const params = {
      pageNum: pagination.current,
      pageSize: pagination.pageSize,
      category_id: selectedCategory.value === 'all' ? undefined : selectedCategory.value,
    };
    const { data } = await getPublicActivities(params);
    activities.value = data.records;
    pagination.total = data.total;
  } catch (error) {} finally {
    loading.value = false;
  }
};

const onCategoryChange = (categoryId) => {
  selectedCategory.value = categoryId;
  pagination.current = 1;
  fetchActivities();
};

const formatTime = (time) => dayjs(time).format('YYYY-MM-DD HH:mm');
const goToDetail = (id) => router.push(`/activities/${id}`);

onMounted(() => {
  fetchCategories();
  fetchActivities();
});
</script>

<style scoped>
.activity-page {
  padding: 40px 48px;
  background-color: #f7f8fa;
  min-height: 100vh;
}

.page-header {
  text-align: center;
  margin-bottom: 40px;
}
.page-header h1 {
  font-size: 2.5rem;
  font-weight: bold;
  color: #1f2937;
}
.page-header p {
  font-size: 1.1rem;
  color: #6b7280;
}

.filter-bar {
  display: flex;
  justify-content: center;
  margin-bottom: 32px;
}
.filter-group {
  display: inline-flex;
  background: #e5e7eb;
  padding: 4px;
  border-radius: 8px;
}
.filter-btn {
  border: none;
  padding: 8px 20px;
  border-radius: 6px;
  cursor: pointer;
  background: transparent;
  color: #4b5563;
  font-weight: 500;
  transition: all 0.3s ease;
}
.filter-btn.active {
  background: #fff;
  color: #1890ff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.loading-state, .empty-state {
  text-align: center;
  padding: 80px 0;
  color: #6b7280;
}

.activity-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px;
}

.activity-card {
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  cursor: pointer;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}
.activity-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 10px 20px rgba(0,0,0,0.08);
}
.card-cover {
  position: relative;
  width: 100%;
  padding-top: 66.66%; /* 3:2 Aspect Ratio */
}
.card-cover img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.price-tag {
  position: absolute;
  top: 12px;
  right: 12px;
  background-color: rgba(0, 0, 0, 0.5);
  color: white;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 14px;
  font-weight: bold;
  backdrop-filter: blur(4px);
}
.card-body {
  padding: 16px;
}
.card-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #374151;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 8px;
}
.card-info {
  font-size: 0.9rem;
  color: #6b7280;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.pagination-wrapper {
  text-align: center;
  margin-top: 40px;
}
</style> 