<template>
  <div class="space-y-6">
    <!-- Заголовок и фильтры -->
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <h2 class="text-2xl font-bold text-gray-900">Сводка</h2>
      </div>
      <div class="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          class="app-btn-sm"
          @click="openFilters"
        >
          <svg class="h-3.5 w-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M7 12h10m-7 6h4" />
          </svg>
          Фильтры
          <span
            v-if="activeFiltersCount > 0"
            class="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700"
          >
            {{ activeFiltersCount }}
          </span>
        </button>
        <PresetsControl
          v-if="!presetsLoading"
          :presets="presets"
          :active-preset-id="activePresetId"
          :is-dirty="isDirty"
          @select="handlePresetSelect"
          @save="handlePresetSave"
          @save-as="handlePresetSaveAs"
          @rename="handlePresetRename"
          @delete="handlePresetDelete"
        />
        <ColumnsPickerDropdown
          :all-columns="summaryColumns"
          :visible-column-ids="visibleColumnIds"
          :column-order="columnOrder"
          @update:visible-column-ids="applyVisible"
          @reset="resetToDefault"
          @open-reorder-modal="handleReorderModalOpen"
        />
        <ColumnReorderModal
          :is-open="isReorderModalOpen"
          :all-columns="summaryColumns"
          :column-order="columnOrder"
          :visible-column-ids="visibleColumnIds"
          @close="handleReorderModalClose"
          @confirm="handleReorderConfirm"
          @update:draft-order="handleDraftOrderUpdate"
        />
        <PeriodFilter />
      </div>
    </div>

    <!-- Таблица -->
    <div class="bg-white rounded-lg shadow overflow-hidden">
      <div class="overflow-x-auto overflow-y-auto max-h-[calc(100vh-240px)]">
        <table class="min-w-[calc(100vw-64px)] w-full divide-y divide-gray-200">
          <thead class="bg-gray-50 sticky top-0 z-30">
            <tr>
              <!-- Колонка "Товар" - всегда первая и sticky -->
              <th
                v-if="visibleColumnIds.includes('product')"
                class="px-3 py-3 text-left text-[11px] font-semibold text-gray-500 tracking-normal w-20 sticky left-0 bg-gray-50 z-40"
              >
                Товар
              </th>
              <!-- Остальные колонки -->
              <th
                v-for="col in visibleDataColumns"
                :key="col.id"
                class="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 tracking-normal"
              >
                <div class="flex items-center gap-1">
                  {{ col.label }}
                  <div
                    v-if="col.headerTooltip"
                    class="tooltip-icon"
                    @mouseenter="showTooltip($event, col.headerTooltip)"
                    @mouseleave="hideTooltip"
                  >
                    <svg
                      class="w-4 h-4 text-gray-400 cursor-help"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                </div>
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <!-- Итоговая строка -->
            <tr v-if="summary" class="bg-blue-50 font-semibold sticky top-[48px] z-20">
              <!-- Колонка "Товар" -->
              <td
                v-if="visibleColumnIds.includes('product')"
                class="px-3 py-3 text-sm font-bold text-gray-900 sticky left-0 bg-blue-50 z-20"
              >
                Итого
              </td>
              <!-- Остальные колонки -->
              <td
                v-for="col in visibleDataColumns"
                :key="col.id"
                class="px-4 py-3 text-sm"
                :class="renderCell(col, undefined, summary)?.classes || 'text-gray-700'"
              >
                <span v-if="renderCell(col, undefined, summary)?.text">
                  {{ renderCell(col, undefined, summary)?.text }}
                </span>
              </td>
            </tr>

            <!-- Строки артикулов -->
            <template v-for="product in report" :key="product.ni">
              <tr
                class="hover:bg-gray-50 cursor-pointer group"
                @click="toggleProduct(product.ni)"
              >
                <!-- Колонка "Товар" -->
                <td
                  v-if="visibleColumnIds.includes('product')"
                  class="px-3 py-3 sticky left-0 bg-white z-10 group-hover:bg-gray-50 w-20"
                >
                  <div class="flex items-center gap-3">
                    <button
                      class="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 flex-shrink-0"
                      @click.stop="toggleProduct(product.ni)"
                    >
                      <svg
                        v-if="expandedProducts.has(product.ni)"
                        class="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                      </svg>
                      <svg
                        v-else
                        class="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    <img
                      v-if="product.img"
                      :src="product.img"
                      :alt="product.title"
                      class="w-12 h-12 object-cover rounded flex-shrink-0"
                      @error="handleImageError"
                    />
                    <div class="flex-1 min-w-0">
                      <div class="text-sm font-medium text-gray-900 truncate max-w-[140px]">{{ product.ni }}</div>
                      <div
                        class="text-sm text-gray-500 truncate max-w-[140px] cursor-help"
                        @mouseenter="showTooltip($event, product.title)"
                        @mouseleave="hideTooltip"
                      >
                        {{ product.title }}
                      </div>
                    </div>
                  </div>
                </td>
                <!-- Остальные колонки -->
                <td
                  v-for="col in visibleDataColumns"
                  :key="col.id"
                  class="px-4 py-3 text-sm"
                  :class="renderCell(col, product)?.classes || 'text-gray-700'"
                >
                  <span v-if="renderCell(col, product)?.text">
                    {{ renderCell(col, product)?.text }}
                  </span>
                </td>
              </tr>

              <!-- Строки размеров (вложенные) -->
              <template v-if="expandedProducts.has(product.ni) && product.sizes.length > 0">
                <tr
                  v-for="size in product.sizes"
                  :key="`${product.ni}_${size.sz}`"
                  class="bg-gray-50 hover:bg-gray-100"
                >
                  <!-- Колонка "Товар" для размера -->
                  <td
                    v-if="visibleColumnIds.includes('product')"
                    class="px-3 py-2 pl-12 sticky left-0 bg-gray-50 z-10 group-hover:bg-gray-100 w-20"
                  >
                    <div class="text-sm text-gray-600">Размер: {{ size.sz }}</div>
                  </td>
                  <!-- Остальные колонки для размера -->
                  <td
                    v-for="col in visibleDataColumns"
                    :key="col.id"
                    class="px-4 py-2 text-sm"
                    :class="renderCell(col, size)?.classes || 'text-gray-600'"
                  >
                    <span v-if="renderCell(col, size)?.text">
                      {{ renderCell(col, size)?.text }}
                    </span>
                  </td>
                </tr>
              </template>
            </template>

            <!-- Пустое состояние -->
            <tr v-if="report.length === 0">
              <td :colspan="visibleColumns.length" class="px-4 py-8 text-center text-gray-500">
                {{ !store.filters.dateFrom || !store.filters.dateTo ? 'Выберите период' : 'Нет данных' }}
              </td>
            </tr>
          </tbody>
        </table>
    </div>
    </div>
  </div>

  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isFiltersOpen"
        class="fixed inset-0 z-[60] flex items-start justify-center bg-black/30 p-6"
        @click.self="closeFilters"
      >
        <div class="w-full max-w-xl rounded-xl bg-white p-5 shadow-xl">
          <div class="flex items-center justify-between border-b border-gray-200 pb-3">
            <div class="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <svg class="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M7 12h10m-7 6h4" />
              </svg>
              Фильтры
              <span
                v-if="activeFiltersCount > 0"
                class="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700"
              >
                {{ activeFiltersCount }}
              </span>
            </div>
            <button class="text-xs text-gray-500 hover:text-gray-700" type="button" @click="closeFilters">
              Закрыть
            </button>
          </div>

          <div class="mt-3 grid gap-3 sm:grid-cols-[160px_1fr]">
            <div class="space-y-1 rounded-lg border border-gray-200 bg-gray-50 p-2">
              <button
                type="button"
                class="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs"
                :class="activeFilterTab === 'subject' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:bg-white/70'"
                @click="activeFilterTab = 'subject'"
              >
                Предмет
                <span v-if="draftSubjects.length" class="text-xs text-blue-600">{{ draftSubjects.length }}</span>
              </button>
              <button
                type="button"
                class="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs"
                :class="activeFilterTab === 'vendorCode' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:bg-white/70'"
                @click="activeFilterTab = 'vendorCode'"
              >
                Артикул продавца
                <span v-if="draftVendorCodes.length" class="text-xs text-blue-600">{{ draftVendorCodes.length }}</span>
              </button>
              <button
                type="button"
                class="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs"
                :class="activeFilterTab === 'brand' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:bg-white/70'"
                @click="activeFilterTab = 'brand'"
              >
                Бренд
                <span v-if="draftBrands.length || draftIncludeNoBrand" class="text-xs text-blue-600">
                  {{ draftBrands.length + (draftIncludeNoBrand ? 1 : 0) }}
                </span>
              </button>
              <button
                type="button"
                class="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs"
                :class="activeFilterTab === 'article' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:bg-white/70'"
                @click="activeFilterTab = 'article'"
              >
                Артикул
                <span v-if="draftSearchQuery" class="text-xs text-blue-600">1</span>
              </button>
            </div>

            <div class="rounded-lg border border-gray-200 p-3">
              <div v-if="activeFilterTab === 'subject'">
                <div class="relative mb-3">
                  <input
                    v-model="filterSearch"
                    type="text"
                    placeholder="Поиск по предметам"
                    class="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <svg class="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35m1.6-4.65a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <div class="max-h-56 space-y-1.5 overflow-y-auto pr-1 text-xs text-gray-700">
                  <label
                    v-for="subject in filteredSubjectOptions"
                    :key="subject.code"
                    class="flex items-start gap-2"
                  >
                    <input
                      type="checkbox"
                      class="mt-0.5"
                      :checked="draftSubjects.includes(subject.code)"
                      @change="toggleDraftSubject(subject.code)"
                    />
                    <span class="leading-tight">{{ subject.code }}</span>
                  </label>
                  <div v-if="filteredSubjectOptions.length === 0" class="text-xs text-gray-400">
                    Нет совпадений
                  </div>
                </div>
              </div>

              <div v-else-if="activeFilterTab === 'vendorCode'">
                <div class="relative mb-3">
                  <input
                    v-model="filterSearch"
                    type="text"
                    placeholder="Поиск по артикулам продавца"
                    class="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <svg class="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35m1.6-4.65a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <div class="max-h-56 space-y-1.5 overflow-y-auto pr-1 text-xs text-gray-700">
                  <label
                    v-for="vendor in filteredVendorOptions"
                    :key="vendor.code"
                    class="flex items-start gap-2"
                  >
                    <input
                      type="checkbox"
                      class="mt-0.5"
                      :checked="draftVendorCodes.includes(vendor.code)"
                      @change="toggleDraftVendorCode(vendor.code)"
                    />
                    <span class="leading-tight">
                      {{ vendor.code }}
                      <span v-if="vendor.title" class="block text-[10px] text-gray-500">{{ vendor.title }}</span>
                    </span>
                  </label>
                  <div v-if="filteredVendorOptions.length === 0" class="text-xs text-gray-400">
                    Нет совпадений
                  </div>
                </div>
              </div>

              <div v-else-if="activeFilterTab === 'brand'">
                <div class="relative mb-3">
                  <input
                    v-model="filterSearch"
                    type="text"
                    placeholder="Поиск по брендам"
                    class="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <svg class="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35m1.6-4.65a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <label class="mb-2 flex items-center gap-2 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    class="mt-0.5"
                    :checked="draftIncludeNoBrand"
                    @change="draftIncludeNoBrand = !draftIncludeNoBrand"
                  />
                  Без бренда
                </label>
                <div class="max-h-56 space-y-1.5 overflow-y-auto pr-1 text-xs text-gray-700">
                  <label
                    v-for="brand in filteredBrandOptions"
                    :key="brand.code"
                    class="flex items-start gap-2"
                  >
                    <input
                      type="checkbox"
                      class="mt-0.5"
                      :checked="draftBrands.includes(brand.code)"
                      @change="toggleDraftBrand(brand.code)"
                    />
                    <span class="leading-tight">{{ brand.code }}</span>
                  </label>
                  <div v-if="filteredBrandOptions.length === 0" class="text-xs text-gray-400">
                    Нет совпадений
                  </div>
                </div>
              </div>

              <div v-else>
                <label class="block text-xs font-medium text-gray-700">Поиск по артикулу</label>
                <input
                  v-model="draftSearchQuery"
                  type="text"
                  placeholder="Артикул или название"
                  class="mt-2 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p class="mt-2 text-[11px] text-gray-500">
                  Фильтрует по названию и артикулу в таблице.
                </p>
              </div>
            </div>
          </div>

          <div class="mt-3 flex items-center justify-between border-t border-gray-200 pt-3">
            <button
              type="button"
              class="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
              @click="resetFilters"
            >
              Сбросить
            </button>
            <button
              type="button"
              class="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
              @click="applyFilters"
            >
              Применить
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- Tooltip через Teleport -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="tooltipVisible"
        ref="tooltipRef"
        class="fixed tooltip-popup"
        :style="{
          top: tooltipPosition.top + 'px',
          left: tooltipPosition.left + 'px',
          transform: 'translate(-50%, calc(-100% - 8px))',
        }"
      >
        {{ tooltipText }}
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useAnalyticsStore } from '../../stores/analyticsStore'
import PeriodFilter from './PeriodFilter.vue'
import ColumnsPickerDropdown from './summary/ColumnsPickerDropdown.vue'
import ColumnReorderModal from './summary/ColumnReorderModal.vue'
import PresetsControl from './summary/PresetsControl.vue'
import { useSummaryFilter } from '../composables/useSummaryFilter'
import { useTableColumns } from '../composables/useTableColumns'
import { useTableColumnPresets } from '../composables/useTableColumnPresets'
import { ReportTotalsCalculator } from '../../application/services/ReportTotalsCalculator'
import { summaryColumns, type ColumnDef } from '../summary/summaryColumns'
import type { SizeAggregate, ProductAggregate, ReportTotals } from '../../types/analytics'
import { LocalStorageTableSettingsRepository } from '../../infrastructure/settings/LocalStorageTableSettingsRepository'
import { IndexedDbTablePresetsRepository } from '../../infrastructure/settings/IndexedDbTablePresetsRepository'
import { TablePresetsService } from '../../application/table/TablePresetsService'

