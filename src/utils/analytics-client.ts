/**
 * 浏览器端 Analytics 客户端（全站唯一入口）。
 *
 * 职责：
 * 1. 记录页面浏览（PV/UV）——每次「进入页面」只发一次请求，刷新重新计数
 * 2. 回填站点统计卡与文章/动态阅读量
 * 3. 兼容首次加载、Swup 页面切换、前进后退、锚点跳转
 *
 * 全部请求失败静默降级：统计不可用时页面照常渲染，数字保持占位符 "--"。
 */
import type { AnalyticsViewType, SiteAnalyticsStats } from "@/types/analytics";
import { formatNumber } from "./format-number";

export interface AnalyticsClientConfig {
	/** analyticsConfig.enabled */
	enabled: boolean;
	/** 是否回填站点统计卡 */
	siteStats: boolean;
	/** 是否记录文章阅读量 */
	articleViews: boolean;
	/** 是否记录动态阅读量 */
	dynamicViews: boolean;
	/** 文章详情页路径前缀，如 "/posts/" */
	postPathPrefix: string;
	/** 动态页路径，如 "/dynamic/" */
	dynamicPath: string;
	/** 动态锚点前缀，与 dynamicAnchor() 保持一致 */
	dynamicAnchorPrefix: string;
}

interface ViewContext {
	type: AnalyticsViewType;
	slug?: string;
	id?: string;
}

const BASE = import.meta.env.BASE_URL || "/";
const API_VIEW = `${BASE}api/analytics/view/`;
const API_STATS = `${BASE}api/analytics/stats/`;
const API_ARTICLE = `${BASE}api/analytics/article/`;
const API_DYNAMIC = `${BASE}api/analytics/dynamic/`;

const PLACEHOLDER = "--";

/** 上一次已上报的视图标识；挂在 window 上，避免脚本被 Swup 重新执行时重复计数 */
function getLastKey(): string {
	return window.__y7AnalyticsLastKey ?? "";
}

function setLastKey(key: string): void {
	window.__y7AnalyticsLastKey = key;
}

// ---------------------------------------------------------------------------
// 视图上下文：完全由当前 URL 推导，因此 Swup 换页后不会读到过期状态
// ---------------------------------------------------------------------------

function dynamicIdFromHash(prefix: string): string {
	const hash = window.location.hash;
	if (!hash || hash === "#") return "";
	let anchor: string;
	try {
		anchor = decodeURIComponent(hash.slice(1));
	} catch {
		anchor = hash.slice(1);
	}
	if (!anchor.startsWith(prefix)) return "";
	// 优先取 DOM 上的真实动态 id，避免锚点 sanitize 后与 KV key 不一致
	const entry = document.getElementById(anchor);
	const fromDom =
		entry?.dataset.dynamicId ||
		entry?.querySelector<HTMLElement>("[data-view-id]")?.dataset.viewId;
	return fromDom || anchor.slice(prefix.length);
}

function resolveContext(config: AnalyticsClientConfig): ViewContext {
	const { pathname } = window.location;

	if (pathname.startsWith(config.postPathPrefix)) {
		const slug = pathname
			.slice(config.postPathPrefix.length)
			.replace(/\/+$/, "");
		if (slug) return { type: "article", slug };
	}

	if (config.dynamicViews && pathname === config.dynamicPath) {
		const id = dynamicIdFromHash(config.dynamicAnchorPrefix);
		if (id) return { type: "dynamic", id };
	}

	return { type: "site" };
}

function contextKey(context: ViewContext): string {
	if (context.type === "article") return `article:${context.slug}`;
	if (context.type === "dynamic") return `dynamic:${context.id}`;
	return `site:${window.location.pathname}`;
}

// ---------------------------------------------------------------------------
// 上报
// ---------------------------------------------------------------------------

async function sendView(context: ViewContext): Promise<void> {
	try {
		await fetch(API_VIEW, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(context),
			keepalive: true,
			cache: "no-store",
		});
	} catch {
		/* 统计失败不影响站点 */
	}
}

// ---------------------------------------------------------------------------
// 回填
// ---------------------------------------------------------------------------

/**
 * 写入阅读量。参数是外层 `[data-view-count]` 节点 —— `data-view-filled`
 * 契约挂在外层，回填标记必须写回同一个节点，否则重复扫描的守卫会失效。
 */
function writeNumber(countNode: HTMLElement, views: number): void {
	const target = countNode.querySelector<HTMLElement>("[data-view-number]");
	if (!target) return;
	target.textContent = formatNumber(views);
	countNode.dataset.viewFilled = "true";
}

async function fetchJson<T>(url: string): Promise<T | null> {
	try {
		const res = await fetch(url, { cache: "no-store" });
		if (!res.ok) return null;
		return (await res.json()) as T;
	} catch {
		return null;
	}
}

