/**
 * 「节日倒计时 + 当前节气」卡片验收测试。
 *
 * 运行：npx tsx scripts/verify-calendar-card.ts
 * 覆盖需求文档要求的全部验收日期，另含：
 * - 秋分交节时刻前后的分钟级边界（2026-09-23 08:05、2027-09-23 14:02）
 * - 跨年节气连续性（2027-01-01 仍为上一年冬至）
 * - 业务时区一致性（同一时刻的不同表示、UTC 边界附近的日期归属）
 * - 数据覆盖范围之外的优雅降级
 *
 * 所有断言基于 Asia/Shanghai 业务时区，与运行脚本的宿主时区无关。
 */
import { HOLIDAYS } from "../src/data/holidays";
import { SOLAR_TERMS } from "../src/data/solarTerms";
import { getCalendarCardData } from "../src/utils/calendar";

const TZ = "Asia/Shanghai";

interface Expectation {
	dateText: string;
	weekdayText: string;
	/** "今天是中秋节" 或 "距中秋节还有 12 天"，null 表示无节日数据 */
	holiday: string | null;
	/** 节气名，null 表示数据外应隐藏 */
	term: string | null;
	/** 节日当天才有的祝福语 */
	blessing?: string;
}

const D = (iso: string): Date => new Date(iso);

