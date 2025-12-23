<template>
  <div class="space-y-6">
    <!-- Заголовок -->
    <div class="flex items-center justify-between">
      <h2 class="text-2xl font-bold text-gray-900">Заказы на закупку</h2>
      <button
        v-if="!selectedOrderId"
        @click="showCreateForm = true"
        class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        <Plus class="w-4 h-4" />
        Создать новый заказ
      </button>
      <button
        v-else
        @click="selectedOrderId = null"
        class="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
      >
        <ArrowLeft class="w-4 h-4" />
        Назад к списку
      </button>
    </div>

    <!-- Форма создания заказа -->
    <div
      v-if="showCreateForm && !selectedOrderId"
      class="bg-white p-6 rounded-lg shadow"
    >
      <h3 class="text-lg font-semibold text-gray-900 mb-4">Новый заказ на закупку</h3>
      
      <form @submit.prevent="handleCreateOrder" class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Номер заказа -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Номер заказа *
            </label>
            <input
              v-model="newOrder.orderNumber"
              type="text"
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="PO-2024-001"
            />
          </div>

          <!-- Дата заказа -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Дата заказа *
            </label>
            <input
              v-model="newOrder.date"
              type="date"
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <!-- Курс юаня -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Курс юаня (CNY) *
            </label>
            <input
              v-model.number="newOrder.cnyRate"
              type="number"
              step="0.01"
              min="0"
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="12.50"
            />
          </div>

          <!-- Комиссия байера -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Комиссия байера (%) *
            </label>
            <input
              v-model.number="newOrder.buyerCommission"
              type="number"
              step="0.1"
              min="0"
              max="100"
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="3.0"
            />
          </div>

          <!-- Доставка в России -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Доставка в России (RUB) *
            </label>
            <input
              v-model.number="newOrder.totalRussiaDelivery"
              type="number"
              step="0.01"
              min="0"
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
            />
          </div>
        </div>

        <!-- Кнопки -->
        <div class="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            @click="cancelCreate"
            class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Отмена
          </button>
          <button
            type="submit"
            :disabled="isCreating"
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ isCreating ? 'Создание...' : 'Создать заказ' }}
          </button>
        </div>
      </form>
    </div>

    <!-- Детальный вид заказа с товарами -->
    <div v-if="selectedOrderId && currentOrder" class="space-y-6">
      <!-- Ultra-Compact Header (Sticky) -->
      <div class="sticky top-0 z-40 bg-gray-50 border-b border-gray-200 shadow-sm">
        <!-- Single Line: All Fields + Save Button -->
        <div class="px-3 py-1.5">
          <div class="flex items-center gap-2 flex-nowrap overflow-x-auto">
            <label class="text-[10px] text-gray-500 whitespace-nowrap">№:</label>
              <input
                v-model="editingOrder.orderNumber"
                type="text"
                required
                :readonly="isOrderConfirmed"
                class="w-24 px-1.5 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                :class="{ 'bg-gray-100 cursor-not-allowed': isOrderConfirmed }"
              />
            <label class="text-[10px] text-gray-500 whitespace-nowrap ml-2">Дата:</label>
              <input
                v-model="editingOrder.date"
                type="date"
                required
                :readonly="isOrderConfirmed"
                class="w-28 px-1.5 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                :class="{ 'bg-gray-100 cursor-not-allowed': isOrderConfirmed }"
              />
            <label class="text-[10px] text-gray-500 whitespace-nowrap ml-2">CNY:</label>
              <input
                v-model.number="editingOrder.cnyRate"
                type="number"
                step="0.01"
                min="0"
                required
                :readonly="isOrderConfirmed"
                @input="debouncedHandleOrderUpdate"
                class="w-20 px-1.5 py-1 text-xs border border-gray-300 rounded text-right focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                :class="{ 'bg-gray-100 cursor-not-allowed': isOrderConfirmed }"
              />
            <label class="text-[10px] text-gray-500 whitespace-nowrap ml-2">Комиссия (%):</label>
              <input
                v-model.number="editingOrder.buyerCommission"
                type="number"
                step="0.1"
                min="0"
                max="100"
                required
                :readonly="isOrderConfirmed"
                @input="debouncedHandleOrderUpdate"
                class="w-16 px-1.5 py-1 text-xs border border-gray-300 rounded text-right focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                :class="{ 'bg-gray-100 cursor-not-allowed': isOrderConfirmed }"
              />
            <label class="text-[10px] text-gray-500 whitespace-nowrap ml-2">Доставка РФ:</label>
              <input
                v-model.number="editingOrder.totalRussiaDelivery"
                type="number"
                step="0.01"
                min="0"
                required
                :readonly="isOrderConfirmed"
                @input="debouncedHandleOrderUpdate"
                class="w-24 px-1.5 py-1 text-xs border border-gray-300 rounded text-right focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                :class="{ 'bg-gray-100 cursor-not-allowed': isOrderConfirmed }"
              />
            <button
              type="button"
              @click="handleSaveOrder"
              :disabled="isSaving"
              class="ml-auto px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors whitespace-nowrap"
            >
              {{ isSaving ? 'Сохранение...' : 'Сохранить' }}
            </button>
          </div>
        </div>
        
        <!-- Totals Panel: Expressive Cards -->
        <div v-if="orderItems.length > 0" class="px-3 py-2 border-t border-gray-300 bg-white">
          <div class="flex items-center gap-3 flex-wrap">
            <div class="px-3 py-1.5 bg-blue-50 border border-blue-200 rounded shadow-sm">
              <span class="text-[10px] text-blue-600 font-medium">Закупка:</span>
              <span class="ml-1 text-xs font-bold text-blue-700">{{ orderSummary.totalPurchase.toFixed(2) }} ₽</span>
            </div>
            <div class="px-3 py-1.5 bg-purple-50 border border-purple-200 rounded shadow-sm">
              <span class="text-[10px] text-purple-600 font-medium">Логистика:</span>
              <span class="ml-1 text-xs font-bold text-purple-700">{{ orderSummary.totalLogistics.toFixed(2) }} ₽</span>
            </div>
            <div class="px-3 py-1.5 bg-orange-50 border border-orange-200 rounded shadow-sm">
              <span class="text-[10px] text-orange-600 font-medium">Услуги:</span>
              <span class="ml-1 text-xs font-bold text-orange-700">{{ orderSummary.totalServices.toFixed(2) }} ₽</span>
            </div>
            <div class="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded shadow-sm">
              <span class="text-[10px] text-gray-600 font-medium">Вес:</span>
              <span class="ml-1 text-xs font-bold text-gray-700">{{ orderTotalWeight.toFixed(0) }} г</span>
            </div>
            <div class="px-3 py-1.5 bg-green-50 border-2 border-green-300 rounded shadow-md ml-auto">
              <span class="text-[10px] text-green-600 font-medium">Итого:</span>
              <span class="ml-1 text-sm font-bold text-green-700">{{ orderSummary.totalCost.toFixed(2) }} ₽</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Секция товаров -->
      <div class="bg-white p-6 rounded-lg shadow">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900">Товары</h3>
          <button
            @click="showAddItemForm = true"
            class="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Plus class="w-4 h-4" />
            Добавить товар
          </button>
        </div>

        <!-- Форма добавления товара -->
        <div v-if="showAddItemForm" data-add-item-form class="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h4 class="text-md font-semibold text-gray-900 mb-4">Добавить товар</h4>
          
          <!-- Поиск товара -->
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">Поиск товара</label>
            <input
              v-model="productSearchQuery"
              @input="searchProducts"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Поиск по nmId, артикулу или названию..."
            />
            
            <!-- Результаты поиска -->
            <div
              v-if="productSearchResults.length > 0"
              class="mt-2 border border-gray-200 rounded-lg bg-white max-h-60 overflow-y-auto"
            >
              <div
                v-for="product in productSearchResults"
                :key="product.nmId"
                @click="selectProduct(product)"
                class="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0 flex items-center gap-3"
              >
                <img
                  v-if="product.photo"
                  :src="product.photo"
                  :alt="product.title"
                  class="w-12 h-12 object-cover rounded"
                />
                <div class="flex-1">
                  <div class="font-medium text-sm">{{ product.title || 'Без названия' }}</div>
                  <div class="text-xs text-gray-500">
                    nmId: {{ product.nmId }}
                    <span v-if="product.vendorCode"> | Артикул: {{ product.vendorCode }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Форма товара -->
          <div v-if="selectedProduct" class="space-y-4">
            <div class="flex items-center gap-4 p-3 bg-white rounded-lg border border-gray-200">
              <img
                v-if="selectedProduct.photo"
                :src="selectedProduct.photo"
                :alt="selectedProduct.title"
                class="w-16 h-16 object-cover rounded"
              />
              <div>
                <div class="font-medium">{{ selectedProduct.title || 'Без названия' }}</div>
                <div class="text-sm text-gray-500">nmId: {{ selectedProduct.nmId }}</div>
                <div v-if="selectedProduct.vendorCode" class="text-sm text-gray-500">
                  Артикул: {{ selectedProduct.vendorCode }}
                </div>
                <div v-if="selectedProduct.weight" class="text-sm text-gray-500">
                  Вес: {{ selectedProduct.weight }}г
                </div>
              </div>
            </div>

            <!-- Общие поля (применяются ко всем размерам) -->
            <div class="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h5 class="text-sm font-semibold text-gray-900 mb-3">Общие поля (применяются ко всем размерам):</h5>
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                <div>
                  <label class="block text-xs font-medium text-gray-700 mb-1">Вес (г)</label>
                  <input
                    v-model.number="commonFields.weight"
                    type="number"
                    step="1"
                    min="0"
                    class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-700 mb-1">Доставка Китай (CNY)</label>
                  <input
                    v-model.number="commonFields.chinaDelivery"
                    type="number"
                    step="0.01"
                    min="0"
                    class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-700 mb-1">Фулфилмент (RUB)</label>
                  <input
                    v-model.number="commonFields.fulfillmentCost"
                    type="number"
                    step="0.01"
                    min="0"
                    class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-700 mb-1">Упаковка (RUB)</label>
                  <input
                    v-model.number="commonFields.packagingCost"
                    type="number"
                    step="0.01"
                    min="0"
                    class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-700 mb-1">КИЗ (RUB)</label>
                  <input
                    v-model.number="commonFields.kizCost"
                    type="number"
                    step="0.01"
                    min="0"
                    class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <!-- Список размеров -->
            <div class="space-y-3">
              <h5 class="text-sm font-semibold text-gray-900">Размеры товара:</h5>
              <div class="space-y-2">
                <div
                  v-for="(sizeItem, index) in sizeItems"
                  :key="index"
                  class="p-3 bg-white rounded-lg border border-gray-200"
                >
                  <div class="flex items-center gap-4">
                    <!-- Чекбокс для выбора размера -->
                    <input
                      type="checkbox"
                      v-model="sizeItem.selected"
                      class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    
                    <!-- Название размера -->
                    <div class="w-20 font-medium text-sm text-gray-900">
                      {{ sizeItem.techSize }}
                    </div>
                    
                    <!-- Количество -->
                    <div class="flex-1">
                      <label class="block text-xs text-gray-600 mb-1">Кол-во *</label>
                      <input
                        v-model.number="sizeItem.quantity"
                        type="number"
                        min="0"
                        step="1"
                        :disabled="!sizeItem.selected"
                        class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      />
                    </div>
                    
                    <!-- Цена CNY -->
                    <div class="flex-1">
                      <label class="block text-xs text-gray-600 mb-1">Цена (CNY) *</label>
                      <input
                        v-model.number="sizeItem.priceCny"
                        type="number"
                        step="0.01"
                        min="0"
                        :disabled="!sizeItem.selected"
                        class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Кнопки -->
            <div class="flex justify-end gap-3">
              <button
                type="button"
                @click="cancelAddItem"
                class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                @click="handleAddItems"
                :disabled="!hasSelectedSizes || isAddingItem"
                class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {{ isAddingItem ? 'Добавление...' : 'Добавить выбранные размеры' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Таблица товаров -->
        <!-- Ultra-Compact Product Rows -->
        <div v-if="orderItems.length > 0" class="space-y-1">
          <!-- Professional Grid Product Rows -->
          <div
            v-for="(group, groupIndex) in groupedOrderItems"
            :key="`group-${groupIndex}-${group.nmId}`"
            class="mb-6 bg-white border border-gray-300 shadow-sm"
            style="overflow: visible;"
          >
            <!-- Product Header Row -->
            <div class="px-3 py-2 flex items-center gap-3 border-b border-gray-300 bg-gray-50">
              <!-- Photo (50px) -->
              <div class="flex-shrink-0">
                <img
                  v-if="group.photo"
                  v-once
                  :src="group.photo"
                  :alt="group.title"
                  class="w-[50px] h-[50px] object-cover rounded border border-gray-300"
                />
                <div v-else class="w-[50px] h-[50px] bg-gray-100 rounded border border-gray-300 flex items-center justify-center">
                  <span class="text-gray-400 text-[10px]">Нет</span>
                </div>
              </div>
              
              <!-- Product Info -->
              <div class="flex-1 min-w-0 flex items-center gap-4">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1">
                    <h3 class="text-base font-bold text-gray-900 truncate">
                      {{ group.title || `nmId: ${group.nmId}` }}
                    </h3>
                    <span class="text-[10px] text-gray-400">nmId: {{ group.nmId }}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <label class="text-[10px] text-gray-500">Артикул:</label>
                    <input
                      :value="group.items[0]?.vendorCode || ''"
                      @blur="debouncedUpdateVendorCode(group.items[0]?.id!, ($event.target as HTMLInputElement).value.trim() || undefined)"
                      @keyup.enter="($event.target as HTMLInputElement).blur()"
                      type="text"
                      placeholder="Артикул"
                      :readonly="isOrderConfirmed"
                      class="w-32 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                      :class="{ 'bg-gray-100 cursor-not-allowed': isOrderConfirmed }"
                    />
                    <span class="text-[10px] text-gray-500">Вес: {{ getArticleTotalWeight(group.items) }} г</span>
                  </div>
                </div>
                
                <!-- Common Costs (Single Row) -->
                <div class="flex items-center gap-2 flex-shrink-0">
                  <div class="flex items-center gap-1">
                    <label class="text-[10px] text-gray-500">Китай:</label>
                    <input
                      :value="group.items[0]?.chinaDelivery || 0"
                      @input="debouncedUpdateChinaDelivery(group.items[0]?.nmId, group.items[0]?.vendorCode, parseFloat(($event.target as HTMLInputElement).value) || 0)"
                      type="number"
                      step="0.01"
                      min="0"
                      :readonly="isOrderConfirmed"
                      class="w-16 px-2 py-1 text-xs border border-gray-300 rounded text-right focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                      :class="{ 'bg-gray-100 cursor-not-allowed': isOrderConfirmed }"
                    />
                  </div>
                  <div class="flex items-center gap-1">
                    <label class="text-[10px] text-gray-500">ФФ:</label>
                    <input
                      :value="group.items[0]?.fulfillmentCost || 0"
                      @input="debouncedUpdateArticleField(group.items[0]?.nmId, group.items[0]?.vendorCode, 'fulfillmentCost', parseFloat(($event.target as HTMLInputElement).value) || 0)"
                      type="number"
                      step="0.01"
                      min="0"
                      :readonly="isOrderConfirmed"
                      class="w-16 px-2 py-1 text-xs border border-gray-300 rounded text-right focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                      :class="{ 'bg-gray-100 cursor-not-allowed': isOrderConfirmed }"
                    />
                  </div>
                  <div class="flex items-center gap-1">
                    <label class="text-[10px] text-gray-500">Упак:</label>
                    <input
                      :value="group.items[0]?.packagingCost || 0"
                      @input="debouncedUpdateArticleField(group.items[0]?.nmId, group.items[0]?.vendorCode, 'packagingCost', parseFloat(($event.target as HTMLInputElement).value) || 0)"
                      type="number"
                      step="0.01"
                      min="0"
                      :readonly="isOrderConfirmed"
                      class="w-16 px-2 py-1 text-xs border border-gray-300 rounded text-right focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                      :class="{ 'bg-gray-100 cursor-not-allowed': isOrderConfirmed }"
                    />
                  </div>
                  <div class="flex items-center gap-1">
                    <label class="text-[10px] text-gray-500">КИЗ:</label>
                    <input
                      :value="group.items[0]?.kizCost || 0"
                      @input="debouncedUpdateArticleField(group.items[0]?.nmId, group.items[0]?.vendorCode, 'kizCost', parseFloat(($event.target as HTMLInputElement).value) || 0)"
                      type="number"
                      step="0.01"
                      min="0"
                      :readonly="isOrderConfirmed"
                      class="w-16 px-2 py-1 text-xs border border-gray-300 rounded text-right focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                      :class="{ 'bg-gray-100 cursor-not-allowed': isOrderConfirmed }"
                    />
                  </div>
                  <button
                    @click="addSizesToExistingProduct(group.nmId, group.vendorCode)"
                    class="px-2 py-1 text-[10px] bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    title="Редактировать размеры"
                  >
                    ✏️
                  </button>
                </div>
              </div>
            </div>
            
            <!-- Sizes Table (Professional Grid with Borders) -->
            <div class="overflow-x-auto" style="overflow-y: visible !important;">
              <table class="w-full text-xs border-collapse" style="position: relative; overflow: visible;">
                <thead class="bg-gray-100 border-b-2 border-gray-300">
                  <tr>
                    <th class="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-r border-gray-300">Размер</th>
                    <th class="px-3 py-2 text-right text-xs font-semibold text-gray-700 border-r border-gray-300">Кол-во</th>
                    <th class="px-3 py-2 text-right text-xs font-semibold text-gray-700 border-r border-gray-300">Цена (CNY)</th>
                    <th class="px-3 py-2 text-right text-xs font-semibold text-gray-700 border-r border-gray-300">Вес (г)</th>
                    <th class="px-3 py-2 text-right text-xs font-semibold text-gray-700 border-r border-gray-300">Себестоимость</th>
                    <th class="px-3 py-2 text-center text-xs font-semibold text-gray-700 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(item, itemIndex) in group.items"
                    :key="item.id"
                    :class="[
                      'border-b border-gray-200 transition-colors',
                      itemIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50',
                      'hover:bg-blue-50',
                      isItemSuspicious(item) ? 'bg-red-50 border-red-300' : ''
                    ]"
                  >
                    <td class="px-3 py-2 text-xs font-medium text-gray-700 border-r border-gray-200">{{ item.size || '—' }}</td>
                    <td class="px-3 py-2 border-r border-gray-200">
                      <input
                        :value="item.quantity"
                        @input="debouncedUpdateItemField(item.id!, 'quantity', parseFloat(($event.target as HTMLInputElement).value) || 1)"
                        type="number"
                        min="1"
                        step="1"
                        :readonly="isOrderConfirmed"
                        class="w-16 px-2 py-1 text-xs border border-gray-300 rounded text-right focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                        :class="{ 'bg-gray-100 cursor-not-allowed': isOrderConfirmed }"
                      />
                    </td>
                    <td class="px-3 py-2 border-r border-gray-200">
                      <input
                        :value="item.priceCny"
                        @input="debouncedUpdateItemField(item.id!, 'priceCny', parseFloat(($event.target as HTMLInputElement).value) || 0)"
                        type="number"
                        step="0.01"
                        min="0"
                        :readonly="isOrderConfirmed"
                        class="w-20 px-2 py-1 text-xs border border-gray-300 rounded text-right focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                        :class="{ 'bg-gray-100 cursor-not-allowed': isOrderConfirmed }"
                      />
                    </td>
                    <td class="px-3 py-2 text-right text-xs text-gray-600 border-r border-gray-200">{{ item.weight || 0 }}</td>
                    <td class="px-3 py-2 text-right border-r border-gray-200 relative" style="overflow: visible;">
                      <div class="flex flex-col items-end gap-0.5">
                        <div 
                          class="relative inline-block cursor-help cost-tooltip-wrapper"
                          @mouseenter="(e) => showCostTooltip(e, item)"
                          @mouseleave="hideCostTooltip"
                        >
                          <span class="inline-block px-2 py-1 font-bold text-green-700 text-xs bg-green-50 border border-green-200 rounded">
                            {{ item.unitCostResult.toFixed(2) }} ₽
                          </span>
                        </div>
                        <!-- Расшифровка себестоимости -->
                        <div class="text-[9px] text-gray-500 leading-tight text-right">
                          <div>Закупка: {{ getCostBreakdown(item).purchase.toFixed(2) }} ₽</div>
                          <div>Доп. расходы: {{ (getCostBreakdown(item).chinaDelivery + getCostBreakdown(item).russiaDelivery + getCostBreakdown(item).warehouse + getCostBreakdown(item).commission).toFixed(2) }} ₽</div>
                        </div>
                      </div>
                    </td>
                    <td class="px-3 py-2 text-center">
                      <button
                        @click="handleDeleteItem(item.id!)"
                        class="text-red-600 hover:text-red-800 transition-colors"
                        title="Удалить"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                </tbody>
                <tfoot class="bg-gray-100 border-t-2 border-gray-300">
                  <tr>
                    <td class="px-3 py-2 text-xs text-gray-600 font-medium border-r border-gray-300" colspan="4">
                      Всего: {{ group.totalQuantity }} шт | Средняя: {{ getAverageUnitCost(group.items).toFixed(2) }} ₽
                    </td>
                    <td class="px-3 py-2 text-right text-xs font-bold text-green-700 border-r border-gray-300" colspan="2">
                      {{ (group.items.reduce((sum, i) => sum + (i.unitCostResult * i.quantity), 0)).toFixed(2) }} ₽
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="flex flex-col items-center justify-center py-16 px-4">
          <div class="max-w-md w-full text-center">
            <!-- Иллюстрация -->
            <div class="mb-6 flex justify-center">
              <div class="w-32 h-32 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center shadow-lg">
                <svg class="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
            </div>
            
            <!-- Текст -->
            <h3 class="text-xl font-bold text-gray-900 mb-2">Заказ пуст</h3>
            <p class="text-gray-600 mb-6">
              Добавьте товары в заказ, чтобы начать расчет себестоимости и управление закупками.
            </p>
            
            <!-- Кнопка -->
            <button
              @click="showAddItemForm = true"
              class="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 shadow-md hover:shadow-lg transition-all duration-200"
            >
              <Plus class="w-5 h-5" />
              Добавить первый товар
            </button>
          </div>
        </div>

        <!-- Предупреждение о весе (если есть товары) -->
        <div v-if="orderItems.length > 0 && orderTotalWeight === 0 && currentOrder.totalRussiaDelivery > 0" class="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded">
          <div class="flex items-center gap-2 text-yellow-800">
            <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span class="text-sm font-medium">Укажите вес товаров для корректного расчета логистики</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Модальное окно для редактирования размеров -->
    <div
      v-if="showEditSizesModal"
      class="fixed inset-0 z-50 overflow-y-auto"
      @click.self="cancelAddItem"
    >
      <!-- Overlay -->
      <div class="fixed inset-0 bg-black bg-opacity-50 transition-opacity"></div>
      
      <!-- Модальное окно -->
      <div class="flex min-h-full items-center justify-center p-4">
        <div
          class="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
          @click.stop
        >
          <!-- Заголовок -->
          <div class="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
            <h3 class="text-lg font-semibold text-gray-900">Редактировать размеры</h3>
            <button
              @click="cancelAddItem"
              class="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Содержимое -->
          <div class="p-6">
            <!-- Информация о товаре -->
            <div v-if="selectedProduct" class="mb-6">
              <div class="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <img
                  v-if="selectedProduct.photo"
                  :src="selectedProduct.photo"
                  :alt="selectedProduct.title"
                  class="w-20 h-20 object-cover rounded"
                />
                <div class="flex-1">
                  <div class="font-medium text-lg">{{ selectedProduct.title || 'Без названия' }}</div>
                  <div class="text-sm text-gray-500 mt-1">nmId: {{ selectedProduct.nmId }}</div>
                  <div v-if="selectedProduct.vendorCode" class="text-sm text-gray-500">
                    Артикул: {{ selectedProduct.vendorCode }}
                  </div>
                  <div v-if="selectedProduct.weight" class="text-sm text-gray-500">
                    Вес: {{ selectedProduct.weight }}г
                  </div>
                </div>
              </div>
            </div>

            <!-- Общие поля (применяются ко всем размерам) -->
            <div v-if="selectedProduct" class="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h5 class="text-sm font-semibold text-gray-900 mb-3">Общие поля (применяются ко всем размерам):</h5>
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                <div>
                  <label class="block text-xs font-medium text-gray-700 mb-1">Вес (г)</label>
                  <input
                    v-model.number="commonFields.weight"
                    type="number"
                    step="1"
                    min="0"
                    class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-700 mb-1">Доставка Китай (CNY)</label>
                  <input
                    v-model.number="commonFields.chinaDelivery"
                    type="number"
                    step="0.01"
                    min="0"
                    class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-700 mb-1">Фулфилмент (RUB)</label>
                  <input
                    v-model.number="commonFields.fulfillmentCost"
                    type="number"
                    step="0.01"
                    min="0"
                    class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-700 mb-1">Упаковка (RUB)</label>
                  <input
                    v-model.number="commonFields.packagingCost"
                    type="number"
                    step="0.01"
                    min="0"
                    class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-700 mb-1">КИЗ (RUB)</label>
                  <input
                    v-model.number="commonFields.kizCost"
                    type="number"
                    step="0.01"
                    min="0"
                    class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <!-- Список размеров -->
            <div v-if="selectedProduct && sizeItems.length > 0" class="mb-6">
              <h5 class="text-sm font-semibold text-gray-900 mb-3">Размеры товара:</h5>
              <div class="space-y-2">
                <div
                  v-for="(sizeItem, index) in sizeItems"
                  :key="index"
                  :class="[
                    'p-3 rounded-lg border',
                    sizeItem.isExisting 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-white border-gray-200'
                  ]"
                >
                  <div class="flex items-center gap-4">
                    <!-- Чекбокс для выбора размера -->
                    <input
                      type="checkbox"
                      v-model="sizeItem.selected"
                      class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    
                    <!-- Название размера с меткой -->
                    <div class="w-24">
                      <div class="font-medium text-sm text-gray-900">
                        {{ sizeItem.techSize }}
                      </div>
                      <div v-if="sizeItem.isExisting" class="text-xs text-green-600 mt-0.5">
                        ✓ В заказе
                      </div>
                    </div>
                    
                    <!-- Количество -->
                    <div class="flex-1">
                      <label class="block text-xs text-gray-600 mb-1">Кол-во *</label>
                      <input
                        v-model.number="sizeItem.quantity"
                        type="number"
                        min="0"
                        step="1"
                        :disabled="!sizeItem.selected"
                        class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      />
                    </div>
                    
                    <!-- Цена CNY -->
                    <div class="flex-1">
                      <label class="block text-xs text-gray-600 mb-1">Цена (CNY) *</label>
                      <input
                        v-model.number="sizeItem.priceCny"
                        type="number"
                        step="0.01"
                        min="0"
                        :disabled="!sizeItem.selected"
                        class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-else-if="selectedProduct && sizeItems.length === 0" class="text-center py-8 text-gray-500">
              Все размеры этого товара уже добавлены в заказ.
            </div>
          </div>

          <!-- Кнопки -->
          <div class="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
            <button
              type="button"
              @click="cancelAddItem"
              class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Отмена
            </button>
            <button
              @click="handleAddItems"
              :disabled="!hasSelectedSizes || isAddingItem"
              class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ isAddingItem ? 'Сохранение...' : 'Сохранить изменения' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Список заказов -->
    <div v-if="!selectedOrderId && !showCreateForm">
      <div v-if="store.isLoading" class="bg-white p-6 rounded-lg shadow">
        <div class="flex items-center justify-center py-12">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span class="ml-3 text-gray-600">Загрузка заказов...</span>
        </div>
      </div>

      <div
        v-else-if="store.orders.length === 0"
        class="bg-white p-6 rounded-lg shadow text-center"
      >
        <p class="text-gray-600 mb-4">Нет заказов на закупку</p>
        <p class="text-sm text-gray-500">Нажмите "Создать новый заказ" для начала работы</p>
      </div>

      <div v-else class="bg-white rounded-lg shadow overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Номер заказа
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Дата
              </th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Курс CNY
              </th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Доставка Россия
              </th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Комиссия байера
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Статус
              </th>
              <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Действия
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr
              v-for="order in store.orders"
              :key="order.id"
              class="hover:bg-gray-50"
            >
              <td 
                @click="selectedOrderId = order.id!"
                class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 cursor-pointer"
              >
                {{ order.orderNumber }}
              </td>
              <td 
                @click="selectedOrderId = order.id!"
                class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 cursor-pointer"
              >
                {{ formatDate(order.date) }}
              </td>
              <td 
                @click="selectedOrderId = order.id!"
                class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 cursor-pointer"
              >
                {{ order.cnyRate.toFixed(2) }}
              </td>
              <td 
                @click="selectedOrderId = order.id!"
                class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 cursor-pointer"
              >
                {{ order.totalRussiaDelivery.toFixed(2) }} RUB
              </td>
              <td 
                @click="selectedOrderId = order.id!"
                class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 cursor-pointer"
              >
                {{ order.buyerCommission.toFixed(1) }}%
              </td>
              <td 
                @click="selectedOrderId = order.id!"
                class="px-6 py-4 whitespace-nowrap cursor-pointer"
              >
                <span
                  class="px-2 py-1 text-xs font-medium rounded-full"
                  :class="getStatusClass(order.status)"
                >
                  {{ getStatusLabel(order.status) }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-center">
                <button
                  @click.stop="handleDeleteOrder(order.id!)"
                  class="text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-1 rounded transition-colors"
                  title="Удалить заказ"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import { Plus, ArrowLeft } from 'lucide-vue-next'
import { usePurchaseStore } from '../stores/purchaseStore'
import { container } from '@core/di/container'
import type { PurchaseOrder } from '@core/domain/entities/PurchaseOrder'
import type { PurchaseItem } from '@core/domain/entities/PurchaseItem'
import type { Product } from '@core/domain/entities/Product'

// Debounce utility
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      func(...args)
    }
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

const store = usePurchaseStore()

// State для формы создания заказа
const showCreateForm = ref(false)
const isCreating = ref(false)
const newOrder = ref<Omit<PurchaseOrder, 'id' | 'status' | 'createdAt' | 'updatedAt'>>({
  orderNumber: '',
  date: new Date().toISOString().split('T')[0],
  cnyRate: 0,
  totalChinaDelivery: 0,
  totalRussiaDelivery: 0,
  buyerCommission: 0,
})

// State для редактирования заказа
const selectedOrderId = ref<number | null>(null)
const currentOrder = ref<PurchaseOrder | null>(null)
const editingOrder = ref<Partial<PurchaseOrder>>({})
const isSaving = ref(false)

// State для товаров
const orderItems = ref<PurchaseItem[]>([])
const showAddItemForm = ref(false)
const showEditSizesModal = ref(false) // Модальное окно для редактирования размеров
const productSearchQuery = ref('')
const productSearchResults = ref<Product[]>([])
const selectedProduct = ref<Product | null>(null)
const productsCache = ref<Product[]>([])

// Структура для работы с размерами товара
interface SizeItem {
  techSize: string
  chrtId?: number
  quantity: number
  priceCny: number
  selected: boolean
  isExisting?: boolean // Флаг, что размер уже добавлен в заказ
  existingItemId?: number // ID существующего PurchaseItem, если размер уже добавлен
}

const sizeItems = ref<SizeItem[]>([])
const commonFields = ref({
  weight: 0,
  chinaDelivery: 0,
  fulfillmentCost: 0,
  packagingCost: 0,
  kizCost: 0,
})

const isAddingItem = ref(false)
const previewCost = ref<number | null>(null)

// Computed: проверка наличия выбранных размеров
const hasSelectedSizes = computed(() => {
  return sizeItems.value.some(si => 
    si.selected && si.quantity > 0 && si.priceCny > 0
  )
})

// Computed: группировка товаров по vendorCode (или nmId, если vendorCode нет)
const groupedOrderItems = computed(() => {
  const groups = new Map<string, PurchaseItem[]>()
  
  for (const item of orderItems.value) {
    // Группируем по vendorCode, если есть, иначе по nmId
    const key = item.vendorCode || `nmId_${item.nmId}`
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(item)
  }
  
  return Array.from(groups.entries()).map(([key, items]) => {
    // Вычисляем общее количество единиц по всем размерам
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0)
    
    return {
      vendorCode: key.startsWith('nmId_') ? undefined : key,
      items,
      nmId: items[0].nmId,
      title: getProductTitle(items[0].nmId),
      photo: getProductPhoto(items[0].nmId),
      totalQuantity,
    }
  })
})

