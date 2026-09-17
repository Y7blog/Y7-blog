import type { AnnouncementConfig } from "../types/announcementConfig";

export const announcementConfig: AnnouncementConfig = {
	// 公告标题，留空则走i18n默认标题
	title: "",

	// 公告内容
	content: "想收集大家对文章内容的需求，我自己的想法是以后会针对区块链的新韭菜写一个科普系列的文章，把币圈的本质从头到尾讲一遍，或者把炒币最基本的步骤和玩法聊一聊；还准备跟大家说说怎么无限白嫖AI视频和图片创作。最终其实还是要看大家想看什么，你可以把想看的内容通过留言板告诉我",

	// 是否允许用户关闭公告
	closable: true,

	link: {
		// 启用链接
		enable: true,
		// 链接文本
		text: "了解更多",
		// 链接 URL
		url: "/about/",
		// 内部链接
		external: false,
	},
};
