import type { ReportSaleRepository } from '@infrastructure/repositories/ReportSaleRepository'
import type { ReportReturnRepository } from '@infrastructure/repositories/ReportReturnRepository'
import type { IOrderRepository } from '@core/domain/repositories/IWBRepository'
import type { IExpenseRepository } from '@core/domain/repositories/IWBRepository'

export interface PnLResult {
  revenue: number
  expenses: number
  profit: number
  margin: number
  period: {
    from: string
    to: string
  }
}

export interface CalculatePnLOptions {
  dateFrom: string
  dateTo: string
}

export class CalculatePnLUseCase {
  constructor(
    private saleRepository: ReportSaleRepository,
    private returnRepository: ReportReturnRepository,
    private orderRepository: IOrderRepository,
    private expenseRepository: IExpenseRepository
  ) {}

  async execute(options: CalculatePnLOptions): Promise<PnLResult> {
    const { dateFrom, dateTo } = options

    // Получаем продажи за период
    const sales = await this.saleRepository.getByDateRange(dateFrom, dateTo)
    
    // Получаем возвраты за период
    const returns = await this.returnRepository.getByDateRange(dateFrom, dateTo)
    
    // Получаем заказы за период (для расчета отмененных заказов)
    const orders = await this.orderRepository.getByDateRange(dateFrom, dateTo)
    
    // Получаем расходы за период
    const expenses = await this.expenseRepository.getByDateRange(dateFrom, dateTo)

    // Выручка = сумма ppvz_for_pay (к выплате) по продажам
    const revenue = sales.reduce((sum, sale) => sum + (sale.ppvz_for_pay || 0), 0)

    // Расходы = сумма всех расходов + возвраты (ppvz_for_pay по возвратам) + отмененные заказы
    const returnsAmount = returns.reduce((sum, ret) => sum + (ret.ppvz_for_pay || 0), 0)
    const cancelledOrders = orders.filter(order => order.isCancel)
    const cancelledOrdersAmount = cancelledOrders.reduce((sum, order) => sum + (order.finishedPrice || 0), 0)
    const expensesAmount = expenses.reduce((sum, expense) => sum + (expense.sum || 0), 0)
    const totalExpenses = expensesAmount + returnsAmount + cancelledOrdersAmount

    // Прибыль = Выручка - Расходы
    const profit = revenue - totalExpenses

    // Маржа = (Прибыль / Выручка) * 100
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0

    return {
      revenue,
      expenses: totalExpenses,
      profit,
      margin: Math.round(margin * 100) / 100,
      period: {
        from: dateFrom,
        to: dateTo,
      },
    }
  }
}