const cases: Array<{ at: string; note: string; expect: Expectation }> = [
	// ===== 节日当天 =====
	{
		at: "2026-01-01T10:00:00+08:00",
		note: "2026 元旦当天",
		expect: {
			dateText: "2026年1月1日",
			weekdayText: "星期四",
			holiday: "今天是元旦",
			term: "冬至",
			blessing: "新年有新愿，日子慢慢甜",
		},
	},
	{
		at: "2026-02-17T10:00:00+08:00",
		note: "2026 春节当天",
		expect: {
			dateText: "2026年2月17日",
			weekdayText: "星期二",
			holiday: "今天是春节",
			term: "立春",
			blessing: "新年快乐，愿好运常在",
		},
	},
	{
		at: "2026-03-03T10:00:00+08:00",
		note: "2026 元宵节当天",
		expect: {
			dateText: "2026年3月3日",
			weekdayText: "星期二",
			holiday: "今天是元宵节",
			term: "雨水",
			blessing: "灯火正明，愿你心里有光",
		},
	},
	{
		at: "2026-04-04T10:00:00+08:00",
		note: "2026 清明节当天（节气清明 4/5 才交节，当前节气应仍为春分）",
		expect: {
			dateText: "2026年4月4日",
			weekdayText: "星期六",
			holiday: "今天是清明节",
			term: "春分",
			blessing: "春风有信，愿思念有归处",
		},
	},
	{
		at: "2026-05-01T10:00:00+08:00",
		note: "2026 劳动节当天",
		expect: {
			dateText: "2026年5月1日",
			weekdayText: "星期五",
			holiday: "今天是劳动节",
			term: "谷雨",
			blessing: "辛苦了，去吹吹五月的风",
		},
	},
	{
		at: "2026-06-19T10:00:00+08:00",
		note: "2026 端午节当天",
		expect: {
			dateText: "2026年6月19日",
			weekdayText: "星期五",
			holiday: "今天是端午节",
			term: "芒种",
			blessing: "粽叶飘香，愿你安康如意",
		},
	},
	{
		at: "2026-08-19T10:00:00+08:00",
		note: "2026 七夕当天",
		expect: {
			dateText: "2026年8月19日",
			weekdayText: "星期三",
			holiday: "今天是七夕",
			term: "立秋",
			blessing: "有人相伴，也愿独自精彩",
		},
	},
	{
		at: "2026-09-25T10:00:00+08:00",
		note: "2026 中秋节当天（核心验收）",
		expect: {
			dateText: "2026年9月25日",
			weekdayText: "星期五",
			holiday: "今天是中秋节",
			term: "秋分",
			blessing: "愿你赏月，也有好梦",
		},
	},
	{
		at: "2026-10-01T10:00:00+08:00",
		note: "2026 国庆节当天",
		expect: {
			dateText: "2026年10月1日",
			weekdayText: "星期四",
			holiday: "今天是国庆节",
			term: "秋分",
			blessing: "国庆快乐，去看看远方吧",
		},
	},
	{
		at: "2026-12-25T10:00:00+08:00",
		note: "2026 圣诞节当天（冬至已于 12/22 交节）",
		expect: {
			dateText: "2026年12月25日",
			weekdayText: "星期五",
			holiday: "今天是圣诞节",
			term: "冬至",
			blessing: "愿今夜有星，也有好心情",
		},
	},
	// ===== 倒计时 =====
	{
		at: "2026-09-07T12:00:00+08:00",
		note: "白露交节（22:41）之前，当前节气仍为处暑",
		expect: {
			dateText: "2026年9月7日",
			weekdayText: "星期一",
			holiday: "距中秋节还有 18 天",
			term: "处暑",
		},
	},
	{
		at: "2026-09-07T23:00:00+08:00",
		note: "白露交节（22:41）之后，切换为白露",
		expect: {
			dateText: "2026年9月7日",
			weekdayText: "星期一",
			holiday: "距中秋节还有 18 天",
			term: "白露",
		},
	},
	{
		at: "2026-09-13T12:00:00+08:00",
		note: "需求示例：距中秋节 12 天（核心验收）",
		expect: {
			dateText: "2026年9月13日",
			weekdayText: "星期日",
			holiday: "距中秋节还有 12 天",
			term: "白露",
		},
	},
	{
		at: "2026-09-23T07:00:00+08:00",
		note: "秋分交节（08:05）之前，仍为白露（核心验收）",
		expect: {
			dateText: "2026年9月23日",
			weekdayText: "星期三",
			holiday: "距中秋节还有 2 天",
			term: "白露",
		},
	},
	{
		at: "2026-09-23T08:04:59+08:00",
		note: "秋分交节前 1 秒，必须仍是白露",
		expect: {
			dateText: "2026年9月23日",
			weekdayText: "星期三",
			holiday: "距中秋节还有 2 天",
			term: "白露",
		},
	},
	{
		at: "2026-09-23T08:05:00+08:00",
		note: "秋分交节（08:05:14）前 14 秒，仍为白露",
		expect: {
			dateText: "2026年9月23日",
			weekdayText: "星期三",
			holiday: "距中秋节还有 2 天",
			term: "白露",
		},
	},
	{
		at: "2026-09-23T08:05:14+08:00",
		note: "秋分交节时刻整点（秒级数据），切换为秋分",
		expect: {
			dateText: "2026年9月23日",
			weekdayText: "星期三",
			holiday: "距中秋节还有 2 天",
			term: "秋分",
		},
	},
	{
		at: "2026-09-23T09:00:00+08:00",
		note: "秋分交节之后（核心验收）",
		expect: {
			dateText: "2026年9月23日",
			weekdayText: "星期三",
			holiday: "距中秋节还有 2 天",
			term: "秋分",
		},
	},
	{
		at: "2026-09-26T10:00:00+08:00",
		note: "中秋节次日，倒计时切换到国庆节",
		expect: {
			dateText: "2026年9月26日",
			weekdayText: "星期六",
			holiday: "距国庆节还有 5 天",
			term: "秋分",
		},
	},
	// ===== 跨年 =====
	{
		at: "2026-12-31T10:00:00+08:00",
		note: "跨年倒计时：12/31 找到下一年元旦",
		expect: {
			dateText: "2026年12月31日",
			weekdayText: "星期四",
			holiday: "距元旦还有 1 天",
			term: "冬至",
		},
	},
	{
		at: "2027-01-01T10:00:00+08:00",
		note: "2027 元旦当天；当前节气仍为上一年（2026）冬至，不因跨年重置",
		expect: {
			dateText: "2027年1月1日",
			weekdayText: "星期五",
			holiday: "今天是元旦",
			term: "冬至",
			blessing: "新年有新愿，日子慢慢甜",
		},
	},
	{
		at: "2027-01-05T22:10:00+08:00",
		note: "2027 小寒交节时刻整点",
		expect: {
			dateText: "2027年1月5日",
			weekdayText: "星期二",
			holiday: "距春节还有 32 天",
			term: "小寒",
		},
	},
	{
		at: "2027-09-15T10:00:00+08:00",
		note: "2027 中秋节当天",
		expect: {
			dateText: "2027年9月15日",
			weekdayText: "星期三",
			holiday: "今天是中秋节",
			term: "白露",
			blessing: "愿你赏月，也有好梦",
		},
	},
	{
		at: "2027-09-23T13:00:00+08:00",
		note: "2027 秋分交节（14:02）之前，仍为白露",
		expect: {
			dateText: "2027年9月23日",
			weekdayText: "星期四",
			holiday: "距国庆节还有 8 天",
			term: "白露",
		},
	},
	{
		at: "2027-09-23T15:00:00+08:00",
		note: "2027 秋分交节之后，切换为秋分",
		expect: {
			dateText: "2027年9月23日",
			weekdayText: "星期四",
			holiday: "距国庆节还有 8 天",
			term: "秋分",
		},
	},
	// ===== 时区一致性 =====
	{
		at: "2026-09-24T16:30:00Z",
		note: "UTC 表示的同一时刻（= 北京 9/25 00:30）：必须按业务时区判定为 9/25",
		expect: {
			dateText: "2026年9月25日",
			weekdayText: "星期五",
			holiday: "今天是中秋节",
			term: "秋分",
			blessing: "愿你赏月，也有好梦",
		},
	},
	{
		at: "2026-09-24T15:30:00Z",
		note: "北京 9/24 23:30：仍为 9/24，不能因 UTC 已到 9/24 白天而偏移",
		expect: {
			dateText: "2026年9月24日",
			weekdayText: "星期四",
			holiday: "距中秋节还有 1 天",
			term: "秋分",
		},
	},
	{
		at: "2026-12-31T16:30:00Z",
		note: "北京 2027-01-01 00:30：跨年后的元旦当天（UTC 仍是 2026-12-31）",
		expect: {
			dateText: "2027年1月1日",
			weekdayText: "星期五",
			holiday: "今天是元旦",
			term: "冬至",
			blessing: "新年有新愿，日子慢慢甜",
		},
	},
	// ===== 2027 立夏回归锁 =====
	// 提供的数据中 "2027-05-05T21:02" 与回归年规律/HKO 官网值矛盾，已未采纳。
	// 以下两条锁定正确行为，防止错误数据被回填。
	{
		at: "2027-05-05T22:00:00+08:00",
		note: "2027 立夏交节（5/6 01:25）之前，仍为谷雨",
		expect: {
			dateText: "2027年5月5日",
			weekdayText: "星期三",
			holiday: "距端午节还有 35 天",
			term: "谷雨",
		},
	},
	{
		at: "2027-05-06T01:25:00+08:00",
		note: "2027 立夏交节时刻整点，切换为立夏",
		expect: {
			dateText: "2027年5月6日",
			weekdayText: "星期四",
			holiday: "距端午节还有 34 天",
			term: "立夏",
		},
	},
	// ===== 2028-2030 扩展覆盖（第二批提供数据）=====
	{
		at: "2028-01-25T10:00:00+08:00",
		note: "2028 春节前一天（大寒 1/20 已交节）",
		expect: {
			dateText: "2028年1月25日",
			weekdayText: "星期二",
			holiday: "距春节还有 1 天",
			term: "大寒",
		},
	},
	{
		at: "2028-01-26T10:00:00+08:00",
		note: "2028 春节当天",
		expect: {
			dateText: "2028年1月26日",
			weekdayText: "星期三",
			holiday: "今天是春节",
			term: "大寒",
			blessing: "新年快乐，愿好运常在",
		},
	},
	{
		at: "2028-05-28T10:00:00+08:00",
		note: "2028 端午节当天",
		expect: {
			dateText: "2028年5月28日",
			weekdayText: "星期日",
			holiday: "今天是端午节",
			term: "小满",
			blessing: "粽叶飘香，愿你安康如意",
		},
	},
	{
		at: "2028-10-01T10:00:00+08:00",
		note: "2028 国庆节当天（中秋 10/3 尚未到）",
		expect: {
			dateText: "2028年10月1日",
			weekdayText: "星期日",
			holiday: "今天是国庆节",
			term: "秋分",
			blessing: "国庆快乐，去看看远方吧",
		},
	},
	{
		at: "2028-10-03T10:00:00+08:00",
		note: "2028 中秋节当天（国庆之后）",
		expect: {
			dateText: "2028年10月3日",
			weekdayText: "星期二",
			holiday: "今天是中秋节",
			term: "秋分",
			blessing: "愿你赏月，也有好梦",
		},
	},
	{
		at: "2028-12-21T15:00:00+08:00",
		note: "2028 冬至交节（16:19:41）之前，仍为大雪；最近节日为 4 天后的圣诞节",
		expect: {
			dateText: "2028年12月21日",
			weekdayText: "星期四",
			holiday: "距圣诞节还有 4 天",
			term: "大雪",
		},
	},
	{
		at: "2028-12-21T16:19:41+08:00",
		note: "2028 冬至交节时刻整点，切换为冬至",
		expect: {
			dateText: "2028年12月21日",
			weekdayText: "星期四",
			holiday: "距圣诞节还有 4 天",
			term: "冬至",
		},
	},
	{
		at: "2029-02-13T10:00:00+08:00",
		note: "2029 春节当天",
		expect: {
			dateText: "2029年2月13日",
			weekdayText: "星期二",
			holiday: "今天是春节",
			term: "立春",
			blessing: "新年快乐，愿好运常在",
		},
	},
	{
		at: "2029-09-22T10:00:00+08:00",
		note: "2029 中秋节当天（秋分 9/23 01:38 未交节，仍为白露）",
		expect: {
			dateText: "2029年9月22日",
			weekdayText: "星期六",
			holiday: "今天是中秋节",
			term: "白露",
			blessing: "愿你赏月，也有好梦",
		},
	},
	{
		at: "2030-02-03T10:00:00+08:00",
		note: "2030 春节当天（2030 立春 2/4 03:08 未交节，节气为大寒）",
		expect: {
			dateText: "2030年2月3日",
			weekdayText: "星期日",
			holiday: "今天是春节",
			term: "大寒",
			blessing: "新年快乐，愿好运常在",
		},
	},
	{
		at: "2030-09-07T21:52:50+08:00",
		note: "2030 白露交节时刻整点（数据最后一条节气）",
		expect: {
			dateText: "2030年9月7日",
			weekdayText: "星期六",
			holiday: "距中秋节还有 5 天",
			term: "白露",
		},
	},
	{
		at: "2030-10-01T10:00:00+08:00",
		note: "2030 国庆节当天（节气数据已于 9/7 用尽，持续显示白露）",
		expect: {
			dateText: "2030年10月1日",
			weekdayText: "星期二",
			holiday: "今天是国庆节",
			term: "白露",
			blessing: "国庆快乐，去看看远方吧",
		},
	},
	// ===== 数据边界：优雅降级 =====
	{
		at: "2031-02-10T10:00:00+08:00",
		note: "节日数据已用尽（2030 圣诞已过）：节日行为空；节气持续显示最近一次交节的白露",
		expect: {
			dateText: "2031年2月10日",
			weekdayText: "星期一",
			holiday: null,
			term: "白露",
		},
	},
];

