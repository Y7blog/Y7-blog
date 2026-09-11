export interface SiteAnalyticsStats {
	totalViews: number;
	totalVisitors: number;
	monthlyViews: number;
	monthlyVisitors: number;
	dailyViews: number;
	dailyVisitors: number;
}

export interface ArticleAnalyticsStats {
	slug: string;
	views: number;
}

export interface DynamicAnalyticsStats {
	id: string;
	views: number;
}

export interface PageAnalyticsStats {
	slug: string;
	views: number;
}

export type AnalyticsViewType = "site" | "article" | "dynamic" | "page";

export interface AnalyticsViewRequest {
	type: AnalyticsViewType;
	slug?: string;
	id?: string;
}
