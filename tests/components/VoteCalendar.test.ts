/**
 * SPDX-FileCopyrightText: 2026 Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive, nextTick } from 'vue'
import { DateTime, Duration } from 'luxon'
import VoteCalendar from '../../src/components/VoteCalendar/VoteCalendar.vue'

const stores = vi.hoisted(() => ({
	poll: null as any,
	options: null as any,
	session: null as any,
	votes: null as any,
}))
vi.mock('../../src/stores/poll.ts', () => ({ usePollStore: () => stores.poll }))
vi.mock('../../src/stores/options.ts', () => ({
	useOptionsStore: () => stores.options,
}))
vi.mock('../../src/stores/session.ts', () => ({
	useSessionStore: () => stores.session,
}))
vi.mock('../../src/stores/votes.ts', () => ({ useVotesStore: () => stores.votes }))
vi.mock('@nextcloud/l10n', () => ({
	t: (_app: string, text: string, values: any = {}) =>
		text.replace(/\{(\w+)\}/g, (_, key) => values[key]),
}))
vi.mock('@nextcloud/vue/components/NcButton', () => ({
	default: { template: '<button><slot /></button>' },
}))
vi.mock('../../src/components/Options/OptionItem.vue', () => ({
	default: {
		props: ['option'],
		template: '<span>{{ option.isoTimestamp }}</span>',
	},
}))
vi.mock('../../src/components/Options/OptionMenu.vue', () => ({
	default: { template: '<span />' },
}))
vi.mock('../../src/components/Options/OptionVoteCounter.vue', () => ({
	default: { template: '<span class="results">results</span>' },
}))
vi.mock('../../src/components/VoteTable/VoteButton.vue', () => ({
	default: {
		props: { immediate: Boolean },
		template:
			'<button class="test-vote" :data-immediate="immediate">Vote</button>',
	},
}))
vi.mock('../../src/components/VoteTable/VoteItem.vue', () => ({
	default: { template: '<span class="read-only-vote" />' },
}))

function option(id: number, date: string) {
	return {
		id,
		isoTimestamp: date,
		deleted: 0,
		locked: false,
		getDateTime: () => DateTime.fromISO(date),
		getDuration: () => Duration.fromISO('PT1H'),
	}
}

beforeEach(() => {
	stores.poll = reactive({
		permissions: { vote: true, seeResults: true, seeUsernames: false },
		configuration: { allowMaybe: true },
		status: { isExpired: false },
	})
	stores.session = reactive({
		currentTimezoneName: 'Europe/Berlin',
		currentUser: { id: 'martin', type: 'external', localeCodeIntl: 'en-GB' },
	})
	stores.options = reactive({
		options: [
			option(1, '2026-09-15T17:00:00+02:00'),
			option(2, '2026-09-15T18:00:00+02:00'),
			option(3, '2026-10-25T21:00:00+01:00'),
		],
	})
	stores.votes = {
		getVote: ({ option }: any) => ({ answer: option.id === 1 ? 'no' : '' }),
	}
})

const day = (wrapper: ReturnType<typeof mount>, number: string) =>
	wrapper
		.findAll('.vote-calendar__day')
		.find((button) => button.find('.vote-calendar__number').text() === number)!

async function september(wrapper: ReturnType<typeof mount>) {
	const previous = wrapper.find('[aria-label="Previous month"]')
	if (!previous.attributes('disabled')) await previous.trigger('click')
	await day(wrapper, '15').trigger('click')
}

describe('monthly voting surface', () => {
	it('renders only selected-day slots and counts an explicit No as answered', async () => {
		const wrapper = mount(VoteCalendar)
		await september(wrapper)
		expect(wrapper.findAll('.vote-calendar__slot')).toHaveLength(2)
		expect(day(wrapper, '15').attributes('aria-label')).toContain(
			'1 of 2 options answered',
		)
		expect(
			wrapper
				.findAll('.test-vote')
				.every((button) => button.attributes('data-immediate') === 'true'),
		).toBe(true)
		await day(wrapper, '16').trigger('click')
		expect(wrapper.findAll('.vote-calendar__slot')).toHaveLength(0)
		expect(wrapper.text()).toContain('No options on this day')
		wrapper.unmount()
	})

	it('navigates months and respects the displayed timezone', async () => {
		const wrapper = mount(VoteCalendar)
		await september(wrapper)
		await wrapper.get('[aria-label="Next month"]').trigger('click')
		expect(wrapper.findAll('.vote-calendar__slot')).toHaveLength(1)
		expect(wrapper.get('.vote-calendar__day.selected').text()).toContain('25')
		expect(
			wrapper.get('[aria-label="Next month"]').attributes('disabled'),
		).toBeDefined()
		stores.session.currentTimezoneName = 'Pacific/Auckland'
		await nextTick()
		expect(
			wrapper
				.get('.vote-calendar__day.selected .vote-calendar__number')
				.text(),
		).toBe('26')
		wrapper.unmount()
	})

	it('hides results and blocks voting for unregistered visitors, expired polls, locked options, and missing permissions', async () => {
		stores.poll.permissions.seeResults = false
		const wrapper = mount(VoteCalendar)
		await september(wrapper)
		expect(wrapper.find('.results').exists()).toBe(false)
		stores.session.currentUser.type = 'public'
		await nextTick()
		expect(wrapper.find('.test-vote').exists()).toBe(false)
		expect(day(wrapper, '15').attributes('aria-label')).not.toContain('answered')
		stores.session.currentUser.type = 'external'
		stores.poll.status.isExpired = true
		await nextTick()
		expect(wrapper.findAll('.read-only-vote')).toHaveLength(2)
		stores.poll.status.isExpired = false
		stores.poll.permissions.vote = false
		await nextTick()
		expect(wrapper.find('.test-vote').exists()).toBe(false)
		stores.poll.permissions.vote = true
		stores.options.options[0].locked = true
		await nextTick()
		expect(wrapper.findAll('.test-vote')).toHaveLength(1)
		wrapper.unmount()
	})

	it('handles asynchronous options and selection changes after deletion', async () => {
		const options = stores.options.options
		stores.options.options = []
		const wrapper = mount(VoteCalendar)
		expect(wrapper.text()).toContain('No options on this day')
		stores.options.options = options
		await nextTick()
		await september(wrapper)
		stores.options.options = options.slice(2)
		await nextTick()
		expect(
			wrapper
				.get('.vote-calendar__day.selected .vote-calendar__number')
				.text(),
		).toBe('25')
		expect(wrapper.findAll('.vote-calendar__slot')).toHaveLength(1)
		wrapper.unmount()
	})
})