// Batch actions

// Computed
const productService = computed(() => container.getProductService())

// Load products for search
const loadProducts = async () => {
  try {
    productsCache.value = await productService.value.getProducts()
  } catch (error) {
    console.error('Ошибка при загрузке товаров:', error)
  }
}

// Search products
const searchProducts = () => {
  if (!productSearchQuery.value.trim()) {
    productSearchResults.value = []
    return
  }

  const query = productSearchQuery.value.toLowerCase().trim()
  productSearchResults.value = productsCache.value.filter(product => 
    product.nmId.toString().includes(query) ||
    product.vendorCode?.toLowerCase().includes(query) ||
    product.title?.toLowerCase().includes(query)
  ).slice(0, 10) // Ограничиваем 10 результатами
}

// Select product
const selectProduct = (product: Product) => {
  selectedProduct.value = product
  
  // Получаем уже добавленные размеры этого товара в текущем заказе
  const existingItemsMap = new Map<string, PurchaseItem>()
  orderItems.value
    .filter(item => item.nmId === product.nmId)
    .forEach(item => {
      const sizeKey = item.size || 'Без размера'
      existingItemsMap.set(sizeKey, item)
    })
  
  // Инициализируем размеры товара, включая уже добавленные
  if (product.sizes && product.sizes.length > 0) {
    sizeItems.value = product.sizes.map(size => {
      const techSize = size.techSize || 'Без размера'
      const existingItem = existingItemsMap.get(techSize)
      
      if (existingItem) {
        // Размер уже добавлен - показываем его текущие значения
        return {
          techSize,
          chrtId: size.chrtId,
          quantity: existingItem.quantity,
          priceCny: existingItem.priceCny,
          selected: true, // По умолчанию выбраны уже добавленные размеры
          isExisting: true,
          existingItemId: existingItem.id,
        }
      } else {
        // Новый размер - пустые значения
        return {
          techSize,
          chrtId: size.chrtId,
          quantity: 0,
          priceCny: 0,
          selected: false,
          isExisting: false,
        }
      }
    })
    
    // Если есть размер "Без размера" в существующих, но его нет в product.sizes, добавляем его
    const existingWithoutSize = existingItemsMap.get('Без размера')
    if (existingWithoutSize && !sizeItems.value.some(si => si.techSize === 'Без размера')) {
      sizeItems.value.push({
        techSize: 'Без размера',
        quantity: existingWithoutSize.quantity,
        priceCny: existingWithoutSize.priceCny,
        selected: true,
        isExisting: true,
        existingItemId: existingWithoutSize.id,
      })
    }
  } else {
    // Если размеров нет в продукте, проверяем есть ли "Без размера" в существующих
    const existingWithoutSize = existingItemsMap.get('Без размера')
    if (existingWithoutSize) {
      sizeItems.value = [{
        techSize: 'Без размера',
        quantity: existingWithoutSize.quantity,
        priceCny: existingWithoutSize.priceCny,
        selected: true,
        isExisting: true,
        existingItemId: existingWithoutSize.id,
      }]
    } else {
      // Создаем новый размер "Без размера"
      sizeItems.value = [{
        techSize: 'Без размера',
        quantity: 0,
        priceCny: 0,
        selected: false,
        isExisting: false,
      }]
    }
  }
  
  // Инициализируем общие поля из первого существующего товара, если есть
  const existingItem = orderItems.value.find(item => item.nmId === product.nmId)
  if (existingItem) {
    commonFields.value = {
      weight: existingItem.weight || product.weight || 0,
      chinaDelivery: existingItem.chinaDelivery || 0,
      fulfillmentCost: existingItem.fulfillmentCost || 0,
      packagingCost: existingItem.packagingCost || 0,
      kizCost: existingItem.kizCost || 0,
    }
  } else {
    commonFields.value = {
      weight: product.weight || 0,
      chinaDelivery: 0,
      fulfillmentCost: 0,
      packagingCost: 0,
      kizCost: 0,
    }
  }
  
  productSearchResults.value = []
  productSearchQuery.value = product.title || `nmId: ${product.nmId}`
}

