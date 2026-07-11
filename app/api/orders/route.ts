import { NextResponse } from 'next/server'
import { orderService } from '@/lib/services/order-service'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const orders = await orderService.getPendingOrders()
    return NextResponse.json({ orders })
  } catch (error) {
    return NextResponse.json(
      { error: 'Error obteniendo pedidos' },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { data: order, error } = await supabase
      .from('pedidos')
      .insert({
        ...body,
        created_by: user.id,
        status: 'pending'
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ order })
  } catch (error) {
    return NextResponse.json(
      { error: 'Error creando pedido' },
      { status: 500 }
    )
  }
}