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
          setErrorMsg(data.message ?? "로그인에 실패했어요.")
          setStep("error")
        }
      })
      .catch(() => {
        setErrorMsg("서버 연결에 실패했어요.")
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
        body: JSON.stringify({ email }),
      })
      if (res.ok) {
        setStep("sent")
      } else {
        const data = await res.json().catch(() => ({}))
        setErrorMsg(data.message ?? "요청에 실패했어요.")
      }
    } catch {
      setErrorMsg("서버 연결에 실패했어요.")
    }
  }

  return (
    <div className="flex flex-col items-center pt-8 pb-16">
      <div className="w-full max-w-[440px]">
        <div
          className="rounded-[24px] bg-white p-7 lg:p-8"
          style={{ border: "1px solid #E9D1A6", boxShadow: "0 10px 30px rgba(107,79,42,0.10)" }}
        >
          {step === "input" && (
            <>
              <div className="flex flex-col items-center text-center mb-5">
                <CherryBao size={80} animate />
              </div>
              <h1 className="text-[22px] font-extrabold text-[#3A2A1C] text-center">
                이메일로 시작하기
              </h1>
              <p className="mt-1.5 text-[13px] text-[#6B4F2A] leading-relaxed text-center">
                비밀번호는 필요 없어요. 이메일로 로그인 링크를 보내드릴게요.
                <br />
                처음이시면 자동으로 가입되고 <b className="text-[#C8301E]">200 크레딧</b> 이 무료로 지급돼요.
              </p>
              <form onSubmit={handleSubmit} className="mt-6 space-y-3">
                <input
                  type="email"
                  placeholder="이메일 주소"
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
                  로그인 링크 받기 →
                </button>
              </form>
              <p className="mt-5 text-center text-[11px] text-[#9A7C55]">
                개발자이신가요?{" "}
                <Link href="/login" className="font-bold text-[#6B4F2A] hover:underline">
                  개발자 로그인
                </Link>
              </p>
            </>
          )}

          {step === "sent" && (
            <div className="text-center py-2">
              <CherryBao size={80} animate />
              <h2 className="mt-3 text-[20px] font-extrabold text-[#3A2A1C]">이메일을 확인해 주세요</h2>
              <p className="mt-2 text-[13px] text-[#6B4F2A]">
                <span className="font-bold text-[#3A2A1C]">{email}</span> 으로<br />
                로그인 링크를 보냈어요. (15분 동안 유효)
              </p>
              <button
                onClick={() => setStep("input")}
                className="mt-6 text-[12px] font-bold text-[#C8301E] hover:underline"
              >
                다시 보내기
              </button>
            </div>
          )}

          {step === "verifying" && (
            <div className="text-center py-6">
              <CherryBao size={72} variant="sleeping" animate />
              <h2 className="mt-3 text-[18px] font-extrabold text-[#3A2A1C]">로그인 중…</h2>
            </div>
          )}

          {step === "error" && (
            <div className="text-center py-2">
              <CherryBao size={72} variant="confused" />
              <h2 className="mt-3 text-[20px] font-extrabold text-[#3A2A1C]">로그인 실패</h2>
              <p className="mt-2 text-[13px] text-[#6B4F2A]">{errorMsg}</p>
              <button
                onClick={() => setStep("input")}
                className="mt-5 text-[12px] font-bold text-[#C8301E] hover:underline"
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

export default function StartLoginPage() {
  return (
    <Suspense>
      <StartLoginContent />
    </Suspense>
  )
}
