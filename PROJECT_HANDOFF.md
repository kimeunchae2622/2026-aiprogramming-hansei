# PROJECT HANDOFF — 반려동물 추억 저장소 + 별빛 꼬리 마을

> **최신 변경(2차 갱신, 2026-11-27)**: ①화면 떨림 수정(카메라 정확 추적 + 장치 픽셀 정렬, `village.js render/frame`) ②하단 '돌보기'는 구형 화면 없이 마을 직행(`app.js` 탭 onclick) ③최초 생성·외모 수정 화면 `js/game/creator.js`, 외형은 `game.look`(주인공)·`game.petLooks[petId]`(아이별)에 저장, `setup` 플래그 ④반려동물 스프라이트는 `petFrame(look, dir, pose)`로 변경(옵션표 `PET_OPTS`) ⑤**최상위 철학**: 배고픔·청결·방치 패널티·의무 퀘스트를 절대 추가하지 않는다(접속 안 해도 아무것도 줄지 않음). 미완료: 그래픽 밀도 개선, 비 오는 날 처마·낮잠·간식, 실제 폰 시험. 자세한 내용은 `docs/DEVELOPMENT_REPORT.md` 2차 갱신.

> 마지막 갱신: 2026-11-27 (1차 마을 개발 직후). 다음 개발자(사람 또는 AI)가 이 파일과 저장소만 보고 이어서 작업할 수 있게 쓴 문서입니다.
> 확인 수준: "코드로 확인" = 저장소 코드를 직접 읽거나 실행해서 확인, "추정" = 확인하지 못함.

## 0. 먼저 알아야 할 것

1. 이 프로젝트의 최종 완성품은 **모바일 웹앱(PWA) "반려동물 추억 저장소" 1개**입니다. 게임(별빛 꼬리 마을)은 그 안의 부가 기능이며, **같은 앱·같은 주소**에서 가로 전체 화면으로 열립니다. 별도 사이트로 분리하지 마세요.
2. **사용자 데이터를 잃는 것이 가장 큰 위험**입니다. 저장 구조를 바꾸기 전에 `js/db.js`(DB 버전·저장소)와 `js/backup.js`(백업·복원)부터 읽고, 이전 버전 데이터로 업그레이드 시험을 하세요.
3. 과제 조건(변하지 않음): 일반인이 설명서 없이 사용 / **실행 중 AI API 호출 금지** / 카드 등록 서비스 금지 / 실제 개인정보 금지(가짜·공공데이터만) / 핵심 1 + 부가 3 / **개발 시간 7시간 이하(Claude 작업 시간 기준)** / 무료 상시 배포(GitHub Pages). 비밀 키는 공개 저장소에 절대 올리지 않습니다.
4. 시간 기록은 `notes/time-log.md`. 시작·끝은 `date`로 잰 실제 시각입니다.

## 1. 저장소와 배포

- GitHub: https://github.com/kimeunchae2622/2026-aiprogramming-hansei (공개, 브랜치 `main`)
- 배포: https://kimeunchae2622.github.io/2026-aiprogramming-hansei/ (GitHub Pages, `main` 푸시 시 1~2분 뒤 자동 반영)
- 복구 지점(로컬 태그): `pre-village-2026-11-27` (마을 개발 직전)
- 로컬 실행: `.claude/launch.json`의 `app`(= `python -m http.server 8765`), 브라우저로 `http://localhost:8765`. 빌드 과정 없음(순수 JS ES 모듈).
- 시험 중 브라우저가 옛 파일을 캐시하면 `fetch(path, { cache: 'reload' })`로 새로 받거나 서비스 워커·캐시를 지우세요. 파일을 추가하면 `sw.js`의 `SHELL` 목록과 `CACHE` 버전도 올립니다.

## 2. 앱 구성 (코드로 확인)

