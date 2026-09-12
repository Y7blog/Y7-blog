/**
 * 节日倒计时 + 节气卡片的核心业务逻辑。
 *
 * - 业务时区统一按 Asia/Shanghai（UTC+8）计算，与访问者本地时区无关：
 *   通过 Intl.DateTimeFormat 把任意时刻换算成业务时区的日历日期，
 *   不使用 new Date().getDate() 之类的本地时区读取。
 * - 节气判断使用精确交节时间戳比较（数据来自香港天文台，UTC+8），
 *   绝不按月份/固定日期推断。
 * - 倒计时按"日历日期"差计算：两侧日期都解析为 UTC 午夜时间戳相减，
 *   与时刻部分、夏令时、宿主时区完全无关。
 * - 所有函数均为纯函数并接受 now 注入，Node（构建期初始渲染）与
 *   浏览器（访问期实时刷新）共用同一实现。
 */
import { getHolidaysForYear } from "@/data/holidays";
import type { SolarTerm } from "@/data/solarTerms";

/** 业务日期的各个部分（month/day 为自然数，weekdayIndex 0 = 星期日） */
export interface BusinessDateParts {
	year: number;
	month: number;
	day: number;
	weekdayIndex: number;
}

const WEEKDAY_LABELS = [
	"星期日",
	"星期一",
	"星期二",
	"星期三",
	"星期四",
	"星期五",
	"星期六",
];

/**
 * 当前节气：所有已完成交节（datetime ≤ now）的节气中时间最近的一个。
 * 数据不足（now 晚于数据覆盖范围）时返回 null，由调用方优雅降级。
 */
export function getCurrentSolarTerm(
	solarTerms: SolarTerm[],
	now: Date,
): SolarTerm | null {
	const nowMs = now.getTime();
	let current: SolarTerm | null = null;
	let currentMs = Number.NEGATIVE_INFINITY;
	for (const term of solarTerms) {
		const termMs = new Date(term.datetime).getTime();
		if (Number.isNaN(termMs)) continue;
		if (termMs <= nowMs && termMs > currentMs) {
			current = term;
			currentMs = termMs;
		}
	}
	return current;
}

/** 节日行的两种形态：节日当天 / 距最近未来节日的倒计时 */
export type HolidayLine =
	| { kind: "today"; name: string; blessing: string }
	| { kind: "upcoming"; name: string; days: number };

/**
 * 把 "YYYY-MM-DD" 解析为 UTC 午夜时间戳。
 * 仅作为纯日历日期的数值载体使用，与时区无关且无夏令时干扰。
 */
function dateKeyToUtcMs(dateKey: string): number {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
	if (!match) return Number.NaN;
	return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** 两个业务日期（YYYY-MM-DD）之间的日历天数差（to - from） */
export function diffInCalendarDays(fromKey: string, toKey: string): number {
	const from = dateKeyToUtcMs(fromKey);
	const to = dateKeyToUtcMs(toKey);
	if (Number.isNaN(from) || Number.isNaN(to)) return Number.NaN;
	return Math.round((to - from) / 86_400_000);
}

/**
 * 距最近未来节日的倒计时。节日候选取"当前年份 + 下一年份"，
 * 保证 12 月底能找到下一年元旦（跨年倒计时）。
 * 候选按日期升序取第一个：date === 今天 → 节日当天；否则为倒计时天数。
 * 数据未覆盖（两年候选均已过）时返回 null。
 */
export function resolveHolidayLine(
	now: Date,
	timeZone: string,
): HolidayLine | null {
	const todayParts = getBusinessDateParts(now, timeZone);
	const todayKey = formatDateKey(todayParts);
	const candidates = [
		...getHolidaysForYear(todayParts.year),
		...getHolidaysForYear(todayParts.year + 1),
	]
		.filter((holiday) => holiday.date >= todayKey)
		.sort((a, b) => a.date.localeCompare(b.date));
	const next = candidates[0];
	if (!next) return null;

	if (next.date === todayKey) {
		return { kind: "today", name: next.name, blessing: next.blessing };
	}
	const days = diffInCalendarDays(todayKey, next.date);
	if (Number.isNaN(days) || days < 0) return null;
	return { kind: "upcoming", name: next.name, days };
}

/** 把任意时刻换算为业务时区（如 Asia/Shanghai）的日历日期部分 */
export function getBusinessDateParts(
	date: Date,
	timeZone: string,
): BusinessDateParts {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		weekday: "short",
		hour12: false,
	}).formatToParts(date);
	const read = (type: string): string =>
		parts.find((part) => part.type === type)?.value ?? "";
	const weekdayMap: Record<string, number> = {
		Sun: 0,
		Mon: 1,
		Tue: 2,
		Wed: 3,
		Thu: 4,
		Fri: 5,
		Sat: 6,
	};
	return {
		year: Number(read("year")),
		month: Number(read("month")),
		day: Number(read("day")),
		weekdayIndex: weekdayMap[read("weekday")] ?? 0,
	};
}

/** 业务日期部分 → "YYYY-MM-DD" */
export function formatDateKey(parts: BusinessDateParts): string {
	const pad = (value: number): string => String(value).padStart(2, "0");
	return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

/** 卡片所需的全部展示数据 */
export interface CalendarCardData {
	/** "2026年9月13日" */
	dateText: string;
	/** "星期日" */
	weekdayText: string;
	/** 节日行（当天 / 倒计时），数据未覆盖时为 null */
	holiday: HolidayLine | null;
	/** 当前节气，数据未覆盖时为 null */
	solarTerm: SolarTerm | null;
}

/** 一次算齐卡片内容（服务端初始渲染与客户端实时刷新共用） */
export function getCalendarCardData(options: {
	now: Date;
	timeZone: string;
	solarTerms: SolarTerm[];
}): CalendarCardData {
	const { now, timeZone, solarTerms } = options;
	const parts = getBusinessDateParts(now, timeZone);
	return {
		dateText: `${parts.year}年${parts.month}月${parts.day}日`,
		weekdayText: WEEKDAY_LABELS[parts.weekdayIndex] ?? "",
		holiday: resolveHolidayLine(now, timeZone),
		solarTerm: getCurrentSolarTerm(solarTerms, now),
	};
}
