import { createHash } from "node:crypto";
import type {
	AnalyticsViewType,
	ArticleAnalyticsStats,
	DynamicAnalyticsStats,
	PageAnalyticsStats,
	SiteAnalyticsStats,
} from "@/types/analytics";
import { formatNumber } from "./format-number";

export { formatNumber };

type KvLike = {
	get: (key: string, opts?: unknown) => Promise<string | null>;
	put: (key: string, value: string, opts?: unknown) => Promise<void>;
};

type RecordViewParams = {
	type: AnalyticsViewType;
	slug?: string;
	id?: string;
	userAgent: string | null;
	ip: string;
	pathname: string;
	timezone: string;
	enabled: boolean;
};

const DEFAULT_SITE_STATS: SiteAnalyticsStats = {
	totalViews: 0,
	totalVisitors: 0,
	monthlyViews: 0,
	monthlyVisitors: 0,
	dailyViews: 0,
	dailyVisitors: 0,
};

/** 文章 slug / 动态 id 的最大长度，防止超长 key 写入 KV */
const MAX_ID_LENGTH = 512;

const BOT_REGEX =
	/bot|crawl|spider|slurp|headless|phantom|puppeteer|selenium|curl|wget|python-requests|httpclient|scrapy|facebookexternalhit|twitterbot|whatsapp|telegrambot|bingpreview|applebot|semrush|ahrefs|petalbot|yandex|bytespider|zgrab|nmap|masscan/i;

export function isBotUA(ua: string | null): boolean {
	if (!ua) return false;
	return BOT_REGEX.test(ua);
}

export function shouldSkipPath(pathname: string): boolean {
	if (!pathname) return false;
	const p = pathname.toLowerCase();
	if (p.startsWith("/api/")) return true;
	if (p.startsWith("/admin/")) return true;
	return false;
}

function pad(n: number): string {
	return n < 10 ? `0${n}` : String(n);
}

function offsetForTimezone(timezone: string): number {
	try {
		const dtf = new Intl.DateTimeFormat("en-US", {
			timeZone: timezone,
			timeZoneName: "shortOffset",
		});
		const parts = dtf.formatToParts(new Date("2024-01-01T00:00:00Z"));
		const tz = parts.find((x) => x.type === "timeZoneName")?.value ?? "GMT";
		const m = /GMT([+-]?)(\d+)(?::(\d+))?/.exec(tz);
		if (!m) return 0;
		const sign = m[1] === "-" ? -1 : 1;
		const hours = Number(m[2]) || 0;
		const minutes = Number(m[3]) || 0;
		return sign * (hours * 60 + minutes);
	} catch {
		return 8 * 60;
	}
}

export function getDateKeys(timezone: string): {
	dayKey: string;
	monthKey: string;
} {
	const now = new Date();
	const offsetMin = offsetForTimezone(timezone || "Asia/Shanghai");
	const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
	const local = new Date(utcMs + offsetMin * 60000);
	const y = local.getUTCFullYear();
	const mo = pad(local.getUTCMonth() + 1);
	const d = pad(local.getUTCDate());
	return {
		dayKey: `${y}-${mo}-${d}`,
		monthKey: `${y}-${mo}`,
	};
}

export function hashVisitor(ip: string, ua: string, dateKey: string): string {
	const material = `${ip}||${ua || ""}||${dateKey}`;
	return createHash("sha256").update(material, "utf8").digest("hex");
}

function isKv(kv: unknown): kv is KvLike {
	if (!kv || typeof kv !== "object") return false;
	const k = kv as Record<string, unknown>;
	return typeof k.get === "function" && typeof k.put === "function";
}

async function safeGetNumber(kv: KvLike, key: string): Promise<number> {
	try {
		const v = await kv.get(key);
		if (v === null || v === undefined) return 0;
		const n = Number(v);
		return Number.isFinite(n) ? Math.floor(n) : 0;
	} catch {
		return 0;
	}
}

async function safeIncr(kv: KvLike, key: string, delta = 1): Promise<void> {
	try {
		const cur = await safeGetNumber(kv, key);
		const next = Math.max(0, cur + delta);
		await kv.put(key, String(next));
	} catch {
		/* ignore */
	}
}

