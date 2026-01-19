<template>
  <div class="relative" ref="containerRef">
    <!-- Кнопка выбора пресета -->
    <button
      type="button"
      @click.stop="isOpen = !isOpen"
      class="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent flex items-center gap-2"
    >
      <svg
        class="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 13a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6z"
        />
      </svg>
      {{ activePresetName }}
      <span v-if="isDirty" class="text-blue-600">•</span>
      <svg
        class="w-3.5 h-3.5 transition-transform"
        :class="{ 'rotate-180': isOpen }"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M19 9l-7 7-7-7"
        />
      </svg>
    </button>

    <!-- Dropdown -->
    <Transition
      enter-active-class="transition ease-out duration-100"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition ease-in duration-75"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="isOpen"
        @mousedown.stop
        class="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 flex flex-col"
      >
        <!-- Список пресетов -->
        <div class="p-2 max-h-64 overflow-y-auto">
          <button
            v-for="preset in presets"
            :key="preset.id"
            @click="handleSelect(preset.id)"
            class="w-full px-3 py-2 text-left text-sm rounded hover:bg-gray-100 flex items-center justify-between group"
            :class="{
              'bg-blue-50 text-blue-700': activePresetId === preset.id,
              'text-gray-700': activePresetId !== preset.id,
            }"
          >
            <div class="flex items-center gap-2">
              <span>{{ preset.name }}</span>
              <span v-if="preset.isBuiltIn" class="text-xs text-gray-500">(встроенный)</span>
            </div>
            <svg
              v-if="activePresetId === preset.id"
              class="w-4 h-4 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </button>
        </div>

        <!-- Действия -->
        <div class="border-t border-gray-200 p-2 space-y-1">
          <button
            @click="handleSave"
            :disabled="!canSave"
            class="w-full px-3 py-2 text-sm text-left rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-gray-700"
          >
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
              />
            </svg>
            Сохранить
          </button>
          <button
            @click="handleSaveAs"
            class="w-full px-3 py-2 text-sm text-left rounded hover:bg-gray-100 flex items-center gap-2 text-gray-700"
          >
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
            Сохранить как…
          </button>
          <button
            v-if="activePreset && !activePreset.isBuiltIn"
            @click="handleRename"
            class="w-full px-3 py-2 text-sm text-left rounded hover:bg-gray-100 flex items-center gap-2 text-gray-700"
          >
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            Переименовать
          </button>
          <button
            v-if="activePreset && !activePreset.isBuiltIn"
            @click="handleDelete"
            class="w-full px-3 py-2 text-sm text-left rounded hover:bg-red-50 text-red-600 flex items-center gap-2"
          >
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            Удалить
          </button>
        </div>
      </div>
    </Transition>

    <!-- Диалог "Сохранить как" -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition ease-out duration-200"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition ease-in duration-150"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="showSaveAsDialog"
          class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          @click="showSaveAsDialog = false"
        >
          <div
            @click.stop
            class="bg-white rounded-lg shadow-xl p-6 w-96"
          >
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Сохранить пресет</h3>
            <input
              v-model="newPresetName"
              @keyup.enter="confirmSaveAs"
              @keyup.esc="showSaveAsDialog = false"
              type="text"
              placeholder="Название пресета"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autofocus
            />
            <div class="flex justify-end gap-2 mt-4">
              <button
                @click="showSaveAsDialog = false"
                class="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Отмена
              </button>
              <button
                @click="confirmSaveAs"
                :disabled="!newPresetName.trim()"
                class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Диалог "Переименовать" -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition ease-out duration-200"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition ease-in duration-150"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="showRenameDialog"
          class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          @click="showRenameDialog = false"
        >
          <div
            @click.stop
            class="bg-white rounded-lg shadow-xl p-6 w-96"
          >
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Переименовать пресет</h3>
            <input
              v-model="renamePresetName"
              @keyup.enter="confirmRename"
              @keyup.esc="showRenameDialog = false"
              type="text"
              placeholder="Название пресета"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autofocus
            />
            <div class="flex justify-end gap-2 mt-4">
              <button
                @click="showRenameDialog = false"
                class="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Отмена
              </button>
              <button
                @click="confirmRename"
                :disabled="!renamePresetName.trim()"
                class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Переименовать
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick, Teleport } from 'vue'
import type { TableColumnsPreset } from '../../../types/tablePresets'

const props = defineProps<{
  presets: TableColumnsPreset[]
  activePresetId: string | null
  isDirty: boolean
}>()

const emit = defineEmits<{
  select: [presetId: string]
  save: []
  saveAs: [name: string]
  rename: [name: string]
  delete: []
}>()

const containerRef = ref<HTMLElement | null>(null)
const isOpen = ref(false)
const showSaveAsDialog = ref(false)
const showRenameDialog = ref(false)
const newPresetName = ref('')
const renamePresetName = ref('')

const activePresetName = computed(() => {
  if (!props.activePresetId) return 'Пресет'
  const preset = props.presets.find((p) => p.id === props.activePresetId)
  return preset?.name || 'Пресет'
})

const activePreset = computed(() => {
  if (!props.activePresetId) return null
  return props.presets.find((p) => p.id === props.activePresetId) || null
})

const canSave = computed(() => {
  return props.activePresetId && props.activePreset && !props.activePreset.isBuiltIn
})

const handleSelect = (presetId: string) => {
  emit('select', presetId)
  isOpen.value = false
}

const handleSave = () => {
  if (!canSave.value) return
  emit('save')
  isOpen.value = false
}

const handleSaveAs = () => {
  showSaveAsDialog.value = true
  newPresetName.value = ''
  isOpen.value = false
}

const confirmSaveAs = () => {
  if (!newPresetName.value.trim()) return
  emit('saveAs', newPresetName.value.trim())
  showSaveAsDialog.value = false
  newPresetName.value = ''
}

const handleRename = () => {
  if (!activePreset.value) return
  renamePresetName.value = activePreset.value.name
  showRenameDialog.value = true
  isOpen.value = false
}

const confirmRename = () => {
  if (!renamePresetName.value.trim()) return
  emit('rename', renamePresetName.value.trim())
  showRenameDialog.value = false
  renamePresetName.value = ''
}

const handleDelete = () => {
  if (!confirm('Удалить пресет "' + activePreset.value?.name + '"?')) {
    return
  }
  emit('delete')
  isOpen.value = false
}

const handleClickOutside = async (event: MouseEvent) => {
  await nextTick()
  if (!isOpen.value) {
    return
  }
  if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside, true)
})
</script>
