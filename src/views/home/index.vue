<script setup lang="ts">
import { useAppStore } from '@/stores/app';

const appStore = useAppStore();
</script>

<template>
  <div class="h-full flex-col-center gap-16px">
    <NCard :bordered="false" class="w-full">
      <div class="flex-col-center gap-16px">
        <div class="text-32px font-bold text-primary">
          视频号工具箱
        </div>
        <div class="text-16px text-#666">
          欢迎使用视频号管理工具
        </div>
      </div>
    </NCard>

    <NGrid :cols="3" :x-gap="16" :y-gap="16" class="w-full">
      <NGi>
        <NCard :bordered="false" class="card-wrapper h-120px flex-center cursor-pointer hover:shadow-lg transition-shadow">
          <div class="flex-col-center gap-8px">
            <icon-mdi:account-group class="text-48px text-primary" />
            <div class="text-16px font-medium">账号管理</div>
            <div class="text-12px text-#999">管理视频号账号</div>
          </div>
        </NCard>
      </NGi>
      <NGi>
        <NCard :bordered="false" class="card-wrapper h-120px flex-center cursor-pointer hover:shadow-lg transition-shadow">
          <div class="flex-col-center gap-8px">
            <icon-mdi:chart-line class="text-48px text-success" />
            <div class="text-16px font-medium">数据看板</div>
            <div class="text-12px text-#999">查看数据统计</div>
          </div>
        </NCard>
      </NGi>
      <NGi>
        <NCard :bordered="false" class="card-wrapper h-120px flex-center cursor-pointer hover:shadow-lg transition-shadow">
          <div class="flex-col-center gap-8px">
            <icon-mdi:cog class="text-48px text-warning" />
            <div class="text-16px font-medium">系统设置</div>
            <div class="text-12px text-#999">配置系统参数</div>
          </div>
        </NCard>
      </NGi>
    </NGrid>

    <NCard :bordered="false" class="w-full">
      <NSpace vertical :size="12">
        <div class="text-18px font-bold">快速开始</div>
        <NSteps vertical :current="1" :status="'process'">
          <NStep title="连接比特浏览器" description="在系统设置中配置比特浏览器地址" />
          <NStep title="添加账号" description="在账号管理中添加视频号账号" />
          <NStep title="查看数据" description="在数据看板中查看账号统计数据" />
        </NSteps>
      </NSpace>
    </NCard>
  </div>
</template>

<style scoped>
.card-wrapper {
  border-radius: 8px;
}
</style>
