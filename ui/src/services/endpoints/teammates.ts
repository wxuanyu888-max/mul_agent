/**
 * Teammates API Endpoints
 */

import { api } from '../api';

export interface TeammateInfo {
  name: string;
  role: string;
  status: 'WORKING' | 'IDLE' | 'SHUTDOWN';
  createdAt: string;
  prompt?: string;
}

export interface UpdateTeammateParams {
  role?: string;
  prompt?: string;
}

export const teammatesApi = {
  /**
   * 获取所有 teammates 列表
   */
  list: async () => {
    const response = await api.get<{ data: TeammateInfo[] }>('/teammates');
    return response.data;
  },

  /**
   * 获取指定 teammate 状态
   */
  getStatus: async (name: string) => {
    const response = await api.get<{ data: TeammateInfo }>(`/teammates/${name}`);
    return response.data;
  },

  /**
   * 更新 teammate 配置（立即生效）
   */
  update: async (name: string, params: UpdateTeammateParams) => {
    const response = await api.put<{ data: TeammateInfo; message: string }>(`/teammates/${name}`, params);
    return response.data;
  },

  /**
   * 获取收件箱消息
   */
  getInbox: async (name: string) => {
    const response = await api.get<{ data: any[] }>(`/teammates/${name}/inbox`);
    return response.data;
  },
};

export default teammatesApi;
