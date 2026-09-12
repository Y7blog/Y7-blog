import type { TaxonomyBannerConfig } from "@/types/taxonomyBannerConfig";

/**
 * 金库导航下「分类 / 系列 / 标签」页面顶部横幅图配置
 *
 * 更换图片（同动态页横幅的用法）：
 * 1. 把图片放到 public 目录，例如 public/assets/taxonomy-banner/categories.avif
 * 2. 在下方对应页面填入路径（以 "/" 开头）或远程 URL（以 "http" 开头）
 * 3. 留空则保持原有的纯色卡片样式
 */
export const taxonomyBannerConfig: TaxonomyBannerConfig = {
	// 分类页横幅图，如 "/assets/taxonomy-banner/categories.avif"
	categories: "/assets/dynamic-banner/y7img-Classification1600.avif",

	// 系列页横幅图，如 "/assets/taxonomy-banner/series.avif"
	series: "/assets/dynamic-banner/y7img-series1600.avif",

	// 标签页横幅图，如 "/assets/taxonomy-banner/tags.avif"
	tags: "/assets/dynamic-banner/y7img-Label1600.avif",
};
