<template>
  <div v-if="loading" class="skeleton-wrapper">
    <a-skeleton active :paragraph="{ rows: 10 }" />
  </div>
  <div v-else-if="activity" class="activity-detail-page">
    <div class="hero-section" :style="{ backgroundImage: `url(${baseUrl}${activity.cover_image})` }">
      <div class="hero-overlay"></div>
      <div class="hero-content">
        <button class="back-btn" @click="router.back()">返回列表</button>
        <h1 class="activity-title">{{ activity.name }}</h1>
        <div class="category-tag">{{ activity.category_name }}</div>
      </div>
    </div>

    <div class="content-wrapper">
      <a-row :gutter="{ xs: 8, sm: 16, md: 24, lg: 32 }">
        <a-col :xs="24" :md="16">
          <div class="main-content" v-html="activity.content"></div>
          
          <a-tabs default-active-key="1" class="ratings-comments-tabs">
            <a-tab-pane key="1" tab="评分">
              <div class="ratings-section">
                <div class="section-header">
                  <h2 class="section-title">用户评分</h2>
                  <div class="rating-summary">
                    <span class="rating-score">{{ ratingsData.averageRating }}</span>
                    <div>
                      <a-rate :value="ratingsData.averageRating" disabled allow-half />
                      <p style="margin: 0; color: #8c8c8c;">{{ ratingsData.totalRatings }} 条评分</p>
                    </div>
                  </div>
                </div>

                <div v-if="userStore.userInfo.id" class="submission-form">
                  <a-comment>
                    <template #avatar>
                      <a-avatar :src="userStore.avatar"><template #icon><UserOutlined /></template></a-avatar>
                    </template>
                    <template #content>
                      <a-form-item>
                        <a-rate v-model:value="newRating" />
                      </a-form-item>
                      <a-form-item>
                        <a-textarea v-model:value="newRatingContent" :rows="2" placeholder="可以说说你的感受吗？（选填）" />
                      </a-form-item>
                      <a-form-item>
                        <a-button html-type="submit" :loading="submittingRating" type="primary" @click="handleSubmitRating">
                          提交评分
                        </a-button>
                      </a-form-item>
                    </template>
                  </a-comment>
                </div>
                
                <a-list
                  class="item-list"
                  item-layout="horizontal"
                  :data-source="ratingsData.ratings"
                  :header="`${ratingsData.totalRatings} 条评分`"
                >
                  <template #renderItem="{ item }">
                    <a-list-item>
                      <a-comment
                        :author="item.nickname"
                        :datetime="formatTimeFromNow(item.created_at)"
                      >
                        <template #avatar>
                          <a-avatar :src="`${baseUrl}${item.avatar}`"><template #icon><UserOutlined /></template></a-avatar>
                        </template>
                        <template #content>
                          <a-rate :value="item.rating" disabled />
                          <p v-if="item.content">{{ item.content }}</p>
                        </template>
                      </a-comment>
                    </a-list-item>
                  </template>
                </a-list>
              </div>
            </a-tab-pane>

            <a-tab-pane key="2" tab="评论">
               <div class="comments-section">
                <div v-if="userStore.userInfo.id" class="submission-form" style="margin-top: 24px;">
                  <a-comment>
                    <template #avatar>
                      <a-avatar :src="userStore.avatar"><template #icon><UserOutlined /></template></a-avatar>
                    </template>
                    <template #content>
                      <a-form-item>
                        <a-textarea v-model:value="newComment" :rows="4" placeholder="分享你的想法..." />
                      </a-form-item>
                      <a-form-item>
                        <a-button html-type="submit" :loading="submittingComment" type="primary" @click="handleSubmitComment">
                          发布评论
                        </a-button>
                      </a-form-item>
                    </template>
                  </a-comment>
                </div>
                
                <a-list
                  class="item-list"
                  :header="`${comments.length} 条评论`"
                  item-layout="horizontal"
                  :data-source="comments"
                >
                  <template #renderItem="{ item }">
                    <a-list-item>
                      <a-comment
                        :author="item.nickname"
                        :content="item.content"
                        :datetime="formatTimeFromNow(item.created_at)"
                      >
                        <template #avatar>
                          <a-avatar :src="`${baseUrl}${item.avatar}`"><template #icon><UserOutlined /></template></a-avatar>
                        </template>
                      </a-comment>
                    </a-list-item>
                  </template>
                </a-list>
              </div>
            </a-tab-pane>
          </a-tabs>
        </a-col>

        <a-col :xs="24" :md="8">
          <div class="sidebar">
            <div class="info-card">
              <div class="price">{{ parseFloat(activity.price) === 0 ? '免费' : `¥${activity.price}` }}</div>
              <p class="info-item"><CalendarOutlined /> <span>{{ formatTime(activity.start_time) }}</span></p>
              <p class="info-item"><EnvironmentOutlined /> <span>{{ activity.location }}</span></p>
              <div class="action-buttons">
                <button 
                  class="primary-btn" 
                  @click="handleRegister" 
                  :disabled="isRegistered || registering"
                  :class="{ disabled: isRegistered || registering }"
                >
                  {{ buttonText }}
                </button>
                <button 
                  class="secondary-btn" 
                  @click="toggleCollection"
                  :disabled="isTogglingCollection"
                >
                  <template v-if="isCollected">
                    <StarFilled /> 已收藏
                  </template>
                  <template v-else>
                    <StarOutlined /> 收藏
                  </template>
                </button>
              </div>
            </div>
          </div>
        </a-col>
      </a-row>
    </div>

    <div class="chat-fab-button" @click="showChatDrawer">
      <MessageOutlined />
    </div>

    <a-drawer
      title="在线咨询"
      placement="right"
      :closable="true"
      :visible="chatDrawerVisible"
      @close="closeChatDrawer"
      width="400"
      class="chat-drawer"
    >
      <div v-if="adminUser" class="chat-window">
        <div class="messages-area" ref="chatArea">
           <div v-for="message in chatMessages" :key="message.id"
               :class="['message-item', message.sender_id === userStore.userInfo.id ? 'sent' : 'received']">
            <a-avatar v-if="message.sender_id !== userStore.userInfo.id" class="message-avatar"
                      :src="`${baseUrl}${adminUser.avatar}`" />
            <div class="message-content">
              <div class="message-bubble">{{ message.content }}</div>
            </div>
             <a-avatar v-if="message.sender_id === userStore.userInfo.id" class="message-avatar"
                      :src="`${baseUrl}${userStore.userInfo.avatar}`" />
          </div>
        </div>
        <div class="message-input-area">
           <a-textarea
            v-model:value="newChatMessage"
            placeholder="输入消息..."
            :rows="3"
            @pressEnter.prevent="sendChatMessage"
          />
          <a-button type="primary" @click="sendChatMessage" :loading="sendingChatMessage" style="margin-top: 8px; float: right;">
            发送
          </a-button>
        </div>
      </div>
       <div v-else style="text-align: center; padding-top: 50px;">
        <a-spin tip="正在连接客服..."></a-spin>
      </div>
    </a-drawer>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { 
  getActivityDetail, 
  createRegistration, 
  checkRegistrationStatus, 
  checkCollectionStatus, 
  addCollection, 
  removeCollection,
  getActivityComments,
  postActivityComment,
  getActivityRatings,
  postActivityRating
} from '~/api/activity';
import { notification, message } from 'ant-design-vue';
import { CalendarOutlined, EnvironmentOutlined, StarOutlined, StarFilled, UserOutlined, MessageOutlined } from '@ant-design/icons-vue';
import { useUserStore } from '~/stores/user';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import {
  getAdminForChat,
  getChatHistory,
} from '@/api/chat';
import socket from '@/utils/socket';
dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const baseUrl = import.meta.env.VITE_APP_BASE_URL;
const userStore = useUserStore();
const route = useRoute();
const router = useRouter();
const activity = ref(null);
const loading = ref(true);
const registering = ref(false);
const isRegistered = ref(false);
const isCollected = ref(false);
const isTogglingCollection = ref(false);

