import type { APIRoute } from "astro";
import { analyticsConfig } from "@/config";
import {
	analyticsJson,
	getDynamicViews,
	getDynamicViewsBatch,
	getKvBinding,
	normalizeAnalyticsId,
} from "@/utils/analytics";

// prerender 由 astro.config.mjs 的 analyticsPrerender 集成按构建模式决定

const CACHE_CONTROL =
	"public, max-age=10, s-maxage=20, stale-while-revalidate=60";

/**
 * 动态阅读量。
 * - 单条：GET /api/analytics/dynamic/?id=xxx        -> { id, views }
 * - 批量：GET /api/analytics/dynamic/?ids=a,b,c     -> { items: [{ id, views }] }
 * 批量用于动态列表页，整页只发一次请求。
 */
export const GET: APIRoute = async ({ url }) => {
	try {
		const disabled = analyticsConfig.enabled === false;
		const kv = await getKvBinding();
		const idsParam = url.searchParams.get("ids");

		if (idsParam !== null) {
			const ids = idsParam
				.split(",")
				.map((raw) => normalizeAnalyticsId(raw))
				.filter(Boolean);
			const items = disabled
				? ids.map((id) => ({ id, views: 0 }))
				: await getDynamicViewsBatch(kv, ids);
			return analyticsJson({ items }, { cacheControl: CACHE_CONTROL });
		}

		const id = normalizeAnalyticsId(url.searchParams.get("id"));
		if (!id) {
			return analyticsJson({ error: "invalid id" }, { status: 400 });
		}
		const stats = disabled ? { id, views: 0 } : await getDynamicViews(kv, id);
		return analyticsJson(stats, { cacheControl: CACHE_CONTROL });
	} catch {
		return analyticsJson({ id: "", views: 0 });
	}
};
