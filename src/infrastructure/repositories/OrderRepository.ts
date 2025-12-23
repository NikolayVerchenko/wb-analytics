import { db } from '../db/database'
import type { Order } from '@core/domain/entities/Order'
import type { IOrderRepository } from '@core/domain/repositories/IWBRepository'

export class OrderRepository implements IOrderRepository {
  async getAll(): Promise<Order[]> {
    return await db.orders.toArray()
  }

  async getById(id: number): Promise<Order | undefined> {
    return await db.orders.get(id)
  }

  async create(order: Order): Promise<number> {
    return await db.orders.add(order)
  }

  async createMany(orders: Order[]): Promise<number> {
    return await db.orders.bulkAdd(orders)
  }

  async update(order: Order): Promise<void> {
    if (order.id) {
      await db.orders.update(order.id, order)
    }
  }

  async delete(id: number): Promise<void> {
    await db.orders.delete(id)
  }

  async clear(): Promise<void> {
    await db.orders.clear()
  }

  async getByDateRange(from: string, to: string): Promise<Order[]> {
    return await db.orders
      .where('date')
      .between(from, to, true, true)
      .toArray()
  }
}
