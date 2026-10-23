# 재의 군기

원작 [Song of Ashes / Heroes Battlefield Demo](https://hank1105.itch.io/heroes-battlefield-demo)의 주요 플레이 흐름을 조사해 새 화면·리소스·한국어 UI로 구현한 Three.js 역사 액션·전술 게임입니다.

**[웹에서 플레이하기](https://gyuha.com/banners-of-history/)**

## 실행

Node.js 22.12 이상:

```sh
npm install
npm run dev -- --port 5173
```

브라우저에서 http://localhost:5173/banners-of-history/ 를 엽니다.

```sh
npm test        # 시뮬레이션·저장·업적·전투 데이터 검증
npm run build   # dist 정적 배포 빌드
npm run preview -- --port 4173
```

빌드 미리보기: http://localhost:4173/banners-of-history/

## GitHub Pages 배포

`main`에 푸시하면 GitHub Actions가 의존성 설치, 테스트, 빌드를 수행하고 `dist`를 GitHub Pages에 배포합니다. Actions 탭에서 수동으로도 배포할 수 있습니다. 자세한 설정과 경로 규칙은 [배포 문서](docs/05-github-pages.md)를 참고하세요.

## 플레이

- 전술전 10개·영웅전 10개, 지형/병종 상성, 부장과 병종별 명령.
- WASD/방향키 이동, 클릭 공격, Q/E 기술, R 회복, T 무쌍, 스페이스 회피.
- 마우스 휠 확대·축소, 우클릭 드래그 회전, M 전술 지도, Esc 일시정지.
- 상황별 카메라, 40개 초상, 8종 무기, 군기·문장·장비 조합.
- 전투별 업적·승리 기록 자동 저장. 휴대전화는 가로 화면 권장.

## 개발 자료

[docs/README.md](docs/README.md)에서 조사 근거, 원작과의 차이, 시나리오별 상세 정보, 엔진 구조, 검증 결과를 확인하세요. 원작 리소스나 코드는 실행 게임에서 사용하지 않습니다. 3D 리소스·문장·초상·음향은 코드로 제작했고 키아트는 신규 생성했습니다.

글꼴은 OFL로 배포되는 Noto Sans KR·Noto Serif KR의 프로젝트 로컬 사본을 사용합니다. 출처와 라이선스는 `public/assets/fonts` 및 [리소스 제작 기록](docs/asset-generation.md)에 있습니다.
