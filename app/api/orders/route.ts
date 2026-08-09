import { NextResponse } from 'next/server'
import { orderService, UnknownSkuError } from '@/lib/services/order-service'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

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
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const body = await req.json()
    const items = Array.isArray(body?.items)
      ? body.items.map((it: { sku?: unknown; quantity?: unknown }) => ({
          sku: String(it?.sku ?? ''),
          quantity: Number(it?.quantity ?? 0),
        }))
      : []

    const order = await orderService.createManualOrder(user.id, {
      customer_name: body?.customer_name ?? null,
      customer_phone: body?.customer_phone ?? null,
      delivery_address: body?.delivery_address ?? null,
      items,
    })
    return NextResponse.json({ order })
  } catch (error) {
    if (error instanceof UnknownSkuError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    const message = error instanceof Error ? error.message : 'Error creando pedido'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}