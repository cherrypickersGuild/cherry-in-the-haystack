"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { API_URL, setAccessToken } from "@/lib/auth"
import { CherryBao } from "@/components/cherry/cherry-bao"

function StartLoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [email, setEmail] = useState("")
  const [step, setStep] = useState<"input" | "sent" | "verifying" | "error">("input")
  const [errorMsg, setErrorMsg] = useState("")

  // ?next=/start/... 를 이메일 왕복 뒤에도 쓰도록 저장
  useEffect(() => {
    const nextFromUrl = searchParams.get("next")
    if (nextFromUrl && nextFromUrl.startsWith("/")) {
      try { localStorage.setItem("cherry_login_next", nextFromUrl) } catch { /* noop */ }
    }
  }, [searchParams])

  // 매직링크 자동 로그인
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
          let dest = "/start"
          try {
            const saved = localStorage.getItem("cherry_login_next")
            if (saved && saved.startsWith("/")) {
              dest = saved
              localStorage.removeItem("cherry_login_next")
            }
          } catch { /* noop */ }
          router.push(dest)
        } else {
          setErrorMsg(data.message ?? "Sign in failed.")
          setStep("error")
        }
      })
      .catch(() => {
        setErrorMsg("Couldn't reach the server.")
        setStep("error")
      })
  }, [searchParams, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg("")
    try {
      const res = await fetch(`${API_URL}/api/app-user/signin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, from: "start" }),
      })
      if (res.ok) {
        setStep("sent")
      } else {
        const data = await res.json().catch(() => ({}))
        setErrorMsg(data.message ?? "Request failed.")
      }
    } catch {
      setErrorMsg("Couldn't reach the server.")
    }
  }

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
                Start with your email
              </h1>
              <p
                className="text-[13px] text-[#6B4F2A] leading-relaxed text-center"
                style={{ marginTop: 6 }}
              >
                No password needed. We'll send you a sign-in link by email.
                <br />
                First time here? You get signed up automatically and <b className="text-[#C8301E]">200 credits</b> land in your account.
              </p>
              <form onSubmit={handleSubmit} className="mt-6 space-y-3">
                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl bg-[#FBF6ED] text-[14px] text-[#3A2A1C] placeholder:text-[#C9B88A] outline-none focus:bg-white focus:ring-2 focus:ring-[#C8301E]/30 transition"
                  style={{ border: "1px solid #E9D1A6" }}
                />
                {errorMsg && (
                  <p className="text-[12px] text-[#C8301E]">{errorMsg}</p>
                )}
                <button
                  type="submit"
                  className="w-full py-3 rounded-full bg-[#C8301E] text-white text-[14px] font-extrabold shadow-md hover:shadow-lg hover:scale-[1.01] transition-all"
                >
                  Send me the link →
                </button>
              </form>
            </>
          )}

          {step === "sent" && (
            <div className="text-center py-2">
              <CherryBao size={80} animate />
              <h2 className="mt-3 text-[20px] font-extrabold text-[#3A2A1C]">Check your email</h2>
              <p className="mt-2 text-[13px] text-[#6B4F2A]">
                We sent a sign-in link to<br />
                <span className="font-bold text-[#3A2A1C]">{email}</span>. (Valid for 15 minutes.)
              </p>
              <button
                onClick={() => setStep("input")}
                className="mt-6 text-[12px] font-bold text-[#C8301E] hover:underline"
              >
                Send again
              </button>
            </div>
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
                onClick={() => setStep("input")}
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
