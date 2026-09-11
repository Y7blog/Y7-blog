# Y7 Blog 统一 Analytics 统计系统 - 产品需求文档 (KV 版)

## Overview
- **Summary**: 构建一套完整、统一、可复用的基于 Cloudflare KV 的 Analytics 统计系统，包含网站总览统计卡、文章/动态独立阅读量、独立统计页面，以及可复用的自定义 SVG 图标系统。
- **Purpose**: 解决当前项目缺乏真实访问数据统计的问题，形成统一的数据来源、统一的统计逻辑、统一的组件和统一的 UI，避免后续重复造轮子。
- **Target Users**:
  1. 博客访客：在首页、文章页、动态页查看阅读量和站点热度
  2. 博客管理员：通过 `/stats/` 页面查看全站访问概览与内容阅读数据

## Goals
1. 建立统一 Analytics 类型系统（SiteAnalyticsStats / ArticleAnalyticsStats / DynamicAnalyticsStats）
2. 建立统一 Analytics Service（src/utils/analytics.ts），封装所有 KV 操作
3. 建立 4 个 API：view（POST）、stats（GET）、article（GET）、dynamic（GET）
4. 构建可复用 SiteStatsCard 组件（6项统计，可配置显示项）
5. 构建可复用 ViewCount 组件（统一文章/动态阅读量展示）
6. 新增 `/stats/` 独立统计页面（3 部分：概览 / 内容数据 / 趋势预留）
7. 建立自定义 SVG 图标系统（支持 `custom:views` 等命名空间，currentColor）
8. 扩展 analyticsConfig.ts，增加本站统计开关（不与现有第三方 SDK 配置冲突）
9. Swup 页面切换兼容；首页文章列表不产生 N 次单篇查询
10. Fail-safe：KV/API 失败不影响网站；本地 KV 不可用时优雅降级

## Non-Goals
1. 不引入 D1、Durable Objects 或其他 Cloudflare 存储，仅使用 KV
2. 不修改 `src/config/analyticsConfig.ts` 已有第三方 SDK（Google / Clarity / Umami / 51.la）字段
3. 不删除或替换现有 `widget/SiteStats.astro`（旧的静态内容统计保持独立）
4. 不引入 Chart.js / ECharts 等大型图表库（趋势预留但不强制）
5. 不修改现有文章正文、文章 Frontmatter、评论、打赏、搜索、壁纸、主题等功能
6. 不 git commit / push / Cloudflare deploy（仅本地修改）
7. 不将 Cloudflare API Token 或 KV 权限暴露给浏览器
8. 不在首页文章列表为每篇文章单独请求阅读量 API

## Background & Context
### 项目现有架构
- Astro 7.2 + @astrojs/cloudflare 14.2.6，adapter 目前仅在 `process.env.CF_WORKERS` 为真时启用
- 已使用 Swup (`@swup/astro`) 进行页面过渡，含 `swup:contentReplaced` 事件
- 图标系统：两套并存
  - Astro 侧：`astro-icon/components` 的 `Icon`（用于 .astro 组件）
  - Svelte 侧：`@/components/common/Icon.svelte` + `@iconify/svelte/offline` + `@/constants/icons-data.json`（用于 .svelte 组件）
- i18n：枚举 `I18nKey` + `i18n(key:I18nKey):string`，模板替换需手动 `.replace('{x}', val)`
- 侧边栏组件映射在 `src/components/layout/SideBar.astro` 的 `componentMap` 中
- 现有 `type: "stats"` 侧边栏组件指向 `widget/SiteStats.astro`（纯静态构建时计算）

### KV 目标配置（用户指定）
- Namespace 名称：`y7blog`
- Namespace ID：`6200959951c44786a050133b6fe6ab13`
- Binding 名称：`Y7BLOG_KV`
- 仅服务端可访问

---

## Functional Requirements