const comments = ref([]);
const ratingsData = ref({
  ratings: [],
  totalRatings: 0,
  averageRating: 0,
});
const newComment = ref('');
const newRating = ref(0);
const newRatingContent = ref('');
const submittingComment = ref(false);
const submittingRating = ref(false);

const chatDrawerVisible = ref(false);
const adminUser = ref(null);
const chatMessages = ref([]);
const newChatMessage = ref('');
const sendingChatMessage = ref(false);
const chatArea = ref(null);

const buttonText = computed(() => {
  if (registering.value) return '处理中...';
  if (isRegistered.value) return '已报名';
  if (activity.value && parseFloat(activity.value.price) === 0) {
    return '免费报名';
  }
  return '立即报名';
});

const fetchPageData = async () => {
  loading.value = true;
  try {
    const activityId = route.params.id;
    const [activityRes, regStatusRes, colStatusRes, commentsRes, ratingsRes] = await Promise.all([
      getActivityDetail(activityId),
      checkRegistrationStatus(activityId),
      checkCollectionStatus(activityId),
      getActivityComments(activityId),
      getActivityRatings(activityId),
    ]);
    activity.value = activityRes.data;
    isRegistered.value = regStatusRes.data.isRegistered;
    isCollected.value = colStatusRes.data.isCollected;
    comments.value = commentsRes.data;
    ratingsData.value = ratingsRes.data;
  } catch (error) {
    notification.error({ message: '加载失败', description: '无法加载活动详情，请稍后再试。' });
    router.push('/activities');
  } finally {
    loading.value = false;
    isTogglingCollection.value = false;
  }
};

