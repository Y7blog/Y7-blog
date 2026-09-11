import type { APIRoute } from "astro";
import { analyticsConfig } from "@/config";
import {
	analyticsJson,
	getArticleViews,
	getKvBinding,
	normalizeAnalyticsId,
} from "@/utils/analytics";

// prerender 由 astro.config.mjs 的 analyticsPrerender 集成按构建模式决定

const CACHE_CONTROL =
	"public, max-age=10, s-maxage=20, stale-while-revalidate=60";

/** 单篇文章阅读量：GET /api/analytics/article/?slug=xxx */
export const GET: APIRoute = async ({ url }) => {
	try {
		const slug = normalizeAnalyticsId(url.searchParams.get("slug"));
		if (!slug) {
			return analyticsJson({ error: "invalid slug" }, { status: 400 });
		}
		const stats =
			analyticsConfig.enabled === false
				? { slug, views: 0 }
				: await getArticleViews(await getKvBinding(), slug);
		return analyticsJson(stats, { cacheControl: CACHE_CONTROL });
	} catch {
		return analyticsJson({ slug: "", views: 0 });
	}
};