const store = useAnalyticsStore()

// Репозиторий для настроек таблицы
const tableSettingsRepo = new LocalStorageTableSettingsRepository()

// Репозиторий и сервис для пресетов
const presetsRepo = new IndexedDbTablePresetsRepository()
const presetsService = new TablePresetsService(presetsRepo)

// Настройки колонок
const tableColumnsApi = useTableColumns(
  summaryColumns,
  tableSettingsRepo,
  'summaryTable:v1'
)

const {
  visibleColumns,
  visibleColumnIds,
  columnOrder,
  toggleColumn,
  resetToDefault,
  applyVisible,
  setVisibleColumnIds,
  setColumnOrder,
} = tableColumnsApi

// Состояние модалки переупорядочивания колонок
const isReorderModalOpen = ref(false)

// Исходный порядок колонок для отката при Cancel
const initialColumnOrder = ref<string[]>([])

// Обработчик изменения draft-order (применяется временно к таблице)
const handleDraftOrderUpdate = async (newOrder: string[]) => {
  // Применяем изменения временно (без сохранения)
  await setColumnOrder(newOrder, true)
}

// Обработчик подтверждения переупорядочивания колонок
const handleReorderConfirm = async (newOrder: string[]) => {
  // Очищаем initialColumnOrder сразу в начале, чтобы предотвратить rollback при закрытии
  initialColumnOrder.value = []
  
  // Сохраняем изменения в localStorage
  // Важно: newOrder должен содержать ВСЕ колонки в правильном порядке
  await setColumnOrder(newOrder, false)
  
  // Ждем следующего тика, чтобы убедиться, что columnOrder обновлен реактивно
  await nextTick()
  
  // Если активен пресет, сохраняем изменения в него
  if (activePresetId.value && activePreset.value && !activePreset.value.isBuiltIn) {
    try {
      // Используем обновленный columnOrder.value после setColumnOrder
      // чтобы гарантировать сохранение правильного порядка (с учетом валидации)
      const orderToSave = [...columnOrder.value] // Создаем копию, чтобы избежать проблем с реактивностью
      await presetsService.saveActive('summaryTable', activePresetId.value, {
        visibleColumnIds: [...visibleColumnIds.value],
        columnOrder: orderToSave,
      })
      // Обновляем список пресетов БЕЗ переприменения пресета
      // Важно: обновляем список после сохранения, но не применяем пресет снова
      presets.value = await presetsService.list('summaryTable')
    } catch (error) {
      console.error('[SummaryView] Error saving preset after reorder:', error)
      alert('Ошибка сохранения пресета: ' + (error instanceof Error ? error.message : String(error)))
    }
  }
  
  // Закрываем модалку после успешного сохранения
  isReorderModalOpen.value = false
}

