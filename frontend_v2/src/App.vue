<template>
  <div class="app-shell">
    <header class="app-header">
      <div>
        <p class="app-eyebrow">Учебный фронтенд</p>
        <h1>WB Analytics V2</h1>
      </div>

      <nav class="app-nav">
        <RouterLink to="/accounts">Кабинеты</RouterLink>
        <RouterLink to="/economics">Юнит-экономика</RouterLink>
      </nav>
    </header>

    <main class="page-container">
      <RouterView />
    </main>
  </div>
</template>

<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>
