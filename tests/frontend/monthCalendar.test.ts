/**
 * SPDX-FileCopyrightText: 2026 Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DateTime, Duration } from 'luxon'
import type { Option } from '../../src/stores/options.types.ts'
import {
	groupOptionsByDay,
	initialDay,
	monthDays,
} from '../../src/helpers/modules/monthCalendar.ts'

const timezone = 'Europe/Berlin'

function option(
	id: number,
	isoTimestamp: string,
	extra: Partial<Option> = {},
): Option {
	return {
		id,
		isoTimestamp,
		isoDuration: 'PT1H',
		deleted: 0,
		getDateTime() {
			return DateTime.fromISO(this.isoTimestamp!)
		},
		getDuration() {
			return Duration.fromISO(this.isoDuration!)
		},
		...extra,
	} as Option
}

test('all 326 options remain available across 47 days and the winter-time transition', () => {
	const options: Option[] = []
	for (
		let day = DateTime.fromISO('2026-09-15', { zone: timezone });
		day.toISODate()! <= '2026-10-31';
		day = day.plus({ days: 1 })
	) {
		for (let hour = day.weekday >= 6 ? 10 : 17; hour < 22; hour++) {
			options.push(option(options.length + 1, day.set({ hour }).toISO()!))
		}
	}
	const grouped = groupOptionsByDay(options, timezone)
	assert.equal(options.length, 326)
	assert.equal(grouped.size, 47)
	assert.equal(grouped.get('2026-09-15')!.length, 5)
	assert.equal(grouped.get('2026-09-19')!.length, 12)
	assert.match(grouped.get('2026-10-24')![0].isoTimestamp!, /\+02:00$/)
	assert.match(grouped.get('2026-10-25')![0].isoTimestamp!, /\+01:00$/)
	assert.equal(
		grouped.get('2026-10-31')!.at(-1)!.getDateTime().setZone(timezone).hour,
		21,
	)
})

test('timezone boundaries, ordering, deleted options, and invalid dates', () => {
	const options = [
		option(3, '2026-09-15T23:00:00Z'),
		option(2, '2026-09-15T22:00:00Z', { locked: true }),
		option(1, '2026-09-15T20:00:00Z'),
		option(4, '2026-09-15T21:00:00Z', { deleted: 1 }),
		option(5, 'invalid'),
		option(6, ''),
	]
	const originalOrder = options.map((entry) => entry.id)
	const berlin = groupOptionsByDay(options, timezone)
	assert.deepEqual([...berlin.keys()], ['2026-09-15', '2026-09-16'])
	assert.deepEqual(
		berlin.get('2026-09-16')!.map((entry) => entry.id),
		[2, 3],
	)
	assert.equal(groupOptionsByDay(options, 'UTC').size, 1)
	assert.deepEqual(
		options.map((entry) => entry.id),
		originalOrder,
	)
})

test('overnight and full-day options retain their identity and appear on the starting day', () => {
	const overnight = option(1, '2026-12-31T23:00:00+01:00', { isoDuration: 'PT3H' })
	const allDay = option(2, '2027-01-01T00:00:00+01:00', { isoDuration: 'P1D' })
	const grouped = groupOptionsByDay([overnight, allDay], timezone)
	assert.deepEqual([...grouped.keys()], ['2026-12-31', '2027-01-01'])
	assert.equal(grouped.get('2026-12-31')![0], overnight)
	assert.equal(grouped.get('2027-01-01')![0], allDay)
})

test('month grid keeps Monday-first dates without DST gaps or duplicate days', () => {
	for (const month of ['2026-03-01', '2026-10-01', '2026-12-01', '2028-02-01']) {
		const grid = monthDays(DateTime.fromISO(month, { zone: timezone }))
		assert.equal(grid.length, 42)
		assert.equal(grid[0].weekday, 1)
		assert.equal(grid.at(-1)!.weekday, 7)
		assert.equal(new Set(grid.map((day) => day.toISODate())).size, 42)
		assert(grid.every((day) => day.hour === 0))
	}
	assert(
		monthDays(DateTime.fromISO('2028-02-01')).some(
			(day) => day.toISODate() === '2028-02-29',
		),
	)
})

test('initial selection handles today, future dates, past polls, and an empty poll', () => {
	const days = ['2026-09-15', '2026-09-19', '2026-10-01']
	assert.equal(initialDay(days, '2026-09-15'), '2026-09-15')
	assert.equal(initialDay(days, '2026-09-16'), '2026-09-19')
	assert.equal(initialDay(days, '2027-01-01'), '2026-09-15')
	assert.equal(initialDay([], '2026-09-15'), undefined)
})