// Обработчик закрытия модалки (откат изменений при Cancel)
const handleReorderModalClose = async () => {
  // Откатываем изменения к исходному состоянию
  if (initialColumnOrder.value.length > 0) {
    await setColumnOrder(initialColumnOrder.value, true)
    initialColumnOrder.value = []
  }
  isReorderModalOpen.value = false
}

// Обработчик открытия модалки
const handleReorderModalOpen = () => {
  // Сохраняем текущий порядок для отката
  initialColumnOrder.value = [...columnOrder.value]
  isReorderModalOpen.value = true
}

// Пресеты колонок
const {
  presets,
  activePresetId,
  activePreset,
  isDirty,
  isLoading: presetsLoading,
  init: initPresets,
  applyPreset,
  saveActive,
  saveAs,
  renamePreset,
  deletePreset,
} = useTableColumnPresets('summaryTable', {
  visibleColumnIds,
  columnOrder,
  setVisibleColumnIds,
  setColumnOrder,
}, presetsService)

// Обработчики событий пресетов
const handlePresetSelect = async (presetId: string) => {
  try {
    await applyPreset(presetId)
  } catch (error) {
    console.error('[SummaryView] Error applying preset:', error)
    alert('Ошибка применения пресета: ' + (error instanceof Error ? error.message : String(error)))
  }
}

