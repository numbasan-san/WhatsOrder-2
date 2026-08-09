import type { OrderStatus } from '@/lib/types'
const ALLOWED: Record<OrderStatus, OrderStatus[]> = {
  pending_confirmation: ['pending', 'cancelled'],
  pending: ['approved', 'rejected'],
  approved: [], rejected: [], cancelled: [],
}
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false
}
