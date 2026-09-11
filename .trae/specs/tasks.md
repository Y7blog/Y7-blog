# Y7 Blog 统一 Analytics 统计系统 - 实现任务清单 (KV 版)

> 依赖关系自上而下。前置任务未完成时，后续任务跳过实施。
> 对应 spec.md 26 条 rule AC + 3 条 rubric AC。

---

## Task 1: 基础设施 - Astro hybrid 模式 / KV Binding / 类型 / 开关

**优先级**: high
**状态**: pending
**Depends On**: None
**对应 AC**: AC-1-rule, AC-2-rule, AC-3-rule
**关联文件**:

1. 修改 `astro.config.mjs`：
   - 删除 `const adapter = process.env.CF_WORKERS ? cloudflare(...) : undefined` 条件分支
   - 改为无条件 `adapter: cloudflare({ prerenderEnvironment: "node" })`
   - `defineConfig` 参数对象显式新增一项 `output: 'hybrid'`
2. 修改 `wrangler.jsonc`：新增 `kv_namespaces` 数组项：
   ```jsonc
   "kv_namespaces": [
     {
       "binding": "Y7BLOG_KV",
       "id": "6200959951c44786a050133b6fe6ab13"
     }
   ]
   ```
3. 修改 `wrangler.toml`：同步新增 TOML 格式：
   ```toml
   [[kv_namespaces]]
   binding = "Y7BLOG_KV"
   id = "6200959951c44786a050133b6fe6ab13"
   ```
4. 修改 `src/env.d.ts`：在 `ImportMetaEnv` 接口声明中**可选**声明 `Y7BLOG_KV` 相关；同时扩展 Cloudflare Locals/Env（若 Astro 现有类型扩展位置在 `astro-modules.d.ts` 则在该处声明），目标：`Astro.locals.runtime.env.Y7BLOG_KV` TS 类型可选存在（本地开发 undefined 不报类型错误）
5. 修改 `src/config/siteConfig.ts`：在 pages 对象（`resolvePageToggles({...})` 调用参数）中**新增 `stats: true`**（与 friends/sponsor/dynamic/gallery 等同级）
6. **不**修改 `src/components/widget/SiteStats.astro`（AC-26-rule 验证）

**Test Requirements**:
- `rule` TR-1.1: `astro.config.mjs` grep `CF_WORKERS` 结果为空；grep `output: 'hybrid'` 命中；grep `adapter: cloudflare` 命中且不再嵌套三元
- `rule` TR-1.2: wrangler.jsonc & wrangler.toml 均能被正确解析（JSONC/TOML 语法无错）；均出现 binding=Y7BLOG_KV 和指定 ID
- `rule` TR-1.3: siteConfig.pages.stats === true；TypeScript 类型无新报错
- `rule` TR-1.4: `pnpm check` 运行无 TS 错误新出现（允许老的已存警告）

---

## Task 2: 类型层 / i18n 注册 / analyticsConfig 扩展

**优先级**: high
**状态**: pending
**Depends On**: Task 1
**对应 AC**: AC-19-rule, AC-25-rule
**关联文件**:

1. **新建** `src/types/analytics.ts`：导出 spec FR-3 的 4 个类型：`SiteAnalyticsStats`, `ArticleAnalyticsStats`, `DynamicAnalyticsStats`, `AnalyticsViewType`（字面量联合）, `AnalyticsViewRequest`
2. 修改 `src/types/analyticsConfig.ts`：在 `AnalyticsConfig` 类型新增可选 5 字段：
   ```ts
   enabled?: boolean;
   siteStats?: boolean;
   articleViews?: boolean;
   dynamicViews?: boolean;
   statsPage?: boolean;
   ```
3. 修改 `src/config/analyticsConfig.ts`：保留所有现有字段（GA / Clarity / Umami / 51la）不变；在导出对象顶层**新增 5 字段**（全 true）：enabled, siteStats, articleViews, dynamicViews, statsPage
4. 修改 `src/i18n/i18nKey.ts`：在 enum 末尾新增一组 stats 相关枚举（按分组，注释 `// 网站统计`）：
   ```ts
   // 网站统计
   statsSiteTitle = "statsSiteTitle",
   statsSiteSubtitle = "statsSiteSubtitle",
   statsTotalViews = "statsTotalViews",
   statsTotalVisitors = "statsTotalVisitors",
   statsMonthlyViews = "statsMonthlyViews",
   statsMonthlyVisitors = "statsMonthlyVisitors",
   statsDailyViews = "statsDailyViews",
   statsDailyVisitors = "statsDailyVisitors",
   statsViewCountLabel = "statsViewCountLabel",
   statsArticleTotal = "statsArticleTotal",
   statsDynamicTotal = "statsDynamicTotal",
   statsContentOverview = "statsContentOverview",
   statsOverview = "statsOverview",
   statsTrendPlaceholder = "statsTrendPlaceholder",
   ```
