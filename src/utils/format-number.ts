/**
 * 数字格式化工具（同构：服务端与浏览器均可安全引入）
 *
 * 统计卡、文章阅读量、动态阅读量、统计页面共用此函数，
 * 避免在各组件中重复实现 toLocaleString 逻辑。
 */
export function formatNumber(value: number): string {
	if (!Number.isFinite(value)) return "0";
	return Math.floor(value).toLocaleString("en-US");
}
