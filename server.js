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

// Прокси эндпоинт для всех запросов к WB API
app.all('/api/*', async (req, res) => {
  try {
    // Убираем префикс /api из пути
    const wbPath = req.path.replace(/^\/api/, '')
    const targetUrl = `${WB_STATISTICS_API_BASE_URL}${wbPath}`

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

// Запуск сервера
app.listen(PORT, () => {
  console.log(`🚀 Прокси-сервер запущен на http://localhost:${PORT}`)
  console.log(`📡 Statistics API: ${WB_STATISTICS_API_BASE_URL}`)
  console.log(`📦 Content API: ${WB_CONTENT_API_BASE_URL}`)
  if (!WB_API_KEY) {
    console.warn('⚠️  Предупреждение: WB_API_KEY не установлен!')
  } else {
    console.log('✅ API ключ загружен')
  }
  console.log(`🔍 Health check: http://localhost:${PORT}/health`)
})