5. 修改全部 6 个语言文件（zh_CN, zh_TW, en, ja, ko, ru）：
   - zh_CN 全部中文语义化（不要机器硬翻的不通顺）
   - en 全部英文回退；ja/ko/ru 可用英文回退（不允许空值）；zh_TW 可繁体或英文
   - 每个 key 必须非空（AC-25-rule 保证通过）

**Test Requirements**:
- `rule` TR-2.1: `src/types/analytics.ts` 存在；grep 5 个类型名全部命中
- `rule` TR-2.2: `analyticsConfig.ts` 与对应 types 5 字段全部存在；老 4 方 SDK 字段（googleAnalyticsId / microsoftClarityId / umamiAnalytics / la51Analytics）一字未删（diff 只增不删）
- `rule` TR-2.3: `i18nKey.ts` 新增枚举 13 个；6 个语言文件各新增对应键位，全部非空字符串；`Object.keys(zh_CN).length` 增加 13
- `rule` TR-2.4: `pnpm check` 通过（TypeScript 枚举 6 语言 Translation 类型闭包匹配）

---

## Task 3: 自定义 SVG 图标系统（5 个 SVG + dual-registration）

**优先级**: high
**状态**: pending
**Depends On**: Task 2
**对应 AC**: AC-16-rule, AC-17-rule
**关联文件**:

1. **新建目录** `src/icons/custom/`（如不存在）
2. **新建 5 个 SVG 文件**（viewBox="0 0 24 24"，全 currentColor，禁用硬编码颜色）：
   - `views.svg`：眼睛图标（类似 material-symbols:visibility-outline-rounded 但自定义简洁版，确保独立无版权顾虑）
   - `visitors.svg`：单人/双人剪影轮廓（访客）
   - `articles.svg`：文档折角或堆叠文档（文章）
   - `dynamics.svg`：对话气泡/消息气泡（动态）
   - `analytics.svg`：竖向三根柱条或上升折线（统计）
3. 修改 `astro.config.mjs` 的 `icon()` integration：若 astro-icon 支持加载本地目录（如 `include.custom = ['views','visitors','articles','dynamics','analytics']` 配合 `src/icons/custom` 被自动发现 → 启用此路径；否则跳过 astro-icon 直接仅用 Icon.svelte 离线集合）
4. 修改 `src/constants/icons-data.json`：**新增** `custom` prefix 集合对象（格式参考 material-symbols）：
   ```json
   {
     "prefix": "custom",
     "icons": {
       "views":     { "body": "<path fill=\"currentColor\" d=\"...\" />" },
       "visitors":  { "body": "<path fill=\"currentColor\" d=\"...\" />" },
       "articles":  { "body": "<path fill=\"currentColor\" d=\"...\" />" },
       "dynamics":  { "body": "<path fill=\"currentColor\" d=\"...\" />" },
       "analytics": { "body": "<path fill=\"currentColor\" d=\"...\" />" }
     },
     "width": 24, "height": 24
   }
   ```
   将其合并到 icons-data.json 根对象下；保持原 material-symbols / fa7-solid / mdi 等集合不变
5. **验证 Icon.svelte 自动注册**：现有 Icon.svelte 会遍历 icons-data.json 调用 addCollection → custom 集合应自动注册成功无需改 Icon.svelte；若失败则在 Icon.svelte 中额外手动 addCollection custom

**Test Requirements**:
- `rule` TR-3.1: 5 SVG 文件存在；每个 grep `currentColor` 命中 ≥1；每个 grep 硬编码十六进制颜色 `#[0-9a-fA-F]{3,8}` 未命中（除 `#00000000` 透明外）
- `rule` TR-3.2: icons-data.json 根对象 `custom` 键存在；icons 子键 views/visitors/articles/dynamics/analytics 全部存在
- `rule` TR-3.3: Astro 侧创建一个临时页面 `<Icon name="custom:views" />` 渲染成功不出 "Icon not found"；Svelte 侧 `<Icon icon="custom:analytics" />` 同样渲染 SVG 成功
- `rule` TR-3.4: 切换 Light/Dark Mode → SVG 颜色随 currentColor（随 `text-black dark:text-white` 或父 color 变化），无白底异常

---

## Task 4: Analytics Service 核心层（utils/analytics.ts）

**优先级**: high
**状态**: pending
**Depends On**: Task 3
**对应 AC**: AC-5-rule, AC-6-rule, AC-7-rule, AC-15-rule, AC-18-rule, AC-19-rule, AC-20-rule
**关联文件**:

