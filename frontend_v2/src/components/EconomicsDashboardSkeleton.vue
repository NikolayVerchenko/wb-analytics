<template>
  <div class="dashboard-skeleton">
    <div class="dashboard-skeleton-group">
      <div class="dashboard-skeleton-header">
        <div class="skeleton-bar skeleton-title"></div>
        <div class="skeleton-bar skeleton-subtitle"></div>
      </div>
      <div class="dashboard-skeleton-grid dashboard-skeleton-grid-primary">
        <div v-for="index in 3" :key="`primary-${index}`" class="skeleton-card skeleton-card-primary">
          <div class="skeleton-bar skeleton-label"></div>
          <div class="skeleton-bar skeleton-value"></div>
          <div class="skeleton-bar skeleton-meta"></div>
        </div>
      </div>
    </div>

    <div class="dashboard-skeleton-group">
      <div class="dashboard-skeleton-header">
        <div class="skeleton-bar skeleton-title"></div>
        <div class="skeleton-bar skeleton-subtitle"></div>
      </div>
      <div class="dashboard-skeleton-grid dashboard-skeleton-grid-secondary">
        <div v-for="index in 6" :key="`secondary-${index}`" class="skeleton-card skeleton-card-secondary">
          <div class="skeleton-bar skeleton-label"></div>
          <div class="skeleton-bar skeleton-value small"></div>
          <div class="skeleton-bar skeleton-meta"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-skeleton {
  display: grid;
  gap: 24px;
}

.dashboard-skeleton-group {
  display: grid;
  gap: 14px;
}

.dashboard-skeleton-header {
  display: grid;
  gap: 6px;
}

.dashboard-skeleton-grid {
  display: grid;
  gap: 16px;
}

.dashboard-skeleton-grid-primary {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.dashboard-skeleton-grid-secondary {
  grid-template-columns: repeat(6, minmax(0, 1fr));
}

.skeleton-card {
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  background: #ffffff;
  padding: 16px;
  display: grid;
  gap: 10px;
}

.skeleton-card-primary {
  min-height: 160px;
  padding: 22px;
}

.skeleton-card-secondary {
  min-height: 110px;
  padding: 14px;
  background: #f9fafb;
}

.skeleton-bar {
  height: 12px;
  border-radius: 999px;
  background: linear-gradient(90deg, #f3f4f6 0%, #e5e7eb 50%, #f3f4f6 100%);
  background-size: 200% 100%;
  animation: shimmer 1.6s ease-in-out infinite;
}

.skeleton-title {
  width: 140px;
  height: 14px;
}

.skeleton-subtitle {
  width: 220px;
}

.skeleton-label {
  width: 80px;
}

.skeleton-value {
  width: 140px;
  height: 22px;
}

.skeleton-value.small {
  width: 90px;
  height: 18px;
}

.skeleton-meta {
  width: 110px;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

@media (max-width: 1200px) {
  .dashboard-skeleton-grid-secondary {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 960px) {
  .dashboard-skeleton-grid-primary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .dashboard-skeleton-grid-secondary {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .dashboard-skeleton-grid-primary,
  .dashboard-skeleton-grid-secondary {
    grid-template-columns: 1fr;
  }
}
</style>