### FR-1：Astro 输出模式与 Cloudflare Adapter 常量化
- **当前问题**：`astro.config.mjs` 仅当 `CF_WORKERS` 为真才挂载 cloudflare adapter；无 adapter 时 API endpoint 静态化，POST 无法工作
- **要求**：
  - 无条件启用 `@astrojs/cloudflare` adapter（删除 `CF_WORKERS` 条件）
  - `defineConfig` 显式设置 `output: 'hybrid'`
  - 4 个 analytics API 文件首行写 `export const prerender = false;`
  - 所有现有页面默认保持 prerender（hybrid 默认行为），构建零变化

### FR-2：Cloudflare KV Binding 声明
- 同时写入两个 wrangler 文件：
  - `wrangler.jsonc`：`kv_namespaces = [{ binding = "Y7BLOG_KV", id = "6200959951c44786a050133b6fe6ab13" }]`
  - `wrangler.toml`：`[[kv_namespaces]]` 同样内容
- `src/env.d.ts` 声明 `Astro.locals.runtime.env.Y7BLOG_KV: KVNamespace`（兼容本地不存在情形，TS 不报错）

### FR-3：Analytics 类型层
- 新建 `src/types/analytics.ts`：
  ```ts
  export interface SiteAnalyticsStats {
    totalViews: number;
    totalVisitors: number;
    monthlyViews: number;
    monthlyVisitors: number;
    dailyViews: number;
    dailyVisitors: number;
  }
  export interface ArticleAnalyticsStats { slug: string; views: number; }
  export interface DynamicAnalyticsStats { id: string; views: number; }
  export type AnalyticsViewType = 'site' | 'article' | 'dynamic';
  export interface AnalyticsViewRequest {
    type: AnalyticsViewType;
    slug?: string;   // type=article 时必填
    id?: string;     // type=dynamic 时必填
  }
  ```

### FR-4：analyticsConfig 扩展（不冲突）
- 修改 `src/config/analyticsConfig.ts`，在保留现有 `googleAnalyticsId / microsoftClarityId / umamiAnalytics / la51Analytics` 字段的前提下，顶层新增：
  ```ts
  enabled: true;          // 本站 KV 统计总开关；false 时 Service 全部 no-op
  siteStats: true;        // SiteStatsCard / /stats 页是否启用
  articleViews: true;     // 文章页是否记录并显示阅读量
  dynamicViews: true;     // 动态是否记录并显示阅读量
  statsPage: true;        // /stats/ 页面是否注册（false 时 404）
  ```
- 同步修改 `src/types/analyticsConfig.ts` 类型

### FR-5：统一数字格式化工具
- 新建 `formatNumber(n: number): string` 放在 `src/utils/analytics.ts`（或独立 `src/utils/number-format.ts`）
- 逻辑：`n.toLocaleString('en-US')` → `12,836` / `1,000,000`
- 所有统计卡、文章阅读量、动态阅读量、统计页面数字必须调用此函数，禁止散落写 `toLocaleString`

### FR-6：Analytics Service（核心）
- 新建 `src/utils/analytics.ts`，导出：
  - `getSiteStats(kv): Promise<SiteAnalyticsStats>`
  - `getArticleViews(kv, slug): Promise<ArticleAnalyticsStats>`
  - `getDynamicViews(kv, id): Promise<DynamicAnalyticsStats>`
  - `recordView(kv, req, type, slug?, id?): Promise<void>`
  - `formatNumber(n: number): string`
- **KV Key 设计（严格用户指定）**：
  | 用途 | Key 模板 |
  |---|---|
  | 总浏览 | `analytics:site:views` |
  | 总访客 | `analytics:site:visitors` |
  | 当日浏览 | `analytics:day:{YYYY-MM-DD}:views` |
  | 当日访客 | `analytics:day:{YYYY-MM-DD}:visitors` |
  | 当月浏览 | `analytics:month:{YYYY-MM}:views` |
  | 当月访客 | `analytics:month:{YYYY-MM}:visitors` |
  | 文章阅读 | `analytics:article:{slug}:views` |
  | 动态阅读 | `analytics:dynamic:{id}:views` |
  | UV 去重(日) | `analytics:uv:day:{YYYY-MM-DD}:{visitorHash}` |
  | UV 去重(月) | `analytics:uv:month:{YYYY-MM}:{visitorHash}` |
  | UV 去重(全) | `analytics:uv:all:{visitorHash}` |
