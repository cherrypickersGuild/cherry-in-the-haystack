/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Version skew protection — 배포마다 다른 deploymentId 를 박아서
  // 옛 청크가 사라진 상황(404)에서 클라이언트가 자동으로 hard reload 하도록 함.
  // env로 안 받으면 빌드 타임 timestamp 폴백, 어쨌든 매 빌드 변함.
  // ref: https://nextjs.org/docs/app/api-reference/config/next-config-js/deploymentId
  deploymentId: process.env.NEXT_DEPLOYMENT_ID || `build-${Date.now()}`,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    // Turbopack이 매 배포마다 청크 파일명을 새로 뽑는데, 브라우저가 옛 HTML을
    // 휴리스틱 캐싱으로 오래 들고 있으면 사라진 옛 청크(_next/static/chunks/<oldhash>)를
    // 참조해 404 → CSS 일부가 비어서 레이아웃이 무너짐.
    // HTML/RSC 는 매번 ETag 검증, 정적 청크는 immutable 그대로.
    return [
      {
        source: '/((?!_next/static|_next/image|api|favicon).*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
        ],
      },
    ]
  },
}

export default nextConfig