const handlePresetSave = async () => {
  try {
    await saveActive()
  } catch (error) {
    console.error('[SummaryView] Error saving preset:', error)
    alert('Ошибка сохранения пресета: ' + (error instanceof Error ? error.message : String(error)))
  }
}

const handlePresetSaveAs = async (name: string) => {
  try {
    await saveAs(name)
  } catch (error) {
    console.error('[SummaryView] Error saving preset as:', error)
    alert('Ошибка сохранения пресета: ' + (error instanceof Error ? error.message : String(error)))
  }
}

const handlePresetRename = async (name: string) => {
  if (!activePresetId.value) return
  try {
    await renamePreset(activePresetId.value, name)
  } catch (error) {
    console.error('[SummaryView] Error renaming preset:', error)
    alert('Ошибка переименования пресета: ' + (error instanceof Error ? error.message : String(error)))
  }
}

const handlePresetDelete = async () => {
  if (!activePresetId.value) return
  try {
    await deletePreset(activePresetId.value)
  } catch (error) {
    console.error('[SummaryView] Error deleting preset:', error)
    alert('Ошибка удаления пресета: ' + (error instanceof Error ? error.message : String(error)))
  }
}

// Состояние раскрытых артикулов
const expandedProducts = ref<Set<number>>(new Set())

