import type { APIRoute } from "astro";
import { analyticsConfig, siteConfig } from "@/config";
import type { AnalyticsViewRequest } from "@/types/analytics";
import {
	analyticsJson,
	getClientIp,
	getKvBinding,
	normalizeAnalyticsId,
	recordView,
} from "@/utils/analytics";

// prerender 由 astro.config.mjs 的 analyticsPrerender 集成按构建模式决定：
// Astro 只用正则识别源码里的 `export const prerender = true|false` 字面量，
// 写成运行时表达式会被静默忽略。

const VALID_TYPES = new Set(["site", "article", "dynamic", "page"]);

/**
 * 被访问页面的路径取自 Referer（服务端推导，不信任客户端上报），
 * 用于 /api/*、/admin/* 过滤；缺失时按 "/" 处理。
 */
function resolvePagePathname(request: Request): string {
	const referer = request.headers.get("referer");
	if (!referer) return "/";
	try {
		return new URL(referer).pathname;
	} catch {
		return "/";
	}
}

/**
 * 记录一次页面浏览（PV / UV）。
 * 任何异常都返回 200 + success:false —— 统计失败绝不能影响站点。
 */
export const POST: APIRoute = async ({ request }) => {
	try {
		if (analyticsConfig.enabled === false) {
			return analyticsJson({ success: false, reason: "disabled" });
		}

		const body = (await request
			.json()
			.catch(() => null)) as AnalyticsViewRequest | null;
		const type = body?.type;

		if (!type || !VALID_TYPES.has(type)) {
			return analyticsJson(
				{ success: false, error: "invalid type" },
				{ status: 400 },
			);
		}

		const slug =
			type === "article" || type === "page"
				? normalizeAnalyticsId(body?.slug)
				: "";
		const id = type === "dynamic" ? normalizeAnalyticsId(body?.id) : "";

		if ((type === "article" || type === "page") && !slug) {
			return analyticsJson(
				{ success: false, error: "invalid slug" },
				{ status: 400 },
			);
		}
		if (type === "dynamic" && !id) {
			return analyticsJson(
				{ success: false, error: "invalid id" },
				{ status: 400 },
			);
		}

		const { recorded } = await recordView(await getKvBinding(), {
			type,
			...(slug ? { slug } : {}),
			...(id ? { id } : {}),
			userAgent: request.headers.get("user-agent"),
			ip: getClientIp(request),
			pathname: resolvePagePathname(request),
			timezone: siteConfig.timezone || "Asia/Shanghai",
			enabled: true,
		});

		return analyticsJson({ success: recorded });
	} catch {
		return analyticsJson({ success: false });
	}
};

/** 浏览量只通过 POST 记录；GET 仅为静态构建时的预渲染占位与健康检查 */
export const GET: APIRoute = () =>
	analyticsJson({ success: false, reason: "use POST" });
