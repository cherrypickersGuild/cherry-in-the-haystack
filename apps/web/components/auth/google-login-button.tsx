"use client"

import { useCallback, useEffect, useRef } from "react"
import { API_URL, setAccessToken } from "@/lib/auth"

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
const GSI_SRC = "https://accounts.google.com/gsi/client"

// Google Identity Services 전역 타입 (최소)
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (res: { credential?: string }) => void
          }) => void
          renderButton: (
            parent: HTMLElement,
            options: Record<string, unknown>,
          ) => void
        }
      }
    }
  }
}

/**
 * "Google로 로그인" 버튼.
 * - GIS 스크립트를 로드하고 공식 버튼을 렌더
 * - 로그인 성공 시 백엔드(/app-user/google-login)에 idToken 전달 → accessToken 저장
 * - onSuccess(accessToken) 로 상위 페이지가 리다이렉트 처리
 */
export function GoogleLoginButton({
  onSuccess,
  onError,
  onStart,
}: {
  onSuccess: (accessToken: string) => void
  onError?: (message: string) => void
  onStart?: () => void
}) {
  const divRef = useRef<HTMLDivElement>(null)

  const handleCredential = useCallback(
    async (res: { credential?: string }) => {
      if (!res.credential) {
        onError?.("구글 인증 정보를 받지 못했습니다.")
        return
      }
      onStart?.()
      try {
        const r = await fetch(`${API_URL}/api/app-user/google-login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ idToken: res.credential }),
        })
        const data = await r.json().catch(() => ({}))
        if (r.ok && data.accessToken) {
          setAccessToken(data.accessToken)
          onSuccess(data.accessToken)
        } else {
          onError?.(data.message ?? "Google 로그인에 실패했습니다.")
        }
      } catch {
        onError?.("서버 연결에 실패했습니다.")
      }
    },
    [onSuccess, onError, onStart],
  )

  useEffect(() => {
    if (!CLIENT_ID) {
      onError?.("Google Client ID가 설정되지 않았습니다.")
      return
    }

    const render = () => {
      if (!window.google || !divRef.current) return
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: handleCredential,
      })
      window.google.accounts.id.renderButton(divRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "pill",
        logo_alignment: "left",
        width: 320,
      })
    }

    if (window.google?.accounts?.id) {
      render()
      return
    }

    let script = document.querySelector<HTMLScriptElement>(
      `script[src="${GSI_SRC}"]`,
    )
    let created = false
    if (!script) {
      script = document.createElement("script")
      script.src = GSI_SRC
      script.async = true
      script.defer = true
      document.head.appendChild(script)
      created = true
    }
    script.addEventListener("load", render)
    return () => {
      script?.removeEventListener("load", render)
      if (created) {
        /* 스크립트 자체는 재사용 위해 남겨둠 */
      }
    }
  }, [handleCredential, onError])

  return <div ref={divRef} className="flex justify-center" />
}