1. **新建** `src/utils/analytics.ts`（统一入口，所有 KV 操作在此，API 和 SSR 组件仅调用此模块封装函数，禁止直接 KV.put/get）
2. 导出：
   ```ts
   // 工具
   export function formatNumber(n: number): string;  // n.toLocaleString('en-US')
   export function isBotUA(ua: string | null): boolean;
   export function shouldSkipPath(pathname: string): boolean;  // /api/*, /admin/*
   export function getDateKeys(timezone: string): { dayKey: string; monthKey: string };
   export function hashVisitor(ip: string, ua: string, dateKey: string): string;  // SHA-256 hex 64

   // 查询（均 fail-safe：kv undefined 或抛异常 → 返回默认 zeros，不 throw）
   export async function getSiteStats(kv: unknown): Promise<SiteAnalyticsStats>;
   export async function getArticleViews(kv: unknown, slug: string): Promise<ArticleAnalyticsStats>;
   export async function getDynamicViews(kv: unknown, id: string): Promise<DynamicAnalyticsStats>;

   // 写入（同样 fail-safe）
   export async function recordView(
     kv: unknown,
     params: {
       type: AnalyticsViewType;
       slug?: string;
       id?: string;
       userAgent: string | null;
       ip: string;
       pathname: string;
       timezone: string;
       enabled: boolean;  // analyticsConfig.enabled
     },
   ): Promise<{ recorded: boolean }>;
   ```
3. **recordView 逻辑要点**：
   - `!enabled` → 直接 recorded=false
   - `isBotUA(ua)` → 跳过
   - `shouldSkipPath(pathname)` → 跳过
   - 生成 dayKey (YYYY-MM-DD), monthKey (YYYY-MM), visitorHash = hashVisitor(ip, ua, dayKey)
   - UV day key: `analytics:uv:day:{dayKey}:{hash}` TTL 86400*2 → 尝试 list 或先 get 判断是否存在；不存在 → dailyVisitors +1 + 写入 key
   - UV month key `analytics:uv:month:{monthKey}:{hash}` TTL 86400*35 → 不存在 monthlyVisitors +1
   - UV all key `analytics:uv:all:{hash}` → 不存在 totalVisitors +1
   - PV: site total +1；day +1；month +1
   - type='article' 且 slug 合法：`analytics:article:{slug}:views` +1
   - type='dynamic' 且 id 合法：`analytics:dynamic:{id}:views` +1
   - 所有读写 try/catch；单个子操作失败不影响其他，不抛到外层
4. **KV 调用安全**：参数 `kv: unknown`，内部先判断是否为对象且含 get/put/putWithMetadata 方法（防御式），否则视为"KV 不可用"返回默认值，**不依赖外部 `@cloudflare/workers-types` 全局类型（避免本地无类型环境 pnpm check 失败）**

**Test Requirements**:
- `rule` TR-4.1: `formatNumber(12836) === '12,836'`; `formatNumber(1000000) === '1,000,000'`
- `rule` TR-4.2: `isBotUA('Googlebot/2.1 (+http://www.google.com/bot.html)') === true`; `isBotUA('Mozilla/5.0 ... Chrome/120') === false`
- `rule` TR-4.3: `shouldSkipPath('/api/analytics/stats') === true`; `shouldSkipPath('/admin/dashboard') === true`; `shouldSkipPath('/posts/hello/') === false`
- `rule` TR-4.4: 模拟 kv=undefined → getSiteStats 返回 `{ totalViews:0, totalVisitors:0, monthlyViews:0, monthlyVisitors:0, dailyViews:0, dailyVisitors:0 }` 不抛异常
- `rule` TR-4.5: analyticsConfig.enabled=false 传入 recordView → recorded=false；KV 零写入
- `rubric` TR-4.6: 代码分层整洁度；Dimension: Service 单一职责 + 注释（若无注释但命名清晰也可）；Scale 0-2；Anchors 0 = 函数超过 150 行杂乱 / 1 = 函数拆分合理少量重复 / 2 = 纯函数 30 行以内每函数职责清晰；阈值 ≥1；Evidence 为文件行数和函数清单

---

## Task 5: 4 个 Analytics API 路由

**优先级**: high
**状态**: pending
**Depends On**: Task 4
**对应 AC**: AC-2-rule, AC-4-rule, AC-5-rule, AC-20-rule
**关联文件**（全部新建）：

1. **新建** `src/pages/api/analytics/view.ts`：
   - 第一行 `export const prerender = false;`
   - 仅接受 POST；其他方法 → 405
   - 读 body JSON 后严格白名单：
     - `type ∈ {'site','article','dynamic'}`；否则 400
     - `type='article'` 时 `slug` 非空且 ≤ 512；否则 400
     - `type='dynamic'` 时 `id` 非空且 ≤ 512；否则 400
   - 取 UA = `request.headers.get('user-agent')`，IP = 优先 `CF-Connecting-IP` → `X-Forwarded-For` 第一段 → socket remoteAddress；本地无则 '127.0.0.1'
   - 取 `kv = (Astro.locals as any)?.runtime?.env?.Y7BLOG_KV`（any 访问避免本地类型未扩展时报错；类型严格由 Service 内部防御）
   - `import { analyticsConfig } from '@/config'` 取 enabled + siteConfig.timezone
   - `await recordView(kv, { ... })`
   - 响应 200 `{ success: true }`；任何异常（含 body 解析失败 + KV 报错）→ 200 `{ success: false, error: 'silent' }`（但不 500，前端统一按 success=false 忽略）

