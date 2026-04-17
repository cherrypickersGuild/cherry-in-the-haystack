/**
 * NEAR Connect wrapper — singleton NearConnector + helpers
 *
 * 프론트엔드에서 NEAR 지갑 연결 / 직접 서명을 지원.
 * 기존 MetaMask 흐름(Status Network)과 병행 — 체인 토글로 구분.
 */
"use client"

import { NearConnector, type NearWalletBase } from "@hot-labs/near-connect"

const NETWORK = "testnet" as const
const CONTRACT_ID = process.env.NEXT_PUBLIC_NEAR_CONTRACT_ID ?? "tomatojams.testnet"

// 기본 manifest (hot-dao) — MyNearWallet이 포함돼 있지만 features.testnet 플래그가 빠져 있어
// testnet 모드에서 필터링되므로 런타임에 패치한다.
const DEFAULT_MANIFEST_URL =
  "https://raw.githubusercontent.com/hot-dao/near-selector/refs/heads/main/repository/manifest.json"

let _connector: NearConnector | null = null
let _connectorPromise: Promise<NearConnector> | null = null
let _windowOpenPatched = false

/**
 * MNW/기타 wallet sandbox가 `window.open()`에 고정 width/height를 넘기는 탓에
 * Next 버튼이 가려지는 문제 해결: wallet URL일 경우 features 문자열을 리사이즈.
 */
function patchWindowOpenForWallets() {
  if (_windowOpenPatched) return
  if (typeof window === "undefined") return
  _windowOpenPatched = true

  const original = window.open.bind(window)
  const WALLET_DOMAINS = [
    "mynearwallet.com",
    "meteorwallet.app",
    "wallet.intear.tech",
    "okx.com",
    "hot-labs.org",
  ]
  const TARGET_W = 540
  const TARGET_H = 820

  window.open = function patchedOpen(
    url?: string | URL,
    target?: string,
    features?: string,
  ): Window | null {
    try {
      const urlStr = typeof url === "string" ? url : url?.toString() ?? ""
      const isWallet = WALLET_DOMAINS.some((d) => urlStr.includes(d))
      if (isWallet && typeof features === "string") {
        // 화면 중앙에 맞춘 top/left
        const left = Math.max(0, Math.round((window.screen.availWidth - TARGET_W) / 2))
        const top = Math.max(0, Math.round((window.screen.availHeight - TARGET_H) / 2))
        const replaced = features
          .replace(/width=\d+/i, `width=${TARGET_W}`)
          .replace(/height=\d+/i, `height=${TARGET_H}`)
          .replace(/top=\d+/i, `top=${top}`)
          .replace(/left=\d+/i, `left=${left}`)
        return original(url as any, target, replaced)
      }
    } catch {
      /* fall through */
    }
    return original(url as any, target, features)
  } as typeof window.open
}

/** 기본 manifest fetch + MyNearWallet에 testnet 지원 플래그 + 허용 URL 주입 */
async function loadPatchedManifest(): Promise<{ wallets: any[]; version: string }> {
  const res = await fetch(DEFAULT_MANIFEST_URL)
  if (!res.ok) throw new Error(`Failed to load NEAR manifest: ${res.status}`)
  const m = await res.json()
  const mnw = m.wallets?.find((w: any) => w.id === "mynearwallet")
  if (mnw) {
    mnw.features = { ...mnw.features, testnet: true, mainnet: true }
    // testnet MNW URL + 추가 도메인을 허용해야 sandbox executor가 "Permission denied" 안 냄
    const existingAllowsOpen: string[] = mnw.permissions?.allowsOpen ?? []
    mnw.permissions = {
      ...mnw.permissions,
      allowsOpen: Array.from(
        new Set([
          ...existingAllowsOpen,
          "https://app.mynearwallet.com",
          "https://testnet.mynearwallet.com",
          "https://mynearwallet.com",
        ]),
      ),
    }
  }
  return m
}

/** 싱글톤 커넥터 반환. SSR 환경에서는 null. */
export async function getNearConnector(): Promise<NearConnector | null> {
  if (typeof window === "undefined") return null
  patchWindowOpenForWallets()
  if (_connector) return _connector
  if (!_connectorPromise) {
    _connectorPromise = (async () => {
      let manifest: { wallets: any[]; version: string } | undefined
      try {
        manifest = await loadPatchedManifest()
      } catch (e) {
        console.warn("[near-connector] manifest patch failed, falling back to default", e)
      }
      _connector = new NearConnector({
        network: NETWORK,
        ...(manifest ? { manifest } : {}),
      })
      return _connector
    })()
  }
  return _connectorPromise
}

/** 지갑 팝업 띄우기 → 유저가 지갑 선택 + 로그인 → accountId 반환 */
export async function connectNearWallet(): Promise<string> {
  const c = await getNearConnector()
  if (!c) throw new Error("NEAR connector unavailable (SSR)")
  let wallet: NearWalletBase
  try {
    // walletId 지정 → 지갑 선택 셀렉터 팝업 스킵, 바로 MyNearWallet 로그인 페이지로 리다이렉트
    // (검증된 지갑만 노출해서 데모 안정성 확보)
    wallet = await c.connect({ walletId: "mynearwallet" })
  } catch (e: any) {
    console.error("[near-connector] c.connect() failed:", e)
    throw new Error(
      `connect() failed: ${e?.message ?? e?.name ?? JSON.stringify(e)}`,
    )
  }
  let accounts: Array<{ accountId: string }> = []
  try {
    accounts = await wallet.getAccounts()
  } catch (e: any) {
    console.error("[near-connector] wallet.getAccounts() failed:", e)
    throw new Error(
      `getAccounts() failed: ${e?.message ?? e?.name ?? JSON.stringify(e)}`,
    )
  }
  const accountId = accounts?.[0]?.accountId
  if (!accountId) throw new Error("No NEAR account returned from wallet")
  return accountId
}