// Добавить размеры к существующему товару
const addSizesToExistingProduct = async (nmId: number, vendorCode?: string) => {
  if (!selectedOrderId.value) return
  
  // Убеждаемся, что товары загружены в кэш
  if (productsCache.value.length === 0) {
    await loadProducts()
  }
  
  // Находим товар в кэше
  let product = productsCache.value.find(p => p.nmId === nmId)
  
  // Если товар не найден в кэше, пытаемся загрузить его из базы
  if (!product) {
    try {
      const productService = container.getProductService()
      product = await productService.getProductByNmId(nmId)
      if (product) {
        productsCache.value.push(product)
      }
    } catch (error) {
      console.error('Ошибка при загрузке товара:', error)
    }
  }
  
  if (!product) {
    alert('Товар не найден в базе. Используйте поиск для добавления размеров.')
    return
  }
  
  // Устанавливаем выбранный товар и открываем модальное окно
  selectProduct(product)
  showEditSizesModal.value = true
}

// Handle item field change - больше не используется, так как работаем с размерами

// Handle order update (save changes and recalculate items)
const handleOrderUpdate = async () => {
  if (!selectedOrderId.value) return
  
  try {
    // Сначала сохраняем изменения заказа в базу данных
    await store.updateOrder(selectedOrderId.value, {
      orderNumber: editingOrder.value.orderNumber,
      date: editingOrder.value.date,
      cnyRate: editingOrder.value.cnyRate,
      buyerCommission: editingOrder.value.buyerCommission || 0,
      totalRussiaDelivery: editingOrder.value.totalRussiaDelivery || 0,
    })
    
    // Обновляем currentOrder, чтобы он отражал актуальные данные
    currentOrder.value = await store.getOrderById(selectedOrderId.value)
    
    // Теперь пересчитываем товары с актуальными данными заказа
    await store.recalculateOrderItems(selectedOrderId.value)
    await loadOrderItems()
  } catch (error) {
    console.error('Ошибка при обновлении заказа и пересчете товаров:', error)
  }
}

