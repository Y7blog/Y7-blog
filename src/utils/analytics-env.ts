/**
 * 服务端 Analytics **构建期**开关，只供 astro.config.mjs 决定
 * 是否挂载 Cloudflare adapter、以及 /api/analytics/* 是否 prerender。
 *
 * - `astro dev`：启用，本地由 wrangler 配置提供 Y7BLOG_KV
 * - `CF_WORKERS=1 astro build`：启用，产物部署到 Cloudflare Workers/Pages
 * - 其余（CI 静态构建、GitHub Pages）：禁用，产物保持纯静态 dist/
 *
 * 不要在接口处理函数里用它做运行时判断：部署后的 worker 里没有 process.env，
 * 这个表达式会恒为 false 并把接口永久打成占位响应。
 * 运行时降级由 getKvBinding() 返回 undefined + 服务层 isKv() 兜底完成。
 */
export const analyticsServerEnabled: boolean =
	Boolean(process.env.CF_WORKERS) || process.env.NODE_ENV === "development";
