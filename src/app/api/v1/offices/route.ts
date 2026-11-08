import { z } from 'zod'
import { db } from '@/lib/db'
import { handleRoute, ok } from '@/lib/api'
import { assertSameOrigin, requireAuth, requireRole } from '@/lib/auth'
import { audit } from '@/lib/notify'

/** GET /api/v1/offices */
export const GET = handleRoute(async (req) => {
  const authed = await requireAuth(req)
  requireRole(authed, 'HR_ADMIN')
  const offices = await db.office.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { users: true } } } })
  return ok({ items: offices })
})

const officeSchema = z.object({
  name: z.string().min(2),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusMeters: z.number().int().min(10).max(5000).default(25),
  timezone: z.string().default('Asia/Kolkata'),
})

/** POST /api/v1/offices */
export const POST = handleRoute(async (req) => {
  assertSameOrigin(req)
  const authed = await requireAuth(req)
  requireRole(authed, 'HR_ADMIN')
  const body = await req.json().catch(() => ({}))
  const input = officeSchema.parse(body)
  const office = await db.office.create({ data: input })
  await audit(authed.id, 'OFFICE_CREATED', 'Office', office.id, null, office)
  return ok(office, { status: 201 })
})