let failed = 0;
for (const { at, note, expect } of cases) {
	const now = D(at);
	const data = getCalendarCardData({
		now,
		timeZone: TZ,
		solarTerms: SOLAR_TERMS,
	});
	const holidayText =
		data.holiday?.kind === "today"
			? `今天是${data.holiday.name}`
			: data.holiday
				? `距${data.holiday.name}还有 ${data.holiday.days} 天`
				: null;
	const blessing =
		data.holiday?.kind === "today" ? data.holiday.blessing : undefined;
	const term = data.solarTerm?.name ?? null;

	const problems: string[] = [];
	if (data.dateText !== expect.dateText)
		problems.push(`日期 ${data.dateText} ≠ ${expect.dateText}`);
	if (data.weekdayText !== expect.weekdayText)
		problems.push(`星期 ${data.weekdayText} ≠ ${expect.weekdayText}`);
	if (holidayText !== expect.holiday)
		problems.push(`节日行 "${holidayText}" ≠ "${expect.holiday}"`);
	if (term !== expect.term) problems.push(`节气 ${term} ≠ ${expect.term}`);
	if (blessing !== expect.blessing)
		problems.push(`祝福语 "${blessing}" ≠ "${expect.blessing}"`);

	if (problems.length) {
		failed += 1;
		console.error(`✗ [${at}] ${note}`);
		for (const problem of problems) console.error(`    ${problem}`);
	} else {
		console.log(`✓ [${at}] ${note}`);
	}
}

