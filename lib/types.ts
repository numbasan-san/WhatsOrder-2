export type OrderStatus = 'pending_confirmation' | 'pending' | 'approved' | 'rejected' | 'cancelled'
export type DeliveryStatus = 'pending' | 'assigned' | 'in_transit' | 'delivered' | null

export interface Producto {
  id: string; sku: string; name: string; price: number; stock: number; active: boolean
}
export interface OrderItem {
  sku: string; product: string; quantity: number; price: number; subtotal: number
}
export interface Pedido {
  id: string
  customer_name: string | null
  customer_phone: string | null
  telegram_chat_id: string | null
  customer_email: string | null
  customer_cedula: string | null
  items: OrderItem[]
  total: number
  status: OrderStatus
  source: string | null
  delivery_address: string | null
  delivery_city: string | null
  delivery_zone: string | null
  delivery_instructions: string | null
  delivery_assigned_to: string | null
  delivery_status: DeliveryStatus
  delivery_eta: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  confirmed_at: string | null
  approved_by: string | null
  approved_at: string | null
  rejected_by: string | null
  rejected_at: string | null
  rejection_reason: string | null
}