- **日期格式**：`YYYY-MM-DD` / `YYYY-MM`，时区使用 `siteConfig.timezone || 'Asia/Shanghai'`，用 dayjs tz 或原生偏移计算
- **visitorHash 生成（服务端，不存 IP）**：
  - 取 `CF-Connecting-IP` / `X-Forwarded-For` 首段 或 request.socket IP
  - 与 User-Agent、日期字符串拼接
  - `SHA-256(IP + UA + dateKey)` 生成 64 字符 visitorHash
  - 不把 IP 直接写进 KV key
- **PV 原子递增**：用 `KV.getWithMetadata` → `parseInt || 0` → `+1` → `KV.put(key, String(newVal))`；并发竞争可接受（用户要求仅 KV，不引入 Durable Object）
- **UV 判定**：
  - 同一天：尝试 `KV.put(uvDayKey, '1', { expirationTtl })`，若 key 已存在则不增加当日/当月/总访客
  - UV Key TTL 建议：day `86400*2`，month `86400*35`，all 可永久无 TTL 或 `86400*366*2`
- **Bot 过滤（轻量）**：UA 忽略大小写正则匹配 `bot/crawl/spider/slurp/headless/phantom/puppeteer/selenium/curl/wget/python-requests/httpclient/scrapy`，命中直接跳过不计 PV/UV
- **Admin 页面排除**：URL pathname 以 `/admin` 开头直接跳过不记录
- **API 请求排除**：pathname 以 `/api/` 开头跳过
- **Fail-safe**：所有 KV 读写包裹 try/catch，出错返回默认 0 计数，不抛异常

### FR-7：Analytics API 层（4 个文件，全部 `prerender=false`）
1. **`POST /api/analytics/view`**（`src/pages/api/analytics/view.ts`）
   - 请求体 JSON：`{ type: 'site' | 'article' | 'dynamic'; slug?: string; id?: string }`
   - 白名单校验：`type` 非三种之一或 slug/id 缺失对应项 → 400
   - 字符串长度限制：slug/id ≤ 512
   - 调用 Service `recordView`
   - 响应：`{ success: true }` / 静默 500（前端不关心错误详情）
2. **`GET /api/analytics/stats`**（`src/pages/api/analytics/stats.ts`）
   - 返回：`SiteAnalyticsStats` 6 项 JSON
   - `Cache-Control: public, max-age=30, s-maxage=60, stale-while-revalidate=120`
3. **`GET /api/analytics/article?slug=xxx`**
   - 返回：`{ views: number }`，不存在 views=0
   - Cache `s-maxage=20`
4. **`GET /api/analytics/dynamic?id=xxx`**
   - 返回：`{ views: number }`，不存在 views=0
   - Cache `s-maxage=20`
5. **失败降级**：Y7BLOG_KV 不存在（本地开发）→ 所有 API 返回默认值，不 500

### FR-8：自定义 SVG 图标系统
- **目标**：统一管理自定义 SVG，支持 Astro 与 Svelte 两套组件调用，达到 `<Icon name="custom:views" />` 风格
- **SVG 存放位置**：`src/icons/custom/`（新目录，与现有 `src/icons/*.svg` 平级）
- **SVG 编写要求**：
  - 全部 `viewBox="0 0 24 24"`
  - 颜色使用 `fill="currentColor"` 或 `stroke="currentColor"`
  - 禁止硬编码 `#color`
- **至少 5 个自定义 SVG**（用户指定）：
  1. `views.svg`：眼睛/浏览图标
  2. `visitors.svg`：用户/访客图标
  3. `articles.svg`：文章/文档图标
  4. `dynamics.svg`：动态/消息/气泡图标
  5. `analytics.svg`：柱状图/统计图标
