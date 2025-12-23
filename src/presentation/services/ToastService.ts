export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number // в миллисекундах, 0 = бесконечно
  timestamp: Date
}

/**
 * Сервис для управления Toast-уведомлениями
 */
export class ToastService {
  private toasts: Toast[] = []
  private subscribers: Set<(toasts: Toast[]) => void> = new Set()

  /**
   * Показать уведомление
   */
  show(type: ToastType, title: string, message?: string, duration: number = 5000): void {
    const toast: Toast = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      title,
      message,
      duration,
      timestamp: new Date(),
    }

    this.toasts.push(toast)
    this.notifySubscribers()

    // Автоматически удаляем toast после duration
    if (duration > 0) {
      setTimeout(() => {
        this.remove(toast.id)
      }, duration)
    }
  }

  /**
   * Показать успешное уведомление
   */
  success(title: string, message?: string, duration?: number): void {
    this.show('success', title, message, duration)
  }

  /**
   * Показать ошибку
   */
  error(title: string, message?: string, duration?: number): void {
    this.show('error', title, message, duration || 7000)
  }

  /**
   * Показать предупреждение
   */
  warning(title: string, message?: string, duration?: number): void {
    this.show('warning', title, message, duration)
  }

  /**
   * Показать информацию
   */
  info(title: string, message?: string, duration?: number): void {
    this.show('info', title, message, duration)
  }

  /**
   * Удалить уведомление
   */
  remove(id: string): void {
    this.toasts = this.toasts.filter(t => t.id !== id)
    this.notifySubscribers()
  }

  /**
   * Очистить все уведомления
   */
  clear(): void {
    this.toasts = []
    this.notifySubscribers()
  }

  /**
   * Получить все уведомления
   */
  getAll(): Toast[] {
    return [...this.toasts]
  }

  /**
   * Подписаться на изменения
   */
  subscribe(callback: (toasts: Toast[]) => void): () => void {
    this.subscribers.add(callback)
    
    return () => {
      this.subscribers.delete(callback)
    }
  }

  /**
   * Уведомить подписчиков
   */
  private notifySubscribers(): void {
    const toastsCopy = [...this.toasts]
    this.subscribers.forEach(callback => {
      try {
        callback(toastsCopy)
      } catch (error) {
        console.error('Error in toast subscriber:', error)
      }
    })
  }
}

// Singleton instance
export const toastService = new ToastService()
