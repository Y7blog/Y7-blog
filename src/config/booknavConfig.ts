import type { BooknavGroup, BooknavPageConfig } from "../types/booknavConfig";

// 书签导航页面配置
export const booknavPageConfig: BooknavPageConfig = {
	// 页面标题，如果留空则使用 i18n 中的翻译
	title: "",

	// 页面描述文本，如果留空则使用 i18n 中的翻译
	description: "",

	// favicon 自动获取配置
	favicon: {
		// 书签未填写 icon 时，是否自动获取目标站点的 favicon 图标
		enabled: true,

		// favicon 接口地址，{domain} 为占位符，会被替换成目标站点域名
		// 更换接口只需保证地址里含有 {domain}，例如：
		//   https://a.favicon.im/{domain}
		//   https://favicon.im/{domain}
		api: "https://a.favicon.im/{domain}",
	},
};

// 书签导航配置
// 每个数组项是一个分类组，分类组内的 items 是该分类下的书签
export const booknavConfig: BooknavGroup[] = [
	{
		id: "dev",
		name: "区块链交易所",
		icon: "material-symbols:code-rounded",
		desc: "最高可返手续费30%",
		weight: 100,
		items: [
			{
				title: "币安交易所",
				url: "https://www.bsmkweb.cc/referral/earn-together/refer2earn-usdc/claim?hl=zh-CN&ref=GRO_28502_0JJXS",
				desc: "全球领先，加密交易首选",
				// icon 字段可以使用 astro-icon 图标库的图标名称
				// 也可以使用图片 URL 和本地图片路径
				// 不填则会通过接口自动获取目标站点的 favicon 图标（需要在上面配置）
				icon: "fa7-brands:github",
				weight: 10,
			},
			{
				title: "欧易OKX交易所",
				url: "https://web3.okx.com/join/Y7BTC",
				desc: "专业安全，畅享加密交易",
				weight: 9,
			},
			{
				title: "Bitget交易所",
				url: "https://share.glassgs.com/u/PTLEZY8X?clacCode=7HGJ98RT",
				desc: "跟单交易，轻松捕捉机会",
				weight: 8,
			},
			
		],
	},
	{
		id: "opensource",
		name: "冲狗工具",
		icon: "material-symbols:code-rounded",
		desc: "捕捉热点，快速交易",
		weight: 90,
		items: [
			{
				title: "GMGN",
				url: "https://gmgn.ai/r/ekea6Yeb",
				desc: "链上猎手，发现百倍机会",
				icon: "/favicon/firefly-32.png",
				weight: 10,
			},
		],
	},
	{
		id: "design",
		name: "会员充值",
		icon: "material-symbols:palette-outline-rounded",
		desc: "会员充值更省钱，优惠更多",
		weight: 90,
		items: [
			{
				title: "Twitter",
				url: "https://ronvip.pages.dev/?ref=RP6G2I5B6E1A1J611I",
				desc: "X会员3月低至4U，畅享专属特权",
				weight: 10,
			},
			{
				title: "Telegram",
				url: "https://ronvip.pages.dev/?ref=RP6G2I5B6E1A1J611I",
				desc: "优惠充值TG会员，支持链上链下多种支付",
				weight: 9,
			},
		],
	},
	{
		id: "tools",
		name: "VPN",
		icon: "material-symbols:build-outline-rounded",
		desc: "顺手的在线小工具",
		weight: 80,
		items: [
			{
				title: "云边VPN",
				url: "https://cruise.54678999.xyz/#/register?code=9dF4lfAb",
				desc: "高速稳定，每天免费1小时",
				weight: 10,
			},
			
		],
	},
	{
		id: "resources",
		name: "查询工具",
		icon: "material-symbols:auto-stories-outline-rounded",
		desc: "文档、教程与阅读",
		weight: 70,
		items: [
			{
				title: "钱包追踪",
				url: "",
				desc: "链上追踪，看清资金走向",
				icon: "https://docs-firefly.cuteleaf.cn/logo.png",
				weight: 10,
			},
			{
				title: "推特查询",
				url: "",
				desc: "让骗局无处遁形",
				weight: 9,
			},
		],
	},
];
