// Cloudflare Workers 运行时模块的最小声明。
// 项目未安装 @cloudflare/workers-types，这里只声明统计系统用到的 KV 绑定，
// 避免为一个命名空间引入整套类型。
declare module "cloudflare:workers" {
	export const env: {
		readonly Y7BLOG_KV?: KVNamespaceLike | undefined;
	};
}
