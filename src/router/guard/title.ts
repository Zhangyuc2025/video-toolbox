import type { Router } from 'vue-router';
import { useTitle } from '@vueuse/core';

export function createDocumentTitleGuard(router: Router) {
  router.afterEach(to => {
    const { title } = to.meta;

    useTitle(title || '视频号工具箱');
  });
}
