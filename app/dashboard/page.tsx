'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Order {
  id: string
  customer_phone: string
  items: any[]
  total: number
  status: string
  created_at: string
}

export default function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchOrders()
  }, [])

  async function fetchOrders() {
    try {
      const { data, error } = await supabase
        .from('pedidos')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setOrders(data || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  async function approveOrder(id: string) {
    const { error } = await supabase
      .from('pedidos')
      .update({ status: 'approved' })
      .eq('id', id)

    if (!error) {
      await fetchOrders()
    }
  }

  if (loading) return <div>Cargando...</div>

  return (
    
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Dashboard de Pedidos</h1>
      
      <div className="grid gap-4">
        {orders.map((order) => (
          <div key={order.id} className="border rounded-lg p-4 shadow">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium">{order.customer_phone}</p>
                <p className="text-sm text-gray-500">
                  {new Date(order.created_at).toLocaleString()}
                </p>
                <p className="text-sm">Productos: {order.items.length}</p>
                <p className="font-bold text-lg">${order.total.toFixed(2)}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`px-2 py-1 rounded text-sm ${
                  order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  order.status === 'approved' ? 'bg-green-100 text-green-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {order.status}
                </span>
                {order.status === 'pending' && (
                  <button
                    onClick={() => approveOrder(order.id)}
                    className="bg-blue-500 text-white px-4 py-1 rounded text-sm hover:bg-blue-600"
                  >
                    Aprobar
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    <p>holas</p>
    </div>
  )
}