// Load order items
const loadOrderItems = async () => {
  if (!selectedOrderId.value) return
  try {
    // Пересчитываем товары перед загрузкой, чтобы применить актуальную формулу
    await store.recalculateOrderItems(selectedOrderId.value)
    orderItems.value = await store.getOrderItems(selectedOrderId.value)
  } catch (error) {
    console.error('Ошибка при загрузке товаров заказа:', error)
  }
}

// Watch selectedOrderId
watch(selectedOrderId, async (newId) => {
  if (newId) {
    currentOrder.value = await store.getOrderById(newId)
    if (currentOrder.value) {
      editingOrder.value = { ...currentOrder.value }
      await loadOrderItems()
      await loadProducts()
    }
  } else {
    currentOrder.value = null
    editingOrder.value = {}
    orderItems.value = []
  }
})

// Handle create order
const handleCreateOrder = async () => {
  isCreating.value = true
  try {
    const orderId = await store.createOrder({
      ...newOrder.value,
      status: 'draft',
    })
    
    newOrder.value = {
      orderNumber: '',
      date: new Date().toISOString().split('T')[0],
      cnyRate: 0,
      totalChinaDelivery: 0,
      totalRussiaDelivery: 0,
      buyerCommission: 0,
    }
    showCreateForm.value = false
    
    // Открываем созданный заказ для редактирования
    selectedOrderId.value = orderId
  } catch (error) {
    console.error('Ошибка при создании заказа:', error)
    alert('Ошибка при создании заказа. Проверьте консоль для деталей.')
  } finally {
    isCreating.value = false
  }
}