// Видимые колонки без "product" (product всегда первая и sticky)
const visibleDataColumns = computed(() => {
  return visibleColumns.value.filter(col => col.id !== 'product')
})

// Получаем данные из store
const sourceData = computed(() => store.aggregatedReport)

// Фильтрация данных
const {
  searchQuery,
  selectedVendorCodes,
  selectedSubjects,
  selectedBrands,
  includeNoBrand,
  filteredRows,
} = useSummaryFilter(sourceData)

const isFiltersOpen = ref(false)
const activeFilterTab = ref<'subject' | 'vendorCode' | 'brand' | 'article'>('subject')
const filterSearch = ref('')
const draftVendorCodes = ref<string[]>([])
const draftSubjects = ref<string[]>([])
const draftBrands = ref<string[]>([])
const draftIncludeNoBrand = ref(false)
const draftSearchQuery = ref('')

const openFilters = () => {
  draftVendorCodes.value = [...selectedVendorCodes.value]
  draftSubjects.value = [...selectedSubjects.value]
  draftBrands.value = [...selectedBrands.value]
  draftIncludeNoBrand.value = includeNoBrand.value
  draftSearchQuery.value = searchQuery.value
  filterSearch.value = ''
  isFiltersOpen.value = true
}

const closeFilters = () => {
  isFiltersOpen.value = false
}

const applyFilters = () => {
  selectedVendorCodes.value = [...draftVendorCodes.value]
  selectedSubjects.value = [...draftSubjects.value]
  selectedBrands.value = [...draftBrands.value]
  includeNoBrand.value = draftIncludeNoBrand.value
  searchQuery.value = draftSearchQuery.value.trim()
  closeFilters()
}

