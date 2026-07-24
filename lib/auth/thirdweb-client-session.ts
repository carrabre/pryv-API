import {signLoginPayload, type LoginPayload} from 'thirdweb/auth'
import type {Account} from 'thirdweb/wallets'

export type ThirdwebServerSessionResult =
  | {ok: true; status: number}
  | {ok: false; status: number; errorCode?: string; error?: string}

let sessionCreateQueue: Promise<unknown> = Promise.resolve()

async function parseJson(response: Response): Promise<any> {
  return response.json().catch(() => null)
}

function queueSessionCreation<T>(task: () => Promise<T>): Promise<T> {
  const queued = sessionCreateQueue.catch(() => undefined).then(task)
  sessionCreateQueue = queued.catch(() => undefined)
  return queued
}

async function createThirdwebServerSessionNow(
  account: Account,
  authMethod = 'thirdweb',
): Promise<ThirdwebServerSessionResult> {
  if (!account?.address) {
    return {ok: false, status: 0, errorCode: 'wallet_not_connected'}
  }

  const payloadResponse = await fetch('/api/auth/thirdweb/payload', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    cache: 'no-store',
    credentials: 'include',
    body: JSON.stringify({address: account.address}),
  })
  const payloadBody = (await parseJson(payloadResponse)) as {
    payload?: LoginPayload
    errorCode?: string
    error?: string
  } | null

  if (!payloadResponse.ok || !payloadBody?.payload) {
    return {
      ok: false,
      status: payloadResponse.status,
      errorCode: payloadBody?.errorCode ?? 'login_payload_failed',
      error: payloadBody?.error,
    }
  }

  const signedPayload = await signLoginPayload({
    account,
    payload: payloadBody.payload,
  })

  const sessionResponse = await fetch('/api/auth/thirdweb', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    cache: 'no-store',
    credentials: 'include',
    body: JSON.stringify({...signedPayload, authMethod}),
  })

  if (sessionResponse.ok) {
    return {ok: true, status: sessionResponse.status}
  }

  const sessionBody = (await parseJson(sessionResponse)) as {
    errorCode?: string
    error?: string
  } | null
  return {
    ok: false,
    status: sessionResponse.status,
    errorCode: sessionBody?.errorCode ?? 'session_create_failed',
    error: sessionBody?.error,
  }
}

export async function createThirdwebServerSession(
  account: Account,
  authMethod = 'thirdweb',
): Promise<ThirdwebServerSessionResult> {
  return queueSessionCreation(() => createThirdwebServerSessionNow(account, authMethod))
}
