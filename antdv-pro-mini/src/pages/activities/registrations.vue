<template>
  <div class="registrations-page">
    <div class="page-container">
      <h1 class="page-title">我的报名</h1>
      <div v-if="loading" class="loading-state">
        <a-spin size="large" />
      </div>
      <div v-else-if="registrations.length === 0" class="empty-state">
        <div class="empty-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="feather feather-calendar"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
        </div>
        <h2>暂无报名记录</h2>
        <p>您参与的所有活动都会在这里出现</p>
        <button class="explore-btn" @click="$router.push('/activities')">去探索活动</button>
      </div>
      <div v-else class="registrations-timeline">
        <div v-for="item in registrations" :key="item.registration_id" class="timeline-item">
          <div class="timeline-connector">
            <div class="timeline-marker"></div>
          </div>
          <div class="timeline-content">
            <div class="registration-card" @click="$router.push(`/activities/${item.id}`)">
              <img :src="getImageUrl(item.cover_image)" alt="Activity Cover" class="card-cover">
              <div class="card-body">
                <div class="card-header">
                  <h3 class="card-title">{{ item.name }}</h3>
                  <span class="card-status" :class="`status-${item.status}`">{{ statusMap[item.status].text }}</span>
                </div>
                <div class="card-meta">
                  <p><span class="meta-label">活动时间:</span> {{ formatTime(item.start_time) }}</p>
                  <p><span class="meta-label">报名时间:</span> {{ formatTime(item.registration_date) }}</p>
                </div>
                <div class="card-footer">
                  <span class="card-price">{{ parseFloat(item.price) === 0 ? '免费' : `¥${item.price}` }}</span>
                   <button v-if="item.status === 'pending_payment'" class="action-btn primary" @click.stop="openPaymentModal(item)">
                    立即支付
                  </button>
                  <button v-else class="action-btn secondary" @click.stop="$router.push(`/activities/${item.id}`)">
                    查看详情
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

     <a-modal v-model:open="paymentModalVisible" title="扫码支付" :footer="null" @cancel="closePaymentModal">
      <div v-if="selectedRegistration" class="payment-modal-content">
        <p>请扫描下方二维码完成对"{{ selectedRegistration.name }}"的支付。</p>
        <img :src="getImageUrl(qrCodeUrl)" alt="支付二维码" style="width: 200px; height: 200px; margin: 0 auto; display: block;" />
        <p style="text-align: center; margin-top: 10px;">支付金额：<span class="price-tag">¥{{ selectedRegistration.price }}</span></p>
        <a-button type="primary" block @click="handleConfirmPayment" :loading="confirmingPayment" style="margin-top: 20px;">
          我已完成支付
        </a-button>
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { getMyRegistrations, initiatePayment, confirmPayment } from '~/api/activity';
import { notification } from 'ant-design-vue';
import dayjs from 'dayjs';

const loading = ref(true);
const baseUrl = import.meta.env.VITE_APP_BASE_URL;
const registrations = ref([]);
const paymentModalVisible = ref(false);
const selectedRegistration = ref(null);
const qrCodeUrl = ref('');
const confirmingPayment = ref(false);
const router = useRouter();

const statusMap = {
  pending_payment: { text: '待支付' },
  completed: { text: '已完成' },
  cancelled: { text: '已取消' },
};

const getImageUrl = (path) => {
  if (!path) return '';
  return baseUrl + path;
};

const fetchRegistrations = async () => {
  loading.value = true;
  try {
    const { data } = await getMyRegistrations();
    registrations.value = data || [];
  } catch (error) {} finally {
    loading.value = false;
  }
};

const openPaymentModal = async (registration) => {
  selectedRegistration.value = registration;
  try {
    const { data } = await initiatePayment({ registration_id: registration.registration_id });
    qrCodeUrl.value = data.qrCodeUrl;
    paymentModalVisible.value = true;
  } catch (error) {
    notification.error({ message: '支付发起失败', description: '无法获取支付二维码，请稍后再试。' });
  }
};

const closePaymentModal = () => {
  paymentModalVisible.value = false;
  selectedRegistration.value = null;
};

const handleConfirmPayment = async () => {
  confirmingPayment.value = true;
  try {
    await confirmPayment({ registration_id: selectedRegistration.value.registration_id });
    notification.success({ message: '支付成功', description: '您的报名已确认！' });
    closePaymentModal();
    fetchRegistrations(); 
  } catch (error) {
    notification.error({ message: '支付确认失败', description: error.message || '请稍后再试。' });
  } finally {
    confirmingPayment.value = false;
  }
};

const formatTime = (time) => {
  if (!time) return 'N/A';
  return dayjs(time).format('YYYY年MM月DD日 HH:mm');
};

onMounted(fetchRegistrations);
</script>

<style lang="less" scoped>
.registrations-page {
  background: linear-gradient(180deg, #fdfdff 0%, #f7f8fa 300px, #f7f8fa 100%);
  padding: 48px 24px;
  min-height: 100vh;
}

.page-container {
  max-width: 800px;
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

.registrations-timeline {
  position: relative;
}

.timeline-item {
  display: flex;
  position: relative;
  margin-bottom: 40px;
}

.timeline-item:last-child .timeline-connector::before {
  display: none;
}

.timeline-connector {
  flex-shrink: 0;
  width: 40px;
  position: relative;
}

.timeline-connector::before {
  content: '';
  position: absolute;
  top: 12px;
  left: 19px;
  width: 2px;
  height: 100%;
  background-color: #e2e8f0;
}

.timeline-marker {
  position: absolute;
  top: 12px;
  left: 14px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: #cbd5e0;
  border: 2px solid #fff;
}

.timeline-item:first-child .timeline-marker {
  background-color: #3182ce;
}

.timeline-content {
  flex-grow: 1;
}

.registration-card {
  background: #fff;
  border: 1px solid #eef2f7;
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  transition: all 0.3s ease;
  cursor: pointer;
}

.registration-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 10px 25px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  border-color: #a0aec0;
}

.card-cover {
  width: 150px;
  height: auto;
  object-fit: cover;
}

.card-body {
  flex-grow: 1;
  padding: 20px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.card-title {
  font-size: 1.2rem;
  font-weight: 700;
  color: #2d3748;
  margin: 0;
  line-height: 1.4;
}

.card-status {
  display: inline-block;
  padding: 3px 10px;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 9999px;
  white-space: nowrap;
  margin-left: 16px;
}

.status-pending_payment { background-color: #fffaf0; color: #dd6b20; }
.status-completed { background-color: #f0fff4; color: #38a169; }
.status-cancelled { background-color: #fff5f5; color: #e53e3e; }

.card-meta {
  font-size: 0.875rem;
  color: #718096;
  margin-bottom: 16px;
}
.card-meta p {
  margin: 0 0 4px 0;
}
.meta-label {
  font-weight: 600;
  color: #4a5568;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid #edf2f7;
}

.card-price {
  font-size: 1.25rem;
  font-weight: 700;
  color: #2c5282;
}

.action-btn {
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid transparent;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s ease;
  font-size: 0.875rem;
}

.action-btn.primary {
  background-color: #3182ce;
  color: white;
}
.action-btn.primary:hover {
  background-color: #2b6cb0;
  box-shadow: 0 2px 8px rgba(49, 130, 206, 0.2);
}

.action-btn.secondary {
  background-color: #f7fafc;
  color: #4a5568;
  border-color: #e2e8f0;
}
.action-btn.secondary:hover {
  background-color: #edf2f7;
  border-color: #cbd5e0;
}

.price-tag {
  font-size: 18px;
  color: #dd6b20;
  font-weight: bold;
}
</style> 