const resetFilters = () => {
  draftVendorCodes.value = []
  draftSubjects.value = []
  draftBrands.value = []
  draftIncludeNoBrand.value = false
  draftSearchQuery.value = ''
  filterSearch.value = ''
  applyFilters()
}

const toggleDraftVendorCode = (code: string) => {
  const index = draftVendorCodes.value.indexOf(code)
  if (index === -1) {
    draftVendorCodes.value.push(code)
  } else {
    draftVendorCodes.value.splice(index, 1)
  }
}

const toggleDraftSubject = (code: string) => {
  const index = draftSubjects.value.indexOf(code)
  if (index === -1) {
    draftSubjects.value.push(code)
  } else {
    draftSubjects.value.splice(index, 1)
  }
}

const toggleDraftBrand = (code: string) => {
  const index = draftBrands.value.indexOf(code)
  if (index === -1) {
    draftBrands.value.push(code)
  } else {
    draftBrands.value.splice(index, 1)
  }
}

// Уникальные vendorCode (sa) из aggregatedReport для dropdown
const vendorOptions = computed(() => {
  const vendorMap = new Map<string, { code: string; title?: string }>()

  store.aggregatedReport.forEach((product: ProductAggregate) => {
    if (product.sa && !vendorMap.has(product.sa)) {
      vendorMap.set(product.sa, {
        code: product.sa,
        title: product.title,
      })
    }
  })

  return Array.from(vendorMap.values()).sort((a, b) => a.code.localeCompare(b.code))
})

const subjectOptions = computed(() => {
  const subjectSet = new Set<string>()
  for (const product of store.aggregatedReport) {
    if (product.sj) {
      subjectSet.add(product.sj)
    }
  }
  return Array.from(subjectSet)
    .sort((a, b) => a.localeCompare(b))
    .map((subject) => ({ code: subject }))
})

const filteredSubjectOptions = computed(() => {
  const query = filterSearch.value.trim().toLowerCase()
  if (!query) return subjectOptions.value
  return subjectOptions.value.filter((subject) => subject.code.toLowerCase().includes(query))
})

const filteredVendorOptions = computed(() => {
  const query = filterSearch.value.trim().toLowerCase()
  if (!query) return vendorOptions.value
  return vendorOptions.value.filter((vendor) => {
    const title = vendor.title?.toLowerCase() || ''
    return vendor.code.toLowerCase().includes(query) || title.includes(query)
  })
})

const brandOptions = computed(() => {
  const brandSet = new Set<string>()
  for (const product of store.aggregatedReport) {
    if (product.bc) {
      brandSet.add(product.bc)
    }
  }
  return Array.from(brandSet)
    .sort((a, b) => a.localeCompare(b))
    .map((brand) => ({ code: brand }))
})

const filteredBrandOptions = computed(() => {
  const query = filterSearch.value.trim().toLowerCase()
  if (!query) return brandOptions.value
  return brandOptions.value.filter((brand) => brand.code.toLowerCase().includes(query))
})

const activeFiltersCount = computed(() => {
  return (
    selectedVendorCodes.value.length +
    selectedSubjects.value.length +
    selectedBrands.value.length +
    (includeNoBrand.value ? 1 : 0) +
    (searchQuery.value.trim() ? 1 : 0)
  )
})

// Используем отфильтрованные данные
const report = filteredRows

// Вычисляем итоги по отфильтрованным данным
const summary = computed(() => {
  return ReportTotalsCalculator.calculateTotals(
    filteredRows.value,
    store.storageCosts,
    store.acceptanceCosts,
    store.filters.dateFrom || undefined,
    store.filters.dateTo || undefined
  )
})

// Переключение раскрытия артикула
const toggleProduct = (ni: number) => {
  if (expandedProducts.value.has(ni)) {
    expandedProducts.value.delete(ni)
  } else {
    expandedProducts.value.add(ni)
  }
}

// Форматирование валюты
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

const formatBuyoutPercent = (value: number): string => {
  return value.toFixed(1) + '%'
}

const getBuyoutPercentClass = (value: number): string => {
  if (value < 30) return 'text-red-600 font-semibold'
  if (value > 70) return 'text-green-600 font-semibold'
  return 'text-gray-700'
}

