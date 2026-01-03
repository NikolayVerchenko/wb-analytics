import express from 'express'
import cors from 'cors'
import axios from 'axios'
import dotenv from 'dotenv'

// Загружаем переменные окружения
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000
const WB_STATISTICS_API_BASE_URL = 'https://statistics-api.wildberries.ru'
const WB_CONTENT_API_BASE_URL = 'https://content-api.wildberries.ru'
const WB_SUPPLIES_API_BASE_URL = 'https://supplies-api.wildberries.ru'
const WB_ADVERT_API_BASE_URL = 'https://advert-api.wildberries.ru'
const WB_SELLER_ANALYTICS_API_BASE_URL = 'https://seller-analytics-api.wildberries.ru'
const WB_API_KEY = process.env.WB_API_KEY || process.env.VITE_WB_API_KEY

// Настройка CORS - разрешаем все запросы с локального хоста
// Включаем поддержку всех портов Vite (5173, 5174, 5175 и т.д.)
const corsOptions = {
  origin: function (origin, callback) {
    // Разрешаем запросы без origin (например, из Postman, мобильных приложений) 
    // и все локальные origins для разработки
    if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1')) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-WB-API-Key', 'x-wb-api-key', 'Accept', 'Origin', 'X-Requested-With'],
  exposedHeaders: ['Content-Type', 'Authorization'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}

app.use(cors(corsOptions))

// Парсинг JSON тел запросов
app.use(express.json())

// Middleware для логирования всех запросов (для отладки)
app.use((req, res, next) => {
  console.log(`[DEBUG ALL] ${req.method} ${req.path} ${req.originalUrl}`)
  next()
})

// Прокси эндпоинт для Advert API (должен быть ПЕРЕД /api/*, чтобы не перехватывался)
app.all('/adv/*', async (req, res) => {
  try {
    // Путь уже содержит /adv/v1/upd, просто добавляем базовый URL
    const targetUrl = `${WB_ADVERT_API_BASE_URL}${req.path}`

    console.log(`[Proxy Advert] ${req.method} ${req.path} -> ${targetUrl}`)

    // Определяем API ключ: приоритет у заголовка X-WB-API-Key от клиента, затем из .env
    const clientApiKey = req.headers['x-wb-api-key'] || req.headers['X-WB-API-Key']
    const apiKey = clientApiKey || WB_API_KEY

    // Проверяем наличие API ключа
    if (!apiKey) {
      return res.status(500).json({
        error: 'API ключ не найден. Укажите его в заголовке X-WB-API-Key или в переменной окружения WB_API_KEY/VITE_WB_API_KEY.'
      })
    }

    // Подготавливаем заголовки для запроса к WB API
    const headers = {
      'Authorization': apiKey,
      'Content-Type': 'application/json'
    }

    // Выполняем запрос к WB API
    const config = {
      method: req.method,
      url: targetUrl,
      headers: headers,
      params: req.query,
      data: req.body,
      timeout: 30000
    }

    const response = await axios(config)
    console.log(`[Proxy Advert] Response Status: ${response.status}`)
    res.status(response.status).json(response.data)

  } catch (error) {
    console.error('[Proxy Advert Error]', error.message)
    if (error.response) {
      console.error('[Proxy Advert Error] Response Status:', error.response.status)
      console.error('[Proxy Advert Error] Response Data:', JSON.stringify(error.response.data, null, 2))
      res.status(error.response.status).json({
        error: error.response.data || error.message,
        status: error.response.status
      })
    } else if (error.request) {
      res.status(503).json({
        error: 'Сервер Wildberries Advert API недоступен',
        message: error.message
      })
    } else {
      res.status(500).json({
        error: 'Внутренняя ошибка прокси-сервера',
        message: error.message
      })
    }
  }
})

// Прокси эндпоинт для Seller Analytics API (/api/v1/paid_storage) - создание задачи платного хранения
app.all('/api/v1/paid_storage', async (req, res) => {
  try {
    // Путь уже содержит /api/v1/paid_storage, просто добавляем базовый URL
    const targetUrl = `${WB_SELLER_ANALYTICS_API_BASE_URL}${req.path}`

    console.log(`[Proxy Seller Analytics] ${req.method} ${req.path} -> ${targetUrl}`)

    // Определяем API ключ: приоритет у заголовка X-WB-API-Key от клиента, затем из .env
    const clientApiKey = req.headers['x-wb-api-key'] || req.headers['X-WB-API-Key']
    const apiKey = clientApiKey || WB_API_KEY

    // Проверяем наличие API ключа
    if (!apiKey) {
      return res.status(500).json({
        error: 'API ключ не найден. Укажите его в заголовке X-WB-API-Key или в переменной окружения WB_API_KEY/VITE_WB_API_KEY.'
      })
    }

    // Подготавливаем заголовки для запроса к WB API
    const headers = {
      'Authorization': apiKey,
      'Content-Type': 'application/json'
    }

    // Выполняем запрос к WB API
    const config = {
      method: req.method,
      url: targetUrl,
      headers: headers,
      params: req.query,
      data: req.body,
      timeout: 30000
    }

    const response = await axios(config)
    console.log(`[Proxy Seller Analytics] Response Status: ${response.status}`)
    res.status(response.status).json(response.data)

  } catch (error) {
    console.error('[Proxy Seller Analytics Error]', error.message)
    if (error.response) {
      console.error('[Proxy Seller Analytics Error] Response Status:', error.response.status)
      console.error('[Proxy Seller Analytics Error] Response Data:', JSON.stringify(error.response.data, null, 2))
      res.status(error.response.status).json({
        error: error.response.data || error.message,
        status: error.response.status
      })
    } else if (error.request) {
      res.status(503).json({
        error: 'Сервер Wildberries Seller Analytics API недоступен',
        message: error.message
      })
    } else {
      res.status(500).json({
        error: 'Внутренняя ошибка прокси-сервера',
        message: error.message
      })
    }
  }
})

// Прокси эндпоинт для Seller Analytics API (/api/v1/paid_storage/*) - статус и скачивание платного хранения - должен быть ПЕРЕД /api/*
app.all('/api/v1/paid_storage/*', async (req, res) => {
  try {
    // Путь уже содержит /api/v1/paid_storage/..., просто добавляем базовый URL
    const targetUrl = `${WB_SELLER_ANALYTICS_API_BASE_URL}${req.path}`

    console.log(`[Proxy Seller Analytics] ${req.method} ${req.path} -> ${targetUrl}`)

    // Определяем API ключ: приоритет у заголовка X-WB-API-Key от клиента, затем из .env
    const clientApiKey = req.headers['x-wb-api-key'] || req.headers['X-WB-API-Key']
    const apiKey = clientApiKey || WB_API_KEY

    // Проверяем наличие API ключа
    if (!apiKey) {
      return res.status(500).json({
        error: 'API ключ не найден. Укажите его в заголовке X-WB-API-Key или в переменной окружения WB_API_KEY/VITE_WB_API_KEY.'
      })
    }

    // Подготавливаем заголовки для запроса к WB API
    const headers = {
      'Authorization': apiKey,
      'Content-Type': 'application/json'
    }

    // Выполняем запрос к WB API
    const config = {
      method: req.method,
      url: targetUrl,
      headers: headers,
      params: req.query,
      data: req.body,
      timeout: 30000
    }

    const response = await axios(config)
    console.log(`[Proxy Seller Analytics] Response Status: ${response.status}`)
    res.status(response.status).json(response.data)

  } catch (error) {
    console.error('[Proxy Seller Analytics Error]', error.message)
    if (error.response) {
      console.error('[Proxy Seller Analytics Error] Response Status:', error.response.status)
      console.error('[Proxy Seller Analytics Error] Response Data:', JSON.stringify(error.response.data, null, 2))
      res.status(error.response.status).json({
        error: error.response.data || error.message,
        status: error.response.status
      })
    } else if (error.request) {
      res.status(503).json({
        error: 'Сервер Wildberries Seller Analytics API недоступен',
        message: error.message
      })
    } else {
      res.status(500).json({
        error: 'Внутренняя ошибка прокси-сервера',
        message: error.message
      })
    }
  }
})

// Прокси эндпоинт для Seller Analytics API (/api/v1/acceptance_report) - создание задачи
app.all('/api/v1/acceptance_report', async (req, res) => {
  try {
    // Путь уже содержит /api/v1/acceptance_report, просто добавляем базовый URL
    const targetUrl = `${WB_SELLER_ANALYTICS_API_BASE_URL}${req.path}`

    console.log(`[Proxy Seller Analytics] ${req.method} ${req.path} -> ${targetUrl}`)

    // Определяем API ключ: приоритет у заголовка X-WB-API-Key от клиента, затем из .env
    const clientApiKey = req.headers['x-wb-api-key'] || req.headers['X-WB-API-Key']
    const apiKey = clientApiKey || WB_API_KEY

    // Проверяем наличие API ключа
    if (!apiKey) {
      return res.status(500).json({
        error: 'API ключ не найден. Укажите его в заголовке X-WB-API-Key или в переменной окружения WB_API_KEY/VITE_WB_API_KEY.'
      })
    }

    // Подготавливаем заголовки для запроса к WB API
    const headers = {
      'Authorization': apiKey,
      'Content-Type': 'application/json'
    }

    // Выполняем запрос к WB API
    const config = {
      method: req.method,
      url: targetUrl,
      headers: headers,
      params: req.query,
      data: req.body,
      timeout: 30000
    }

    const response = await axios(config)
    console.log(`[Proxy Seller Analytics] Response Status: ${response.status}`)
    res.status(response.status).json(response.data)

  } catch (error) {
    console.error('[Proxy Seller Analytics Error]', error.message)
    if (error.response) {
      console.error('[Proxy Seller Analytics Error] Response Status:', error.response.status)
      console.error('[Proxy Seller Analytics Error] Response Data:', JSON.stringify(error.response.data, null, 2))
      res.status(error.response.status).json({
        error: error.response.data || error.message,
        status: error.response.status
      })
    } else if (error.request) {
      res.status(503).json({
        error: 'Сервер Wildberries Seller Analytics API недоступен',
        message: error.message
      })
    } else {
      res.status(500).json({
        error: 'Внутренняя ошибка прокси-сервера',
        message: error.message
      })
    }
  }
})

// Прокси эндпоинт для Seller Analytics API (/api/v1/acceptance_report/*) - статус и скачивание - должен быть ПЕРЕД /api/*
app.all('/api/v1/acceptance_report/*', async (req, res) => {
  try {
    // Путь уже содержит /api/v1/acceptance_report/..., просто добавляем базовый URL
    const targetUrl = `${WB_SELLER_ANALYTICS_API_BASE_URL}${req.path}`

    console.log(`[Proxy Seller Analytics] ${req.method} ${req.path} -> ${targetUrl}`)

    // Определяем API ключ: приоритет у заголовка X-WB-API-Key от клиента, затем из .env
    const clientApiKey = req.headers['x-wb-api-key'] || req.headers['X-WB-API-Key']
    const apiKey = clientApiKey || WB_API_KEY

    // Проверяем наличие API ключа
    if (!apiKey) {
      return res.status(500).json({
        error: 'API ключ не найден. Укажите его в заголовке X-WB-API-Key или в переменной окружения WB_API_KEY/VITE_WB_API_KEY.'
      })
    }

    // Подготавливаем заголовки для запроса к WB API
    const headers = {
      'Authorization': apiKey,
      'Content-Type': 'application/json'
    }

    // Выполняем запрос к WB API
    const config = {
      method: req.method,
      url: targetUrl,
      headers: headers,
      params: req.query,
      data: req.body,
      timeout: 30000
    }

    const response = await axios(config)
    console.log(`[Proxy Seller Analytics] Response Status: ${response.status}`)
    res.status(response.status).json(response.data)

  } catch (error) {
    console.error('[Proxy Seller Analytics Error]', error.message)
    if (error.response) {
      console.error('[Proxy Seller Analytics Error] Response Status:', error.response.status)
      console.error('[Proxy Seller Analytics Error] Response Data:', JSON.stringify(error.response.data, null, 2))
      res.status(error.response.status).json({
        error: error.response.data || error.message,
        status: error.response.status
      })
    } else if (error.request) {
      res.status(503).json({
        error: 'Сервер Wildberries Seller Analytics API недоступен',
        message: error.message
      })
    } else {
      res.status(500).json({
        error: 'Внутренняя ошибка прокси-сервера',
        message: error.message
      })
    }
  }
})

// Прокси эндпоинт для Advert API v2 (/api/advert/*)
app.all('/api/advert/*', async (req, res) => {
  try {
    // Путь уже содержит /api/advert/..., просто добавляем базовый URL
    const targetUrl = `${WB_ADVERT_API_BASE_URL}${req.path}`

    console.log(`[Proxy Advert API] ${req.method} ${req.path} -> ${targetUrl}`)

    // Определяем API ключ: приоритет у заголовка X-WB-API-Key от клиента, затем из .env
    const clientApiKey = req.headers['x-wb-api-key'] || req.headers['X-WB-API-Key']
    const apiKey = clientApiKey || WB_API_KEY

    // Проверяем наличие API ключа
    if (!apiKey) {
      return res.status(500).json({
        error: 'API ключ не найден. Укажите его в заголовке X-WB-API-Key или в переменной окружения WB_API_KEY/VITE_WB_API_KEY.'
      })
    }

    // Подготавливаем заголовки для запроса к WB API
    const headers = {
      'Authorization': apiKey,
      'Content-Type': 'application/json'
    }

    // Выполняем запрос к WB API
    const config = {
      method: req.method,
      url: targetUrl,
      headers: headers,
      params: req.query,
      data: req.body,
      timeout: 30000
    }

    const response = await axios(config)
    console.log(`[Proxy Advert API] Response Status: ${response.status}`)
    res.status(response.status).json(response.data)

  } catch (error) {
    console.error('[Proxy Advert API Error]', error.message)
    if (error.response) {
      console.error('[Proxy Advert API Error] Response Status:', error.response.status)
      console.error('[Proxy Advert API Error] Response Data:', JSON.stringify(error.response.data, null, 2))
      res.status(error.response.status).json({
        error: error.response.data || error.message,
        status: error.response.status
      })
    } else if (error.request) {
      res.status(503).json({
        error: 'Сервер Wildberries Advert API недоступен',
        message: error.message
      })
    } else {
      res.status(500).json({
        error: 'Внутренняя ошибка прокси-сервера',
        message: error.message
      })
    }
  }
})

// Прокси эндпоинт для Supplies API (должен быть ПЕРЕД /api/*, чтобы не перехватывался)
// Используем app.all для перехвата всех методов
app.all('/supplies-api/*', async (req, res) => {
  console.log(`[Proxy Supplies] === ЗАПРОС ПЕРЕХВАЧЕН ===`)
  console.log(`[Proxy Supplies] Method: ${req.method}`)
  console.log(`[Proxy Supplies] Original URL: ${req.originalUrl}`)
  console.log(`[Proxy Supplies] Path: ${req.path}`)
  try {
    // Убираем префикс /supplies-api из пути
    const wbPath = req.path.replace(/^\/supplies-api/, '')
    // Формируем целевой URL
    const targetUrl = `${WB_SUPPLIES_API_BASE_URL}${wbPath}`

    // Логирование только для отладки (можно убрать в продакшене)
    console.log(`[Proxy Supplies] ${req.method} ${req.path} -> ${targetUrl}`)

    // Определяем API ключ: приоритет у заголовка X-WB-API-Key от клиента, затем из .env
    const clientApiKey = req.headers['x-wb-api-key'] || req.headers['X-WB-API-Key']
    const apiKey = clientApiKey || WB_API_KEY

    // Проверяем наличие API ключа
    if (!apiKey) {
      return res.status(500).json({
        error: 'API ключ не найден. Укажите его в заголовке X-WB-API-Key или в переменной окружения WB_API_KEY/VITE_WB_API_KEY.'
      })
    }

    // Подготавливаем заголовки для запроса к WB API
    // Для Supplies API используется HeaderApiKey - передаем ключ напрямую в Authorization
    const headers = {
      'Authorization': apiKey, // API ключ передается напрямую, без Bearer
      'Content-Type': 'application/json'
    }

    // НЕ передаем другие заголовки от клиента для Supplies API
    // Только Authorization и Content-Type

    // Выполняем запрос к WB API
    const config = {
      method: req.method,
      url: targetUrl,
      headers: headers,
      params: req.query, // limit и offset как query параметры
      data: req.body,
      timeout: 30000
    }

    console.log(`[Proxy Supplies] Axios Config:`, {
      method: config.method,
      url: config.url,
      params: config.params,
      headers: Object.keys(config.headers),
    })

    const response = await axios(config)
    console.log(`[Proxy Supplies] Response Status: ${response.status}`)
    console.log(`[Proxy Supplies] Response Data (first 200 chars):`, JSON.stringify(response.data).substring(0, 200))
    res.status(response.status).json(response.data)

  } catch (error) {
    console.error('[Proxy Supplies Error]', error.message)
    if (error.response) {
      console.error('[Proxy Supplies Error] Response Status:', error.response.status)
      console.error('[Proxy Supplies Error] Response Data:', JSON.stringify(error.response.data, null, 2))
      console.error('[Proxy Supplies Error] Response Headers:', JSON.stringify(error.response.headers, null, 2))
    }
    
    if (error.response) {
      res.status(error.response.status).json({
        error: error.response.data || error.message,
        status: error.response.status
      })
    } else if (error.request) {
      res.status(503).json({
        error: 'Сервер Wildberries недоступен',
        message: error.message
      })
    } else {
      res.status(500).json({
        error: 'Внутренняя ошибка прокси-сервера',
        message: error.message
      })
    }
  }
})

// Прокси эндпоинт для Seller Analytics API (/api/v1/warehouse_remains) - создание задачи остатков - должен быть ПЕРЕД /api/analytics/*
app.all('/api/v1/warehouse_remains', async (req, res) => {
  try {
    const targetUrl = `${WB_SELLER_ANALYTICS_API_BASE_URL}${req.path}`
    console.log(`[Proxy Seller Analytics (Warehouse Remains)] ${req.method} ${req.path} -> ${targetUrl}`)

    const clientApiKey = req.headers['x-wb-api-key'] || req.headers['X-WB-API-Key']
    const apiKey = clientApiKey || WB_API_KEY

    if (!apiKey) {
      return res.status(500).json({
        error: 'API ключ не найден. Укажите его в заголовке X-WB-API-Key или в переменной окружения WB_API_KEY/VITE_WB_API_KEY.'
      })
    }

    const headers = {
      'Authorization': apiKey,
      'Content-Type': 'application/json'
    }

    const config = {
      method: req.method,
      url: targetUrl,
      headers: headers,
      params: req.query,
      data: req.body,
      timeout: 30000
    }

    const response = await axios(config)
    console.log(`[Proxy Seller Analytics (Warehouse Remains)] Response Status: ${response.status}`)
    res.status(response.status).json(response.data)

  } catch (error) {
    console.error('[Proxy Seller Analytics (Warehouse Remains) Error]', error.message)
    if (error.response) {
      console.error('[Proxy Seller Analytics (Warehouse Remains) Error] Response Status:', error.response.status)
      console.error('[Proxy Seller Analytics (Warehouse Remains) Error] Response Data:', JSON.stringify(error.response.data, null, 2))
      res.status(error.response.status).json({
        error: error.response.data || error.message,
        status: error.response.status
      })
    } else if (error.request) {
      res.status(503).json({
        error: 'Сервер Wildberries Seller Analytics API недоступен',
        message: error.message
      })
    } else {
      res.status(500).json({
        error: 'Внутренняя ошибка прокси-сервера',
        message: error.message
      })
    }
  }
})

// Прокси эндпоинт для Seller Analytics API (/api/v1/warehouse_remains/*) - статус и скачивание остатков - должен быть ПЕРЕД /api/analytics/*
app.all('/api/v1/warehouse_remains/*', async (req, res) => {
  try {
    const targetUrl = `${WB_SELLER_ANALYTICS_API_BASE_URL}${req.path}`
    console.log(`[Proxy Seller Analytics (Warehouse Remains)] ${req.method} ${req.path} -> ${targetUrl}`)

    const clientApiKey = req.headers['x-wb-api-key'] || req.headers['X-WB-API-Key']
    const apiKey = clientApiKey || WB_API_KEY

    if (!apiKey) {
      return res.status(500).json({
        error: 'API ключ не найден. Укажите его в заголовке X-WB-API-Key или в переменной окружения WB_API_KEY/VITE_WB_API_KEY.'
      })
    }

    const headers = {
      'Authorization': apiKey,
      'Content-Type': 'application/json'
    }

    const config = {
      method: req.method,
      url: targetUrl,
      headers: headers,
      params: req.query,
      data: req.body,
      timeout: 30000
    }

    const response = await axios(config)
    console.log(`[Proxy Seller Analytics (Warehouse Remains)] Response Status: ${response.status}`)
    res.status(response.status).json(response.data)

  } catch (error) {
    console.error('[Proxy Seller Analytics (Warehouse Remains) Error]', error.message)
    if (error.response) {
      console.error('[Proxy Seller Analytics (Warehouse Remains) Error] Response Status:', error.response.status)
      console.error('[Proxy Seller Analytics (Warehouse Remains) Error] Response Data:', JSON.stringify(error.response.data, null, 2))
      res.status(error.response.status).json({
        error: error.response.data || error.message,
        status: error.response.status
      })
    } else if (error.request) {
      res.status(503).json({
        error: 'Сервер Wildberries Seller Analytics API недоступен',
        message: error.message
      })
    } else {
      res.status(500).json({
        error: 'Внутренняя ошибка прокси-сервера',
        message: error.message
      })
    }
  }
})

// Прокси эндпоинт для Seller Analytics API (/api/analytics/*) - должен быть ПЕРЕД /api/*
app.all('/api/analytics/*', async (req, res) => {
  try {
    const targetUrl = `${WB_SELLER_ANALYTICS_API_BASE_URL}${req.path}`
    console.log(`[Proxy Seller Analytics] ${req.method} ${req.path} -> ${targetUrl}`)

    const clientApiKey = req.headers['x-wb-api-key'] || req.headers['X-WB-API-Key']
    const apiKey = clientApiKey || WB_API_KEY

    if (!apiKey) {
      return res.status(500).json({
        error: 'API ключ не найден. Укажите его в заголовке X-WB-API-Key или в переменной окружения WB_API_KEY/VITE_WB_API_KEY.'
      })
    }

    const headers = {
      'Authorization': apiKey,
      'Content-Type': 'application/json'
    }

    const config = {
      method: req.method,
      url: targetUrl,
      headers: headers,
      params: req.query,
      data: req.body,
      timeout: 30000
    }

    const response = await axios(config)
    console.log(`[Proxy Seller Analytics] Response Status: ${response.status}`)
    res.status(response.status).json(response.data)

  } catch (error) {
    console.error('[Proxy Seller Analytics Error]', error.message)
    if (error.response) {
      console.error('[Proxy Seller Analytics Error] Response Status:', error.response.status)
      console.error('[Proxy Seller Analytics Error] Response Data:', JSON.stringify(error.response.data, null, 2))
      res.status(error.response.status).json({
        error: error.response.data || error.message,
        status: error.response.status
      })
    } else if (error.request) {
      res.status(503).json({
        error: 'Сервер Wildberries Seller Analytics API недоступен',
        message: error.message
      })
    } else {
      res.status(500).json({
        error: 'Внутренняя ошибка прокси-сервера',
        message: error.message
      })
    }
  }
})

// Прокси эндпоинт для всех запросов к WB API
app.all('/api/*', async (req, res) => {
  try {
    // Путь уже содержит /api/v5/supplier/..., просто добавляем базовый URL
    const targetUrl = `${WB_STATISTICS_API_BASE_URL}${req.path}`

    // Определяем API ключ: приоритет у заголовка X-WB-API-Key от клиента, затем из .env
    // Заголовки в Express приходят в нижнем регистре
    const clientApiKey = req.headers['x-wb-api-key'] || req.headers['X-WB-API-Key']
    const apiKey = clientApiKey || WB_API_KEY

    // Проверяем наличие API ключа
    if (!apiKey) {
      return res.status(500).json({
        error: 'API ключ не найден. Укажите его в заголовке X-WB-API-Key или в переменной окружения WB_API_KEY/VITE_WB_API_KEY.'
      })
    }

    // Подготавливаем заголовки для запроса к WB API
    const headers = {
      'Authorization': apiKey,
      'Content-Type': 'application/json'
    }

    // Передаем все входящие заголовки (кроме host и authorization, так как они заменяются)
    Object.keys(req.headers).forEach(key => {
      const lowerKey = key.toLowerCase()
      if (lowerKey !== 'host' && lowerKey !== 'authorization' && lowerKey !== 'content-length') {
        headers[key] = req.headers[key]
      }
    })

    // Выполняем запрос к WB API
    const config = {
      method: req.method,
      url: targetUrl,
      headers: headers,
      params: req.query, // Query параметры
      data: req.body, // Тело запроса для POST/PUT/PATCH
      timeout: 30000 // 30 секунд таймаут
    }

    console.log(`[Proxy] ${req.method} ${targetUrl}`)
    const response = await axios(config)

    // Возвращаем ответ от WB API
    res.status(response.status).json(response.data)

  } catch (error) {
    console.error('[Proxy Error]', error.message)
    
    // Обрабатываем ошибки axios
    if (error.response) {
      // Сервер вернул ошибку
      res.status(error.response.status).json({
        error: error.response.data || error.message,
        status: error.response.status
      })
    } else if (error.request) {
      // Запрос был сделан, но ответа не получено
      res.status(503).json({
        error: 'Сервер Wildberries недоступен',
        message: error.message
      })
    } else {
      // Ошибка при настройке запроса
      res.status(500).json({
        error: 'Внутренняя ошибка прокси-сервера',
        message: error.message
      })
    }
  }
})

// Прокси эндпоинт для Content API (v2)
app.all('/content/*', async (req, res) => {
  try {
    // Убираем префикс /content из пути
    const wbPath = req.path.replace(/^\/content/, '')
    const targetUrl = `${WB_CONTENT_API_BASE_URL}/content${wbPath}`

    console.log(`[Proxy Content] Запрос: ${req.method} ${req.path}`)
    console.log(`[Proxy Content] Original URL: ${req.url}`)
    console.log(`[Proxy Content] Path after /content removal: ${wbPath}`)
    console.log(`[Proxy Content] Формируемый URL: ${targetUrl}`)
    console.log(`[Proxy Content] Body:`, JSON.stringify(req.body, null, 2))

    // Определяем API ключ: приоритет у заголовка X-WB-API-Key от клиента, затем из .env
    const clientApiKey = req.headers['x-wb-api-key'] || req.headers['X-WB-API-Key']
    const apiKey = clientApiKey || WB_API_KEY

    // Проверяем наличие API ключа
    if (!apiKey) {
      console.error('[Proxy Content] API ключ не найден')
      return res.status(500).json({
        error: 'API ключ не найден. Укажите его в заголовке X-WB-API-Key или в переменной окружения WB_API_KEY/VITE_WB_API_KEY.'
      })
    }

    // Подготавливаем заголовки для запроса к WB API
    const headers = {
      'Authorization': apiKey,
      'Content-Type': 'application/json'
    }

    // Передаем все входящие заголовки (кроме host и authorization)
    Object.keys(req.headers).forEach(key => {
      const lowerKey = key.toLowerCase()
      if (lowerKey !== 'host' && lowerKey !== 'authorization' && lowerKey !== 'content-length') {
        headers[key] = req.headers[key]
      }
    })

    console.log(`[Proxy Content] Заголовки:`, JSON.stringify(headers, null, 2))

    // Выполняем запрос к WB API
    const config = {
      method: req.method,
      url: targetUrl,
      headers: headers,
      params: req.query,
      data: req.body,
      timeout: 30000
    }

    console.log(`[Proxy Content] Отправка запроса на: ${targetUrl}`)
    const response = await axios(config)
    console.log(`[Proxy Content] Успешный ответ: ${response.status}`)

    // Возвращаем ответ от WB API
    res.status(response.status).json(response.data)

  } catch (error) {
    console.error('[Proxy Content Error]', error.message)
    console.error('[Proxy Content Error] Stack:', error.stack)
    
    if (error.response) {
      console.error('[Proxy Content Error] Response status:', error.response.status)
      console.error('[Proxy Content Error] Response data:', JSON.stringify(error.response.data, null, 2))
      res.status(error.response.status).json({
        error: error.response.data || error.message,
        status: error.response.status
      })
    } else if (error.request) {
      console.error('[Proxy Content Error] Request made but no response received')
      console.error('[Proxy Content Error] Request config:', {
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers,
        data: error.config?.data
      })
      console.error('[Proxy Content Error] Error code:', error.code)
      console.error('[Proxy Content Error] Error message:', error.message)
      res.status(503).json({
        error: 'Сервер Wildberries Content API недоступен',
        message: error.message,
        code: error.code,
        url: error.config?.url
      })
    } else {
      console.error('[Proxy Content Error] Error setting up request')
      res.status(500).json({
        error: 'Внутренняя ошибка прокси-сервера',
        message: error.message
      })
    }
  }
})

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    port: PORT,
    hasApiKey: !!WB_API_KEY,
    timestamp: new Date().toISOString()
  })
})

// Тестовый эндпоинт для проверки маршрута supplies-api
app.get('/supplies-api/test', (req, res) => {
  res.json({ 
    message: 'Supplies API route is working',
    path: req.path,
    method: req.method
  })
})

// Запуск сервера
app.listen(PORT, () => {
  console.log(`🚀 Прокси-сервер запущен на http://localhost:${PORT}`)
  console.log(`📡 Statistics API: ${WB_STATISTICS_API_BASE_URL}`)
  console.log(`📦 Content API: ${WB_CONTENT_API_BASE_URL}`)
  console.log(`📢 Advert API: ${WB_ADVERT_API_BASE_URL}`)
  console.log(`📊 Seller Analytics API: ${WB_SELLER_ANALYTICS_API_BASE_URL}`)
  if (!WB_API_KEY) {
    console.warn('⚠️  Предупреждение: WB_API_KEY не установлен!')
  } else {
    console.log('✅ API ключ загружен')
  }
  console.log(`🔍 Health check: http://localhost:${PORT}/health`)
})