const handleRegister = async () => {
  registering.value = true;
  try {
    await createRegistration({ activity_id: activity.value.id });
    if (parseFloat(activity.value.price) === 0) {
      notification.success({
        message: '报名成功',
        description: '您已成功报名该活动！',
      });
    } else {
      notification.success({
        message: '报名成功',
        description: '您已成功报名，请前往"我的报名"页面完成支付。',
      });
    }
    isRegistered.value = true;
  } catch (error) {
    notification.error({
      message: '报名失败',
      description: error.message || '报名过程中发生错误，请稍后再试。',
    });
  } finally {
    registering.value = false;
  }
};

const toggleCollection = async () => {
  isTogglingCollection.value = true;
  try {
    if (isCollected.value) {
      await removeCollection(activity.value.id);
      notification.success({ message: '已取消收藏' });
    } else {
      await addCollection(activity.value.id);
      notification.success({ message: '收藏成功' });
    }
    isCollected.value = !isCollected.value;
  } catch (error) {
    notification.error({ message: '操作失败', description: error.message || '请稍后再试' });
  } finally {
    isTogglingCollection.value = false;
  }
};

const handleSubmitRating = async () => {
  if (newRating.value === 0) {
    message.warning('请至少选择一个星级');
    return;
  }
  submittingRating.value = true;
  try {
    const activityId = route.params.id;
    await postActivityRating(activityId, newRating.value, newRatingContent.value);
    
    notification.success({ message: '评分成功！' });
    newRating.value = 0;
    newRatingContent.value = '';
    
    const ratingsRes = await getActivityRatings(activityId);
    ratingsData.value = ratingsRes.data;

  } catch (error) {
    notification.error({ message: '提交失败', description: error.message || '请稍后再试' });
  } finally {
    submittingRating.value = false;
  }
};

