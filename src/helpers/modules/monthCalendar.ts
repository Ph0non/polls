/**
 * SPDX-FileCopyrightText: 2026 Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { DateTime } from 'luxon'
import type { Option } from '../../stores/options.types.ts'

/**
 * Group active options by their start date in the displayed timezone.
 * Long and overnight options remain single votes; their complete interval is shown in the details.
 *
 * @param options
 * @param timezone
 */
export function groupOptionsByDay(
	options: Option[],
	timezone: string,
): Map<string, Option[]> {
	const days = new Map<string, Option[]>()
	const sorted = options
		.filter((option) => !option.deleted && option.isoTimestamp)
		.sort(
			(a, b) =>
				a.getDateTime().toMillis() - b.getDateTime().toMillis()
				|| a.id - b.id,
		)
	for (const option of sorted) {
		const day = option.getDateTime().setZone(timezone).toISODate()
		if (day) {
			const entries = days.get(day) ?? []
			entries.push(option)
			days.set(day, entries)
		}
	}
	return days
}

/**
 * Six complete weeks, starting on Monday, using calendar days across DST changes.
 *
 * @param month
 */
export function monthDays(month: DateTime): DateTime[] {
	const first = month.startOf('month').startOf('week')
	return Array.from({ length: 42 }, (_, index) => first.plus({ days: index }))
}

/**
 * Prefer today, then the next available date, falling back to the earliest option.
 *
 * @param days Sorted ISO calendar dates
 * @param today ISO calendar date in the displayed timezone
 */
export function initialDay(days: string[], today: string): string | undefined {
	return days.find((day) => day >= today) ?? days[0]
}
