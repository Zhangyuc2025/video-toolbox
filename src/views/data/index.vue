<template>
  <div class="data-page">
    <n-card title="数据看板" :bordered="false" class="h-full">
      <n-space vertical :size="16">
        <n-grid :cols="4" :x-gap="12">
          <n-gi>
            <n-statistic label="总账号数" :value="stats.totalAccounts" />
          </n-gi>
          <n-gi>
            <n-statistic label="在线账号" :value="stats.onlineAccounts" />
          </n-gi>
          <n-gi>
            <n-statistic label="今日采集" :value="stats.todayCollected" />
          </n-gi>
          <n-gi>
            <n-statistic label="总数据量" :value="stats.totalData" />
          </n-gi>
        </n-grid>

        <n-card title="数据趋势" size="small">
          <div style="height: 300px; display: flex; align-items: center; justify-content: center; color: #999;">
            图表区域（ECharts 待集成）
          </div>
        </n-card>
      </n-space>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const stats = ref({
  totalAccounts: 0,
  onlineAccounts: 0,
  todayCollected: 0,
  totalData: 0
});

onMounted(() => {
  // 初始化时加载统计数据
});
</script>

<style scoped>
.data-page {
  height: 100%;
}
</style>
