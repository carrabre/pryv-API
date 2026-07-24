import 'server-only'

export async function getLegacyNextAuthSession() {
  const {auth} = await import('@/app/(auth)/auth')
  return auth()
}
