import type { ProfileConfig } from "../types/profileConfig";

export const profileConfig: ProfileConfig = {
	// 头像
	// 图片路径支持三种格式：
	// 1. public 目录（以 "/" 开头，不优化）："/assets/images/avatar.webp"
	// 2. src 目录（不以 "/" 开头，自动优化但会增加构建时间，推荐）："assets/images/avatar.webp"
	// 3. 远程 URL："https://example.com/avatar.jpg"
	avatar: "https://www.y7img.ccwu.cc/file/头像/1788789438317_头像1_4K高清.png",

	// 名字
	name: "鱼七",

	// 个人签名
	bio: "做个俗人，贪财好色！",

	// 链接配置
	// 已经预装的图标集：fa7-brands，fa7-regular，fa7-solid，material-symbols，simple-icons
	// 访问https://icones.js.org/ 获取图标代码，
	// 如果想使用尚未包含相应的图标集，则需要安装它
	// `pnpm add @iconify-json/<icon-set-name>`
	// showName: true 时显示图标和名称，false 时只显示图标
	links: [
		{
			name: "Twitter",
			icon: "logo-twitter-current color16",
			url: "https://x.com/0x100U",
			showName: false,
		},
		{
			name: "Telegram",
			icon: "logo-telegramr-current color18",
			url: "https://t.me/+ZegDSfLwOjFiOTJl",
			showName: false,
		},
		{
			name: "YouTube",
			icon: "logo-youtube-current color18",
			url: "",
			showName: false,
		},
		{
			name: "RSS",
			icon: "fa7-solid:rss",
			url: "/rss/",
			showName: false,
		},
	],
};
