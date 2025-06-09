<template>
  <page-container>
    <a-spin :spinning="loading">
      <a-row :gutter="[16, 16]">
        <a-col :xs="24" :sm="12" :md="6">
          <div class="stats-card card-blue">
            <div class="icon-wrapper">
              <UserOutlined />
            </div>
            <div class="stats-info">
              <a-statistic title="用户总数" :value="stats.totalUsers" :precision="0" />
            </div>
          </div>
        </a-col>
        <a-col :xs="24" :sm="12" :md="6">
          <div class="stats-card card-green">
            <div class="icon-wrapper">
              <AppstoreOutlined />
            </div>
            <div class="stats-info">
              <a-statistic title="活动总数" :value="stats.totalActivities" :precision="0" />
            </div>
          </div>
        </a-col>
        <a-col :xs="24" :sm="12" :md="6">
           <div class="stats-card card-orange">
            <div class="icon-wrapper">
              <SolutionOutlined />
            </div>
            <div class="stats-info">
              <a-statistic title="总报名数" :value="stats.totalRegistrations" :precision="0" />
            </div>
          </div>
        </a-col>
        <a-col :xs="24" :sm="12" :md="6">
          <div class="stats-card card-purple">
            <div class="icon-wrapper">
              <PayCircleOutlined />
            </div>
            <div class="stats-info">
              <a-statistic title="总收入" :value="stats.totalRevenue" :precision="2" prefix="¥" />
            </div>
          </div>
        </a-col>

        <a-col :span="24">
          <a-card title="近30日报名趋势">
            <div id="daily-registrations-chart" style="height: 300px;"></div>
          </a-card>
        </a-col>

        <a-col :span="16">
          <a-card title="热门活动 Top 5">
            <div id="popular-activities-chart" style="height: 300px;"></div>
          </a-card>
        </a-col>
        <a-col :span="8">
          <a-card title="活动状态分布">
            <div id="activity-status-chart" style="height: 300px;"></div>
          </a-card>
        </a-col>
      </a-row>
    </a-spin>
  </page-container>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue';
import { getDashboardStats } from '~/api/dashboard';
import { Pie, Bar, Line } from '@antv/g2plot';
import { notification } from 'ant-design-vue';
import { 
  UserOutlined, 
  AppstoreOutlined, 
  SolutionOutlined, 
  PayCircleOutlined 
} from '@ant-design/icons-vue';

const loading = ref(true);
const stats = ref({
  totalUsers: 0,
  totalActivities: 0,
  totalRegistrations: 0,
  totalRevenue: 0,
  activityStatus: [],
  popularActivities: [],
  dailyRegistrations: [],
});

let activityStatusChart, popularActivitiesChart, dailyRegistrationsChart;

const renderCharts = () => {
  if (document.getElementById('activity-status-chart')) {
    activityStatusChart = new Pie('activity-status-chart', {
      appendPadding: 10,
      data: stats.value.activityStatus,
      angleField: 'value',
      colorField: 'type',
      radius: 0.8,
      label: {
        type: 'spider',
        labelHeight: 28,
        content: '{name}\n{percentage}',
      },
      interactions: [{ type: 'element-active' }],
    });
    activityStatusChart.render();
  }

  if (document.getElementById('popular-activities-chart')) {
     popularActivitiesChart = new Bar('popular-activities-chart', {
      data: stats.value.popularActivities,
      xField: 'count',
      yField: 'name',
      seriesField: 'name',
      legend: {
        position: 'top-left',
      },
       tooltip: {
        formatter: (datum) => {
          return { name: '报名人数', value: datum.count };
        },
      }
    });
    popularActivitiesChart.render();
  }

  if (document.getElementById('daily-registrations-chart')) {
    dailyRegistrationsChart = new Line('daily-registrations-chart', {
      data: stats.value.dailyRegistrations,
      padding: 'auto',
      xField: 'date',
      yField: 'count',
      xAxis: {
        tickCount: 10,
      },
       tooltip: {
        formatter: (datum) => {
          return { name: '报名数', value: datum.count };
        },
      }
    });
    dailyRegistrationsChart.render();
  }
};

onMounted(async () => {
  try {
    const res = await getDashboardStats();
    if (res.success) {
      stats.value = res.data;
      await nextTick();
      renderCharts();
    } else {
      notification.error({ message: '数据加载失败', description: res.message });
    }
  } catch (error) {
    notification.error({ message: '数据加载失败', description: error.message });
  } finally {
    loading.value = false;
  }
});
</script>

<style lang="less" scoped>
.stats-card {
  display: flex;
  align-items: center;
  padding: 20px;
  border-radius: 8px;
  color: white;
  transition: all 0.3s ease;
  cursor: pointer;

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 20px rgba(0,0,0,0.1);
  }

  .icon-wrapper {
    font-size: 36px;
    margin-right: 20px;
    padding: 15px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .stats-info {
    :deep(.ant-statistic-title) {
      color: rgba(255, 255, 255, 0.8) !important;
      font-size: 14px;
      margin-bottom: 4px;
    }
    :deep(.ant-statistic-content) {
      color: white !important;
      font-size: 24px;
      font-weight: 600;
    }
  }
}
.card-blue {
  background: linear-gradient(135deg, #6A8A9A 0%, #8EAEBD 100%);
  .icon-wrapper { background-color: rgba(255,255,255,0.2); }
}
.card-green {
  background: linear-gradient(135deg, #8FBC8F 0%, #A9C9A4 100%);
  .icon-wrapper { background-color: rgba(255,255,255,0.2); }
}
.card-orange {
  background: linear-gradient(135deg, #D2B48C 0%, #E0C8A0 100%);
  .icon-wrapper { background-color: rgba(255,255,255,0.2); }
}
.card-purple {
  background: linear-gradient(135deg, #B298B6 0%, #C4AEC9 100%);
  .icon-wrapper { background-color: rgba(255,255,255,0.2); }
}
</style>