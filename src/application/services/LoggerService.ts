export type LogLevel = 'info' | 'warn' | 'error' | 'success'

export interface LogEntry {
  id: string
  timestamp: Date
  level: LogLevel
  message: string
  context?: Record<string, any>
}

/**
 * Сервис для логирования процесса синхронизации
 * Хранит логи в памяти (последние 1000 записей)
 */
export class LoggerService {
  private logs: LogEntry[] = []
  private maxLogs = 1000
  private subscribers: Set<(logs: LogEntry[]) => void> = new Set()

  /**
   * Добавляет запись в лог
   */
  add(level: LogLevel, message: string, context?: Record<string, any>): void {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      level,
      message,
      context,
    }

    this.logs.push(entry)

    // Ограничиваем количество логов
    if (this.logs.length > this.maxLogs) {
      this.logs.shift()
    }

    // Уведомляем подписчиков
    this.notifySubscribers()
  }

  /**
   * Получает все логи
   */
  getAll(): LogEntry[] {
    return [...this.logs]
  }

  /**
   * Получает последние N логов
   */
  getLast(count: number = 50): LogEntry[] {
    return this.logs.slice(-count)
  }

  /**
   * Очищает все логи
   */
  clear(): void {
    this.logs = []
    this.notifySubscribers()
  }

  /**
   * Подписывается на изменения логов
   */
  subscribe(callback: (logs: LogEntry[]) => void): () => void {
    this.subscribers.add(callback)
    
    // Возвращаем функцию для отписки
    return () => {
      this.subscribers.delete(callback)
    }
  }

  /**
   * Уведомляет всех подписчиков
   */
  private notifySubscribers(): void {
    const logsCopy = [...this.logs]
    this.subscribers.forEach(callback => {
      try {
        callback(logsCopy)
      } catch (error) {
        console.error('Error in log subscriber:', error)
      }
    })
  }
}

// Singleton instance
export const loggerService = new LoggerService()