- **接入方式**：
  - 不新建第二套 Icon 组件；复用现有 astro-icon 的 include 配置 + Icon.svelte addCollection 机制
  - 在 `astro.config.mjs` 的 `icon({ include: { ... } })` 中新增自定义集合（若 astro-icon 不支持本地目录，则改为构建脚本把 SVG 转换成 `@iconify/svelte/offline` 可注册的 JSON 格式，并写入 `src/constants/icons-data.json`；或两者同时做）
  - 在 `Icon.svelte` 启动时通过 `addCollection({ prefix: 'custom', icons: {...}, width:24, height:24 })` 注册 `custom` 前缀
- **调用方式**：
  - Astro 侧：`<Icon name="custom:views" />`（astro-icon）
  - Svelte 侧：`<Icon icon="custom:views" />`（Icon.svelte）

### FR-9：SiteStatsCard 可复用组件
- **文件**：`src/components/Analytics/SiteStatsCard.astro`（若项目已有更合适目录则按实际结构）
- **Props**：
  ```ts
  interface Props {
    showTotalViews?: boolean;      // default true
    showTotalVisitors?: boolean;   // default true
    showMonthlyViews?: boolean;    // default true
    showMonthlyVisitors?: boolean; // default true
    showDailyViews?: boolean;      // default true
    showDailyVisitors?: boolean;   // default true
    className?: string;
    style?: string;
  }
  ```
- **Props 支持 Astro props；若不方便则退回读取 analyticsConfig 中 siteStats 子配置控制**
- **UI 结构（用户指定）**：
  ```
  ┌──────────────────────────────┐
  │ 📊 站点统计                  │
  │ 12,836        3,421          │
  │ 总浏览量      总访客          │
  │ 3,286         821            │
  │ 本月浏览      本月访客        │
  │ 286           73             │
  │ 今日浏览      今日访客        │
  └──────────────────────────────┘
  ```
  （正式 UI：📊 替换为 `custom:analytics` SVG）
- **渲染**：SSR 骨架 `--`；组件内 `<script client:idle>` 异步 `fetch('/api/analytics/stats')` 更新数字；失败保留 `--` 或 0
- **布局网格**：
  - PC (≥768px)：3×2（3 行 2 列）
  - 手机 (<768px)：2×3（2 列 3 行，或保持 2 列自动换行）
- **样式**：复用现有 `card-base`、`--radius-2xl`、Tailwind 类，深色模式跟随 CSS 变量

### FR-10：ViewCount 可复用组件（统一文章 + 动态）
- **文件**：`src/components/Analytics/ViewCount.astro`
- **Props**：
  ```ts
  interface Props {
    type: 'article' | 'dynamic';
    slug?: string;   // article 时
    id?: string;     // dynamic 时
    showLabel?: boolean;  // 文章时默认 true → "X 次阅读"；动态时默认 false → 仅"X"
    className?: string;
  }
  ```
- **结构**：`<span class="inline-flex items-center gap-[5px]"><Icon name="custom:views" /><span>--</span></span>`
- **SSR 骨架 `--`**；`client:idle` 脚本根据 `type` fetch `/api/analytics/article?slug=xxx` 或 `/api/analytics/dynamic?id=xxx` 更新数字
- **数字**：使用 `formatNumber`

### FR-11：首页统计卡接入
- 首页不是组件直接写死：把 SiteStatsCard 组件加入侧边栏配置更合适
- **方案**（由用户当前 `type: "stats"` 指向旧 SiteStats.astro 的约定保持不变，避免冲突）：
  - 方案 A：在 `src/config/sidebarConfig.ts` 的 rightComponents 中**新增**一个可选的 `analyticsStats` 组件类型（`type: "analyticsStats"`，默认 enable:true），并在 `SideBar.astro` 的 componentMap 添加 `analyticsStats: SiteStatsCard` 映射
  - 方案 B：若 A 不可行，则在 `MainGridLayout` 的首页（`isHomePageCheck === true`）内容区上方或下方单独渲染 `<SiteStatsCard />`，用响应式类控制
- **关键性能**：首页只渲染 1 张 SiteStatsCard 异步请求（`GET /api/analytics/stats`），**不为首页文章列表单独请求阅读量**（FR-14 强制）