/** 기존 연결 세션이 있으면 accountId 반환, 없으면 null */
export async function getConnectedNearAccount(): Promise<string | null> {
  const c = await getNearConnector()
  if (!c) return null
  try {
    const { accounts } = await c.getConnectedWallet()
    return accounts?.[0]?.accountId ?? null
  } catch {
    return null
  }
}

/** 현재 연결된 지갑 인스턴스 반환 */
async function getWallet(): Promise<NearWalletBase> {
  const c = await getNearConnector()
  if (!c) throw new Error("NEAR connector unavailable")
  return c.wallet()
}

/** NEAR 지갑 연결 해제 */
export async function disconnectNearWallet(): Promise<void> {
  const c = await getNearConnector()
  if (!c) return
  try {
    await c.disconnect()
  } catch {
    /* ignore */
  }
}

/**
 * NEAR 컨트랙트 메서드 호출 서명.
 * 유저 지갑 팝업 → 승인 → tx hash 반환.
 *
 * 주의: CONTRACT_ID가 실제 배포된 컨트랙트가 아니면 "Method not found"로 실패한다.
 * 데모/testnet 환경에서는 `signAndSendNearProvenance()`를 권장.
 */
export async function signAndSendNearFunctionCall(params: {
  methodName: string
  args: Record<string, unknown>
  receiverId?: string
  gasTgas?: number
  depositYocto?: string
}): Promise<{ txHash: string; explorerUrl: string }> {
  const wallet = await getWallet()
  const receiverId = params.receiverId ?? CONTRACT_ID
  const gas = String(BigInt(params.gasTgas ?? 30) * BigInt(1e12)) // 30 TGas default
  const deposit = params.depositYocto ?? "0"

  const outcome: any = await wallet.signAndSendTransaction({
    network: NETWORK,
    receiverId,
    actions: [
      {
        type: "FunctionCall",
        params: {
          methodName: params.methodName,
          args: params.args,
          gas,
          deposit,
        },
      } as any,
    ],
  })

  const txHash =
    outcome?.transaction?.hash ??
    outcome?.transaction_outcome?.id ??
    outcome?.final_execution_status ??
    ""
  const explorerUrl = txHash ? `https://testnet.nearblocks.io/txns/${txHash}` : ""
  return { txHash, explorerUrl }
}

/**
 * Provenance 용도의 NEAR 트랜잭션 — self-transfer of 1 yoctoNEAR.
 *
 * 컨트랙트 배포 없이도 항상 성공하는 최소 트랜잭션.
 * 유저가 NEAR 지갑으로 명시 승인했다는 on-chain 증거이며,
 * testnet.nearblocks.io에서 tx hash로 조회 가능.
 *
 * 데모/해커톤 환경에서 "NEAR 지갑이 직접 서명했다"는 provenance가 필요할 때 사용.
 * 프로덕션에서는 실제 KaaS 컨트랙트의 consumeCredit 호출로 교체.
 */
export async function signAndSendNearProvenance(memo?: string): Promise<{
  txHash: string
  explorerUrl: string
  signerId: string
}> {
  const wallet = await getWallet()
  const accounts = await wallet.getAccounts({ network: NETWORK })
  const signerId = accounts?.[0]?.accountId
  if (!signerId) throw new Error("NEAR wallet not connected")

  if (memo) console.log(`[NEAR provenance] memo=${memo}`)

  let outcome: any
  let txHash = ""
  try {
    outcome = await wallet.signAndSendTransaction({
      network: NETWORK,
      signerId,
      receiverId: signerId, // self-transfer
      actions: [
        {
          type: "Transfer",
          params: { deposit: "1" }, // 1 yoctoNEAR — 실질 0원
        } as any,
      ],
    })
    console.log("[NEAR provenance] outcome:", outcome)

    const firstArr = Array.isArray(outcome) ? outcome[0] : null
    txHash =
      outcome?.transaction?.hash ??
      outcome?.transaction_outcome?.id ??
      outcome?.transactionHashes?.[0] ??
      outcome?.hash ??
      outcome?.id ??
      firstArr?.transaction?.hash ??
      firstArr?.transaction_outcome?.id ??
      ""
  } catch (e: any) {
    // @hot-labs/near-connect는 tx 제출 직후 RPC로 status를 polling하는데,
    // NEAR 노드 인덱싱 지연으로 "Transaction <hash> doesn't exist" 에러를 던질 때가 있다.
    // 이 경우 tx는 실제로 on-chain에 제출됐고 곧 확정되므로, 에러 메시지에서 hash를 복구해 진행.
    const msg: string = e?.message ?? String(e)
    const match = msg.match(/Transaction ([A-HJ-NP-Za-km-z1-9]{40,50})\s+doesn['']t\s+exist/i)
    if (match) {
      txHash = match[1]
      console.warn(
        `[NEAR provenance] RPC polling race — tx submitted but not yet indexed. Recovered hash from error: ${txHash}`,
      )
    } else {
      console.error("[NEAR provenance] signAndSendTransaction failed:", e)
      throw e
    }
  }

  if (!txHash) {
    console.error("[NEAR provenance] Could not extract tx hash from outcome:", outcome)
    throw new Error(
      "NEAR tx signed but hash not found in outcome. Check console for outcome shape.",
    )
  }

  const explorerUrl = `https://testnet.nearblocks.io/txns/${txHash}`
  return { txHash, explorerUrl, signerId }
}
