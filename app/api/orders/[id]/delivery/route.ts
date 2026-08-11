import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { orderService } from '@/lib/services/order-service'
import type { DeliveryStatus } from '@/lib/types'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { assigned_to?: unknown; delivery_status?: unknown; delivery_eta?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const assigned_to = typeof body.assigned_to === 'string' ? body.assigned_to.trim() : ''
  if (!assigned_to) {
    return NextResponse.json({ error: 'assigned_to is required' }, { status: 400 })
  }
  const delivery_status = (typeof body.delivery_status === 'string' ? body.delivery_status : null) as DeliveryStatus
  const delivery_eta = typeof body.delivery_eta === 'string' ? body.delivery_eta : null

  try {
    const order = await orderService.assignDelivery(id, user.id, {
      assigned_to,
      delivery_status,
      delivery_eta,
    })
    return NextResponse.json({ order })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error asignando entrega'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
