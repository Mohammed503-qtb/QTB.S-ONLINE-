import { ok, handleRouteError } from '@/lib/server/api'
import { destroySession } from '@/lib/server/auth'

export async function POST() {
  try {
    await destroySession()
    return ok({ loggedOut: true })
  } catch (e) {
    return handleRouteError(e)
  }
}
