import type { Order } from '../entities/Order'
import type { Sale } from '../entities/Sale'
import type { Expense } from '../entities/Expense'
import type { Storage } from '../entities/Storage'
import type { Acceptance } from '../entities/Acceptance'
import type { Product } from '../entities/Product'

export interface IOrderRepository {
  getAll(): Promise<Order[]>
  getById(id: number): Promise<Order | undefined>
  create(order: Order): Promise<number>
  createMany(orders: Order[]): Promise<number>
  update(order: Order): Promise<void>
  delete(id: number): Promise<void>
  clear(): Promise<void>
  getByDateRange(from: string, to: string): Promise<Order[]>
}

export interface ISaleRepository {
  getAll(): Promise<Sale[]>
  getById(id: number): Promise<Sale | undefined>
  create(sale: Sale): Promise<number>
  createMany(sales: Sale[]): Promise<number>
  update(sale: Sale): Promise<void>
  delete(id: number): Promise<void>
  clear(): Promise<void>
  getByDateRange(from: string, to: string): Promise<Sale[]>
}

export interface IExpenseRepository {
  getAll(): Promise<Expense[]>
  getById(id: number): Promise<Expense | undefined>
  create(expense: Expense): Promise<number>
  createMany(expenses: Expense[]): Promise<number>
  update(expense: Expense): Promise<void>
  delete(id: number): Promise<void>
  clear(): Promise<void>
  getByDateRange(from: string, to: string): Promise<Expense[]>
}

export interface IStorageRepository {
  getAll(): Promise<Storage[]>
  getById(id: number): Promise<Storage | undefined>
  create(storage: Storage): Promise<number>
  createMany(storages: Storage[]): Promise<number>
  update(storage: Storage): Promise<void>
  delete(id: number): Promise<void>
  clear(): Promise<void>
}

export interface IAcceptanceRepository {
  getAll(): Promise<Acceptance[]>
  getById(id: number): Promise<Acceptance | undefined>
  create(acceptance: Acceptance): Promise<number>
  createMany(acceptances: Acceptance[]): Promise<number>
  update(acceptance: Acceptance): Promise<void>
  delete(id: number): Promise<void>
  clear(): Promise<void>
  getByDateRange(from: string, to: string): Promise<Acceptance[]>
}

export interface IProductRepository {
  getAll(): Promise<Product[]>
  getById(id: number): Promise<Product | undefined>
  getByNmId(nmId: number): Promise<Product | undefined>
  create(product: Product): Promise<number>
  createMany(products: Product[]): Promise<number>
  update(product: Product): Promise<void>
  delete(id: number): Promise<void>
  clear(): Promise<void>
}
