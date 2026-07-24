import type {verifyCloudProof as verifyCloudProofValue} from '@worldcoin/idkit-core/backend'
import type {
  MiniAppVerifyActionPayload,
  MiniAppWalletAuthPayload,
  MiniAppWalletAuthSuccessPayload,
} from '@worldcoin/minikit-js'
import {AUTH_DEBUG_ENABLED, logAuthDebug} from '@/lib/server-debug'
import {getWorldcoinServerConfig} from '@/lib/worldcoin/config'

type CloudProofInput = Parameters<typeof verifyCloudProofValue>[0]

export interface WalletAuthVerificationResult {
  isValid: boolean
  address?: string
  reason?: string
}

export async function verifyWalletAuthPayload(
  payload: MiniAppWalletAuthPayload,
  nonce: string,
): Promise<WalletAuthVerificationResult> {
  if (!payload || payload.status !== 'success') {
    return {isValid: false, reason: 'wallet-auth-error'}
  }

  try {
    const {verifySiweMessage} = await import('@worldcoin/minikit-js')
    const siweResult = await verifySiweMessage(payload as MiniAppWalletAuthSuccessPayload, nonce)
    if (!siweResult.isValid) {
      if (AUTH_DEBUG_ENABLED) {
        logAuthDebug('worldcoin:wallet-auth:invalid', {reason: 'siwe-invalid'})
      }
      return {isValid: false, reason: 'siwe-invalid'}
    }

    if (AUTH_DEBUG_ENABLED) {
      logAuthDebug('worldcoin:wallet-auth:success', {
        address: payload.address,
      })
    }

    return {
      isValid: true,
      address: payload.address,
    }
  } catch (error) {
    if (AUTH_DEBUG_ENABLED) {
      logAuthDebug('worldcoin:wallet-auth:error', {
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    }
    return {isValid: false, reason: 'siwe-exception'}
  }
}

export async function verifyWorldcoinProof(payload: MiniAppVerifyActionPayload) {
  if (!payload || payload.status !== 'success') {
    return {success: false, code: 'invalid_proof_payload'} as const
  }

  const config = getWorldcoinServerConfig()
  const {verifyCloudProof} = await import('@worldcoin/idkit-core/backend')

  const proofPayload: CloudProofInput = {
    proof: payload.proof,
    merkle_root: payload.merkle_root,
    nullifier_hash: payload.nullifier_hash,
    verification_level: payload.verification_level,
  }

  const response = await verifyCloudProof(
    proofPayload,
    config.appId,
    config.actionId,
    undefined,
    undefined,
    config.secret ? {Authorization: `Bearer ${config.secret}`} : undefined,
  )

  if (AUTH_DEBUG_ENABLED) {
    logAuthDebug('worldcoin:proof:result', {
      success: response.success,
      code: response.code,
      level: payload.verification_level,
    })
  }

  return response
}