### FR-12：文章阅读量显示（仅文章详情页）
- **插入位置**：`src/pages/posts/[...slug].astro` 的 PostMetadata 组件所在区域（或 `PostMeta.astro` 自身新增阅读量区块），与发布日期 / 分类 / 标签等元信息在同一行
- **显示内容**：`[custom:views SVG] 1,286 次阅读`
- **统计记录**：
  - 页面加载时客户端脚本调用 `POST /api/analytics/view` body `{ type:'article', slug }`
  - 成功后调用 `GET /api/analytics/article?slug=xxx` 取最新计数显示
- **Swup 兼容**：同时监听 `DOMContentLoaded` 和 `swup:contentReplaced`

### FR-13：动态阅读量显示
- **显示位置**：每条动态的 `.dynamic-meta` 区域内，紧跟 time / location 之后
- **两份渲染都要同步修改**（否则一半动态不显示）：
  1. `src/components/pages/dynamic/DynamicItem.astro`（SSR 版）
  2. `src/components/pages/dynamic/DynamicItemTemplate.astro`（Svelte DynamicFeed 客户端克隆模板）
- **显示内容**：动态默认不显示文字标签，仅 `[custom:views SVG] 128`（与现有 UI 紧凑一致）
- **批量加载避免 N+1**：
  - 在动态页面脚本中新增 `GET /api/analytics/dynamics?ids=a,b,c`（或复用 `dynamic` 逐个查询），若批量 API 成本高则第一版允许逐个但需加去重缓存；用户性能要求是首页文章列表不批量，动态页面可允许单条但鼓励批量
- **统计记录**：当前用户要求 "动态阅读量只在动态详情/实际展示逻辑中请求"，动态列表不计 PV，只显示已有 PV；访问动态详情页（若有）时触发 recordView
- **注**：当前项目动态页面是列表锚点形式（`#dynamic-xxx`），若没有独立 detail 路由，则可记录每次页面加载中每个动态 anchor 进入视口（IntersectionObserver）触发一次 recordView（去重）；或简单仅在页面 URL 含动态锚点时为该动态 recordView 一次。实现取最稳妥的方式，避免重复统计。

### FR-14：首页文章列表性能（严格禁止 N+1）
- `PostPage.astro` / `PostCard.astro` **不**在首页调用文章阅读量 API
- 首页文章卡片只显示构建期静态数据（标题、日期、分类、标签、描述、封面）
- 文章阅读量**仅**在 `posts/[...slug].astro` 详情页显示并记录
- 若用户后续想要列表页也显示，应由实现方提供**批量 API（`/api/analytics/articles?slugs=a,b,c...`）** 但第一版不启用

### FR-15：独立统计页面 `/stats/`
- **文件**：`src/pages/stats.astro`（新建）
- **页面开关**：顶部写 `if (!analyticsConfig.statsPage || !siteConfig.pages.stats) return Astro.redirect('/404/');`
- **需新增 `siteConfig.pages.stats` 开关（true）**（位于 `src/config/siteConfig.ts` 的 pages 对象）
- **布局**：复用 `MainGridLayout`（与 `/about/` 同），保留侧边栏 + banner + footer + swup
- **页面内容自上而下**：
  1. **页面标题 & 简介**：标题 "网站统计"；简介 "记录网站访问与内容阅读数据"；走 i18n
  2. **第一部分：网站数据概览**：复用 `<SiteStatsCard />`（6 项全开）
  3. **第二部分：内容数据**：卡片内显示
     - 文章总数（构建期用 `getSortedPosts().length`）
     - 动态总数（构建期从 content collection 读取）
     - 两项分别使用 `custom:articles` 和 `custom:dynamics` SVG
  4. **第三部分（预留）**：趋势统计区域，第一版空占位或仅文字 "Coming soon"，不引入图表库
- **SEO**：title / description 为静态中文描述，实时数字不入 SEO metadata
- **URL 选择**：用户在 `/stats` 与 `/analytics` 之间选；根据当前项目路由（`friends`, `about`, `guestbook`, `sponsor` 均是短单词）→ `/stats/`