/** 站点统计卡：整站只有这一个请求 */
async function fillSiteStats(root: ParentNode = document): Promise<void> {
	const nodes = root.querySelectorAll<HTMLElement>("[data-site-stat]");
	if (!nodes.length) return;

	const data = await fetchJson<Partial<SiteAnalyticsStats>>(API_STATS);
	if (!data) return;

	for (const node of nodes) {
		const key = node.dataset.siteStat as keyof SiteAnalyticsStats | undefined;
		if (!key) continue;
		const value = data[key];
		if (typeof value === "number") node.textContent = formatNumber(value);
	}
}

/** 文章阅读量：文章详情页只有一个节点 */
async function fillArticleViews(nodes: HTMLElement[]): Promise<void> {
	await Promise.all(
		nodes.map(async (node) => {
			const slug = node.dataset.viewId;
			if (!slug) return;
			const data = await fetchJson<{ views?: number }>(
				`${API_ARTICLE}?slug=${encodeURIComponent(slug)}`,
			);
			if (data && typeof data.views === "number") {
				writeNumber(node, data.views);
			}
		}),
	);
}

/** 动态阅读量：整页合并为一次批量请求，避免 N+1 */
async function fillDynamicViews(nodes: HTMLElement[]): Promise<void> {
	if (!nodes.length) return;

	const ids = Array.from(
		new Set(
			nodes
				.map((node) => node.dataset.viewId || "")
				.filter((id): id is string => Boolean(id)),
		),
	);
	if (!ids.length) return;

	const data = await fetchJson<{
		items?: Array<{ id: string; views: number }>;
	}>(`${API_DYNAMIC}?ids=${encodeURIComponent(ids.join(","))}`);
	if (!data?.items) return;

	const viewsById = new Map(data.items.map((item) => [item.id, item.views]));
	for (const node of nodes) {
		const id = node.dataset.viewId;
		if (!id) continue;
		const views = viewsById.get(id);
		if (typeof views === "number") {
			writeNumber(node, views);
		}
	}
}

/** 扫描页面上尚未回填的阅读量节点 */
async function fillViewCounts(root: ParentNode = document): Promise<void> {
	const nodes = Array.from(
		root.querySelectorAll<HTMLElement>("[data-view-count]"),
	).filter(
		(node) =>
			node.dataset.viewFilled !== "true" &&
			node.querySelector("[data-view-number]")?.textContent?.trim() ===
				PLACEHOLDER,
	);
	if (!nodes.length) return;

	const articles = nodes.filter((node) => node.dataset.viewType === "article");
	const dynamics = nodes.filter((node) => node.dataset.viewType === "dynamic");

	await Promise.all([
		articles.length ? fillArticleViews(articles) : Promise.resolve(),
		dynamics.length ? fillDynamicViews(dynamics) : Promise.resolve(),
	]);
}

/**
 * 供「构建期不存在、运行时才插入 DOM」的内容调用（动态列表分页/筛选）。
 * 统计逻辑仍然全部集中在本模块，调用方只负责告知何时重新扫描。
 */
export function refreshViewCounts(root: ParentNode = document): void {
	if (typeof window === "undefined") return;
	void fillViewCounts(root);
}

// ---------------------------------------------------------------------------
// 编排
// ---------------------------------------------------------------------------

async function runPageView(config: AnalyticsClientConfig): Promise<void> {
	const context = resolveContext(config);
	const key = contextKey(context);

	// 同一次页面进入只上报一次；刷新会重置 window 状态，因此重新计数
	if (key !== getLastKey()) {
		setLastKey(key);
		await sendView(context);
	}

	if (config.siteStats) await fillSiteStats();
	await fillViewCounts();
}

/**
 * 初始化统计客户端。由 AnalyticsTracker 在 Layout 中调用一次，
 * 之后由 Swup / hashchange 驱动后续页面。
 */
export function initAnalytics(config: AnalyticsClientConfig): void {
	if (!config.enabled || typeof window === "undefined") return;

	const run = (): void => {
		void runPageView(config);
	};

	// 监听器只注册一次，避免 Swup 切页重跑脚本时重复绑定
	if (!window.__y7AnalyticsInit) {
		window.__y7AnalyticsInit = true;
		// Swup v4 的钩子名是冒号分隔的 `swup:page:view`（v3 的 contentReplaced 已不存在）。
		// page:view 在内容替换完成后触发一次，此时阅读量节点已在 DOM 中。
		document.addEventListener("swup:page:view", () => {
			setTimeout(run, 60);
		});
		// 动态页通过 #dynamic-xxx 锚点进入具体动态
		window.addEventListener("hashchange", () => {
			setTimeout(run, 60);
		});
	}

	run();
}
