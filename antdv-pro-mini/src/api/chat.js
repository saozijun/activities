export const getAdminForChat = (data) => {
  return useGet('/chat/admin')
}

export const getChatUserList = (data) => {
  return useGet('/chat/users');
}

export const getChatHistory = (userId) => {
  return useGet(`/chat/history/${userId}`);
}