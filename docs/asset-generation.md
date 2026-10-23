# 신규 키아트 제작 기록

## 산출물

- 파일: `public/assets/battle-keyart.png`
- 용도: ‘재의 군기’ 메인 메뉴 배경
- 유형: 새로 생성한 래스터 콘셉트 아트. 원작 게임의 이미지나 로고를 추출하거나 재사용하지 않았다.
- 크기: 1672 × 941 px, PNG, 불투명 배경
- 방식: imagegen 스킬의 기본 내장 `image_gen` 도구. CLI/API 폴백은 사용하지 않았다.
- 제작일: 2026-10-23

## 최종 생성 프롬프트

```text
Use case: historical-scene
Asset type: Original wide landscape key art for a Korean-language 3D tactical game called 재의 군기, to appear as the main menu background.
Primary request: A painterly cinematic ancient battlefield at dawn. Tiny shield-and-spear infantry in disciplined formations with muted teal banners on the left confront distant formations with muted crimson banners on the right. Ancient ridgelines, hazy mountains, charcoal pine forests, broad dusty golden fields.
Style/medium: Sophisticated editorial strategy-game painting with tactile brushwork, restrained detail and dramatic atmospheric depth. Entirely original visual design.
Composition/framing: Very wide panoramic landscape, approximately 16:9. Elevated sweeping view. Army formations remain small against the landscape. Broad luminous mist and open sky in upper middle, rich layered dark foreground terrain. Balanced visual weight suitable behind a clean game title interface.
Lighting/mood: Warm parchment amber sunrise diffusing through mist, long soft shadows, quiet anticipation before battle.
Color palette: parchment gold, sandstone, ash charcoal, desaturated teal and distant muted crimson.
Constraints: No words, no lettering, no logos, no UI, no borders, no watermarks. No modern objects. No close-up faces, no gore.
```

## 검수

생성된 파일을 이미지 뷰어로 직접 확인했다. 왼쪽 청록 군기와 오른쪽 진홍 군기, 작은 창·방패 보병 대열, 새벽의 호박빛, 안개 낀 산과 숲이 들어 있다. 글자·로고·UI·워터마크가 없고 가로 구도이므로 메뉴 배경에 적합하다. 렌더링 중인 실제 게임 화면이 아닌 분위기용 키아트다.

## 적용 시 참고

이미지 위에 표시하는 메뉴명·버튼·설명은 HTML로 작성해 한글 표시와 접근성을 유지한다. 화면 비율에 따라 `background-size: cover` 또는 동등한 object-fit 처리를 사용한다. 사진의 중심부와 상단은 밝으므로 글자 가독성을 위한 어두운 오버레이를 별도로 적용할 수 있다. 원본 출력은 Codex 생성 이미지 디렉터리에 유지하고 프로젝트용 사본을 위 경로에 저장했다.


## 제품에 적용한 자체 제작 리소스

키아트는 메인 전장의 실시간 3D 미리보기와 혼동하지 않도록 **작전 상세 모달**에 사용했다. 전장 자체는 실제 Three.js 장면이다.

| 리소스 | 제작 방식 | 구현 위치 |
|---|---|---|
| 병사 6종·지휘관·적장·부장·호송 인물 | 기본 지오메트리와 색 재질을 조합한 신규 3D 모델 | `src/engine.js` |
| 지면·숲·바위·텐트·울타리·다리·깃발 | 절차 생성 3D 리소스, 공유 캐시·부분 병합 | `src/engine.js` |
| 군기 문장 6개 | 직접 작성한 SVG 도형과 대응하는 입체 도형 | `src/main.js`, `src/engine.js` |
| 지휘관 초상 40개 | 얼굴·머리·장비·피부·배경의 신규 SVG 조합 | `src/progress.js`, `src/main.js` |
| 메뉴·병종 아이콘 | 직접 작성한 벡터 경로 | `src/main.js` |
| 타격·치유·무쌍 효과 | 고리·입자·투사체 애니메이션 | `src/engine.js` |
| 전장 효과음 | Web Audio 발진기로 실시간 합성 | `src/engine.js` |
| 기본 군단 문장 | 직접 작성한 SVG | `public/assets/crest.svg` |

원작에서 내려받은 이미지, 3D 모델, 음향, 난독화된 게임 본문을 실행 제품에 재사용하지 않았다. `docs/evidence`의 원작 페이지/로더는 관찰·분석 근거로만 보관하며 `dist`에 들어가지 않는다.

## 한국어 글꼴

Google Fonts의 Noto Sans KR(보통/굵게), Noto Serif KR(중간) 배포본을 다운로드해 한글 음절·한글 자모·라틴·기호를 포함하는 로컬 WOFF2로 준비했다. 런타임에 Google Fonts에 연결하지 않아도 모든 메뉴가 표시된다. 사용자의 추가 입력에서 글꼴에 없는 문자는 시스템 글꼴로 대체한다.

- upstream: [Noto Sans KR](https://fonts.google.com/specimen/Noto+Sans+KR), [Noto Serif KR](https://fonts.google.com/specimen/Noto+Serif+KR)
- 라이선스: SIL Open Font License 1.1. `public/assets/fonts/*-OFL.txt`에 원문을 포함했다.
- 준비 도구: `tools/prepare-fonts.py` (`uv run --with fonttools --with brotli tools/prepare-fonts.py`). 이 스크립트는 선택 기능이며 게임 실행·빌드에는 Python이 필요 없다.
- `noto-sans-kr.woff2`, `noto-sans-kr-bold.woff2`, `noto-serif-kr.woff2`를 CSS에서 직접 로드한다.
