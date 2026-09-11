import type { APIRoute } from "astro";
import { analyticsConfig, siteConfig } from "@/config";
import type { SiteAnalyticsStats } from "@/types/analytics";
import { analyticsJson, getKvBinding, getSiteStats } from "@/utils/analytics";

// prerender 由 astro.config.mjs 的 analyticsPrerender 集成按构建模式决定
const EMPTY_STATS: SiteAnalyticsStats = {
	totalViews: 0,
	totalVisitors: 0,
	monthlyViews: 0,
	monthlyVisitors: 0,
	dailyViews: 0,
	dailyVisitors: 0,
};

/** 站点六项统计：总/月/日 的浏览量与访客数 */
export const GET: APIRoute = async () => {
	try {
		const stats =
			analyticsConfig.enabled === false
				? EMPTY_STATS
				: await getSiteStats(
						await getKvBinding(),
						siteConfig.timezone || "Asia/Shanghai",
					);
		return analyticsJson(stats, {
			cacheControl:
				"public, max-age=30, s-maxage=60, stale-while-revalidate=120",
		});
	} catch {
		return analyticsJson(EMPTY_STATS);
	}
};
