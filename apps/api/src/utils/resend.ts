import { Resend } from 'resend';

/**
 * 이메일 전송 함수
 * @param to 수신자 이메일
 * @param subject 이메일 제목
 * @param html 이메일 HTML 내용
 */
const sendEmail = async (to: string, subject: string, html: string) => {
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'no-reply@solteti.site',
    to,
    subject,
    html,
  });
};

/**
 * 이메일 템플릿
 * @param {string} title 이메일 상단 제목
 * @param {string} content 본문 내용 (HTML)
 * @param {string} buttonText 버튼에 표시할 텍스트
 * @param {string} buttonLink 버튼 클릭 시 이동할 링크
 * @returns {string} 완성된 HTML 문자열
 */
export const EMAIL_TEMPLATE = (
  title: string,
  content: string,
  buttonText: string,
  buttonLink: string,
) => {
  return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title}</title>
  <style>
    /* 기본 리셋 및 텍스트 스타일 */
    body, table, td, a {
      font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif;
      margin: 0;
      padding: 0;
    }
    body {
      background-color: #F5F5F5;
      line-height: 1.6;
    }
    h1, h2, p {
      margin: 0;
      padding: 0;
    }
    a {
      text-decoration: none;
      color: inherit;
    }
    img {
      border: 0;
      display: block;
    }

    /* 반응형 디자인 */
    @media screen and (max-width: 600px) {
      .container {
        width: 100% !important;
        padding: 10px !important;
      }
      .header-logo {
        font-size: 28px !important;
      }
      .content-table {
        padding: 20px !important;
      }
      .button {
        padding: 10px 20px !important;
        font-size: 14px !important;
      }
    }

    /* 물결 애니메이션 keyframes */
    @keyframes wave {
      0% { transform: translateY(0); }
      50% { transform: translateY(-2px); }
      100% { transform: translateY(0); }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#F5F5F5;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 700px; margin: 0 auto;">
    <!-- 헤더 영역 -->
    <tr>
      <td align="center" style="padding: 40px 0 20px;">
        <h1 class="header-logo" style="font-size: 36px; font-weight: 700; text-shadow: 1px 1px 2px rgba(0,0,0,0.1);">
          Cherry in the Haystack
        </h1>
        <p style="font-size: 12px; color: #666; margin-top: 8px;">
          Your curated knowledge digest
        </p>
      </td>
    </tr>

    <!-- 본문 컨테이너 -->
    <tr>
      <td align="center" style="padding: 20px 15px;">
        <table class="content-table" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #FFFFFF; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px;">
              <!-- 제목 -->
              <h2 style="font-size: 20px; font-weight: 600; color: #333; margin-bottom: 20px;">
                ${title}
              </h2>
              <!-- 내용 -->
              <p style="font-size: 16px; line-height: 1.6; color: #555; margin-bottom: 24px;">
                ${content}
              </p>

              <!-- 버튼 -->
              <table border="0" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
                <tr>
                  <td align="center" bgcolor="#3FA0EF" style="border-radius: 6px; transition: all 0.3s;">
                    <a href="${buttonLink}" target="_blank" class="button"
                       style="display: inline-block; padding: 14px 32px; color: #FFFFFF; font-size: 16px; font-weight: 600; border-radius: 6px; background: linear-gradient(135deg, #3FA0EF, #2F80ED);">
                      ${buttonText}
                    </a>
                  </td>
                </tr>
              </table>

              <!-- 버튼 아래 링크 텍스트 -->
              <br/>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- 푸터 영역 -->
    <tr>
      <td align="center" style="padding: 30px 15px; font-size: 12px; color: #666;">
        <p style="margin-bottom: 10px;">All rights reserved. ⓒ Cherry in the Haystack</p>
        <p style="margin-bottom: 10px;">
          <a href="${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/start" style="color: #3FA0EF; margin: 0 10px;">Home</a>
        </p>
 
      </td>
    </tr>
  </table>
</body>
</html>
`;
};

// 이메일 전송 함수 내보내기
export default sendEmail;