| 영역 | 파일 | 비고 |
|---|---|---|
| 앱 진입·피드·달력·더보기·꾸미기 | `js/app.js`, `css/style.css` | 하단 탭: 추억/달력/돌보기/지도/더보기 |
| 저장소 | `js/db.js` | IndexedDB `pet-memories` **v4**: `pets, posts, events, characters, game, meta` |
| 백업·복원 | `js/backup.js` | 사진 포함 JSON. `BACKUP_STORES`에 있는 저장소만 포함. 예전 백업도 복원됨 |
| 돌보기(방 게임) | `js/care.js`, `js/room.js`, `js/character.js`, `js/items.js` | 기존 "우리 집" 방, 코인·친밀도(xp)·상점. **삭제하지 않았음** |
| 동물병원 지도 | `js/map.js`, `lib/leaflet/`, `data/hospitals.json` | 공공데이터 5,264곳 |
| 별빛 꼬리 마을 | `js/game/*.js`, `css/game.css` | 아래 3장 |
| 오프라인 | `sw.js`, `manifest.webmanifest` | 네트워크 우선, 실패 시 캐시 |

## 3. 별빛 꼬리 마을 (이번에 만든 것)

설계 상세는 `docs/GAME_DESIGN.md`, 그래픽 출처는 `docs/ASSET_SOURCES.md`, 시험은 `docs/TEST_RESULTS.md`, 결과 보고는 `docs/DEVELOPMENT_REPORT.md`.

- 진입: 하단 **돌보기** 탭 → `careCtx.openVillage()`(`js/app.js`) → `openVillage()`(`js/game/village.js`).
- 직접 만든 Canvas 2D 엔진(Phaser 미사용), 모든 그림은 코드가 그리는 원본 픽셀 아트(외부 에셋 없음).
- 구현됨: 가로 전체 화면(세로면 회전 안내), 조이스틱/키보드 이동, 충돌·가림 순서, 카메라, 반려동물 여러 마리의 자율 행동·쓰다듬기·산책 동행·방석에서 쉬기, 채집 4종(매일 오전 5시 KST 갱신)·가방, 상점(가구 사기·채집물 팔기), 정원 가구 놓기·치우기, 낮밤·벚꽃잎·나비·물 반짝임, 주인공 이름·외형(머리·원피스·피부) 선택, 저장·백업 포함.
- **준비 중 표시만 있음**: 광산(`mine`), 낚시터(`pier`), 농장(`farm`) — `js/game/world.js`의 `world.interacts`와 `village.js`의 `useInteract()`에서 연결하면 됩니다. 지도를 다시 만들 필요 없음.
- 디버그 훅: `__debug()`(`village.js`)가 실행 중인 게임 상태 객체를 돌려줍니다(시험용). `G.nightOverride = 0|1`로 낮/밤 강제.

### 알려진 한계 (2차 후보)
1. 실제 Android·iPhone 시험을 하지 못했습니다(성능, 터치 감각, 전체 화면 동작).
2. 그래픽이 시안보다 단순합니다(걷기 2~3프레임, 꼬리 흔들기·앉기 등 세밀한 동작 없음).
3. 집 안 2D 실내, 효과음, 낚시·광산·농사, NPC, 계절 이벤트는 없습니다.
4. 코인은 기존 규칙을 그대로 씁니다(아이별 코인 + 마을 주머니). 새 코인 획득 경로는 "채집물 팔기"뿐입니다.

## 4. 다음 개발자의 첫 작업 순서

1. 이 파일, `README.md`, `docs/GAME_DESIGN.md`, `notes/time-log.md`를 읽고 누적 시간(7시간 상한)을 확인한다.
2. 실제 폰으로 배포 주소를 열어 `docs/TEST_RESULTS.md`의 "미확인" 항목을 확인한다.
3. 사용자의 새 요구를 "절대 보존 / 수정 / 새로 구현 / 나중에"로 나눠 시간 안에 들어가는지 먼저 보여 준다.
4. 작은 단위로 개발 → 폰 크기 모의 화면으로 실행 확인 → 커밋. 사용자가 요청할 때 푸시한다.
5. 저장 구조를 바꿀 때: `js/db.js` 버전을 올리고 `onupgradeneeded`에 새 단계만 추가, `BACKUP_STORES`와 `js/backup.js` 검증 추가, 이전 버전 데이터로 업그레이드 시험.
