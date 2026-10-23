# GitHub Pages 배포

공개 게임 주소: https://gyuha.com/banners-of-history/

GitHub Pages 기본 주소 https://gyuha.github.io/banners-of-history/ 도 기존 계정 연결 도메인 `gyuha.com`으로 이동한다. 이번 작업에서는 계정의 기존 사이트나 도메인 설정을 변경하지 않았다.

저장소: https://github.com/gyuha/banners-of-history

## 배포 방식

저장소 Settings → Pages의 Source는 **GitHub Actions**를 사용한다. `.github/workflows/deploy-pages.yml`이 `main` 푸시 또는 수동 실행으로 동작한다.

1. 소스 체크아웃과 Node.js 24 준비.
2. `npm ci`로 lockfile에 기록된 의존성 설치.
3. `npm test`로 게임 로직·저장·업적 검사.
4. `npm run build`로 `dist` 생성.
5. `dist`를 Pages artifact로 업로드하고 `github-pages` 환경에 배포.

워크플로에 필요한 권한은 `contents: read`, `pages: write`, `id-token: write`다. 별도 비밀 키나 개인 토큰을 코드에 넣지 않는다. 사용한 공식 GitHub Actions는 커밋 SHA로 고정했다.

## 저장소 경로 처리

프로젝트 Pages는 사이트 루트가 아닌 `/banners-of-history/`에서 실행된다. `vite.config.js`의 `base`에 이 경로를 지정했다.

- HTML favicon은 `%BASE_URL%`을 사용한다.
- JS가 만드는 군기 이미지, 작전 키아트와 홈 링크는 `import.meta.env.BASE_URL`을 사용한다.
- CSS 글꼴 URL은 Vite가 빌드 시 같은 base 아래로 변환한다.
- 모델과 효과음은 코드에서 생성하므로 별도 서버가 필요 없다.

다른 저장소로 옮기거나 사용자 지정 도메인의 루트에 배포할 때는 `base`를 새 경로로 수정한다. HTML/JS에 사이트 루트 `/assets/...`를 다시 하드코딩하면 Pages에서 파일을 못 찾게 되므로 주의한다.

로컬 주소:

```sh
npm run dev
# http://localhost:5173/banners-of-history/
npm run build
npm run preview
# http://localhost:4173/banners-of-history/
```

## 배포 상태 확인

[Actions의 배포 워크플로](https://github.com/gyuha/banners-of-history/actions/workflows/deploy-pages.yml)에서 테스트·빌드·업로드·배포 결과를 확인한다. 첫 배포 후 Pages 캐시 반영까지 잠시 시간이 걸릴 수 있다.

- 테스트/빌드 실패: 해당 단계 로그를 확인하고 로컬에서 같은 명령으로 재현.
- Pages 설정 오류: Source가 GitHub Actions인지 확인.
- HTML은 열리지만 게임/이미지/글꼴이 빠짐: 요청 경로가 `/banners-of-history/` 아래인지 확인.
- 저장 기록: 브라우저 localStorage를 사용한다. 로컬 개발 주소의 전적은 공개 Pages 주소와 별도로 저장된다.

## 설정 근거

- [Vite 공식 GitHub Pages 배포 가이드](https://vite.dev/guide/static-deploy.html#github-pages)
- [GitHub Pages REST API](https://docs.github.com/en/rest/pages/pages)

기존 `04-validation.md`의 최초 개발 검증은 로컬 실행을 기준으로 한다. 이 문서와 Pages 배포 기록이 이후 공개 배포 설정을 설명한다.

## 공개 배포 검증 — 2026-10-23

첫 자동 배포 [Actions 실행 39891165424](https://github.com/gyuha/banners-of-history/actions/runs/39891165424)가 성공했다. GitHub 러너에서도 테스트 26개와 빌드가 통과했으며 Pages artifact 업로드와 배포 단계가 완료되었다.

Ego Lite에서 실제 HTTPS 공개 주소를 열어 다음을 확인했다.

- 한글 사령부와 WebGL 전장이 정상 표시된다.
- 군기 이미지, 프로젝트 로컬 글꼴, 작전 상세 키아트가 저장소 하위 경로에서 로드된다.
- 출전하면 아군 44명과 적군 72명의 전투가 실행된다.
- 카메라 확대가 1.15배로 적용되고 Q 기술이 실제 재사용 시간을 갖는다.
- 일시정지 후 사령부로 복귀한다.
- 수집된 JavaScript 실행 오류와 HTTP 400 이상 리소스 오류가 없다.

검증 기록: [`github-pages-public-check.json`](evidence/github-pages-public-check.json), [공개 페이지 화면](evidence/github-pages-public.png). 배포 전 같은 하위 경로에서 수행한 검사는 [`github-pages-local-check.json`](evidence/github-pages-local-check.json)에 있다.