// 数据一致性：节日表升序且无重复日期；节气表时间戳升序
for (let i = 1; i < HOLIDAYS.length; i++) {
	if (HOLIDAYS[i].date <= HOLIDAYS[i - 1].date) {
		failed += 1;
		console.error(
			`✗ 节日表顺序异常: ${HOLIDAYS[i - 1].date} → ${HOLIDAYS[i].date}`,
		);
	}
}
for (let i = 1; i < SOLAR_TERMS.length; i++) {
	const prev = new Date(SOLAR_TERMS[i - 1].datetime).getTime();
	const curr = new Date(SOLAR_TERMS[i].datetime).getTime();
	if (!(curr > prev)) {
		failed += 1;
		console.error(
			`✗ 节气表顺序异常: ${SOLAR_TERMS[i - 1].datetime} → ${SOLAR_TERMS[i].datetime}`,
		);
	}
}
for (const term of SOLAR_TERMS) {
	if (!term.description || term.description.length > 13) {
		failed += 1;
		console.error(`✗ 节气短文案超限或缺失: ${term.name} "${term.description}"`);
	}
}
for (const holiday of HOLIDAYS) {
	if (!holiday.blessing || holiday.blessing.length > 13) {
		failed += 1;
		console.error(
			`✗ 节日祝福语超限或缺失: ${holiday.name} "${holiday.blessing}"`,
		);
	}
}

console.log(
	`\n共 ${cases.length} 个时刻用例 + 数据完整性检查，失败 ${failed} 项。`,
);
if (failed > 0) process.exit(1);
