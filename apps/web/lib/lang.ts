"use client"

import { useSyncExternalStore } from "react"

/* 화면 언어(한국어/영어) — 개념 페이지 안이 아니라 상단 바에서 고른다.
   페이지마다 상태를 따로 두면 화면을 옮길 때마다 되돌아가므로 모듈 단일 저장소로 둔다.
   값은 브라우저에만 남기고(localStorage), 서버 렌더에서는 항상 "ko" 로 시작한다. */

export type Lang = "ko" | "en"

const KEY = "cherry.lang"
const listeners = new Set<() => void>()
let current: Lang | null = null

function read(): Lang {
  if (current) return current
  try {
    const v = window.localStorage.getItem(KEY)
    current = v === "en" ? "en" : "ko"
  } catch {
    current = "ko"
  }
  return current
}

export function setLang(next: Lang) {
  current = next
  try {
    window.localStorage.setItem(KEY, next)
  } catch {
    /* 사생활 보호 모드 등 — 저장이 막혀도 화면은 바뀌어야 한다 */
  }
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** 현재 언어. 상단 바와 개념 페이지가 같은 값을 본다. */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, read, () => "ko")
}

/** 한국어·영어 중 하나를 고른다. SVG 안 글자까지 이걸 통과시킨다. */
export function usePick(): (ko: string, en: string) => string {
  const lang = useLang()
  return (ko, en) => (lang === "ko" ? ko : en)
}
