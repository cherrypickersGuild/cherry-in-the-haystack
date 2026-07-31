# 체리 Webapp (v.0.0.1) 구현

### 프로젝트 정보

**맥락: 체리 PRD**

1. 매주 소식들이 수집되어서, 트리맵 + 고 영향 뉴스들의 모음으로 구현되었으면 좋겠다
2. basic/advanced section에 테크닉/방법론들이 전부 모여 있었으면 좋겠다
3. newly discovered에 카테고리별 뉴스들이 적재되었으면 좋겠다 (비즈니스 케이스)
4. (개인별로 다른 뉴스를 팔로우할 수 있고, 다른 내용이 표현되었으면 좋겠다) - THIS

### 기능 정의

**1순위: 뉴스레터를 위해 필요한 부분 → 백엔드 구현 (2/28)**

1. 개인화 - 로그인 / 회원가입
    1. 이메일 로그인 or 소셜 로그인 (선택)
2. 뉴스 수집
    1. autonews → 개발 서버에서 되었음.
    2. 에이전트의 뉴스 요약 시켜야 함
3. 회사별로, 자기가 원하는 소스를 팔로우할 수 있게 해줬으면 한다 (현재는  RSS 피드만)
4. 회사 측에서 **‘팔로우할 소스’ 관리할 수 있는 페이지**가 필요함
    1. 노션을 프론트엔드로 하자 (제일 쉬움)
    2. 우리 앱에서, 저걸 관리할 수 있는 페이지를 만들어주자 (선택)
    3. db
        1. 모든 회사들이 팔로우하는 소스를 다 볼수 있는 (마스터 소스 db) 같은게 하나 있어야 합니다
5. ~~트위터, 링크드인, 카톡방 ← (차후 개발될 것임)~~
6. 뉴스레터를 작성하는 에이전트를 구현하고, 그걸 **커스터마이즈 할 수 있는 창**이 있어야 합니다
    1. 필요한 입력 : 프롬프트를 변경할 수 있는 창 : 브랜드 문투, 예시 (퓨샷), 이번에 홍보하고 싶은 내용
        1. 프롬프트 버저닝 (A/B) (선택)
    2. 이메일 리스트에다가 쏴줘야 함