2. **新建** `src/pages/api/analytics/stats.ts`：
   - `export const prerender = false;`
   - 仅接受 GET
   - `return new Response(JSON.stringify(await getSiteStats(kv)), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=120' }})`
   - 异常 → 200 + zeros JSON，不 500

3. **新建** `src/pages/api/analytics/article.ts`：
   - `export const prerender = false;`
   - `slug = Astro.url.searchParams.get('slug') || ''`；空或 >512 → 400
   - `return new Response(JSON.stringify(await getArticleViews(kv, slug)), { headers: {'Cache-Control':'public, s-maxage=20'} })`

4. **新建** `src/pages/api/analytics/dynamic.ts`：
   - `export const prerender = false;`
   - 同上 id 参数

**Test Requirements**:
- `rule` TR-5.1: 4 文件 grep `export const prerender = false` 全部命中
- `rule` TR-5.2: `POST /api/analytics/view` body=`{"type":"invalid"}` → 400；body=`{"type":"article","slug":"a".repeat(600)}` → 400
- `rule` TR-5.3: `GET /api/analytics/stats` → HTTP 200；返回 JSON 6 个键名（totalViews totalVisitors monthlyViews monthlyVisitors dailyViews dailyVisitors）全部数值类型
- `rule` TR-5.4: `GET /api/analytics/article?slug=nonexistent` → `{"views":0}`；KV undefined 同样 200
- `rule` TR-5.5: POST view 带 User-Agent: `curl/7.0` → KV 不增长（bot 跳过）

---

## Task 6: SiteStatsCard 可复用组件

**优先级**: high
**状态**: pending
**Depends On**: Task 5
**对应 AC**: AC-8-rule, AC-18-rule, AC-21-rule, AC-22-rule, AC-23-rubric
**关联文件**（新建）:

1. **新建目录**（如不存在）`src/components/Analytics/`
2. **新建** `src/components/Analytics/SiteStatsCard.astro`：
   - Props 接口（spec FR-9），所有 show* 默认 true
   - 读取 `analyticsConfig.siteStats` 作为全局开关（若 false 渲染空 div 不做请求）
   - 结构：
     - 外层：`WidgetLayout`（复用现有 `@/components/common/WidgetLayout.astro`）或等价 `card-base` 容器 + `--radius-2xl` 圆角；保证与侧边栏其他卡片视觉一致
     - Header：左 `<Icon name="custom:analytics" />` + 右标题 `i18n(I18nKey.statsSiteTitle)`；副标题可选小字 `statsSiteSubtitle`
     - Grid：`grid grid-cols-2 md:grid-cols-2 gap-4 px-4 py-3`（移动端 2 列，PC 保持 2 列以实现 3 行 × 2 列）
     - 6 项按配置显示与否：
       1. 总浏览：icon=custom:views, label=statsTotalViews, data-total-views
       2. 总访客：icon=custom:visitors, label=statsTotalVisitors, data-total-visitors
       3. 本月浏览：icon=custom:views (或 analytics), label=statsMonthlyViews, data-monthly-views
       4. 本月访客：icon=custom:visitors, label=statsMonthlyVisitors, data-monthly-visitors
       5. 今日浏览：icon=custom:views, label=statsDailyViews, data-daily-views
       6. 今日访客：icon=custom:visitors, label=statsDailyVisitors, data-daily-visitors
   - 所有数字 SSR 骨架 `--`
   - `<script client:idle>` 异步：
     ```ts
     async function load() {
       try {
         const res = await fetch('/api/analytics/stats', { cache: 'no-store' });
         if (!res.ok) return;
         const d = await res.json();
         // 更新 6 个 data-* 节点 .textContent = formatNumberFromApi(d.xxx)
         // 注意：formatNumber 函数在 client 侧单独内联实现（utils/analytics.ts 是服务端 + KV，不可直接在浏览器 import；客户端 copy 一份简单 toLocaleString 包装）
       } catch { /* ignore */ }
     }
     // DOMContentLoaded 立即执行；同时监听 swup:contentReplaced 再执行一次
     ```
   - 颜色：label secondary text (`text-neutral-500 dark:text-neutral-400`), 数字 `font-bold text-neutral-900 dark:text-neutral-100`；图标 `text-(--primary)`

**Test Requirements**:
- `rule` TR-6.1: 6 个数字 DOM 节点存在（默认 props=全 true）；关闭 `showDailyViews={false}` → 对应节点 DOM 数量 -1
- `rule` TR-6.2: 数字 `12836` 显示为 `12,836`（不出现 1.2k / 12.8k）
- `rule` TR-6.3: DevTools Network 模拟 /api/analytics/stats 500 → 页面骨架 `--` 保留，无 JS console.error 中断
- `rule` TR-6.4: DevTools dark mode 切换 → 数字与标签颜色跟随；图标 primary 色不变；无白底/硬编码颜色
- `rubric` TR-6.5 (对应 AC-23)：视觉融合度评分 0-2，阈值 ≥1