async function trySetOnce(
	kv: KvLike,
	key: string,
	ttlSec?: number,
): Promise<boolean> {
	try {
		const cur = await kv.get(key);
		if (cur !== null) return false;
		const opts: { expirationTtl?: number } = {};
		if (typeof ttlSec === "number" && ttlSec > 0) {
			opts.expirationTtl = ttlSec;
		}
		await kv.put(key, "1", Object.keys(opts).length ? opts : undefined);
		return true;
	} catch {
		return false;
	}
}

export async function getSiteStats(
	kv: unknown,
	timezone = "Asia/Shanghai",
): Promise<SiteAnalyticsStats> {
	if (!isKv(kv)) return { ...DEFAULT_SITE_STATS };
	try {
		const { dayKey, monthKey } = getDateKeys(timezone);
		const [
			totalViews,
			totalVisitors,
			monthlyViews,
			monthlyVisitors,
			dailyViews,
			dailyVisitors,
		] = await Promise.all([
			safeGetNumber(kv, "analytics:site:views"),
			safeGetNumber(kv, "analytics:site:visitors"),
			safeGetNumber(kv, `analytics:month:${monthKey}:views`),
			safeGetNumber(kv, `analytics:month:${monthKey}:visitors`),
			safeGetNumber(kv, `analytics:day:${dayKey}:views`),
			safeGetNumber(kv, `analytics:day:${dayKey}:visitors`),
		]);
		return {
			totalViews,
			totalVisitors,
			monthlyViews,
			monthlyVisitors,
			dailyViews,
			dailyVisitors,
		};
	} catch {
		return { ...DEFAULT_SITE_STATS };
	}
}

export async function getArticleViews(
	kv: unknown,
	slug: string,
): Promise<ArticleAnalyticsStats> {
	const safe = normalizeAnalyticsId(slug);
	if (!safe) return { slug: "", views: 0 };
	if (!isKv(kv)) return { slug: safe, views: 0 };
	try {
		const views = await safeGetNumber(kv, `analytics:article:${safe}:views`);
		return { slug: safe, views };
	} catch {
		return { slug: safe, views: 0 };
	}
}

export async function getDynamicViews(
	kv: unknown,
	id: string,
): Promise<DynamicAnalyticsStats> {
	const safe = normalizeAnalyticsId(id);
	if (!safe) return { id: "", views: 0 };
	if (!isKv(kv)) return { id: safe, views: 0 };
	try {
		const views = await safeGetNumber(kv, `analytics:dynamic:${safe}:views`);
		return { id: safe, views };
	} catch {
		return { id: safe, views: 0 };
	}
}

/** 页面级浏览量（如动态页整体）：GET 查询用 */
export async function getPageViews(
	kv: unknown,
	slug: string,
): Promise<PageAnalyticsStats> {
	const safe = normalizeAnalyticsId(slug);
	if (!safe) return { slug: "", views: 0 };
	if (!isKv(kv)) return { slug: safe, views: 0 };
	try {
		const views = await safeGetNumber(kv, `analytics:page:${safe}:views`);
		return { slug: safe, views };
	} catch {
		return { slug: safe, views: 0 };
	}
}

/** 批量查询动态阅读量：动态列表页只发一次请求，避免 N+1 */
export async function getDynamicViewsBatch(
	kv: unknown,
	ids: string[],
	limit = 100,
): Promise<DynamicAnalyticsStats[]> {
	const safeIds = Array.from(
		new Set(ids.map(normalizeAnalyticsId).filter((v): v is string => !!v)),
	).slice(0, limit);
	if (!safeIds.length) return [];
	if (!isKv(kv)) return safeIds.map((id) => ({ id, views: 0 }));
	try {
		const counts = await Promise.all(
			safeIds.map((id) => safeGetNumber(kv, `analytics:dynamic:${id}:views`)),
		);
		return safeIds.map((id, i) => ({ id, views: counts[i] ?? 0 }));
	} catch {
		return safeIds.map((id) => ({ id, views: 0 }));
	}
}

/** 校验并收敛文章 slug / 动态 id，作为 KV key 片段使用 */
export function normalizeAnalyticsId(value: string | null | undefined): string {
	if (!value) return "";
	const trimmed = value.trim();
	if (!trimmed || trimmed.length > MAX_ID_LENGTH) return "";
	// KV key 不允许出现会破坏 key 结构的分隔符
	if (/[:\s]/.test(trimmed)) return "";
	return trimmed;
}