// Handle save order
const handleSaveOrder = async () => {
  if (!selectedOrderId.value) {
    alert('Ошибка: не выбран заказ для сохранения')
    return
  }
  
  // Проверяем обязательные поля
  if (!editingOrder.value.orderNumber || !editingOrder.value.date) {
    alert('Заполните все обязательные поля (Номер заказа, Дата заказа)')
    return
  }
  
  if (!editingOrder.value.cnyRate || editingOrder.value.cnyRate <= 0) {
    alert('Укажите корректный курс юаня')
    return
  }
  
  isSaving.value = true
  try {
    console.log('Сохранение заказа:', selectedOrderId.value, editingOrder.value)
    
    // Подготавливаем данные для сохранения
    const updateData: Partial<PurchaseOrder> = {
      orderNumber: editingOrder.value.orderNumber,
      date: editingOrder.value.date,
      cnyRate: editingOrder.value.cnyRate,
      buyerCommission: editingOrder.value.buyerCommission || 0,
      totalRussiaDelivery: editingOrder.value.totalRussiaDelivery || 0,
    }
    
    await store.updateOrder(selectedOrderId.value, updateData)
    
    // Перезагружаем заказ и товары
    currentOrder.value = await store.getOrderById(selectedOrderId.value)
    if (currentOrder.value) {
      editingOrder.value = { ...currentOrder.value }
    }
    
    // Пересчитываем товары после изменения параметров заказа
    await store.recalculateOrderItems(selectedOrderId.value)
    await loadOrderItems()
    
    alert('Заказ успешно сохранен')
  } catch (error) {
    console.error('Ошибка при сохранении заказа:', error)
    const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка'
    alert(`Ошибка при сохранении заказа: ${errorMessage}`)
  } finally {
    isSaving.value = false
  }
}