### FR-16：Swup 页面切换 + 去重
- 统计请求必须在两种场景触发：
  - 首次页面加载（`DOMContentLoaded` 或 Astro 自带 hydration）
  - Swup 切页完成（`swup:contentReplaced`）
- **同一次页面进入不重复发送**：
  - 使用一个弱标记（如 `data-analytics-sent` 标记在 `document.documentElement` 或 sessionStorage key，基于 pathname + content id 的组合）
  - 刷新或浏览器直接进入：允许重新计数
  - sessionStorage key 格式：`y7_analytics_sent:${pathname}:${Date.now()/60000|0}` 过期策略：5 分钟后同页重新统计（避免用户停留过久再次浏览不计数）
- **后退 / 前进**：Swup 默认 `animateHistoryBrowsing: false`（项目已配置）；若触发 `swup:contentReplaced` 同样按上述去重策略

### FR-17：页面类型判定 & Admin 页面过滤
| 场景 | type |
|---|---|
| 首页 `/` 或 `/[...page]/`（分页）| `site` |
| 文章详情 `/posts/xxx/` | `article` |
| 动态详情（或动态页面 URL 含锚点）| `dynamic` |
| 其他公开页面（`/about/`, `/friends/`, `/archive/`, `/tags/`, `/categories/`, `/stats/`...）| `site` |
| `/api/*` | 跳过不统计 |
| `/admin/*` | 跳过不统计 |

---

## Non-Functional Requirements

### NFR-1：Fail-safe（强约束）
- 所有 API `try/catch`，异常 → 200 + 默认值（0 或 `--`），不 500
- 所有组件端 `fetch().catch(() => {})`，DEV 环境 `console.warn`，生产静默
- 本地 `pnpm dev` 若 `Y7BLOG_KV` 不存在：
  - Service 层检测到 `kv === undefined` 时立即走降级分支（直接返回默认 0）
  - 页面不报 500；`pnpm build` / `pnpm check` 100% 通过

### NFR-2：安全
- 不把 Cloudflare Token、KV 操作暴露到浏览器
- visitorHash 不可逆（SHA-256），不存原始 IP / UA
- POST /api/analytics/view 严格白名单校验（type / slug / id 长度）
- CORS：仅同源允许（默认 Astro SSR 同源）

### NFR-3：TypeScript
- 新文件全部 TS；禁止新增 `any`（除非 Cloudflare Env 不可避免）
- Cloudflare Env 类型完整（`KVNamespace` 在 env.d.ts）

### NFR-4：SEO 零影响
- 不修改 sitemap / RSS / Pagefind / canonical / OG 图 / metadata
- 统计脚本使用 `client:idle` / `defer`，不阻塞首屏

### NFR-5：视觉融合（Rubric 0-2）
- 圆角、间距、字号、图标 currentColor、深色模式完全跟随 PostStats / DynamicItem / Calendar / SiteInfo 现有样式
- 0 = 明显 admin 风 / 白底 / 不一致；1 = 轻微差异；2 = 浑然一体
- 阈值 ≥ 1

### NFR-6：响应式
- 统计卡 320px 视口无横向溢出
- 统计页面 3×2 PC / 2×3 或 1×6 mobile

### NFR-7：可维护性（Rubric 0-2）
- 分层清晰：types → config → utils/service → api → components → pages
- 命名与现有 utils 一致（驼峰、i18n 枚举、SVG 集中在 `src/icons/custom/`）
- 阈值 ≥ 1

---

## Constraints
1. **KV Only**：只使用 Cloudflare KV（Namespace ID 固定），禁止 D1 / Durable Objects / R2
2. **不删现有功能**：旧 `widget/SiteStats.astro`、旧 analyticsConfig 第三方 SDK 字段、旧文章/动态/主题/评论/搜索/壁纸全部保留
3. **不部署**：仅本地代码修改，不 git commit / push / Cloudflare deploy
4. **不修改文章 / Frontmatter**：统计系统完全外置
5. **不引入大型图表库**（趋势预留空）
6. **首页不 N+1 查询文章阅读量**