---

## Task 7: ViewCount 可复用组件（统一文章/动态）

**优先级**: medium
**状态**: pending
**Depends On**: Task 5
**对应 AC**: AC-9-rule, AC-11-rule, AC-18-rule
**关联文件**（新建）:

1. **新建** `src/components/Analytics/ViewCount.astro`：
   - Props：`type: 'article' | 'dynamic'; slug?: string; id?: string; showLabel?: boolean; className?: string;`
   - showLabel 默认：article=true, dynamic=false
   - DOM：`<span class:list={['inline-flex items-center gap-[5px] align-middle', className]} data-view-count data-type={type} data-slug={slug || ''} data-id={id || ''}>`
     - `<Icon name="custom:views" class="text-sm" />`
     - `<span data-view-num class="font-medium">--</span>`
     - `{showLabel && <span class="ml-1 text-xs">&nbsp;{i18n(I18nKey.statsViewCountLabel)}</span>}`
   - `<script client:idle>`：
     - 从根节点读 dataset → 拼装 URL（article → `/api/analytics/article?slug=xxx`；dynamic → `/api/analytics/dynamic?id=xxx`）
     - fetch → res.ok → JSON.views → `formatNumberClient(views)` 更新 data-view-num
     - 失败：不报错，保留 `--`
     - 同时绑定 DOMContentLoaded 和 swup:contentReplaced（带 dedupe：已填充数字则跳过）
   - client 侧 formatNumberClient 同样简单内联 copy，避免 import 服务端文件

**Test Requirements**:
- `rule` TR-7.1: article showLabel=true 渲染结果包含 "浏览量" 文本；dynamic 默认 showLabel=false 只出数字
- `rule` TR-7.2: data-type 与 data-slug/id 属性正确渲染；JS 执行后 data-view-num 被 fetch 后更新（非 --）
- `rule` TR-7.3: 数字格式同上 `1,286`

---

## Task 8: 首页接入 SiteStatsCard + 侧边栏组件映射

**优先级**: high
**状态**: pending
**Depends On**: Task 6
**对应 AC**: AC-8-rule, AC-12-rule, AC-26-rule
**关联文件**（修改）:

1. 修改 `src/config/sidebarConfig.ts`：
   - 在 `rightComponents` 数组中**紧挨着旧的 `type: "stats"` 附近新增**一项：
     ```ts
     {
       type: "analyticsStats",
       enable: true,
       position: "top",
       showOnPostPage: false, // 首页侧边栏显示，文章页不显示
       showTitle: false,
     },
     ```
   - 旧 `type: "stats"` 一项**保留不动**（AC-26-rule）
2. 修改 `src/components/layout/SideBar.astro`：
   - 顶部 import：`import SiteStatsCard from "@/components/Analytics/SiteStatsCard.astro";`
   - 在 `componentMap` 对象中**新增**键：`analyticsStats: SiteStatsCard,`（与 profile/stats 等同级）
   - WidgetLayout 包装的判断：SiteStatsCard 自身内部已用 WidgetLayout 或需要外层包装？需检查并调整：若 SiteStatsCard 已自带 WidgetLayout → 直接用组件透传 widgetConfig；若未自带 → 组件改为在 SideBarColumn 中渲染时仍走 WidgetLayout wrapper 或在 SiteStatsCard 内补上

**Test Requirements**:
- `rule` TR-8.1: 首页（非文章详情页）右侧边栏 DOM 出现 analyticsStats 组件（data-total-views 节点存在）
- `rule` TR-8.2: 文章详情页由于 showOnPostPage=false → 侧边栏不渲染 analyticsStats
- `rule` TR-8.3: 首页 Network `/api/analytics/article` 请求数量恒为 0（AC-12-rule 严格禁止 N+1）；仅出现至多 1 条 `/api/analytics/stats`
- `rule` TR-8.4: 旧 `type: "stats"`（SiteStats.astro 显示文章数/字数/运行天数）未受影响（widget 仍然存在）

---

## Task 9: 文章详情页阅读量接入 + 访问记录（recordView）+ Swup 去重

**优先级**: high
**状态**: pending
**Depends On**: Task 7
**对应 AC**: AC-9-rule, AC-10-rule, AC-14-rule, AC-15-rule
**关联文件**:

1. 修改 `src/components/layout/PostMeta.astro`：
   - 顶部新增 import：`import ViewCount from "@/components/Analytics/ViewCount.astro";` + `import { analyticsConfig } from "@/config";`
   - 在现有「分类」「标签」之后，「twikoo/waline/artalk visitorCount」区块之前（或之后；视觉合适即可），**当 `!isHome && analyticsConfig.articleViews && id`** 为真时插入：
     ```astro
     {!isHome && analyticsConfig.articleViews && id && (
       <ViewCount type="article" slug={id} showLabel={true} className="meta-view-count" />
     )}
     ```
   - 中间插入分隔符 `|`（与 words/minutes 相同的 divider 样式 class `dividerClass` 或保持一致视觉）
2. 修改 `src/pages/posts/[...slug].astro`：
   - 在 `<script client:idle>`（或新增一个）中，添加 recordView 调用 + Swup 去重逻辑：
     ```ts
     (function () {
       const slug = document.body.dataset?.postSlug; // 需在 body 或 swup-container 上写 data-post-slug={slug}
       if (!slug) return;
       function sendOnce() {
         const key = `y7_analytics_sent:article:${slug}:${Math.floor(Date.now()/300000)}`;
         if (window.sessionStorage && sessionStorage.getItem(key)) return;
         fetch('/api/analytics/view', {
           method: 'POST',
           headers: {'Content-Type':'application/json'},
           body: JSON.stringify({ type:'article', slug }),
           keepalive: true, credentials: 'same-origin'
         }).catch(()=>{});
         sessionStorage?.setItem(key, '1');
         // 同时刷新一次当前文章阅读量数字（recordView 之后 +1）
         // setTimeout 再 fetch /api/analytics/article?slug=xxx 并更新 ViewCount 节点
       }
       // 在 post [...slug].astro 模板中给主容器 div 写 data-post-slug={slug} 供脚本读取
       // 挂载：DOMContentLoaded & swup:contentReplaced 各一次
       if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sendOnce);
       else sendOnce();
       // 只注册一次 Swup 监听器（避免 Swup 切页脚本重新初始化重复注册）：守卫
       if (!(window as any).__analyticsPostViewInit) {
         (window as any).__analyticsPostViewInit = true;
         document.addEventListener('swup:contentReplaced', () => { setTimeout(sendOnce, 80); });
       }
     })();
     ```
   - 在 [...slug].astro 主内容容器（swup-container 内部 wrapper）加属性 `data-post-slug={slug}`（slug 取 props entry.id 去除扩展名）

**Test Requirements**:
- `rule` TR-9.1: 打开文章详情，DOM 中 `ViewCount` 的图标 + 文本出现；刷新两次 → GET article?slug views 值前后 +2
- `rule` TR-9.2: POST /api/analytics/view body.type==article 命中；刷新 10 次同文章同一天 → dailyVisitors 只 +1（KV 层保证），dailyViews +10
- `rule` TR-9.3: 从首页 Swup 切到此文章页（不刷新）→ 仍然触发一次 POST view（不会因 hydration 缺失）
- `rule` TR-9.4: 同 IP+UA 打开文章 A + B 各 3 次 → A.views=3, B.views=3（互不共享计数）

---

## Task 10: 动态阅读量显示 + recordView 稳妥策略

**优先级**: medium
**状态**: pending
**Depends On**: Task 7
**对应 AC**: AC-11-rule, AC-14-rule
**关联文件**（修改两处 DynamicItem + 动态页脚本）:

1. 修改 `src/components/pages/dynamic/DynamicItem.astro`（SSR 版）：
   - import ViewCount + analyticsConfig
   - 在 `.dynamic-meta` div 内部，`location` span 之后新增：
     ```astro
     {analyticsConfig.dynamicViews && (
       <span class="dynamic-views-count inline-flex items-center gap-1">
         <ViewCount type="dynamic" id={entry.id} showLabel={false} className="dynamic-view-count-item" />
       </span>
     )}
     ```
   - 若 entry.id 含扩展名（`.md`），使用 `dynamicSlug(entry.id)` 去除；与 KV key `analytics:dynamic:{id}` 保持一致
2. 修改 `src/components/pages/dynamic/DynamicItemTemplate.astro`（Svelte DynamicFeed 克隆模板）：
   - 同样位置插入同结构 DOM，使用 data 属性占位，供 JS 回填（因为模板为 `<template>` 内 Astro 组件不会运行 client script）：
     ```astro
     {analyticsConfig.dynamicViews && (
       <span class="dynamic-views-count inline-flex items-center gap-1" data-dynamic-view-item>
         <!-- 这里使用 astro-icon Icon + 占位数字 <span data-dynamic-view-num>--</span> -->
         <!-- 同时把 dynamic id 写到父级 <dynamic-entry> 上 data-dynamic-id="{id}"（模板用占位 {id} 替换逻辑需要遵循现有 DynamicItemTemplate.astro 的克隆渲染机制） -->
       </span>
     )}
     ```
   - 需要理解现有 DynamicItemTemplate.astro 中 Svelte 如何通过 template clone 渲染数据 → 保证 id 能传递到 DOM dataset