// Handle add items (multiple sizes)
const handleAddItems = async () => {
  if (!selectedOrderId.value || !selectedProduct.value) return
  
  // Получаем выбранные размеры с заполненными данными
  const selectedSizes = sizeItems.value.filter(si => 
    si.selected && si.quantity > 0 && si.priceCny > 0
  )
  
  if (selectedSizes.length === 0) {
    alert('Выберите хотя бы один размер с указанными количеством и ценой')
    return
  }
  
  isAddingItem.value = true
  try {
    // Обрабатываем каждый выбранный размер
    for (const sizeItem of selectedSizes) {
      const itemData = {
        orderId: selectedOrderId.value,
        nmId: selectedProduct.value.nmId,
        vendorCode: selectedProduct.value.vendorCode || '',
        size: sizeItem.techSize,
        quantity: sizeItem.quantity,
        priceCny: sizeItem.priceCny,
        weight: commonFields.value.weight,
        chinaDelivery: commonFields.value.chinaDelivery,
        fulfillmentCost: commonFields.value.fulfillmentCost,
        packagingCost: commonFields.value.packagingCost,
        kizCost: commonFields.value.kizCost,
      }
      
      if (sizeItem.isExisting && sizeItem.existingItemId) {
        // Обновляем существующий размер
        await store.updateOrderItem(sizeItem.existingItemId, itemData)
      } else {
        // Добавляем новый размер
        await store.addOrderItem(itemData)
      }
    }
    
    await loadOrderItems()
    cancelAddItem()
  } catch (error) {
    console.error('Ошибка при сохранении товаров:', error)
    alert('Ошибка при сохранении товаров.')
  } finally {
    isAddingItem.value = false
  }
}

// Cancel add item
const cancelAddItem = () => {
  showAddItemForm.value = false
  showEditSizesModal.value = false
  selectedProduct.value = null
  productSearchQuery.value = ''
  productSearchResults.value = []
  sizeItems.value = []
  commonFields.value = {
    weight: 0,
    chinaDelivery: 0,
    fulfillmentCost: 0,
    packagingCost: 0,
    kizCost: 0,
  }
  previewCost.value = null
}

// Update item field
const updateItemField = async (itemId: number, field: keyof PurchaseItem, value: any) => {
  try {
    await store.updateOrderItem(itemId, { [field]: value })
    await loadOrderItems()
  } catch (error) {
    console.error('Ошибка при обновлении товара:', error)
  }
}

// Debounced versions for input fields
const debouncedUpdateItemField = debounce(updateItemField, 500)
const debouncedUpdateVendorCode = debounce((itemId: number, value: string | undefined) => {
  updateItemField(itemId, 'vendorCode', value)
}, 500)
const debouncedHandleOrderUpdate = debounce(handleOrderUpdate, 500)

// Update China delivery for all sizes of an article
const updateChinaDeliveryForArticle = async (nmId: number, vendorCode: string | undefined, chinaDelivery: number) => {
  if (!selectedOrderId.value) return
  
  try {
    // Находим все товары этого артикула
    const articleItems = orderItems.value.filter(item => {
      if (vendorCode) {
        return item.vendorCode === vendorCode && item.nmId === nmId
      }
      return item.nmId === nmId
    })
    
    // Обновляем доставку для всех размеров
    for (const item of articleItems) {
      if (item.id) {
        await store.updateOrderItem(item.id, { chinaDelivery })
      }
    }
    
    await loadOrderItems()
  } catch (error) {
    console.error('Ошибка при обновлении доставки по Китаю:', error)
    alert('Ошибка при обновлении доставки по Китаю')
  }
}

// Debounced version
const debouncedUpdateChinaDelivery = debounce(updateChinaDeliveryForArticle, 500)

// Update field (fulfillmentCost, packagingCost, kizCost) for all sizes of an article
const updateArticleField = async (nmId: number, vendorCode: string | undefined, field: 'fulfillmentCost' | 'packagingCost' | 'kizCost', value: number) => {
  if (!selectedOrderId.value) return
  
  try {
    // Находим все товары этого артикула
    const articleItems = orderItems.value.filter(item => {
      if (vendorCode) {
        return item.vendorCode === vendorCode && item.nmId === nmId
      }
      return item.nmId === nmId
    })
    
    // Обновляем поле для всех размеров
    for (const item of articleItems) {
      if (item.id) {
        await store.updateOrderItem(item.id, { [field]: value })
      }
    }
    
    await loadOrderItems()
  } catch (error) {
    console.error(`Ошибка при обновлении ${field}:`, error)
    alert(`Ошибка при обновлении ${field}`)
  }
}

// Debounced version
const debouncedUpdateArticleField = debounce(updateArticleField, 500)

// Handle delete order
const handleDeleteOrder = async (orderId: number) => {
  const order = store.orders.find(o => o.id === orderId)
  const orderNumber = order?.orderNumber || `#${orderId}`
  
  if (!confirm(`Вы уверены, что хотите удалить заказ "${orderNumber}"?\n\nЭто действие нельзя отменить. Все товары в заказе также будут удалены.`)) {
    return
  }
  
  try {
    await store.deleteOrder(orderId)
    
    // Если удаляемый заказ был открыт, закрываем его
    if (selectedOrderId.value === orderId) {
      selectedOrderId.value = null
      currentOrder.value = null
      editingOrder.value = {}
      orderItems.value = []
    }
    
    alert('Заказ успешно удален')
  } catch (error) {
    console.error('Ошибка при удалении заказа:', error)
    const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка'
    alert(`Ошибка при удалении заказа: ${errorMessage}`)
  }
}

// Handle delete item
const handleDeleteItem = async (itemId: number) => {
  if (!confirm('Удалить товар из заказа?')) return
  try {
    await store.deleteOrderItem(itemId)
    await loadOrderItems()
  } catch (error) {
    console.error('Ошибка при удалении товара:', error)
    alert('Ошибка при удалении товара.')
  }
}


// Helper functions
const getProductPhoto = (nmId: number): string | undefined => {
  return productsCache.value.find(p => p.nmId === nmId)?.photo
}

const getProductTitle = (nmId: number): string | undefined => {
  return productsCache.value.find(p => p.nmId === nmId)?.title
}