## Dependencies
- `@astrojs/cloudflare ^14.2.6`（已安装）
- `astro-icon`（已安装）
- `@iconify/svelte` + `@iconify/utils`（已安装，用于 custom SVG JSON 转换）
- `dayjs`（已安装，时区日期计算）
- `wrangler ^4.127.1`（已安装）
- `node:crypto`（内置，SHA-256）

## Assumptions
1. 用户将在 Cloudflare Pages 控制台手动绑定 `Y7BLOG_KV` 到部署环境（wrangler 双文件已写入 Namespace ID 作声明）
2. 本地开发 KV 不可用属于常态 → 默认走优雅降级（views=0），不阻塞任何功能
3. Swup `swup:contentReplaced` 事件正确发射（项目已验证）
4. `siteConfig.timezone` 用于日期计算；默认 Asia/Shanghai

---

## Acceptance Criteria

### AC-1-rule：基础构建通过
- **Given**：代码完成
- **When**：运行 `pnpm check && pnpm build`
- **Then**：两者 exit code 均为 0，无 TS / Astro / 构建错误
- **Pass Condition**：命令均成功
- **Evidence**：终端截图或输出

### AC-2-rule：4 个 API 正确声明 SSR
- **Given**：4 个 API 文件存在
- **When**：grep `export const prerender = false`
- **Then**：4 个文件首行（或前 5 行）存在该声明
- **Pass Condition**：4 命中
- **Evidence**：grep 输出

### AC-3-rule：KV 名称空间双文件声明
- **Given**：wrangler.jsonc 和 wrangler.toml
- **When**：grep `Y7BLOG_KV`
- **Then**：两个文件均出现 binding=Y7BLOG_KV，Namespace ID 正确
- **Evidence**：grep 输出

### AC-4-rule：POST view 错误请求 400
- **Given**：本地运行
- **When**：`curl -X POST /api/analytics/view -d '{"type":"xxx"}'`
- **Then**：HTTP 400；不写入任何 KV
- **Evidence**：curl 输出

### AC-5-rule：Bot UA 跳过统计
- **Given**：POST /api/analytics/view `User-Agent: Googlebot/2.1`
- **When**：查询 `analytics:site:views` 前后
- **Then**：数字不变
- **Evidence**：KV 前后对比或 API 返回默认值时仍不污染

### AC-6-rule：Admin 路径跳过
- **Given**：访问 `/admin/anything`
- **Then**：不发送 view 事件，site PV 不变

### AC-7-rule：API 请求路径跳过
- **Given**：调用 GET /api/analytics/stats
- **Then**：不产生 PV/UV（路径以 `/api/` 开头）

### AC-8-rule：首页统计卡显示 6 项
- **Given**：访问 http://localhost:4321/
- **When**：统计卡加载完成
- **Then**：DOM 出现 6 个数字节点（总浏览、总访客、本月浏览、本月访客、今日浏览、今日访客）+ 5 个自定义 SVG 图标至少出现 analytics + views/visitors 类
- **Evidence**：DevTools DOM 截图

### AC-9-rule：文章阅读量详情页 +1 正常
- **Given**：打开一篇文章详情
- **When**：刷新页面 2 次
- **Then**：文章 views 计数 +2（同访客同一天 UV 不增加但 PV 增加）
- **Evidence**：GET /api/analytics/article?slug=xxx 数值前后对比

### AC-10-rule：两篇文章独立计数
- **Given**：文章 A 访问 5 次，文章 B 访问 3 次
- **Then**：A.views=5, B.views=3（不共享）

### AC-11-rule：动态阅读量独立计数
- **Given**：动态 X 访问 5 次，动态 Y 访问 3 次
- **Then**：X.views=5, Y.views=3

### AC-12-rule：首页文章列表无 N+1 请求
- **Given**：访问首页，打开 DevTools Network
- **When**：首页完成加载
- **Then**：Filter `/api/analytics/article` 的请求数量 = 0；仅出现 1 条 `/api/analytics/stats`（若统计卡放在首页）或 0 条（若统计卡仅侧边栏）

