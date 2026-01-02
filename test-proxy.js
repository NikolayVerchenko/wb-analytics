/**
 * Простой скрипт для проверки работы прокси-сервера
 * Запуск: node test-proxy.js
 */

import axios from 'axios'

const PROXY_URL = 'http://localhost:3000'
const TEST_API_KEY = process.env.WB_API_KEY || process.env.VITE_WB_API_KEY || 'test-key'

async function testProxy() {
  console.log('🧪 Тестирование прокси-сервера...\n')

  // 1. Проверка health endpoint
  console.log('1. Проверка /health endpoint...')
  try {
    const healthResponse = await axios.get(`${PROXY_URL}/health`)
    console.log('✅ Health check:', healthResponse.data)
  } catch (error) {
    console.error('❌ Health check failed:', error.message)
    console.error('   Убедитесь, что прокси-сервер запущен: npm run server')
    return
  }

  // 2. Проверка обработки /api/* маршрута
  console.log('\n2. Проверка /api/v5/supplier маршрута...')
  try {
    const testResponse = await axios.get(`${PROXY_URL}/api/v5/supplier/reportDetailByPeriod`, {
      params: {
        dateFrom: '2024-01-01T00:00:00+03:00',
        dateTo: '2024-01-01T23:59:59+03:00',
        limit: 10,
        period: 'daily'
      },
      headers: {
        'X-WB-API-Key': TEST_API_KEY
      },
      validateStatus: () => true // Принимаем любой статус для проверки
    })
    
    if (testResponse.status === 200 || testResponse.status === 204) {
      console.log(`✅ Прокси обработал запрос. Статус: ${testResponse.status}`)
      if (testResponse.status === 204) {
        console.log('   (204 - нет данных за указанный период, это нормально)')
      }
    } else if (testResponse.status === 401) {
      console.log('⚠️  Прокси работает, но API ключ неверный (ожидаемо для тестового ключа)')
    } else {
      console.log(`⚠️  Прокси ответил со статусом: ${testResponse.status}`)
      console.log('   Ответ:', testResponse.data)
    }
  } catch (error) {
    if (error.response) {
      console.log(`⚠️  Прокси обработал запрос. Статус: ${error.response.status}`)
      if (error.response.status === 401) {
        console.log('   (401 - неверный API ключ, но прокси работает)')
      } else {
        console.log('   Ошибка:', error.response.data)
      }
    } else if (error.request) {
      console.error('❌ Прокси не отвечает. Проверьте, что сервер запущен.')
    } else {
      console.error('❌ Ошибка:', error.message)
    }
  }

  console.log('\n✅ Тестирование завершено')
  console.log('\n📝 Примечания:')
  console.log('   - Если видите 401, прокси работает корректно (нужен реальный API ключ)')
  console.log('   - Если видите 204, прокси работает и API ключ верный')
  console.log('   - Если видите ошибки подключения, проверьте запущен ли сервер')
}

testProxy().catch(console.error)

