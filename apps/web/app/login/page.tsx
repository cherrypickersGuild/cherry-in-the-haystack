"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [email, setEmail] = useState("")
  const [step, setStep] = useState<"input" | "sent" | "verifying" | "error">("input")
  const [errorMsg, setErrorMsg] = useState("")

  // 매직링크 클릭 시 자동 로그인 처리
  useEffect(() => {
    const tokenFromUrl = searchParams.get("token")
    const emailFromUrl = searchParams.get("email")

    if (tokenFromUrl && emailFromUrl) {
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
            localStorage.setItem("accessToken", data.accessToken)
            router.push("/")
          } else {
            setErrorMsg(data.message ?? "로그인에 실패했습니다.")
            setStep("error")
          }
        })
        .catch(() => {
          setErrorMsg("서버 연결에 실패했습니다.")
          setStep("error")
        })
    }
  }, [searchParams, router])

  const handleSubmit = async (e: React.FormEvent) => {
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
        const data = await res.json()
        setErrorMsg(data.message ?? "요청에 실패했습니다.")
      }
    } catch {
      setErrorMsg("서버 연결에 실패했습니다.")
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#FBFAF8" }}>
      <div className="w-full max-w-md px-6">
        {/* 로고 */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-2 mb-3">
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

          {/* 이메일 입력 */}
          {step === "input" && (
            <>
              <h2 className="text-[18px] font-bold text-[#1A1626] mb-1">로그인</h2>
              <p className="text-[13px] text-[#7B7599] mb-6">
                이메일을 입력하면 로그인 링크를 보내드립니다.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <input
                  type="email"
                  placeholder="이메일 주소"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-[#E4E1EE] text-[14px] text-[#1A1626] placeholder-[#B0ADCA] outline-none focus:border-[#C94B6E] transition-colors"
                />
                {errorMsg && (
                  <p className="text-[12px] text-[#C94B6E]">{errorMsg}</p>
                )}
                <button
                  type="submit"
                  className="w-full py-3 rounded-xl text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "#C94B6E" }}
                >
                  로그인 링크 받기
                </button>
              </form>
            </>
          )}

          {/* 이메일 발송 완료 */}
          {step === "sent" && (
            <div className="text-center py-4">
              <div className="text-4xl mb-4">📬</div>
              <h2 className="text-[18px] font-bold text-[#1A1626] mb-2">이메일을 확인해주세요</h2>
              <p className="text-[13px] text-[#7B7599]">
                <span className="font-semibold text-[#1A1626]">{email}</span>으로<br />
                로그인 링크를 보냈습니다. (15분 유효)
              </p>
              <button
                onClick={() => setStep("input")}
                className="mt-6 text-[13px] text-[#C94B6E] hover:underline"
              >
                다시 보내기
              </button>
            </div>
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
                onClick={() => setStep("input")}
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
