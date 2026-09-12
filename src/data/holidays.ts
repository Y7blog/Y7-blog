/**
 * 节日数据（与节气数据完全分离，见 solarTerms.ts）。
 *
 * - date 表示节日本身的公历日期（YYYY-MM-DD），不是法定放假区间，
 *   倒计时以节日当天为准。
 * - blessing 为节日当天的祝福语（≤13 个中文字符）。
 *
 * 覆盖年份：2026 至 2030。农历节日逐年不同，每年需补充下一年数据；
 * 倒计时按"当前年份 + 下一年份"合并查找（见 src/utils/calendar.ts），
 * 因此 12 月底能正确找到下一年元旦（跨年倒计时）。
 */
export interface Holiday {
	/** 节日名称 */
	name: string;
	/** 节日本身日期（YYYY-MM-DD） */
	date: string;
	/** 节日当天祝福语（≤13 个中文字符） */
	blessing: string;
}

/** 按年份取节日数据 */
export function getHolidaysForYear(year: number): Holiday[] {
	return HOLIDAYS.filter((holiday) => holiday.date.startsWith(`${year}-`));
}

export const HOLIDAYS: Holiday[] = [
	// ===== 2026 =====
	{ name: "元旦", date: "2026-01-01", blessing: "新年有新愿，日子慢慢甜" },
	{ name: "春节", date: "2026-02-17", blessing: "新年快乐，愿好运常在" },
	{ name: "元宵节", date: "2026-03-03", blessing: "灯火正明，愿你心里有光" },
	{ name: "清明节", date: "2026-04-04", blessing: "春风有信，愿思念有归处" },
	{ name: "劳动节", date: "2026-05-01", blessing: "辛苦了，去吹吹五月的风" },
	{ name: "端午节", date: "2026-06-19", blessing: "粽叶飘香，愿你安康如意" },
	{ name: "七夕", date: "2026-08-19", blessing: "有人相伴，也愿独自精彩" },
	{ name: "中元节", date: "2026-08-27", blessing: "秋风渐起，愿思念有归处" },
	{ name: "中秋节", date: "2026-09-25", blessing: "愿你赏月，也有好梦" },
	{ name: "国庆节", date: "2026-10-01", blessing: "国庆快乐，去看看远方吧" },
	{ name: "圣诞节", date: "2026-12-25", blessing: "愿今夜有星，也有好心情" },
	// ===== 2027 =====
	{ name: "元旦", date: "2027-01-01", blessing: "新年有新愿，日子慢慢甜" },
	{ name: "春节", date: "2027-02-06", blessing: "新年快乐，愿好运常在" },
	{ name: "元宵节", date: "2027-02-20", blessing: "灯火正明，愿你心里有光" },
	{ name: "清明节", date: "2027-04-05", blessing: "春风有信，愿思念有归处" },
	{ name: "劳动节", date: "2027-05-01", blessing: "辛苦了，去吹吹五月的风" },
	{ name: "端午节", date: "2027-06-09", blessing: "粽叶飘香，愿你安康如意" },
	{ name: "七夕", date: "2027-08-08", blessing: "有人相伴，也愿独自精彩" },
	{ name: "中元节", date: "2027-08-16", blessing: "秋风渐起，愿思念有归处" },
	{ name: "中秋节", date: "2027-09-15", blessing: "愿你赏月，也有好梦" },
	{ name: "国庆节", date: "2027-10-01", blessing: "国庆快乐，去看看远方吧" },
	{ name: "圣诞节", date: "2027-12-25", blessing: "愿今夜有星，也有好心情" },
	// ===== 2028（用户提供）=====
	{ name: "元旦", date: "2028-01-01", blessing: "新年有新愿，日子慢慢甜" },
	{ name: "春节", date: "2028-01-26", blessing: "新年快乐，愿好运常在" },
	{ name: "元宵节", date: "2028-02-09", blessing: "灯火正明，愿你心里有光" },
	{ name: "清明节", date: "2028-04-04", blessing: "春风有信，愿思念有归处" },
	{ name: "劳动节", date: "2028-05-01", blessing: "辛苦了，去吹吹五月的风" },
	{ name: "端午节", date: "2028-05-28", blessing: "粽叶飘香，愿你安康如意" },
	{ name: "七夕", date: "2028-08-26", blessing: "有人相伴，也愿独自精彩" },
	{ name: "中元节", date: "2028-09-03", blessing: "秋风渐起，愿思念有归处" },
	{ name: "国庆节", date: "2028-10-01", blessing: "国庆快乐，去看看远方吧" },
	{ name: "中秋节", date: "2028-10-03", blessing: "愿你赏月，也有好梦" },
	{ name: "圣诞节", date: "2028-12-25", blessing: "愿今夜有星，也有好心情" },
	// ===== 2029（用户提供）=====
	{ name: "元旦", date: "2029-01-01", blessing: "新年有新愿，日子慢慢甜" },
	{ name: "春节", date: "2029-02-13", blessing: "新年快乐，愿好运常在" },
	{ name: "元宵节", date: "2029-02-27", blessing: "灯火正明，愿你心里有光" },
	{ name: "清明节", date: "2029-04-04", blessing: "春风有信，愿思念有归处" },
	{ name: "劳动节", date: "2029-05-01", blessing: "辛苦了，去吹吹五月的风" },
	{ name: "端午节", date: "2029-06-16", blessing: "粽叶飘香，愿你安康如意" },
	{ name: "七夕", date: "2029-08-16", blessing: "有人相伴，也愿独自精彩" },
	{ name: "中元节", date: "2029-08-24", blessing: "秋风渐起，愿思念有归处" },
	{ name: "中秋节", date: "2029-09-22", blessing: "愿你赏月，也有好梦" },
	{ name: "国庆节", date: "2029-10-01", blessing: "国庆快乐，去看看远方吧" },
	{ name: "圣诞节", date: "2029-12-25", blessing: "愿今夜有星，也有好心情" },
	// ===== 2030（用户提供；国庆/圣诞为公历固定节日，源数据缺失处补齐）=====
	{ name: "元旦", date: "2030-01-01", blessing: "新年有新愿，日子慢慢甜" },
	{ name: "春节", date: "2030-02-03", blessing: "新年快乐，愿好运常在" },
	{ name: "元宵节", date: "2030-02-17", blessing: "灯火正明，愿你心里有光" },
	{ name: "清明节", date: "2030-04-05", blessing: "春风有信，愿思念有归处" },
	{ name: "劳动节", date: "2030-05-01", blessing: "辛苦了，去吹吹五月的风" },
	{ name: "端午节", date: "2030-06-05", blessing: "粽叶飘香，愿你安康如意" },
	{ name: "七夕", date: "2030-08-05", blessing: "有人相伴，也愿独自精彩" },
	{ name: "中元节", date: "2030-08-13", blessing: "秋风渐起，愿思念有归处" },
	{ name: "中秋节", date: "2030-09-12", blessing: "愿你赏月，也有好梦" },
	{ name: "国庆节", date: "2030-10-01", blessing: "国庆快乐，去看看远方吧" },
	{ name: "圣诞节", date: "2030-12-25", blessing: "愿今夜有星，也有好心情" },
];