// Validation: проверка подозрительной себестоимости
const isItemSuspicious = (item: PurchaseItem): boolean => {
  if (!currentOrder.value) return false
  const purchaseCost = item.priceCny * currentOrder.value.cnyRate
  // Подозрительно, если себестоимость равна 0 или меньше 50% от цены закупки
  return item.unitCostResult === 0 || item.unitCostResult < purchaseCost * 0.5
}

// Confirm order costs
const isConfirming = ref(false)
const handleConfirmCosts = async () => {
  if (!selectedOrderId.value || !currentOrder.value) return
  
  // Проверяем наличие подозрительных товаров
  const suspiciousItems = orderItems.value.filter(item => isItemSuspicious(item))
  if (suspiciousItems.length > 0) {
    const itemDetails = suspiciousItems.map(i => 
      `nmId: ${i.nmId}, размер: ${i.size || '—'}, себестоимость: ${i.unitCostResult.toFixed(2)} ₽`
    ).join('\n')
    if (!confirm(`Обнаружены подозрительные себестоимости:\n\n${itemDetails}\n\nПродолжить подтверждение?`)) {
      return
    }
  }
  
  if (!confirm('Подтвердить себестоимость заказа? После подтверждения редактирование будет недоступно.')) {
    return
  }
  
  isConfirming.value = true
  try {
    await store.confirmOrderCosts(selectedOrderId.value)
    await loadOrderItems()
    currentOrder.value = await store.getOrderById(selectedOrderId.value)
    if (currentOrder.value) {
      editingOrder.value = { ...currentOrder.value }
    }
    alert('Себестоимость успешно подтверждена!')
  } catch (error) {
    console.error('Ошибка при подтверждении себестоимости:', error)
    const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка'
    alert(`Ошибка при подтверждении себестоимости: ${errorMessage}`)
  } finally {
    isConfirming.value = false
  }
}

// Computed: проверка, подтвержден ли заказ
const isOrderConfirmed = computed(() => {
  return currentOrder.value?.status === 'confirmed'
})

// Calculate cost breakdown for a single item (per unit)
// Используем ту же логику, что и в store.calculateCosts
const getCostBreakdown = (item: PurchaseItem) => {
  if (!currentOrder.value) {
    return {
      purchase: 0,
      chinaDelivery: 0,
      russiaDelivery: 0,
      commission: 0,
      warehouse: 0,
    }
  }

  const order = currentOrder.value
  
  // 1. Закупка за единицу: (PriceCNY * cnyRate)
  const purchaseSum = item.priceCny * order.cnyRate

  // 2. Доставка по Китаю за единицу (CNY -> RUB)
  // chinaDelivery хранится как общая сумма на весь артикул, нужно разделить на общее количество единиц артикула
  const articleItems = orderItems.value.filter(i => 
    i.nmId === item.nmId && 
    (item.vendorCode ? i.vendorCode === item.vendorCode : !i.vendorCode)
  )
  const articleTotalQuantity = articleItems.reduce((sum, i) => sum + i.quantity, 0)
  const chinaDeliveryPerUnit = articleTotalQuantity > 0 
    ? (item.chinaDelivery || 0) / articleTotalQuantity 
    : 0
  const chinaDeliveryRub = chinaDeliveryPerUnit * order.cnyRate

  // 3. Рассчитываем общий вес заказа
  const totalWeight = orderItems.value.reduce((sum, i) => {
    const itemWeight = i.weight || 0
    return sum + (itemWeight * i.quantity)
  }, 0)

  // 4. Доля доставки РФ (на весь товар, потом делим на quantity)
  const itemWeight = (item.weight || 0) * item.quantity
  const deliveryShareTotal = totalWeight > 0 
    ? (itemWeight / totalWeight) * order.totalRussiaDelivery 
    : 0
  const russiaDelivery = item.quantity > 0 ? deliveryShareTotal / item.quantity : 0

  // 5. Комиссия байера за единицу: процент от (стоимость единицы + доставка по Китаю)
  const commissionPercent = order.buyerCommission / 100
  const baseForCommission = purchaseSum + chinaDeliveryRub
  const commission = baseForCommission * commissionPercent

  // 7. Склад за единицу (Фулфилмент + Упаковка + КИЗ)
  const directCosts = item.fulfillmentCost + item.packagingCost + item.kizCost

  // Отладочная информация для проверки расчета
  const totalPerUnit = purchaseSum + chinaDeliveryRub + russiaDelivery + commission + directCosts
  
  // Всегда выводим отладочную информацию для проверки
  console.log('📊 Расчет себестоимости:', {
    nmId: item.nmId,
    size: item.size,
    quantity: item.quantity,
    priceCny: item.priceCny,
    cnyRate: order.cnyRate,
    chinaDelivery: item.chinaDelivery,
    articleTotalQuantity,
    chinaDeliveryPerUnit,
    purchaseSum: purchaseSum.toFixed(2),
    chinaDeliveryRub: chinaDeliveryRub.toFixed(2),
    russiaDelivery: russiaDelivery.toFixed(2),
    commission: commission.toFixed(2),
    directCosts: directCosts.toFixed(2),
    calculatedTotal: totalPerUnit.toFixed(2),
    storedUnitCost: item.unitCostResult.toFixed(2),
    difference: Math.abs(totalPerUnit - item.unitCostResult).toFixed(2),
  })
  
  if (Math.abs(totalPerUnit - item.unitCostResult) > 0.01) {
    console.warn('⚠️ Несоответствие расчета себестоимости:', {
      nmId: item.nmId,
      size: item.size,
      calculatedTotal: totalPerUnit,
      storedUnitCost: item.unitCostResult,
      difference: Math.abs(totalPerUnit - item.unitCostResult),
    })
  }

  // Возвращаем все на единицу
  return {
    purchase: purchaseSum,
    chinaDelivery: chinaDeliveryRub,
    russiaDelivery,
    commission,
    warehouse: directCosts,
  }
}

// Get tooltip text for cost breakdown
const getCostBreakdownTooltip = (item: PurchaseItem): string => {
  const breakdown = getCostBreakdown(item)
  return `Закупка: ${breakdown.purchase.toFixed(2)} ₽\n` +
         `Доставка Китай: ${breakdown.chinaDelivery.toFixed(2)} ₽\n` +
         `Логистика РФ: ${breakdown.russiaDelivery.toFixed(2)} ₽\n` +
         `Комиссия байера: ${breakdown.commission.toFixed(2)} ₽\n` +
         `Склад: ${breakdown.warehouse.toFixed(2)} ₽`
}

// Computed: Order summary
const orderSummary = computed(() => {
  if (!currentOrder.value || orderItems.value.length === 0) {
    return {
      totalPurchase: 0,
      totalChinaDelivery: 0,
      totalRussiaDelivery: 0,
      totalCommission: 0,
      totalWarehouse: 0,
      totalLogistics: 0,
      totalServices: 0,
      totalCost: 0,
      purchasePercent: 0,
      chinaDeliveryPercent: 0,
      russiaDeliveryPercent: 0,
      commissionPercent: 0,
      warehousePercent: 0,
      logisticsPercent: 0,
      servicesPercent: 0,
    }
  }

  const order = currentOrder.value
  
  // Общая сумма закупки
  const totalPurchase = orderItems.value.reduce((sum, item) => {
    return sum + (item.priceCny * order.cnyRate * item.quantity)
  }, 0)

  // Общая доставка по Китаю
  const totalChinaDelivery = orderItems.value.reduce((sum, item) => {
    return sum + ((item.chinaDelivery || 0) * order.cnyRate * item.quantity)
  }, 0)

  // Доставка в РФ (уже указана в заказе)
  const totalRussiaDelivery = order.totalRussiaDelivery

  // Общая комиссия байера
  const totalOrderSumCny = orderItems.value.reduce((sum, i) => sum + (i.priceCny * i.quantity), 0)
  const totalOrderSumRub = totalOrderSumCny * order.cnyRate
  const commissionPercent = order.buyerCommission / 100
  const totalCommission = totalOrderSumRub * commissionPercent

  // Общие складские расходы
  const totalWarehouse = orderItems.value.reduce((sum, item) => {
    return sum + ((item.fulfillmentCost + item.packagingCost + item.kizCost) * item.quantity)
  }, 0)

  // Логистика (Китай + РФ)
  const totalLogistics = totalChinaDelivery + totalRussiaDelivery

  // Услуги (комиссия + склад)
  const totalServices = totalCommission + totalWarehouse

  // Итого себестоимость
  const totalCost = totalPurchase + totalLogistics + totalServices

  // Проценты
  const purchasePercent = totalCost > 0 ? (totalPurchase / totalCost) * 100 : 0
  const chinaDeliveryPercent = totalCost > 0 ? (totalChinaDelivery / totalCost) * 100 : 0
  const russiaDeliveryPercent = totalCost > 0 ? (totalRussiaDelivery / totalCost) * 100 : 0
  const commissionPercentValue = totalCost > 0 ? (totalCommission / totalCost) * 100 : 0
  const warehousePercent = totalCost > 0 ? (totalWarehouse / totalCost) * 100 : 0
  const logisticsPercent = totalCost > 0 ? (totalLogistics / totalCost) * 100 : 0
  const servicesPercent = totalCost > 0 ? (totalServices / totalCost) * 100 : 0

  return {
    totalPurchase,
    totalChinaDelivery,
    totalRussiaDelivery,
    totalCommission,
    totalWarehouse,
    totalLogistics,
    totalServices,
    totalCost,
    purchasePercent,
    chinaDeliveryPercent,
    russiaDeliveryPercent,
    commissionPercent: commissionPercentValue,
    warehousePercent,
    logisticsPercent,
    servicesPercent,
  }
})

