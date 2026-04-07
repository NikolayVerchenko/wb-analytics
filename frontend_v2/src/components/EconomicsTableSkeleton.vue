<template>
  <div class="table-skeleton">
    <div class="table-skeleton-header">
      <div v-for="index in 10" :key="`header-${index}`" class="skeleton-bar header-bar"></div>
    </div>
    <div class="table-skeleton-body">
      <div v-for="row in 6" :key="`row-${row}`" class="table-skeleton-row">
        <div v-for="cell in 10" :key="`row-${row}-cell-${cell}`" class="skeleton-bar"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.table-skeleton {
  display: grid;
  gap: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px;
  background: #ffffff;
}

.table-skeleton-header {
  display: grid;
  grid-template-columns: repeat(10, minmax(60px, 1fr));
  gap: 8px;
}

.table-skeleton-body {
  display: grid;
  gap: 10px;
}

.table-skeleton-row {
  display: grid;
  grid-template-columns: repeat(10, minmax(60px, 1fr));
  gap: 8px;
}

.skeleton-bar {
  height: 10px;
  border-radius: 999px;
  background: linear-gradient(90deg, #f3f4f6 0%, #e5e7eb 50%, #f3f4f6 100%);
  background-size: 200% 100%;
  animation: shimmer 1.6s ease-in-out infinite;
}

.header-bar {
  height: 12px;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

@media (max-width: 900px) {
  .table-skeleton-header,
  .table-skeleton-row {
    grid-template-columns: repeat(6, minmax(60px, 1fr));
  }
}
</style>
