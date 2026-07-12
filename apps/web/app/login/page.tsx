"use client"

import { useCallback, useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { API_URL, setAccessToken } from "@/lib/auth"
import { GoogleLoginButton } from "@/components/auth/google-login-button"

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [step, setStep] = useState<"input" | "verifying" | "error">("input")
  const [errorMsg, setErrorMsg] = useState("")

  // 로그인 성공 후 돌아갈 경로 — /login?next=/start 저장
  useEffect(() => {
    const nextFromUrl = searchParams.get("next")
    if (nextFromUrl && nextFromUrl.startsWith("/")) {
      try { localStorage.setItem("cherry_login_next", nextFromUrl) } catch { /* noop */ }
    }
  }, [searchParams])

  const goAfterLogin = useCallback(() => {
    let dest = "/"
    try {
      const saved = localStorage.getItem("cherry_login_next")
      if (saved && saved.startsWith("/")) {
        dest = saved
        localStorage.removeItem("cherry_login_next")
      }
    } catch { /* noop */ }
    router.push(dest)
  }, [router])

  // 매직링크(?token=&email=) 자동 로그인 — 백엔드 매직링크는 유지되므로 그대로 처리
  useEffect(() => {
    const tokenFromUrl = searchParams.get("token")
    const emailFromUrl = searchParams.get("email")
    if (!tokenFromUrl || !emailFromUrl) return

    setStep("verifying")
    fetch(`${API_URL}/api/app-user/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email: emailFromUrl, signInToken: tokenFromUrl }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.accessToken) {
          setAccessToken(data.accessToken)
          goAfterLogin()
        } else {
          setErrorMsg(data.message ?? "로그인에 실패했습니다.")
          setStep("error")
        }
      })
      .catch(() => {
        setErrorMsg("서버 연결에 실패했습니다.")
        setStep("error")
      })
  }, [searchParams, goAfterLogin])

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#FBFAF8" }}>
      <div className="w-full max-w-md" style={{ paddingLeft: 24, paddingRight: 24 }}>
        {/* 로고 */}
        <div className="text-center" style={{ marginBottom: 40 }}>
          <div className="flex items-center justify-center" style={{ gap: 8, marginBottom: 12 }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="14" fill="#C94B6E" />
              <circle cx="14" cy="11" r="5" fill="white" />
              <rect x="11" y="18" width="6" height="1.5" rx="0.75" fill="white" />
            </svg>
            <span className="text-[22px] font-extrabold text-[#1A1626] tracking-tight">Cherry</span>
          </div>
          <p className="text-[13px] text-[#7B7599]">Knowledge Platform for AI Engineers</p>
        </div>

        {/* 카드 */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E4E1EE] p-8">

          {step === "input" && (
            <>
              <h2 className="text-[18px] font-bold text-[#1A1626] mb-1">로그인 / 가입</h2>
              <p className="text-[13px] text-[#7B7599] mb-6">
                Google 계정으로 로그인하세요.<br />
                처음 이용하시면 자동으로 가입됩니다.
              </p>
              <div className="flex flex-col items-center gap-3">
                <GoogleLoginButton
                  onStart={() => setStep("verifying")}
                  onSuccess={goAfterLogin}
                  onError={(m) => { setErrorMsg(m); setStep("error") }}
                />
                {errorMsg && (
                  <p className="text-[12px] text-[#C94B6E]">{errorMsg}</p>
                )}
              </div>
            </>
          )}

          {/* 매직링크 처리 중 */}
          {step === "verifying" && (
            <div className="text-center py-4">
              <div className="text-4xl mb-4 animate-spin">⏳</div>
              <h2 className="text-[18px] font-bold text-[#1A1626]">로그인 중...</h2>
            </div>
          )}

          {/* 에러 */}
          {step === "error" && (
            <div className="text-center py-4">
              <div className="text-4xl mb-4">❌</div>
              <h2 className="text-[18px] font-bold text-[#1A1626] mb-2">로그인 실패</h2>
              <p className="text-[13px] text-[#7B7599] mb-6">{errorMsg}</p>
              <button
                onClick={() => { setErrorMsg(""); setStep("input") }}
                className="text-[13px] text-[#C94B6E] hover:underline"
              >
                다시 시도하기
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
