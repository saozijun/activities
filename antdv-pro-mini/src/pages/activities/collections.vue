<template>
  <div class="collections-page">
    <div class="page-container">
      <h1 class="page-title">我的收藏</h1>
      <div v-if="loading" class="loading-state">
        <a-spin size="large" />
      </div>
      <div v-else-if="collections.length === 0" class="empty-state">
        <div class="empty-icon">
           <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="feather feather-star"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
        </div>
        <h2>暂无收藏</h2>
        <p>您收藏的所有活动都会在这里出现</p>
        <button class="explore-btn" @click="$router.push('/activities')">去探索活动</button>
      </div>
      <div v-else class="collections-grid">
        <div v-for="item in collections" :key="item.collection_id" class="collection-card">
          <div class="card-image-wrapper" @click="goToDetail(item.id)">
            <img :src="getImageUrl(item.cover_image)" :alt="item.name" class="card-image">
            <div class="card-overlay">
              <button class="uncollect-btn" @click.stop="uncollect(item)">
                <StarFilled />
              </button>
            </div>
          </div>
          <div class="card-content">
            <h3 class="card-title" @click="goToDetail(item.id)">{{ item.name }}</h3>
            <p class="card-date">活动时间: {{ formatTime(item.start_time, 'YYYY-MM-DD') }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { getMyCollections, removeCollection } from '~/api/activity';
import { notification } from 'ant-design-vue';
import { StarFilled } from '@ant-design/icons-vue';
import dayjs from 'dayjs';

const router = useRouter();
const loading = ref(true);
const collections = ref([]);
const baseUrl = import.meta.env.VITE_APP_BASE_URL;

const getImageUrl = (path) => {
  if (!path) return '';
  return baseUrl + `${path}`;
};

const fetchCollections = async () => {
  loading.value = true;
  try {
    const { data } = await getMyCollections();
    collections.value = data || [];
  } catch (error) {
    notification.error({ message: '获取收藏失败', description: '无法加载收藏列表，请稍后再试。' });
  } finally {
    loading.value = false;
  }
};

const uncollect = async (item) => {
  try {
    await removeCollection(item.id);
    notification.success({ message: '已取消收藏' });
    collections.value = collections.value.filter(c => c.id !== item.id);
  } catch (error) {
    notification.error({ message: '操作失败', description: error.message || '请稍后再试' });
  }
};

const goToDetail = (id) => {
  router.push(`/activities/${id}`);
};

const formatTime = (time, format = 'YYYY年MM月DD日 HH:mm') => {
  if (!time) return 'N/A';
  return dayjs(time).format(format);
};

onMounted(fetchCollections);
</script>

<style scoped>
.collections-page {
  background: linear-gradient(180deg, #fdfdff 0%, #f7f8fa 300px, #f7f8fa 100%);
  padding: 48px 24px;
  min-height: 100vh;
}
.page-container {
  max-width: 1200px;
  margin: 0 auto;
}
.page-title {
  font-size: 2.5rem;
  font-weight: 800;
  color: #1a202c;
  margin-bottom: 48px;
  text-align: center;
}
.loading-state {
  text-align: center;
  padding: 120px 0;
}
.empty-state {
  text-align: center;
  padding: 80px 40px;
  background-color: #fff;
  border-radius: 16px;
  border: 1px solid #eef2f7;
}
.empty-icon {
  margin-bottom: 24px;
  color: #a0aec0;
}
.empty-state h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 12px;
}
.empty-state p {
  font-size: 1rem;
  color: #718096;
  margin-bottom: 32px;
}
.explore-btn {
  background-color: #3182ce;
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  border: none;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}
.explore-btn:hover {
  background-color: #2b6cb0;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(49, 130, 206, 0.2);
}

.collections-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 32px;
}

.collection-card {
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #eef2f7;
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.collection-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 20px 35px -5px rgba(0, 0, 0, 0.08), 0 8px 15px -4px rgba(0, 0, 0, 0.05);
  border-color: #a0aec0;
}

.card-image-wrapper {
  position: relative;
  height: 200px;
  overflow: hidden;
  cursor: pointer;
}

.card-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.4s ease;
}
.collection-card:hover .card-image {
  transform: scale(1.05);
}

.card-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 40%);
  opacity: 0;
  transition: opacity 0.3s ease;
  display: flex;
  justify-content: flex-end;
  align-items: flex-start;
  padding: 12px;
}
.collection-card:hover .card-overlay {
  opacity: 1;
}

.uncollect-btn {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255,255,255,0.3);
  color: #fff;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  cursor: pointer;
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  transition: all 0.3s;
  opacity: 0;
  transform: translateY(-10px);
}
.collection-card:hover .uncollect-btn {
  opacity: 1;
  transform: translateY(0);
  transition-delay: 0.1s;
}
.uncollect-btn:hover {
  background: rgba(0, 0, 0, 0.432);
}

.card-content {
  padding: 20px;
}

.card-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: #2d3748;
  margin: 0 0 8px 0;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-title:hover {
  color: #3182ce;
}

.card-date {
  font-size: 0.875rem;
  color: #718096;
  margin: 0;
}
</style> 