const handleSubmitComment = async () => {
  if (!newComment.value.trim()) {
    message.warning('评论内容不能为空');
    return;
  }
  submittingComment.value = true;
  try {
    const activityId = route.params.id;
    await postActivityComment(activityId, newComment.value);
    
    notification.success({ message: '评论成功！' });
    newComment.value = '';
    
    const commentsRes = await getActivityComments(activityId);
    comments.value = commentsRes.data;

  } catch (error) {
    notification.error({ message: '提交失败', description: error.message || '请稍后再试' });
  } finally {
    submittingComment.value = false;
  }
};

const showChatDrawer = async () => {
  chatDrawerVisible.value = true;
  if (!adminUser.value) {
    try {
      const res = await getAdminForChat();
      adminUser.value = res.data;
      
      const historyRes = await getChatHistory(adminUser.value.id);
      chatMessages.value = historyRes.data;
      
      setupSocket();
      scrollToChatBottom();

    } catch (error) {
       notification.error({ message: '错误', description: error.message || '无法连接到客服' });
       chatDrawerVisible.value = false;
    }
  } else {
    if(!socket.connected) {
      socket.connect();
      socket.emit('user_online', userStore.userInfo.id);
    }
  }
};

const closeChatDrawer = () => {
  chatDrawerVisible.value = false;
  socket.disconnect();
};

const setupSocket = () => {
  if (!socket.connected) {
    socket.auth = { userId: userStore.userInfo.id };
    socket.connect();
    socket.emit('user_online', userStore.userInfo.id);
  }

  socket.off('receive_message');
  socket.on('receive_message', (message) => {
    if ((message.sender_id === adminUser.value?.id && message.receiver_id === userStore.userInfo.id) ||
        (message.sender_id === userStore.userInfo.id && message.receiver_id === adminUser.value?.id)) {
      chatMessages.value.push(message);
      scrollToChatBottom();
    }
  });
};

const sendChatMessage = () => {
  if (!newChatMessage.value.trim() || !adminUser.value) return;

  sendingChatMessage.value = true;
  const messageData = {
    sender_id: userStore.userInfo.id,
    receiver_id: adminUser.value.id,
    content: newChatMessage.value,
  };
  
  socket.emit('private_message', messageData);
  newChatMessage.value = '';
  sendingChatMessage.value = false;
};

const scrollToChatBottom = () => {
  nextTick(() => {
    if (chatArea.value) {
      chatArea.value.scrollTop = chatArea.value.scrollHeight;
    }
  });
};

const formatTimeFromNow = (time) => dayjs(time).fromNow();
const formatTime = (time) => dayjs(time).format('YYYY-MM-DD HH:mm');

onMounted(fetchPageData);
</script>

<style scoped lang="less">
:deep(.ant-rate) {
  position: relative;
  top: -5px;
}
.activity-detail-page {
  background-color: #f7f8fa;
  min-height: 100vh;
  position: relative;
}
.hero-section {
  height: 400px;
  background-size: cover;
  background-position: center;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 40px;
  color: #fff;
}
.hero-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(to top, rgba(0,0,0,0.7) 20%, rgba(0,0,0,0.1));
}
.hero-content {
  position: relative;
  z-index: 2;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}
.back-btn {
  background: rgba(255,255,255,0.2);
  border: 1px solid rgba(255,255,255,0.5);
  color: #fff;
  padding: 8px 16px;
  border-radius: 20px;
  cursor: pointer;
  margin-bottom: 24px;
  backdrop-filter: blur(4px);
  transition: all 0.3s;
}
.back-btn:hover {
  background: rgba(255,255,255,0.3);
}
.activity-title {
  font-size: 3rem;
  font-weight: bold;
  text-shadow: 0 2px 8px rgba(0,0,0,0.5);
  margin: 0;
}
.category-tag {
  display: inline-block;
  background: rgba(255,255,255,0.2);
  padding: 4px 12px;
  border-radius: 16px;
  margin-top: 12px;
}

.content-wrapper {
  max-width: 1200px;
  margin: 24px auto 0 auto;
  padding: 0 24px 40px 24px;
}

.main-content {
  padding: 32px;
  background-color: #fff;
  border-radius: 8px;
  margin-bottom: 24px;
  min-height: 300px;
}