const formatPercent = (value: number): string => {
  return value.toFixed(2) + '%'
}

const getMarginPercentClass = (value: number): string => {
  if (value < 0) return 'text-red-600 font-semibold'
  if (value > 20) return 'text-green-600 font-semibold'
  if (value > 10) return 'text-green-500'
  return 'text-gray-700'
}

const getRoiPercentClass = (value: number): string => {
  if (value < 0) return 'text-red-600 font-semibold'
  if (value > 100) return 'text-green-600 font-semibold'
  if (value > 50) return 'text-green-500'
  if (value > 0) return 'text-gray-700'
  return 'text-gray-500'
}

// Обработка ошибки загрузки изображения
const handleImageError = (event: Event) => {
  const img = event.target as HTMLImageElement
  img.style.display = 'none'
}

// Helper функция для рендеринга ячейки колонки
const renderCell = (col: ColumnDef<ProductAggregate, ReportTotals>, row?: ProductAggregate | SizeAggregate, totals?: ReportTotals) => {
  if (col.id === 'product') {
    return null // Обрабатывается отдельно
  }

  let result: string | { text: string; classes?: string } | '—' | null = null
  
  if (totals && col.totalCell) {
    result = col.totalCell(totals)
  } else if (row) {
    const isSize = 'sz' in row
    if (isSize && col.sizeCell) {
      // Это размер, используем sizeCell
      result = col.sizeCell(row as SizeAggregate)
    } else if (isSize && col.cell) {
      // Это размер, но нет sizeCell, используем cell с приведением через unknown
      result = col.cell(row as unknown as ProductAggregate)
    } else if (!isSize && col.cell) {
      // Это продукт
      result = col.cell(row as ProductAggregate)
    }
  }

  if (result === null || result === undefined) {
    return { text: '', classes: '' }
  }

  if (result === '—') {
    return { text: '—', classes: '' }
  }

  if (typeof result === 'string') {
    return { text: result, classes: '' }
  }

  return result
}

// Tooltip состояние
const tooltipRef = ref<HTMLDivElement | null>(null)
const tooltipVisible = ref(false)
const tooltipText = ref('')
const tooltipPosition = ref({ top: 0, left: 0 })
let tooltipTimeout: number | null = null

// Показать tooltip
const showTooltip = (event: MouseEvent, text: string) => {
  if (tooltipTimeout) {
    clearTimeout(tooltipTimeout)
  }
  
  tooltipText.value = text
  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  
  // Вычисляем позицию: над иконкой с небольшим смещением (8px)
  tooltipPosition.value = {
    top: rect.top - 8, // 8px offset
    left: rect.left + rect.width / 2
  }
  
  tooltipTimeout = window.setTimeout(() => {
    tooltipVisible.value = true
  }, 300)
}

// Скрыть tooltip
const hideTooltip = () => {
  if (tooltipTimeout) {
    clearTimeout(tooltipTimeout)
    tooltipTimeout = null
  }
  tooltipVisible.value = false
}

// Обновить позицию при скролле
const updateTooltipPosition = () => {
  if (tooltipVisible.value && tooltipRef.value) {
    // Позиция будет обновлена при следующем hover
  }
}

onMounted(async () => {
  window.addEventListener('scroll', updateTooltipPosition, true)
  window.addEventListener('resize', updateTooltipPosition)
  
  // Инициализируем пресеты после загрузки настроек колонок
  // Пресеты имеют приоритет и перезаписывают настройки из localStorage
  await initPresets()
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', updateTooltipPosition, true)
  window.removeEventListener('resize', updateTooltipPosition)
  if (tooltipTimeout) {
    clearTimeout(tooltipTimeout)
  }
})
</script>

<style scoped>
.tooltip-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
</style>

<style>
.tooltip-popup {
  z-index: 9999;
  background-color: rgba(31, 41, 55, 0.95);
  color: white;
  text-align: center;
  border-radius: 6px;
  padding: 8px 12px;
  white-space: nowrap;
  font-size: 12px;
  font-weight: normal;
  pointer-events: none;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.tooltip-popup::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  margin-left: -5px;
  border-width: 5px;
  border-style: solid;
  border-color: rgba(31, 41, 55, 0.95) transparent transparent transparent;
}
</style>
