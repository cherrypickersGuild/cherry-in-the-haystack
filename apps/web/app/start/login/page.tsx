"use client"

import { useCallback, useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { API_URL, setAccessToken } from "@/lib/auth"
import { CherryBao } from "@/components/cherry/cherry-bao"
import { GoogleLoginButton } from "@/components/auth/google-login-button"

function StartLoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [step, setStep] = useState<"input" | "verifying" | "error">("input")
  const [errorMsg, setErrorMsg] = useState("")

  // 로그인 성공 후 이동 — /start/login?next=/start/... 저장
  useEffect(() => {
    const nextFromUrl = searchParams.get("next")
    if (nextFromUrl && nextFromUrl.startsWith("/")) {
      try { localStorage.setItem("cherry_login_next", nextFromUrl) } catch { /* noop */ }
    }
  }, [searchParams])

  const goAfterLogin = useCallback(() => {
    let dest = "/start"
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
          setErrorMsg(data.message ?? "Sign in failed.")
          setStep("error")
        }
      })
      .catch(() => {
        setErrorMsg("Couldn't reach the server.")
        setStep("error")
      })
  }, [searchParams, goAfterLogin])

  return (
    <div
      className="flex flex-col items-center"
      style={{ paddingTop: 32, paddingBottom: 64 }}
    >
      <div className="w-full max-w-[440px]">
        <div
          className="rounded-[24px] bg-[#FDFBF5]"
          style={{ border: "1px solid #E9D1A6", boxShadow: "0 10px 30px rgba(107,79,42,0.10)", padding: 28 }}
        >
          {step === "input" && (
            <>
              <div
                className="flex flex-col items-center text-center"
                style={{ marginBottom: 20 }}
              >
                <CherryBao size={80} animate />
              </div>
              <h1 className="text-[22px] font-extrabold text-[#3A2A1C] text-center">
                Continue with Google
              </h1>
              <p
                className="text-[13px] text-[#6B4F2A] leading-relaxed text-center"
                style={{ marginTop: 6 }}
              >
                No password needed. Sign in with your Google account.
                <br />
                First time here? You get signed up automatically and <b className="text-[#C8301E]">200 credits</b> land in your account.
              </p>

              <div className="mt-6 flex flex-col items-center gap-3">
                <GoogleLoginButton
                  onStart={() => setStep("verifying")}
                  onSuccess={goAfterLogin}
                  onError={(m) => { setErrorMsg(m); setStep("error") }}
                />
                {errorMsg && (
                  <p className="text-[12px] text-[#C8301E]">{errorMsg}</p>
                )}
              </div>
            </>
          )}

          {step === "verifying" && (
            <div className="text-center py-6">
              <CherryBao size={72} variant="sleeping" animate />
              <h2 className="mt-3 text-[18px] font-extrabold text-[#3A2A1C]">Signing in…</h2>
            </div>
          )}

          {step === "error" && (
            <div className="text-center py-2">
              <CherryBao size={72} variant="confused" />
              <h2 className="mt-3 text-[20px] font-extrabold text-[#3A2A1C]">Sign in failed</h2>
              <p className="mt-2 text-[13px] text-[#6B4F2A]">{errorMsg}</p>
              <button
                onClick={() => { setErrorMsg(""); setStep("input") }}
                className="mt-5 text-[12px] font-bold text-[#C8301E] hover:underline"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function StartLoginPage() {
  return (
    <Suspense>
      <StartLoginContent />
    </Suspense>
  )
}
