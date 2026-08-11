import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { orderService, OrderTransitionConflictError } from '@/lib/services/order-service'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let reason = ''
  try {
    const body = await req.json()
    reason = typeof body?.reason === 'string' ? body.reason.trim() : ''
  } catch {
    reason = ''
  }
  if (!reason) {
    return NextResponse.json({ error: 'reason is required' }, { status: 400 })
  }

  try {
    const order = await orderService.rejectOrder(id, user.id, reason)
    return NextResponse.json({ order })
  } catch (error) {
    if (error instanceof OrderTransitionConflictError) {
      return NextResponse.json({ error: 'already transitioned' }, { status: 409 })
    }
    const message = error instanceof Error ? error.message : 'Error rechazando pedido'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