3. 修改 `src/pages/dynamic/index.astro`：
   - 在 `<script client:load>`（或新增）中添加：
     - **批量获取显示**：遍历所有 `<dynamic-entry data-dynamic-entry-id>`（或 dataset）收集 ids，构建 `/api/analytics/dynamics?ids=id1,id2,...`（如未做批量 API 则降级逐个 fetch + 用 Map 缓存），找到对应 `[data-dynamic-view-num]` 更新 formatNumber
     - **recordView 策略（最简稳妥）**：只在 URL `hash` 含 `#dynamic-xxx` 时，解出 id，发送 POST /api/analytics/view body=`{type:'dynamic', id}`，带同 sessionStorage 去重；纯列表浏览不记 PV（满足「动态详情/实际展示逻辑中」这一要求）
   - 同样守卫监听器 `__analyticsDynamicInit`，绑定 `swup:contentReplaced` + `hashchange` 事件

**Test Requirements**:
- `rule` TR-10.1: SSR 动态项（页面初始渲染）的每条动态 `.dynamic-meta` 中出现眼睛图标 + `--` 占位数字
- `rule` TR-10.2: 打开包含动态项页面 → 3 秒后所有 `--` 被替换为实际数字（0 或已存计数）；动态 X 改 5 次锚点击 → X.views=5，其他不变
- `rule` TR-10.3: 纯列表滚动（无锚点 hash）→ 不触发 recordView POST

---

## Task 11: 独立统计页面 /stats/

**优先级**: high
**状态**: pending
**Depends On**: Task 6, Task 9, Task 10
**对应 AC**: AC-13-rule, AC-6-rule, AC-7-rule, AC-21-rule, AC-22-rule
**关联文件**（新建 + 修改 sitemap filter）:

1. **新建** `src/pages/stats.astro`：
   ```astro
   ---
   import MainGridLayout from "@/layouts/MainGridLayout.astro";
   import SiteStatsCard from "@/components/Analytics/SiteStatsCard.astro";
   import WidgetLayout from "@/components/common/WidgetLayout.astro";
   import { Icon } from "astro-icon/components";
   import { analyticsConfig, siteConfig } from "@/config";
   import I18nKey from "@/i18n/i18nKey";
   import { i18n } from "@/i18n/translation";
   import { getSortedPosts } from "@/utils/content-utils";
   import { getCollection } from "astro:content";
   import { formatNumber } from "@/utils/analytics"; // 纯函数，服务端可安全 import（不读 KV）

   // 页面开关
   if (!analyticsConfig.statsPage || !siteConfig.pages.stats) return Astro.redirect('/404/');

   const title = i18n(I18nKey.statsSiteTitle);
   const desc  = i18n(I18nKey.statsSiteSubtitle);
   const posts = await getSortedPosts();
   const dynamics = (await getCollection('dynamic')).filter(d => !d.data.draft);
   const articleTotal = posts.length;
   const dynamicTotal = dynamics.length;
   ---

   <MainGridLayout title={title} description={desc}>
     <section class="stats-page-container max-w-3xl mx-auto">
       <!-- 1. 网站数据概览 -->
       <div class="mb-6">
         <h2 class="text-xl font-bold mb-3 flex items-center gap-2">
           <Icon name="custom:analytics" />
           <span>{i18n(I18nKey.statsOverview)}</span>
         </h2>
         <SiteStatsCard />
       </div>

       <!-- 2. 内容数据 -->
       <div class="mb-6">
         <h2 class="text-xl font-bold mb-3 flex items-center gap-2">
           <Icon name="custom:articles" />
           <span>{i18n(I18nKey.statsContentOverview)}</span>
         </h2>
         <WidgetLayout showTitle={false}>
           <div class="grid grid-cols-2 md:grid-cols-2 gap-4 px-4 py-3">
             <div class="flex flex-col">
               <div class="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
                 <Icon name="custom:articles" /><span>{i18n(I18nKey.statsArticleTotal)}</span>
               </div>
               <div class="text-2xl font-bold mt-1">{formatNumber(articleTotal)}</div>
             </div>
             <div class="flex flex-col">
               <div class="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
                 <Icon name="custom:dynamics" /><span>{i18n(I18nKey.statsDynamicTotal)}</span>
               </div>
               <div class="text-2xl font-bold mt-1">{formatNumber(dynamicTotal)}</div>
             </div>
           </div>
         </WidgetLayout>
       </div>

       <!-- 3. 趋势预留占位 -->
       <div class="mb-6">
         <h2 class="text-xl font-bold mb-3 flex items-center gap-2 opacity-70">
           <Icon name="custom:analytics" />
           <span>{i18n(I18nKey.statsTrendPlaceholder)}</span>
         </h2>
         <WidgetLayout showTitle={false}>
           <div class="px-4 py-10 text-center text-neutral-400 dark:text-neutral-500 text-sm">
             {i18n(I18nKey.statsTrendPlaceholder)}
           </div>
         </WidgetLayout>
       </div>
     </section>
   </MainGridLayout>

   <style>
   .stats-page-container { /* 移动端间距适配 */ padding: 0 0.5rem; }
   @media (max-width: 640px) {
     .stats-page-container h2 { font-size: 1.05rem; }
   }
   </style>
   ```