.comments-section, .ratings-section {
  background: transparent;
  padding: 0;
  border-radius: 0;
  margin-bottom: 0;
}
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}
.section-title {
  font-size: 1.5rem;
  font-weight: bold;
  margin: 0;
}
.rating-summary {
  display: flex;
  align-items: center;
  gap: 16px;
}
.rating-score {
  font-size: 2rem;
  font-weight: bold;
  color: #faad14;
}
.rating-details .ant-statistic-title {
  font-size: 0.9rem;
  color: #8c8c8c;
}
.rating-details .ant-statistic-content {
  font-size: 1.2rem;
}
.submission-form {
  margin-bottom: 32px;
}

.item-list .ant-list-item {
  border-bottom: 1px solid #f0f0f0 !important;
}

.sidebar .info-card {
  background: #fff;
  padding: 24px;
  border-radius: 8px;
}
.price {
  font-size: 2rem;
  font-weight: bold;
  color: #ff4d4f;
  margin-bottom: 16px;
}
.info-item {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  font-size: 1rem;
  color: #6b7280;
}
.action-buttons {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}
.primary-btn {
  flex-grow: 1;
  padding: 12px 20px;
  font-size: 1rem;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-weight: 500;
  background-color: #1890ff;
  color: #fff;
  transition: all 0.3s ease;
}
.primary-btn:hover {
  background-color: #40a9ff;
}
.primary-btn.disabled {
  background-color: #b0b0b0;
  cursor: not-allowed;
}
.secondary-btn {
  padding: 12px 20px;
  font-size: 1rem;
  border-radius: 6px;
  border: 1px solid #d9d9d9;
  cursor: pointer;
  background-color: #fff;
  color: #333;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
}
.secondary-btn:hover {
  background-color: #f7f7f7;
  border-color: #1890ff;
  color: #1890ff;
}
.secondary-btn:disabled {
  background-color: #f5f5f5;
  color: #b0b0b0;
  cursor: not-allowed;
  border-color: #d9d9d9;
}

.skeleton-wrapper {
  padding: 40px;
}

/* 确保富文本内容中的图片不会超出容器 */
.main-content img {
  max-width: 100%;
  height: auto;
}

.ratings-comments-tabs {
  background: #fff;
  padding: 0 24px 24px;
  border-radius: 8px;
}

.chat-fab-button {
  position: fixed;
  right: 40px;
  bottom: 100px;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background-color: #1890ff;
  color: white;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 28px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  transition: all 0.3s;
  z-index: 1000;

  &:hover {
    background-color: #40a9ff;
    transform: scale(1.1);
  }
}

.chat-drawer .ant-drawer-body {
  padding: 0;
}

.chat-window {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.chat-header {
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;
  flex-shrink: 0;
  h3 {
    margin: 0;
    font-size: 16px;
  }
}

.messages-area {
  flex-grow: 1;
  overflow-y: auto;
  padding: 16px;
  background-color: #f5f5f5;
}

.message-item {
  display: flex;
  margin-bottom: 16px;

  .message-avatar {
    flex-shrink: 0;
  }

  .message-content {
    display: flex;
    flex-direction: column;
    max-width: 80%;
  }

  .message-bubble {
    padding: 8px 12px;
    border-radius: 18px;
    word-break: break-word;
  }

  &.sent {
    justify-content: flex-end;
    .message-content {
      align-items: flex-end;
    }
    .message-bubble {
      background-color: #1890ff;
      color: white;
    }
    .message-avatar {
      margin-left: 12px;
    }
  }

  &.received {
    justify-content: flex-start;
    .message-content {
      align-items: flex-start;
    }
    .message-bubble {
      background-color: #fff;
    }
     .message-avatar {
      margin-right: 12px;
    }
  }
}

.message-input-area {
  padding: 16px;
  border-top: 1px solid #f0f0f0;
  background: #fff;
  flex-shrink: 0;
}
</style> 