// Computed: Total weight
const orderTotalWeight = computed(() => {
  return orderItems.value.reduce((sum, item) => {
    const itemWeight = item.weight || 0
    return sum + (itemWeight * item.quantity)
  }, 0)
})

// Calculate average unit cost for article
const getAverageUnitCost = (items: PurchaseItem[]): number => {
  if (items.length === 0) return 0
  
  const totalCost = items.reduce((sum, item) => sum + (item.unitCostResult * item.quantity), 0)
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0)
  
  return totalQuantity > 0 ? totalCost / totalQuantity : 0
}

// Calculate total weight for article
const getArticleTotalWeight = (items: PurchaseItem[]): number => {
  return items.reduce((sum, item) => {
    const itemWeight = item.weight || 0
    return sum + (itemWeight * item.quantity)
  }, 0)
}

const cancelCreate = () => {
  showCreateForm.value = false
  newOrder.value = {
    orderNumber: '',
    date: new Date().toISOString().split('T')[0],
    cnyRate: 0,
    totalChinaDelivery: 0,
    totalRussiaDelivery: 0,
    buyerCommission: 0,
  }
}

const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  } catch {
    return dateString
  }
}

const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    draft: 'Черновик',
    confirmed: 'Подтвержден',
    shipped: 'Отправлен',
    delivered: 'Доставлен',
    cancelled: 'Отменен',
  }
  return labels[status] || status
}

const getStatusClass = (status: string): string => {
  const classes: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800',
    confirmed: 'bg-blue-100 text-blue-800',
    shipped: 'bg-yellow-100 text-yellow-800',
    delivered: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  }
  return classes[status] || 'bg-gray-100 text-gray-800'
}

// Tooltip management for cost breakdown
const tooltipElement = ref<HTMLElement | null>(null)
const tooltipVisible = ref(false)
const tooltipItem = ref<PurchaseItem | null>(null)

const showCostTooltip = (event: MouseEvent, item: PurchaseItem) => {
  tooltipItem.value = item
  tooltipVisible.value = true
  
  // Create tooltip element if it doesn't exist
  if (!tooltipElement.value) {
    tooltipElement.value = document.createElement('div')
    tooltipElement.value.className = 'fixed z-[9999] w-56 p-2 bg-gray-900 text-white text-[10px] rounded shadow-xl pointer-events-none cost-breakdown-tooltip transition-opacity duration-200'
    document.body.appendChild(tooltipElement.value)
  }
  
  // Update tooltip content
  const breakdown = getCostBreakdown(item)
  const calculatedTotal = breakdown.purchase + breakdown.chinaDelivery + breakdown.russiaDelivery + breakdown.commission + breakdown.warehouse
  
  tooltipElement.value.innerHTML = `
    <div class="font-semibold mb-1 pb-1 border-b border-gray-700">Детализация (за ед.):</div>
    <div class="space-y-0.5">
      <div class="flex justify-between">
        <span>Закупка:</span>
        <span class="font-medium">${breakdown.purchase.toFixed(2)} ₽</span>
      </div>
      <div class="flex justify-between">
        <span>Доставка Китай:</span>
        <span class="font-medium">${breakdown.chinaDelivery.toFixed(2)} ₽</span>
      </div>
      <div class="flex justify-between">
        <span>Доставка РФ:</span>
        <span class="font-medium">${breakdown.russiaDelivery.toFixed(2)} ₽</span>
      </div>
      <div class="flex justify-between">
        <span>Комиссия байера:</span>
        <span class="font-medium">${breakdown.commission.toFixed(2)} ₽</span>
      </div>
      <div class="flex justify-between">
        <span>Склад (ФФ+Упак+КИЗ):</span>
        <span class="font-medium">${breakdown.warehouse.toFixed(2)} ₽</span>
      </div>
      <div class="flex justify-between pt-1 mt-1 border-t border-gray-700 font-semibold">
        <span>Итого:</span>
        <span>${item.unitCostResult.toFixed(2)} ₽</span>
      </div>
      ${Math.abs(calculatedTotal - item.unitCostResult) > 0.01 ? `
      <div class="flex justify-between pt-1 mt-1 border-t border-red-500 text-red-300 text-[9px]">
        <span>Проверка суммы:</span>
        <span>${calculatedTotal.toFixed(2)} ₽ (не совпадает!)</span>
      </div>
      ` : ''}
    </div>
    <div class="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
      <div class="border-4 border-transparent border-t-gray-900"></div>
    </div>
  `
  
  // Position tooltip
  updateTooltipPosition(event)
}

const updateTooltipPosition = (event: MouseEvent) => {
  if (!tooltipElement.value || !tooltipVisible.value) return
  
  const target = event.currentTarget as HTMLElement
  if (!target) return
  
  const rect = target.getBoundingClientRect()
  const tooltipWidth = 224 // w-56 = 14rem = 224px
  const tooltipHeight = tooltipElement.value.offsetHeight || 120
  const spacing = 8
  
  // Check available space
  const spaceAbove = rect.top
  const spaceBelow = window.innerHeight - rect.bottom
  const spaceLeft = rect.left
  const spaceRight = window.innerWidth - rect.right
  
  let top = 0
  let left = 0
  let arrowPosition = 'bottom'
  
  // Prefer showing above, but check if there's enough space
  if (spaceAbove >= tooltipHeight + spacing) {
    // Show above
    top = rect.top - tooltipHeight - spacing
    arrowPosition = 'bottom'
  } else if (spaceBelow >= tooltipHeight + spacing) {
    // Show below
    top = rect.bottom + spacing
    arrowPosition = 'top'
  } else {
    // Show in the middle if neither side has enough space
    top = Math.max(10, rect.top - tooltipHeight / 2)
    arrowPosition = 'middle'
  }
  
  // Horizontal positioning - center on element, but adjust if near edges
  left = rect.left + rect.width / 2 - tooltipWidth / 2
  
  if (left < 10) {
    left = 10
  } else if (left + tooltipWidth > window.innerWidth - 10) {
    left = window.innerWidth - tooltipWidth - 10
  }
  
  tooltipElement.value.style.top = `${top}px`
  tooltipElement.value.style.left = `${left}px`
  tooltipElement.value.style.opacity = '1'
  tooltipElement.value.style.visibility = 'visible'
}

const hideCostTooltip = () => {
  tooltipVisible.value = false
  if (tooltipElement.value) {
    tooltipElement.value.style.opacity = '0'
    tooltipElement.value.style.visibility = 'hidden'
  }
}

// Cleanup on unmount
onBeforeUnmount(() => {
  if (tooltipElement.value && tooltipElement.value.parentNode) {
    document.body.removeChild(tooltipElement.value)
    tooltipElement.value = null
  }
})

onMounted(() => {
  store.loadOrders()
  loadProducts()
})
</script>