2. **可选**：修改 `astro.config.mjs` sitemap filter（若 siteConfig.pages.stats 为 true 则保持 sitemap 出现；false 已通过 redirect 404 自动 sitemap filter 处理可不再改动，但需验证）

**Test Requirements**:
- `rule` TR-11.1: 访问 `http://localhost:4321/stats/` HTTP 200；3 个 h2 区块 DOM 存在
- `rule` TR-11.2: 内容数据卡片显示文章总数（posts.length 构建时静态数字）、动态总数（dynamics.length）；数字 formatNumber 千分位
- `rule` TR-11.3: `analyticsConfig.statsPage = false` 或 `siteConfig.pages.stats = false` → 访问 /stats/ 302/404（不抛异常）
- `rule` TR-11.4: 320px 移动端 3 张卡片 ×6 项 × 内容数据无横向滚动条；Dark Mode 颜色正常

---

## Task 12: 全站公共 recordView(site type) + Admin 路径过滤 + 最终 pnpm check/build/dev 自检

**优先级**: high
**状态**: pending
**Depends On**: Task 11
**对应 AC**: AC-6-rule, AC-7-rule, AC-14-rule, AC-1-rule
**关联文件**:

1. **站点级 PV/UV（site 类型）记录**：
   - 修改 `src/layouts/Layout.astro`（或 `MainGridLayout.astro`，选一个每个公开页面都会渲染的位置）
   - 在 Layout 底部（body closing 之前）的 is:inline script 或 `<script client:idle>` 中新增一次全局站点统计记录（带去重）：
     ```ts
     (function () {
       function run() {
         const pathname = location.pathname;
         // /api/* 跳过（虽然 API 不会渲染 layout，但保险）
         if (pathname.startsWith('/api/')) return;
         // /admin/* 跳过
         if (pathname.startsWith('/admin/')) return;
         // 只统计 site type（文章、动态会在各自页面额外发 article/dynamic type；site 仍 +1 符合 FR-11 全量一进全涨规则）
         const key = `y7_analytics_sent:site:${pathname}:${Math.floor(Date.now()/300000)}`;
         if (sessionStorage?.getItem(key)) return;
         fetch('/api/analytics/view', {
           method: 'POST',
           headers: {'Content-Type':'application/json'},
           body: JSON.stringify({ type: 'site' }),
           keepalive: true, credentials: 'same-origin'
         }).catch(()=>{});
         sessionStorage?.setItem(key, '1');
       }
       if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
       else run();
       if (!(window as any).__analyticsSiteInit) {
         (window as any).__analyticsSiteInit = true;
         document.addEventListener('swup:contentReplaced', () => { setTimeout(run, 60); });
       }
     })();
     ```
   - 文章/动态页面同时会发 site + article/dynamic 两次 POST → 符合 "一进全涨"：site total/month/day +1，content 单独 +1
2. 运行 **`pnpm check`**：0 error（老的允许）
3. 运行 **`pnpm build`**：0 error（pre/post hooks 全部通过；若 build 时调用 Cloudflare 相关脚本但本地未登录 → 需确保 hybrid output 与 cloudflare adapter 不阻塞本地无账号场景；如阻塞则查阅 @astrojs/cloudflare 14.2.6 文档，在 adapter 选项中添加必要的本地兼容参数，或调整 CF_WORKERS 相关开关；**必须 build 成功**）
4. 启动 **`pnpm dev`**（可选不阻塞任务完成）：打开首页/文章/动态/stats/，手动肉眼过一遍 UI

**Test Requirements**（最终关口）:
- `rule` TR-12.1: `pnpm check` exit code 0；所有新增 .astro/.ts/.svelte 文件无类型错误
- `rule` TR-12.2: `pnpm build` exit code 0（generate-xxx 脚本 + astro build + prune + subset-fonts + minify + pagefind 全链路）
- `rule` TR-12.3: 任何 page 访问（/about /friends /archive /tags/categories /sponsor /search /bangumi /vndb /myanimelist /bilibili /booknav 等）
  - 都触发 1 次 site POST view（除 /api /admin）
  - /stats/ 触发 site 记录（API 调用不计）
- `rule` TR-12.4: 伪造 URL `/admin/dashboard`（手动浏览器访问）→ **不**触发 POST view；KV analytics:site:views 不变
- `rubric` TR-12.5 AC-24 代码可维护性 0-2 阈值 ≥1：最终 grep `KV\.put` / `KV\.get` 全部只出现在 `src/utils/analytics.ts` 一处；formatNumber 只有一份服务端 + 客户端内联精简版（允许）；不散落多处
