import { useGet, usePost } from '~/utils/request'

/**
 * 列表
 * @param {*} data 
 * @returns 
 */
export const  list = (data) => {
  return useGet('/user/page', data)
}

/**
 * 新增编辑
 * @param {*} data 
 * @returns 
 */
export const  save = (data) => {
  return usePost('/user/save', data)
}

/**
 * 删除
 * @param {*} data 
 * @returns 
 */
export const del = (data) => {
  return usePost('/users/delete', data)
}

/**
 * 获取用户信息
 * @returns 
 */
export const getInfo = () => {
  return useGet('/user/info')
}

/**
 * 更新信息
 * @param {*} data 
 * @returns 
 */
export const updateInfo = (data) => {
  return usePost('/user/update', data)
}

/**
 * 修改密码
 * @param {*} data
 * @returns
 */
export const changePassword = (data) => {
  return usePost('/user/change-password', data);
};