/**
 * 取出 Cloudflare KV 绑定（Y7BLOG_KV）。
 *
 * Astro v6 移除了 `Astro.locals.runtime.env`，@astrojs/cloudflare 把它定义成
 * 一读取就抛错的 getter，官方替代方式是 `import { env } from "cloudflare:workers"`。
 * 该模块只存在于 workerd，因此用动态 import + try/catch：
 * Node 预渲染、CI 静态构建、本地无 KV 时安静返回 undefined，由调用方优雅降级。
 */
export async function getKvBinding(): Promise<unknown> {
	try {
		const { env } = await import("cloudflare:workers");
		return env?.Y7BLOG_KV;
	} catch {
		return undefined;
	}
}

/** 取访客 IP，仅用于服务端生成匿名 hash，不落库、不作为 KV key */
export function getClientIp(request: Request): string {
	const headers = [
		request.headers.get("cf-connecting-ip"),
		request.headers.get("x-forwarded-for"),
		request.headers.get("x-real-ip"),
	];
	for (const header of headers) {
		const first = header?.split(",")[0]?.trim();
		if (first) return first;
	}
	return "127.0.0.1";
}

/** 统一的 JSON 响应，带缓存头；统计接口永远返回 200，避免前端异常 */
export function analyticsJson(
	body: unknown,
	options: { status?: number; cacheControl?: string } = {},
): Response {
	const headers = new Headers({
		"Content-Type": "application/json; charset=utf-8",
	});
	if (options.cacheControl) headers.set("Cache-Control", options.cacheControl);
	return new Response(JSON.stringify(body), {
		status: options.status ?? 200,
		headers,
	});
}

export async function recordView(
	kv: unknown,
	params: RecordViewParams,
): Promise<{ recorded: boolean }> {
	if (!params?.enabled) return { recorded: false };
	if (!isKv(kv)) return { recorded: false };
	try {
		if (isBotUA(params.userAgent)) return { recorded: false };
		if (shouldSkipPath(params.pathname)) return { recorded: false };

		const { dayKey, monthKey } = getDateKeys(
			params.timezone || "Asia/Shanghai",
		);
		const visitorHash = hashVisitor(
			params.ip || "127.0.0.1",
			params.userAgent || "",
			dayKey,
		);

		const pvKeys: string[] = [
			"analytics:site:views",
			`analytics:day:${dayKey}:views`,
			`analytics:month:${monthKey}:views`,
		];

		const type = params.type;
		if (type === "article") {
			const slug = normalizeAnalyticsId(params.slug);
			if (slug) pvKeys.push(`analytics:article:${slug}:views`);
		} else if (type === "dynamic") {
			const id = normalizeAnalyticsId(params.id);
			if (id) pvKeys.push(`analytics:dynamic:${id}:views`);
		} else if (type === "page") {
			const slug = normalizeAnalyticsId(params.slug);
			if (slug) pvKeys.push(`analytics:page:${slug}:views`);
		}

		await Promise.all(pvKeys.map((k) => safeIncr(kv, k, 1)));

		// UV: day / month / all — three layers
		const uvDay = `analytics:uv:day:${dayKey}:${visitorHash}`;
		const uvMonth = `analytics:uv:month:${monthKey}:${visitorHash}`;
		const uvAll = `analytics:uv:all:${visitorHash}`;

		const [newDay, newMonth, newAll] = await Promise.all([
			trySetOnce(kv, uvDay, 86400 * 2),
			trySetOnce(kv, uvMonth, 86400 * 35),
			trySetOnce(kv, uvAll, 86400 * 366 * 2),
		]);

		const uvIncr: Array<[string, number]> = [];
		if (newDay) uvIncr.push([`analytics:day:${dayKey}:visitors`, 1]);
		if (newMonth) uvIncr.push([`analytics:month:${monthKey}:visitors`, 1]);
		if (newAll) uvIncr.push(["analytics:site:visitors", 1]);

		if (uvIncr.length) {
			await Promise.all(uvIncr.map(([k, d]) => safeIncr(kv, k, d)));
		}

		return { recorded: true };
	} catch {
		return { recorded: false };
	}
}
