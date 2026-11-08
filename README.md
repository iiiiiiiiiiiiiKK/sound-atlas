# Sound Atlas · 声音地图

> **THE WORLD HAS A SOUNDTRACK.**
> 用耳朵，重新认识这个世界。

A global map of environmental sound. Every point on the map is a **real field recording**,
stored on a public archive, played from there, and credited to the person who made it.

一张全球环境声音地图。地图上的每一个点都是一段**真实的田野录音**，存放于公开档案站、
从原站播放，并标注录制者与许可证。

[![Live](https://img.shields.io/badge/live-sound--atlas-4fd1b5)](https://iiiiiiiiiiiiikk.github.io/sound-atlas/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
![Tests](https://img.shields.io/badge/tests-42%20unit%20%2B%2044%20e2e-brightgreen)
![No backend](https://img.shields.io/badge/backend-none-lightgrey)

**Live demo → <https://iiiiiiiiiiiiikk.github.io/sound-atlas/>**
**Author → <https://x.com/0xkillcoin>**

---

## Why this exists · 为什么做这个

Maps show you where a place is. They never show you what it *sounds* like. Meanwhile,
thousands of people have already uploaded careful field recordings — birds at dawn, rain on a
tin roof, a market at midday — and almost nobody can find them, because they live in archive
categories instead of on a map.

Sound Atlas is a thin, honest layer over that existing work: it puts real recordings on a map,
plays them from their original host, and makes the licence and the recordist visible every time.

地图只告诉你在哪儿，却从不告诉你那里听起来是什么样。与此同时，已经有人认真录下了成千上万段
声音——清晨的鸟、铁皮屋顶上的雨、正午的市场——但它们沉在档案分类里，几乎没人找得到。
Sound Atlas 只是一个诚实的小层：把已有的真实录音放回地图，从原始主机播放，并始终注明
许可证与录制者。

**It does not re-host audio. It does not invent locations. It does not generate sounds.**

---

## Screenshots · 界面截图

All images are captured from the production build by `npm run shots` — not mocked up.

| Home (dark) | Home (light) |
| --- | --- |
| ![Home dark](docs/screenshots/home.png) | ![Home light](docs/screenshots/home-light.png) |

| Explore map | Sound detail |
| --- | --- |
| ![Explore](docs/screenshots/explore.png) | ![Sound detail](docs/screenshots/sound-detail.png) |

| Collections | Library |
| --- | --- |
| ![Collections](docs/screenshots/collections.png) | ![Library](docs/screenshots/library.png) |

| Upload | About |
| --- | --- |
| ![Upload](docs/screenshots/upload.png) | ![About](docs/screenshots/about.png) |

| Mobile home | Mobile explore | Mobile collections |
| --- | --- | --- |
| ![Mobile home](docs/screenshots/mobile-home.png) | ![Mobile explore](docs/screenshots/mobile-explore.png) | ![Mobile collections](docs/screenshots/mobile-collections.png) |

---

## What you can actually do · 实际能做什么

| Feature | English | 中文 |
| --- | --- | --- |
| Global sound map | Real recordings on a world map, coloured by kind of sound and grouped by proximity | 在真实地图上浏览录音，按声音类型着色，按距离聚合 |
| Place search | Type a city or country, the map jumps there and loads only that window | 输入城市或国家，地图跳转并只加载该范围 |
| Search this area | Pan somewhere else and load that viewport | 拖动地图后加载当前视野 |
| Locate me | Browser geolocation, with an honest message when it is denied | 浏览器定位，被拒绝时给出明确提示 |
| Filters | Kind of sound, archive, minimum length, precise coordinates only | 声音类型、数据源、最短时长、仅精确坐标 |
| Playback | Real archived file, waveform, seek, volume, mute, speed, loop, next / previous | 播放原始档案文件、波形、拖动进度、音量、静音、倍速、循环、上/下一段 |
| Ambient mode | Full-screen listening: big place name, real spectrum, sleep timer, auto-advance | 沉浸模式：大字号地点、真实频谱、定时停止、自动续播 |
| Random sound | "Take me somewhere" — a seeded pick from sounds that play right now | 「带我去个地方」——从当前可播放的声音中随机抽取 |
| Collections | Six themed sets resolved live from the providers, never a hard-coded list | 六个专题，实时查询生成，绝不硬编码清单 |
| Personal sound maps | Group sounds into your own themed maps | 把声音组织成自己的主题地图 |
| Sound journeys | An ordered listening route through real places, reorderable, skippable | 按地点顺序聆听的路线，可拖动排序、可跳过 |
| Upload / record | Upload a file or record from the microphone (MediaRecorder), stored locally | 上传文件或直接用麦克风录制，保存在本机 |
| Library | Saved sounds, play history, maps, journeys, recordings, JSON export / import | 收藏、播放记录、地图、路线、录音、JSON 导出导入 |
| Sharing | Per-sound deep link, copyable, resolves after a hard reload | 每段声音的独立链接，刷新后仍可打开 |
| Bilingual | Complete English and 简体中文, browser-detected, switchable | 完整中英双语，按浏览器语言自动选择，可切换 |
| Themes | Dark and light, persisted | 深色与浅色主题，可记忆 |

Every interactive control on the site is wired to real behaviour. There are no disabled
placeholders, no fake counters, no "coming soon" buttons.

站点上每一个可交互控件都对应真实行为。没有占位按钮，没有虚假计数，没有「敬请期待」。

---

## Audio sources and licences · 声音来源与许可证

This is the part that matters most. **No audio is invented, generated, or re-hosted.**

### 1. Wikimedia Commons (`source: commons`)

The shipped catalogue is built by `scripts/fetch-commons-catalog.mjs`, which walks the
`Category:Audio files of <City>` families and a set of soundscape categories through the live
`action=query` API and keeps a file only if **all** of these hold:

- the MIME type is audio and the file is under 24 MB (so it can stream quickly);
- the declared licence is **CC0, Public Domain, CC BY, or CC BY-SA** — everything else is dropped;
- the text does not indicate speech, music, news, narration, or synthesised noise;
- the text *does* claim to be environmental sound;
- the file has real place evidence — either its own EXIF GPS coordinates, or a
  `Audio files of <KnownCity>` category. Files with no location at all are discarded rather
  than placed at a random point.

Current build: **54 records**, each with author, licence and the original file page. Coordinates
carry a `precision` flag:

- `exact` — the recording's own GPS coordinates;
- `city` — placed at its city centre, and labelled as such in the UI.

Playback streams the Commons MP3 transcode (`upload.wikimedia.org`), which sends
`Access-Control-Allow-Origin: *`, so the spectrum you see is computed from real samples.

Rebuild it with `npm run catalog`.

### 2. iNaturalist (`source: inaturalist`)

Live queries to `api.inaturalist.org/v1/observations?sounds=true&licensed=true&quality_grade=research`.
Only observations with a sound file whose licence is CC0 / CC BY / CC BY-SA are surfaced, and
only those that carry coordinates. Queries are bounded by the current map viewport.

`static.inaturalist.org` does **not** send CORS headers. The app therefore plays those files
without Web Audio analysis and says so in the interface instead of pretending to render a
spectrum. This is a deliberate, visible limitation.

### 3. Your own recordings (`source: local`)

Uploaded or recorded audio is stored in **IndexedDB in your browser**. It is never transmitted.
There is no server, so nobody else can fetch it, and clearing site data deletes it.

### Per-source attribution

Every record keeps `author`, `licence.code`, `licence.url`, `pageUrl` and a human-readable
`attribution` string. The UI always shows at minimum:

```
“<title>” by <author> — <LICENCE> · Wikimedia Commons
```

CC BY and CC BY-SA require that attribution; the app renders it in every detail panel and never
hides it behind a hover.

### Not integrated: Freesound

Freesound was evaluated and deliberately **not** wired in. Its API needs a per-application key,
and its preview URLs are issued for that application rather than for arbitrary embedding.
Shipping it would mean either committing a key or serving audio the project has no standing to
serve. `.env.example` documents where a fork could add it. Nothing is faked in its absence.

### Map data

Basemap: **CARTO** raster tiles (dark / light variants, so the map matches the app theme), with
the public **OpenStreetMap** tile service as an automatic fallback if CARTO tiles start failing.
Attribution is rendered in-map for whichever provider is live, and OSM data is credited in the
footer. Commercial reuse of CARTO basemaps needs their own terms — the provider table lives in
`src/components/SoundMap.tsx` if you want to swap it.

Place search uses [Photon](https://photon.komoot.io/) with an iNaturalist fallback.

---

## Architecture · 架构

```
src/
  App.tsx, main.tsx        routing and bootstrap
  components/              Layout, PlayerBar, AmbientOverlay, SoundMap,
                           SoundDetail, SoundCard, Waveform, atoms
  pages/                   Home, Explore, Sound, Collections, CollectionDetail,
                           Random, Library, Journeys, JourneyDetail, MapDetail,
                           Upload, About, NotFound
  services/
    sources/               commons.ts, inaturalist.ts   ← one adapter per provider
    soundService.ts        the only place that merges providers
    audioEngine.ts         single-owner playback + opt-in spectrum analysis
    storage.ts             Dexie / IndexedDB
    places.ts, collections.ts, http.ts
  stores/                  playerStore.ts, uiStore.ts (Zustand)
  locales/                 en + zh dictionaries in one file
  types/                   domain types and the category vocabulary
  utils/                   formatting, ids, seeded shuffle
```

Deliberate decisions:

- **One adapter per provider.** A provider going down returns `partial: true` with its error
  string; it never empties the other provider's results and never throws into the UI.
- **One audio owner.** `AudioEngine` disposes the previous `<audio>` element before every load,
  so two recordings can never play at once. Autoplay rejection is reported as `blocked`, not as
  a broken file.
- **Analysis is opt-in per file.** Before playback the engine probes the host with a one-byte
  ranged CORS fetch. Allowed → `crossOrigin="anonymous"` + `AnalyserNode`. Refused → plain
  playback, no analyser, and a visible note. Routing a tainted element through Web Audio would
  silence it, which is the failure this design exists to avoid.
- **Local-first.** No accounts, no analytics, no network writes. Library data lives in
  IndexedDB and exports to JSON.
- **HashRouter.** Deep links and reloads work on GitHub Pages with no rewrite rules.

**Stack:** React 19 · TypeScript (strict) · Vite · Tailwind CSS 4 · Zustand · Dexie ·
Leaflet · Web Audio API · MediaRecorder · lucide-react.

No backend, no database server, no scheduled jobs, no paid services.

---

## Local development · 本地运行

Requires **Node.js ≥ 20**.

```bash
git clone https://github.com/iiiiiiiiiiiiiKK/sound-atlas.git
cd sound-atlas
npm install
npm run dev          # http://127.0.0.1:5173
```

Other scripts:

```bash
npm run typecheck    # tsc --build, strict
npm run build        # typecheck + production build into dist/
npm run preview      # serve dist/ on http://127.0.0.1:4319
npm test             # vitest, 42 unit tests
npm run test:e2e     # playwright, desktop + iPhone 14 projects
npm run catalog      # rebuild public/data/commons-catalog.json from the live Commons API
npm run shots        # capture docs/screenshots from the production build
npm run verify:prod  # 16-check audit of the deployed site
npm run deploy:pages # publish dist/ to the gh-pages branch
```

### Environment variables

None are required. See `.env.example`; the only optional value is a Freesound key for forks,
and it is not read by the shipped build. **No credentials exist anywhere in this repository.**

---

## Testing · 测试

Real numbers from the delivered build.

### Unit and integration — `npm test`

```
Test Files  6 passed (6)
     Tests  42 passed (42)
```

| Suite | Covers |
| --- | --- |
| `utils/format.test.ts` | duration / clock / byte formatting incl. `null`, `NaN`, negatives; seeded shuffle determinism; id uniqueness |
| `locales/index.test.ts` | both dictionaries, interpolation, untouched placeholders, fallback order, every category label present in both languages |
| `services/storage.test.ts` | save / remove, newest-first ordering, history cap at 60, map CRUD, export → import round trip, **no overwrite on import**, malformed bundle rejected |
| `services/soundService.test.ts` | bbox filtering incl. the antimeridian, catalogue integrity (every record located, every licence in the allow-list, https-only URLs), category / duration / precision filters, de-duplication, limit, partial reporting |
| `services/audioEngine.test.ts` | safe no-op behaviour with nothing loaded; load reports a real duration |
| `services/collections.test.ts` | every resolved sound matches its collection's categories; an unknown collection returns `null` instead of inventing content |

### End-to-end — `npm run test:e2e`

Playwright against the **production build** served by `vite preview`, two projects
(`Desktop Chrome` 1440×900 and `iPhone 14`).

```
  3 skipped
  41 passed     (44 cases: 41 run, 3 mobile-only cases skipped in the desktop project)
```

Covered: shell + X author link, all eight routes loading with zero `pageerror`, deep link +
hard reload, 404 route, language switch persisted across reload, theme toggle persisted,
map markers plotted from real data, place search moving the map, filters narrowing results,
map / list switch, **playback making a real request to `upload.wikimedia.org` or
`static.inaturalist.org`**, licence + author + original-file link present, save surviving a
reload, JSON export download, malformed import rejected with a visible message, journey
create + open, upload accepting a real WAV and refusing to save without the rights
confirmation, mobile menu navigation, mobile list-first layout, and **no horizontal overflow
on a 390 px viewport** across all eight routes.

One external service is stubbed in exactly one test so the suite stays deterministic: Photon
place search, replaced with a fixed GeoJSON response. Everything else is live — the real
Commons catalogue, the real iNaturalist API, and an actual HTTPS request to the archive host
during the playback test.

### Production verification (the deployed site)

`npm run verify:prod` drives a headless browser against the live URL and prints one line per
check. Latest run against <https://iiiiiiiiiiiiikk.github.io/sound-atlas/>:

```
19/19 checks passed.
```

| Check | Result |
| --- | --- |
| Home responds 200 | pass |
| Hero heading renders (`SOUND ATLAS`) | pass |
| Author link `href` | `https://x.com/0xkillcoin` |
| Catalogue loaded (recordings) | 54 |
| Map markers drawn | 31 clusters |
| Basemap tiles loaded | 15 (CARTO) |
| Result count line | `Showing 62 of 150` |
| Playback requests a real archive file | `upload.wikimedia.org/…` |
| Player reaches the `playing` state | pass |
| No uncaught page errors | pass |
| No horizontal overflow on `/`, `/explore`, `/collections`, `/journeys`, `/upload`, `/library`, `/about`, `/random` | 0 px each |
| Mobile menu destinations | 6 links |

### Feature audit (the deployed site)

`npm run verify:features` exercises the deeper flows the smoke audit does not, against
the live URL:

```
9/9 checks passed.
```

| Check | Observed |
| --- | --- |
| Collections resolve real counts from the providers | 6 collections; first is `Rain · 10 sounds · 31:13` |
| Collection detail lists its sounds | `Rain · 14 sounds` |
| Random sound returns a real, credited recording | a Wikimedia record with author and licence |
| Library tabs all render | 5 tabs navigated |
| Library export downloads JSON | `sound-atlas-2026-11-08.json` |
| Ambient mode opens | pass |
| Ambient mode closes on Escape | pass |
| Mobile marker tap opens the detail sheet | pass |
| No uncaught page errors across the run | pass |

### 中文测试说明

单元测试 42 个全部通过，覆盖格式化、双语词典、本地存储（含导入不覆盖、坏文件被拒绝）、
数据源筛选与去重、音频引擎空状态安全、专题解析。端到端测试共 44 个用例（41 通过、
3 个仅在移动端项目运行的用例在桌面项目中跳过），在**生产构建**上运行，桌面与 iPhone 14
两个项目，验证路由、深链刷新、语言与主题持久化、地图打点、地点搜索、筛选、播放
（真实请求到档案站）、收藏持久化、导出下载、错误导入提示、路线创建、上传与版权确认、
移动端菜单，以及全部八条路由在 390px 宽度下无横向溢出。

上线后另做生产环境自动化验收：首页 200 与标题、作者 X 链接、54 条录音统计、
31 个地图聚合点、15 张底图瓦片、`Showing 62 of 150`、真实播放请求与 `playing` 状态、
控制台无未捕获错误、移动端八条路由 0px 溢出、移动端菜单 6 个入口，19/19 全部通过。

---

## Deployment · 部署

Pure static output; any static host works.

**Live site: <https://iiiiiiiiiiiiikk.github.io/sound-atlas/>** — verified after deployment.

### GitHub Pages (what the live demo uses)

`vite.config.ts` sets `base: './'`, so the same `dist/` works at a project subpath, and
`HashRouter` keeps deep links working with no rewrite rules.

Deployment is a one-command, API-only publish — no local `gh-pages` dependency, no Actions
runner needed:

```bash
npm run build
GITHUB_TOKEN=<token with repo scope> npm run deploy:pages
```

`scripts/deploy-pages.mjs` pushes `dist/` to the `gh-pages` branch through the Git data API
(blobs → tree → commit → ref), adds `.nojekyll`, points the Pages site at that branch, and
prints the resulting URL and status.

`.github/workflows/ci.yml` runs typecheck + tests + build on every push, so a red run always
means broken code. Deployment is intentionally *not* wired to Actions: the Pages site is served
from the `gh-pages` branch, and a branch publish cannot race a Pages environment approval.

### Cloudflare Pages / Vercel

- Build command: `npm run build`
- Output directory: `dist`
- Node version: 20 or newer
- Environment variables: none

`HashRouter` means no rewrite rules are needed anywhere.

---

## Privacy · 隐私

- No accounts, no tracking cookies, no analytics, no third-party scripts.
- Saved sounds, maps, journeys, history and recordings are stored in your browser's IndexedDB
  and never leave it.
- Uploaded audio is never transmitted; the app states this on the upload page.
- Exact coordinates are never taken from file metadata. Users choose the place, and precise
  coordinates are opt-in and off by default.
- The microphone opens only after an explicit click, and no recording is ever uploaded.
- Export a JSON backup from the library page if you care about your data — clearing site data
  deletes it permanently.

---

## Known limitations · 已知限制

1. **Uneven coverage.** Archive inventory is not evenly distributed. Some cities have dozens of
   recordings; others have none. The catalogue shows what exists — it is not padded.
2. **City-level placement.** A large share of records are `precision: city`. They are drawn at
   the city centre and labelled as such; they are not recording positions.
3. **No spectrum on some hosts.** `static.inaturalist.org` blocks browser audio analysis, so the
   waveform there is a placeholder shape and the UI says so.
4. **Playback depends on the archive.** If Commons or iNaturalist removes a file, that point
   stops playing. The app surfaces the failure instead of faking playback.
5. **The Commons catalogue is a snapshot.** It is rebuilt with `npm run catalog`; new uploads
   appear only after a rebuild. A live free-text Commons search exists in the adapter, but its
   results are not mapped because Commons search returns no coordinates.
6. **Freesound is not integrated** — see above.
7. **No server-side features by design:** no cross-device sync, no email, no sharing of private
   recordings, no global user counts.

---

## Roadmap · 后续方向

1. **Coverage tooling** — a scheduled catalogue rebuild plus a curated review pass over
   `Audio files of <City>`, so more regions have real sound on the map.
2. **Offline listening** — opt-in caching of a saved journey's audio in IndexedDB, with explicit
   size and licence awareness.
3. **Coordinate contribution for your own recordings** — a map picker that anchors a user's own
   clips to a real position, still local-first, so personal maps can show places properly.

---

## Contributing · 贡献

Issues and pull requests are welcome, especially:

- city categories with genuinely environmental recordings the catalogue misses;
- licence-mapping bugs (a record shown under the wrong terms is a real bug);
- translation corrections in either language.

Ground rules: never introduce invented audio, invented coordinates, invented counts, or a
credential. Run `npm run typecheck && npm test && npm run build` before opening a PR.

---

## Licence · 许可证

Code: **MIT** — see [LICENSE](LICENSE).

Audio: **not** covered by the MIT licence. Every recording remains the property of its
recordist, under the licence shown on its own record and original archive page. Attribution is
rendered in the interface and must be preserved in any fork.

Map data © OpenStreetMap contributors, ODbL.

---

<p align="center">
  <a href="https://iiiiiiiiiiiiikk.github.io/sound-atlas/">Open the map</a> ·
  <a href="https://x.com/0xkillcoin">@0xkillcoin on X</a>
</p>
