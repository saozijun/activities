<template>
  <page-container>
    <a-card :bordered="false">
      <a-layout style="background: #fff; min-height: 75vh;">
        <a-layout-sider width="300" style="background: #fff; border-right: 1px solid #f0f0f0;">
          <a-menu
            mode="inline"
            :selectedKeys="selectedUser ? [String(selectedUser.id)] : []"
            @click="handleSelectUser"
            style="height: 100%;"
          >
            <a-list
              item-layout="horizontal"
              :data-source="chatUsers"
              :loading="loadingUsers"
            >
              <template #header>
                <div style="padding: 12px 24px; font-weight: bold; font-size: 16px;">聊天用户</div>
              </template>
              <template #renderItem="{ item }">
                <a-list-item :key="item.id" class="user-list-item" @click="() => handleSelectUser(item)">
                   <a-list-item-meta>
                    <template #title>
                      <span class="user-nickname">{{ item.nickname }}</span>
                    </template>
                    <template #avatar>
                      <a-avatar style="width: 50px; height: 50px;" :src="BaseUrl + item.avatar" />
                    </template>
                     <template #description>
                       <div class="last-message">{{ item.last_message }}</div>
                     </template>
                  </a-list-item-meta>
                </a-list-item>
              </template>
            </a-list>
          </a-menu>
        </a-layout-sider>
        <a-layout-content style="padding: 0 24px 24px; position: relative;">
          <div v-if="selectedUser" class="chat-window">
            <div class="chat-header">
              <h3>与 {{ selectedUser.nickname }} 的对话</h3>
            </div>
            <div class="messages-area" ref="messagesArea">
              <div v-for="message in messages" :key="message.id"
                   :class="['message-item', message.sender_id === currentUser.id ? 'sent' : 'received']">
                <a-avatar v-if="message.sender_id !== currentUser.id" class="message-avatar"
                          :src="`http://localhost:3000${selectedUser.avatar}`" />
                <div class="message-content">
                  <div class="message-bubble">{{ message.content }}</div>
                  <div class="message-time">{{ formatTime(message.created_at) }}</div>
                </div>
                 <a-avatar v-if="message.sender_id === currentUser.id" class="message-avatar"
                          :src="`http://localhost:3000${currentUser.avatar}`" />
              </div>
            </div>
            <div class="message-input-area">
              <a-textarea
                v-model:value="newMessage"
                placeholder="输入消息..."
                :rows="3"
                @pressEnter.prevent="sendMessage"
              />
              <a-button type="primary" @click="sendMessage" :loading="sending" style="margin-top: 8px;">
                发送
              </a-button>
            </div>
          </div>
          <div v-else class="no-chat-selected">
            <a-empty description="请从左侧选择一个用户开始聊天" />
          </div>
        </a-layout-content>
      </a-layout>
    </a-card>
  </page-container>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import { useUserStore } from '@/stores/user';
import { getChatUserList, getChatHistory } from '@/api/chat';
import socket from '@/utils/socket';
import dayjs from 'dayjs';

const userStore = useUserStore();
const currentUser = userStore.userInfo;

const BaseUrl = import.meta.env.VITE_APP_BASE_URL;
const chatUsers = ref([]);
const loadingUsers = ref(false);
const selectedUser = ref(null);

const messages = ref([]);
const loadingMessages = ref(false);
const messagesArea = ref(null);

const newMessage = ref('');
const sending = ref(false);

const fetchChatUsers = async () => {
  loadingUsers.value = true;
  try {
    const res = await getChatUserList();
    chatUsers.value = res.data;
  } catch (error) {} finally {
    loadingUsers.value = false;
  }
};

const handleSelectUser = async (user) => {
  selectedUser.value = user;
  loadingMessages.value = true;
  try {
    const res = await getChatHistory(user.id);
    messages.value = res.data;
    scrollToBottom();
  } catch (error) {} finally {
    loadingMessages.value = false;
  }
};

const sendMessage = () => {
  if (!newMessage.value.trim() || !selectedUser.value) return;

  sending.value = true;
  const messageData = {
    sender_id: currentUser.id,
    receiver_id: selectedUser.value.id,
    content: newMessage.value,
  };

  socket.emit('private_message', messageData);
  newMessage.value = '';
  sending.value = false;
};

const handleNewMessage = (message) => {
  const isForCurrentChat = (message.sender_id === selectedUser.value?.id && message.receiver_id === currentUser.id) ||
                            (message.sender_id === currentUser.id && message.receiver_id === selectedUser.value?.id);
  
  if (isForCurrentChat) {
    messages.value.push(message);
    scrollToBottom();
  }

  fetchChatUsers();
};

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesArea.value) {
      messagesArea.value.scrollTop = messagesArea.value.scrollHeight;
    }
  });
};

const formatTime = (time) => dayjs(time).format('YYYY-MM-DD HH:mm');

onMounted(() => {
  fetchChatUsers();
  
  socket.auth = { userId: currentUser.id };
  socket.connect();
  socket.emit('user_online', currentUser.id);
  
  socket.on('receive_message', handleNewMessage);
});

onUnmounted(() => {
  socket.off('receive_message', handleNewMessage);
  socket.disconnect();
});
</script>

<style scoped lang="less">
.user-list-item {
  cursor: pointer;
  transition: background-color 0.3s;

  &:hover {
    background-color: #f0f2f5;
  }

  .user-nickname {
    font-weight: 500;
  }
  
  .last-message {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: #888;
  }
}

.chat-window {
  display: flex;
  flex-direction: column;
  height: 75vh;
}

.chat-header {
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;
  h3 {
    margin: 0;
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
    max-width: 70%;
  }

  .message-bubble {
    padding: 8px 12px;
    border-radius: 18px;
    word-break: break-word;
  }

  .message-time {
    font-size: 12px;
    color: #999;
    margin-top: 4px;
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
}

.no-chat-selected {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  color: #999;
}
</style> 