import { db } from '../db/database'
import type { Expense } from '@core/domain/entities/Expense'
import type { IExpenseRepository } from '@core/domain/repositories/IWBRepository'

export class ExpenseRepository implements IExpenseRepository {
  async getAll(): Promise<Expense[]> {
    return await db.advExpenses.toArray()
  }

  async getById(id: number): Promise<Expense | undefined> {
    return await db.advExpenses.get(id)
  }

  async create(expense: Expense): Promise<number> {
    return await db.advExpenses.add(expense)
  }

  async createMany(expenses: Expense[]): Promise<number> {
    return await db.advExpenses.bulkAdd(expenses)
  }

  async update(expense: Expense): Promise<void> {
    if (expense.id) {
      await db.advExpenses.update(expense.id, expense)
    }
  }

  async delete(id: number): Promise<void> {
    await db.advExpenses.delete(id)
  }

  async clear(): Promise<void> {
    await db.advExpenses.clear()
  }

  async getByDateRange(from: string, to: string): Promise<Expense[]> {
    return await db.advExpenses
      .where('date')
      .between(from, to, true, true)
      .toArray()
  }
}
