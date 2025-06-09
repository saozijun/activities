import { useGet, usePost, useDelete } from '~/utils/request'

/**
 * 活动分页列表
 * @param {*} data
 * @returns
 */
export const list = (data) => {
  return useGet('/activity/page', data)
}

/**
 * 新增/编辑活动
 * @param {*} data
 * @returns
 */
export const save = (data) => {
  return usePost('/activity/save', data)
}

/**
 * 删除活动
 * @param {*} data
 * @returns
 */
export const del = (data) => {
  return usePost('/activity/delete', data)
}

/**
 * 获取活动分类
 * @returns
 */
export const getCategories = () => {
  return useGet('/activity/categories')
}

/**
 * 获取公共活动列表
 * @param {*} data
 * @returns
 */
export const getPublicActivities = (data) => {
  return useGet('/public/activities', data)
}

/**
 * 获取单个活动详情
 * @param {string} id
 * @returns
 */
export const getActivityDetail = (id) => {
  return useGet(`/public/activities/${id}`)
}

/**
 * 创建报名
 * @param {*} data
 * @returns
 */
export const createRegistration = (data) => {
  return usePost('/registrations', data)
}

/**
 * 获取我的报名列表
 * @returns
 */
export const getMyRegistrations = () => {
  return useGet('/my-registrations')
}

/**
 * 发起支付
 * @param {*} data
 * @returns
 */
export const initiatePayment = (data) => {
  return usePost('/payment/initiate', data)
}

/**
 * 确认支付
 * @param {*} data
 * @returns
 */
export const confirmPayment = (data) => {
  return usePost('/payment/confirm', data)
}

/**
 * 检查报名状态
 * @param {string} activity_id
 * @returns
 */
export const checkRegistrationStatus = (activity_id) => {
  return useGet('/registrations/status', { activity_id })
}

export function checkCollectionStatus(activityId) {
  return useGet('/collections/status', { activity_id: activityId })
}

export function addCollection(activityId) {
  return usePost('/collections', { activity_id: activityId })
}

export function removeCollection(activityId) {
  return useDelete('/collections', { activity_id: activityId })
}

export function getMyCollections() {
  return useGet('/my-collections')
}

// --- Comments and Ratings ---

export function getActivityComments(activityId) {
  return useGet(`/activities/${activityId}/comments`);
}

export function postActivityComment(activityId, content) {
  return usePost(`/activities/${activityId}/comments`, { content });
}

export function getActivityRatings(activityId) {
  return useGet(`/activities/${activityId}/ratings`);
}

export function postActivityRating(activityId, rating, content) {
  return usePost(`/activities/${activityId}/ratings`, { rating, content });
}

export function analyzeActivity(activity, prompt) {
  return usePost('/activities/analyze', { activity, prompt });
} 