### AC-13-rule：统计页面 `/stats/` 正常工作
- **Given**：访问 http://localhost:4321/stats/
- **Then**：HTTP 200；页面 3 部分出现（网站数据概览 / 内容数据 / 趋势预留）

### AC-14-rule：Swup 切页统计正常
- **Given**：从首页 → 点击一篇文章（通过 Swup 过渡，不刷新）
- **Then**：触发 POST /api/analytics/view（article）1 次；首页切到文章后不重复发送首页 site 多次

### AC-15-rule：同页刷新 UV 不重复（同一天）
- **Given**：同一访客（同 IP+UA+同一天）刷新 10 次
- **Then**：dailyVisitors 只 +1；dailyViews +10

### AC-16-rule：自定义 SVG 全部使用 currentColor
- **Given**：5 个 SVG 文件存在
- **When**：grep `currentColor` 每个文件
- **Then**：每个 SVG 至少出现一次 `currentColor`；不出现硬编码 `#` 颜色（除非 `#00000000`/透明）

### AC-17-rule：SVG 图标调用可用
- **Given**：astro-icon 和 Icon.svelte 注册完成
- **When**：`<Icon name="custom:views" />` 在 astro 组件渲染；`<Icon icon="custom:visitors" />` 在 svelte 组件渲染
- **Then**：DOM 中出现 SVG 节点，不出现 "Icon not found" 占位

### AC-18-rule：数字格式 1,286 风格
- **Given**：12836 → `formatNumber(12836)`
- **Then**：返回 `"12,836"`；统计卡、文章、动态显示均无 `1.2k` / `12.8k`

### AC-19-rule：analyticsConfig.enabled=false 全静默
- **Given**：`analyticsConfig.enabled = false`
- **When**：访问所有页面 + API
- **Then**：Service 返回默认 0；API 返回默认；不写入 KV；控制台无 JS 错误

### AC-20-rule：Fail-safe - API 500 时页面正常
- **Given**：手动使 KV 抛出异常（如注释掉正确 binding）
- **When**：访问所有页面
- **Then**：页面正文正常渲染；统计位置显示 `--` 或 0；无白屏 / 500

### AC-21-rule：深色模式自适应
- **Given**：切换到 Dark Mode
- **When**：观察统计卡 / 阅读量文字颜色
- **Then**：使用 CSS 变量 / dark: 类；无白底 / 不可读颜色

### AC-22-rule：Mobile 响应式
- **Given**：Chrome DevTools 320×640
- **When**：首页 & /stats/
- **Then**：统计卡无横向滚动条；统计项布局为 2 列或紧凑单列

### AC-23-rubric：视觉融合度
- **Dimension**：UI 与现有主题一致性
- **Scale**：0-2
- **Anchors**：0 = 明显第三方 Admin 风；1 = 基本一致，少量间距/字号/圆角差异；2 = 浑然一体（圆角/内边距/字体权重/图标风格 全跟随 PostStats/DynamicItem）
- **Pass Threshold**：≥ 1
- **Evidence**：首页与统计页 Light+Dark 截图

### AC-24-rubric：代码分层 & 可维护性
- **Dimension**：架构整洁度
- **Scale**：0-2
- **Anchors**：0 = API 组件直接写 KV 操作混杂 / SVG 散落 / formatNumber 多处重复；1 = 分层清晰，少量重复；2 = types/config/utils/service/api/components/pages 七层完美分层，零重复
- **Pass Threshold**：≥ 1
- **Evidence**：新增文件列表 + grep 未出现 KV put/get 出现在 API 层以外

### AC-25-rule：i18n 枚举调用
- **Given**：新增翻译键
- **When**：grep 所有 `i18n(` 调用
- **Then**：新增统计相关文案均通过 `I18nKey.statsXxx` 枚举，不出现裸字符串

### AC-26-rule：侧边栏旧 widget/SiteStats.astro 未被修改
- **Given**：完成所有修改
- **When**：`git diff src/components/widget/SiteStats.astro`
- **Then**：输出为空（保持原静态文章统计）

---

## Open Questions
- [ ] 无（用户 47 条需求已覆盖全部设计决策）
