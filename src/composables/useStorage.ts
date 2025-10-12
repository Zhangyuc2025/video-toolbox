/**
 * 本地存储工具
 * 基于 VueUse 的 useStorage 和 useLocalStorage
 */
import { useStorage, useLocalStorage, useSessionStorage } from '@vueuse/core'
import { RemovableRef } from '@vueuse/core'

/**
 * LocalStorage 存储（持久化）
 *
 * @param key - 存储键
 * @param initialValue - 初始值
 *
 * @example
 * const count = useLocal('count', 0)
 * count.value++ // 自动保存到 localStorage
 */
export function useLocal<T>(key: string, initialValue: T): RemovableRef<T> {
  return useLocalStorage(key, initialValue)
}

/**
 * SessionStorage 存储（会话级）
 *
 * @param key - 存储键
 * @param initialValue - 初始值
 *
 * @example
 * const token = useSession('token', '')
 * token.value = 'abc123' // 自动保存到 sessionStorage
 */
export function useSession<T>(key: string, initialValue: T): RemovableRef<T> {
  return useSessionStorage(key, initialValue)
}

/**
 * 通用存储（可选择存储类型）
 *
 * @param key - 存储键
 * @param initialValue - 初始值
 * @param type - 存储类型（local 或 session）
 */
export function useStore<T>(
  key: string,
  initialValue: T,
  type: 'local' | 'session' = 'local'
): RemovableRef<T> {
  if (type === 'session') {
    return useSessionStorage(key, initialValue)
  }
  return useLocalStorage(key, initialValue)
}

/**
 * 最近使用列表存储
 *
 * @param key - 存储键
 * @param maxSize - 最大保存数量
 *
 * @example
 * const recentSearches = useRecentList('recent_searches', 10)
 *
 * recentSearches.add('keyword1')
 * recentSearches.add('keyword2')
 *
 * console.log(recentSearches.list.value) // ['keyword2', 'keyword1']
 */
export function useRecentList<T = string>(key: string, maxSize: number = 10) {
  const list = useLocal<T[]>(key, [])

  function add(item: T) {
    // 移除已存在的项
    const index = list.value.findIndex(i => JSON.stringify(i) === JSON.stringify(item))
    if (index !== -1) {
      list.value.splice(index, 1)
    }

    // 添加到开头
    list.value.unshift(item)

    // 限制数量
    if (list.value.length > maxSize) {
      list.value = list.value.slice(0, maxSize)
    }
  }

  function remove(item: T) {
    const index = list.value.findIndex(i => JSON.stringify(i) === JSON.stringify(item))
    if (index !== -1) {
      list.value.splice(index, 1)
    }
  }

  function clear() {
    list.value = []
  }

  return {
    list,
    add,
    remove,
    clear
  }
}

/**
 * 偏好设置存储
 *
 * @example
 * const prefs = usePreferences('app_prefs', {
 *   theme: 'light',
 *   lang: 'zh-CN'
 * })
 *
 * prefs.theme.value = 'dark' // 自动保存
 */
export function usePreferences<T extends Record<string, any>>(key: string, defaults: T) {
  const storage = useLocal(key, defaults)

  // 创建代理，使每个属性都可以单独访问
  const preferences = {} as { [K in keyof T]: RemovableRef<T[K]> }

  for (const k in defaults) {
    Object.defineProperty(preferences, k, {
      get() {
        return storage.value[k]
      },
      set(value: T[typeof k]) {
        storage.value = {
          ...storage.value,
          [k]: value
        }
      }
    })
  }

  return {
    ...preferences,
    $reset() {
      storage.value = defaults
    },
    $all: storage
  }
}
