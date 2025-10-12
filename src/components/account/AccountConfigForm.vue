<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { NCard, NForm, NFormItem, NSelect, NInput, NButton, NAlert } from 'naive-ui';
import type { AccountCreateItem, ProxyConfig } from '@/types/account';
import type { SelectOption } from 'naive-ui';

interface Props {
  account: AccountCreateItem;
  canRemove?: boolean;
}

interface Emits {
  (e: 'remove'): void;
}

const props = withDefaults(defineProps<Props>(), {
  canRemove: true
});

const emit = defineEmits<Emits>();

// 登录方式选项（只在扫码上号时显示）
const loginMethodOptions = ref<SelectOption[]>([
  { label: '视频号助手 - 不支持长按扫码，在线时间长', value: 'channels_helper' },
  { label: '小店带货助手 - 支持长按扫码，在线时间短', value: 'shop_helper' }
]);

// 代理选项
const proxyOptions = ref<SelectOption[]>([
  { label: '不使用代理', value: null }
]);

// 分组选项
const groupOptions = ref<SelectOption[]>([]);

// 加载分组列表
async function loadGroups() {
  try {
    const { invoke } = await import('@tauri-apps/api/tauri');
    const response = await invoke<any>('get_group_list');

    console.log('分组列表响应:', response);

    if (response.success && response.data) {
      // BitBrowser API 返回格式: { success: true, data: [...] } 或 { success: true, data: { list: [...] } }
      const groupList = Array.isArray(response.data) ? response.data : (response.data.list || []);

      groupOptions.value = groupList.map((group: any) => ({
        label: group.groupName || group.name,
        value: group.id
      }));

      console.log('解析后的分组选项:', groupOptions.value);
    }
  } catch (error) {
    console.error('加载分组列表失败:', error);
  }
}

// 加载代理列表
async function loadProxies() {
  try {
    // TODO: 从配置中获取代理列表
    // const proxies = await getProxyList();
    // proxyOptions.value = [
    //   { label: '不使用代理', value: null },
    //   ...proxies.map(p => ({
    //     label: `${p.host}:${p.port} | ${p.location || '-'}`,
    //     value: p
    //   }))
    // ];
  } catch (error) {
    console.error('加载代理列表失败:', error);
  }
}

onMounted(() => {
  loadGroups();
  loadProxies();
});
</script>

<template>
  <NCard
    :title="`账号 #${account.index + 1}`"
    size="small"
    :bordered="true"
    class="account-config-card"
  >
    <template #header-extra>
      <NButton
        v-if="canRemove"
        text
        type="error"
        size="small"
        @click="emit('remove')"
      >
        <template #icon>
          <icon-mdi:delete />
        </template>
      </NButton>
    </template>

    <NForm label-placement="left" label-width="80" :model="account.config">
      <!-- 登录方式选择 - 只在扫码上号时显示 -->
      <NFormItem
        v-if="account.config.loginWay === 'qr_code'"
        label="登录方式"
        path="loginMethod"
      >
        <NSelect
          v-model:value="account.config.loginMethod"
          :options="loginMethodOptions"
          placeholder="选择登录方式"
        />
      </NFormItem>

      <!-- 分组选择 -->
      <NFormItem label="分组" path="groupId" required>
        <NSelect
          v-model:value="account.config.groupId"
          :options="groupOptions"
          placeholder="选择分组"
          @update:value="(val) => {
            const option = groupOptions.find(o => o.value === val);
            account.config.groupName = option?.label as string;
          }"
        />
      </NFormItem>

      <!-- 备注 -->
      <NFormItem label="备注" path="remark">
        <NInput
          v-model:value="account.config.remark"
          :placeholder="`账号${account.index + 1}`"
          clearable
        />
      </NFormItem>

      <!-- 代理选择 -->
      <NFormItem label="代理" path="proxy">
        <NSelect
          v-model:value="account.config.proxy"
          :options="proxyOptions"
          placeholder="选择代理（可选）"
        />
      </NFormItem>
    </NForm>
  </NCard>
</template>

<style scoped lang="scss">
.account-config-card {
  :deep(.n-card-header) {
    padding: 12px 16px;
  }

  :deep(.n-card__content) {
    padding: 16px;
  }
}
</style>