7. 생성된 뉴스레터를 볼 수 있는 페이지가 필요하다 (참고: https://springcoolers.github.io/llm-handbook/_contents/digest/weeklynews/weeklynews.html)

---

**2순위: 원래 하기로 했는데 못한 부분**

1. newly discovered section에, 카테고리별로 관련 소식들이 잘 누적되는 것 (2/28~3/1)
2. basic/advanced 페이지를 쓰는 에이전트 (가영 asap)
    1. 가영님이 만드신게 있음 → 소통 마치고, 탑재? 하는 거를 그 다음주쯤 해보면 좋겠다. 더 빨라도 좋고
    2. 이 모듈을 올릴 수 있는 백엔드가 필요한 상태

---

**3순위: data ingestion 쪽 미완된 부분 (2/28일까지 못합니다)**

1. autonews가 들어오는 부분 << 어느 정도 완료가 됨
2. 1회성 고퀄리티 정보가 들어오는 부분 << 어느정도 완료가 됨
3. 온톨로지 만드는 거 << graphdb가 좀 실패했음… ㅠㅠ

### 액션 아이템

**소통**

- [x]  화면 (정의서) - 지한님이 해주심 (2/22)
    - [x]  한결이 업그레이드 해야 할 듯
    - https://v0-ai-saa-s-dashboard-delta.vercel.app/
        - 이거 바꿔주세요
            - newsletter studio
                - newsletter studio랑 source manager를 한 페이지에 넣자
                - newsletter studio의 **Newsletter Preview를 아래쪽으로 빼고, 프롬프트를 옆에서 보여주자**
                - newsletter studio 페이지에 ‘지금까지 발간 된 뉴스레터들’ 보여주는 칸이 있었으면 좋겠다
            - dashboard 페이지
                - weekly digest로 페이지 이름 변경
                - weekly news treemap이랑 high impact 뉴스를 세로로 배치시킬 것. (https://springcoolers.github.io/llm-handbook/_contents/digest/weeklynews/weeklynews.html)

              ![image.png](attachment:72a76c5e-00d5-4c86-8042-abdd0f484898:image.png)

                - https://springcoolers.github.io/llm-handbook/_contents/digest/weeklynews/weeklynews.html
            - newly discovered
                - framework, model, tools -
                    - 각 분류별로 메이저한 선택지를 위에 모아준다
                        - ex) 모델 페이지 - ‘오픈 소스 모델’ 카테고리 - llama, qwen,

                  ![image.png](attachment:2d1d1652-cab4-48d9-a0e5-28ff2885a401:image.png)

- [x]  기능 정의서 (2/22) → 화면으로 대체
    - 로버트 읽어 오고 https://github.com/springCoolers/cherry-in-the-haystack/blob/main/docs/PRD.md
    - 한결 - 달라진 거 있나 읽어 봅니다
        - 랜딩 페이지, 홈, 목록과 상세 api, 정렬, 이메일 기반 할 것인가(이메일로 not 소셜),
    - [x]  **디비** 스키마 - 중심 db 잡아놓고, 회사별로 팔로하면 조인하는 형태로 쏘게끔 할듯
- [x]  프론트 / 백엔드 구현. (로버트/지한 ~2/28-3/1)

**결정사항**

- 웹 백엔드는 TS(nest.js)로 하자
    - 로그인, 회원가입 CRUD
- 기존 **Autonews** (DB에 넣어주기만 하면 됨) →
    - 백엔드를 TS로 재작성.
    - 오토뉴스의 로직을 따라가되, 없앨 부분을 없애기
    - agent를 호출하는 부분을 파이썬으로 두자
    - 에이전트 만드시는 분들이 파이썬이 익숙할 것

**정의**

- newly discovered - full page
- 어떤 카테고리가 있는가
- patchnote 페이지 설명
- PRD에 없는 내용 (지한님과 티키타카)

  **1순위: 뉴스레터를 위해 필요한 부분 (2/28)**

    1. 개인화
        1. 체리를 다섯개를 띄워서 회사별로 개별 사이트 5개 만드는 것.
        2. 로그인 / 회원가입 - 개별 유저로그인이 되면 좋겠다 (선택사항)
            1. 5개 아이디만 있으면 되서, 우리가 이 아이디로 접속하세요 하고 줘버려도 됩니다.
    2. 뉴스 수집이 되고 있어야 한다
        1. autonews → 개발 서버에서 되었음.
        2. 에이전트의 뉴스 요약 시켜야 함
            - [ ]  llm token이 없어서 summary가 안 들어감
            - [ ]  이 summary 프롬프트 고쳐가지고 성능을 끌어올려야 함.
            - [ ]  점수 평가하는게 잘 안들어가고 있음 → 프롬프팅 등으로 고쳐야 함
    3. 회사별로, 자기가 원하는 소스를 팔로우할 수 있게 해줬으면 한다 (현재는  RSS 피드만)
    4. 회사 측에서 **‘팔로우할 소스’ 관리할 수 있는 페이지**가 필요함
        1. 노션을 프론트엔드로 하자 (제일 쉬움)
        2. 우리 앱에서, 저걸 관리할 수 있는 페이지를 만들어주자 (선택)
        3. db
            1. 모든 회사들이 팔로우하는 소스를 다 볼수 있는 (마스터 소스 db) 같은게 하나 있어야 합니다
    5. ~~트위터, 링크드인, 카톡방 ← (차후 개발될 것임)~~
    6. 뉴스레터를 작성하는 에이전트를 구현하고, 그걸 **커스터마이즈 할 수 있는 창**이 있어야 합니다
        1. 필요한 입력 : 프롬프트를 변경할 수 있는 창 : 브랜드 문투, 예시 (퓨샷), 이번에 홍보하고 싶은 내용
            1. 프롬프트 버저닝 (A/B) (선택)
        2. 이메일 리스트에다가 쏴줘야 함
    7. 생성된 뉴스레터를 볼 수 있는 페이지가 필요하다 (참고: https://springcoolers.github.io/llm-handbook/_contents/digest/weeklynews/weeklynews.html)

→ 새로운 기능정의서 / PRD 작성

**재문서화**

- 문서가 필요하면 이 화면 기반으로 역으로 정의서 써도 될 것 → docs에 올리자 https://github.com/springCoolers/cherry-in-the-haystack/tree/main/docs

- [x]  BMAD 독스로 올리기