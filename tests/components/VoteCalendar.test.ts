/**
 * SPDX-FileCopyrightText: 2026 Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { reactive, nextTick } from 'vue'
import { DateTime, Duration } from 'luxon'
import VoteCalendar from '../../src/components/VoteCalendar/VoteCalendar.vue'

const stores = vi.hoisted(() => ({
	poll: null as any,
	options: null as any,
	session: null as any,
	votes: null as any,
	success: vi.fn(),
	error: vi.fn(),
}))
vi.mock('@nextcloud/dialogs', () => ({
	showSuccess: stores.success,
	showError: stores.error,
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
	vi.clearAllMocks()
	stores.poll = reactive({
		id: 1,
		permissions: { vote: true, seeResults: true, seeUsernames: false },
		configuration: { allowMaybe: true, useNo: true },
		status: { isExpired: false },
	})
	stores.session = reactive({
		publicToken: '',
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
	const answers = reactive<Record<number, string>>({ 1: 'no', 2: '', 3: '' })
	stores.votes = {
		getVote: ({ option }: any) => ({ answer: answers[option.id] ?? '' }),
		setOptimistic: vi.fn(({ option, setTo }) => {
			answers[option.id] = setTo
		}),
		set: vi.fn(async ({ option, setTo }) => {
			answers[option.id] = setTo
			return {}
		}),
	}
})

const day = (wrapper: ReturnType<typeof mount>, number: string) =>
	wrapper
		.findAll('.vote-calendar__day')
		.find((button) => button.find('.vote-calendar__number').text() === number)!

const dayAction = (wrapper: ReturnType<typeof mount>, label: string) =>
	wrapper
		.findAll('.vote-calendar__day-actions button')
		.find((button) => button.text() === label)!

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
		expect(wrapper.find('.vote-calendar__day-actions').exists()).toBe(false)
		expect(day(wrapper, '15').attributes('aria-label')).not.toContain('answered')
		stores.session.currentUser.type = 'external'
		stores.poll.status.isExpired = true
		await nextTick()
		expect(wrapper.findAll('.read-only-vote')).toHaveLength(2)
		expect(wrapper.find('.vote-calendar__day-actions').exists()).toBe(false)
		stores.poll.status.isExpired = false
		stores.poll.permissions.vote = false
		await nextTick()
		expect(wrapper.find('.test-vote').exists()).toBe(false)
		expect(wrapper.find('.vote-calendar__day-actions').exists()).toBe(false)
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

describe('answers for a whole day', () => {
	it.each([
		['All Yes', 'yes'],
		['All Maybe', 'maybe'],
		['All No', 'no'],
	])(
		'sets %s only for the selected day and skips unchanged answers',
		async (label, answer) => {
			const wrapper = mount(VoteCalendar)
			await september(wrapper)
			await dayAction(wrapper, label).trigger('click')
			await flushPromises()
			expect(
				stores.votes.set.mock.calls.map(([payload]: any) => [
					payload.option.id,
					payload.setTo,
				]),
			).toEqual(
				answer === 'no'
					? [[2, 'no']]
					: [
							[1, answer],
							[2, answer],
						],
			)
			expect(stores.votes.getVote({ option: { id: 3 } }).answer).toBe('')
			expect(day(wrapper, '15').attributes('aria-label')).toContain(
				'2 of 2 options answered',
			)
			expect(dayAction(wrapper, label).attributes('disabled')).toBeDefined()
			expect(stores.success).toHaveBeenCalledOnce()
			wrapper.unmount()
		},
	)

	it('skips locked and deleted options and hides disabled answer choices', async () => {
		stores.options.options[0].locked = true
		stores.options.options.push({
			...option(4, '2026-09-15T19:00:00+02:00'),
			deleted: 1,
		})
		stores.poll.configuration.allowMaybe = false
		stores.poll.configuration.useNo = false
		const wrapper = mount(VoteCalendar)
		await september(wrapper)
		expect(
			wrapper
				.findAll('.vote-calendar__day-actions button')
				.map((button) => button.text()),
		).toEqual(['All Yes'])
		await dayAction(wrapper, 'All Yes').trigger('click')
		await flushPromises()
		expect(
			stores.votes.set.mock.calls.map(([payload]: any) => payload.option.id),
		).toEqual([2])
		expect(stores.votes.getVote({ option: { id: 1 } }).answer).toBe('no')
		await day(wrapper, '16').trigger('click')
		expect(wrapper.find('.vote-calendar__day-actions').exists()).toBe(false)
		wrapper.unmount()
	})

	it('serializes requests and blocks duplicate batches, individual votes, and day navigation while saving', async () => {
		let finish!: () => void
		stores.votes.set.mockImplementationOnce(({ option, setTo }: any) => {
			stores.votes.setOptimistic({ option, setTo })
			return new Promise((resolve) => {
				finish = () => resolve({})
			})
		})
		const wrapper = mount(VoteCalendar)
		await september(wrapper)
		await dayAction(wrapper, 'All Yes').trigger('click')
		expect(stores.votes.set).toHaveBeenCalledTimes(1)
		expect(
			wrapper.get('.vote-calendar__day-actions').attributes('aria-busy'),
		).toBe('true')
		for (const button of wrapper.findAll(
			'.vote-calendar__day-actions button, .test-vote, .vote-calendar__day',
		)) {
			expect(button.attributes('disabled')).toBeDefined()
		}
		expect(
			wrapper.get('[aria-label="Next month"]').attributes('disabled'),
		).toBeDefined()
		await dayAction(wrapper, 'All Maybe').trigger('click')
		await day(wrapper, '16').trigger('click')
		expect(
			wrapper
				.get('.vote-calendar__day.selected .vote-calendar__number')
				.text(),
		).toBe('15')
		expect(stores.votes.set).toHaveBeenCalledTimes(1)
		finish()
		await flushPromises()
		expect(stores.votes.set).toHaveBeenCalledTimes(2)
		expect(
			dayAction(wrapper, 'All Maybe').attributes('disabled'),
		).toBeUndefined()
		wrapper.unmount()
	})

	it('restores rejected votes and reports partial failure while preserving successful writes', async () => {
		stores.votes.set.mockImplementationOnce(async ({ option, setTo }: any) => {
			stores.votes.setOptimistic({ option, setTo })
			throw { response: { status: 409 } }
		})
		const wrapper = mount(VoteCalendar)
		await september(wrapper)
		await dayAction(wrapper, 'All Yes').trigger('click')
		await flushPromises()
		expect(stores.votes.getVote({ option: { id: 1 } }).answer).toBe('no')
		expect(stores.votes.getVote({ option: { id: 2 } }).answer).toBe('yes')
		expect(stores.error).toHaveBeenCalledWith(
			expect.stringContaining('1 answers saved, 1 not saved'),
		)
		expect(stores.success).not.toHaveBeenCalled()
		expect(wrapper.text()).toContain('Please check your answers.')
		wrapper.unmount()
	})

	it('waits for an individual vote before allowing a batch', async () => {
		const wrapper = mount(VoteCalendar)
		await september(wrapper)
		const button = wrapper.findComponent({ name: 'VoteButton' })
		let finish!: () => void
		const saving = new Promise<void>((resolve) => {
			finish = resolve
		})
		button.vm.$emit('saving', saving)
		await nextTick()
		expect(dayAction(wrapper, 'All Yes').attributes('disabled')).toBeDefined()
		await dayAction(wrapper, 'All Yes').trigger('click')
		expect(stores.votes.set).not.toHaveBeenCalled()
		finish()
		await flushPromises()
		expect(dayAction(wrapper, 'All Yes').attributes('disabled')).toBeUndefined()
		wrapper.unmount()
	})

	it('stops unsent votes when leaving the calendar', async () => {
		let finish!: () => void
		stores.votes.set.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					finish = () => resolve({})
				}),
		)
		const wrapper = mount(VoteCalendar)
		await september(wrapper)
		await dayAction(wrapper, 'All Yes').trigger('click')
		wrapper.unmount()
		finish()
		await flushPromises()
		expect(stores.votes.set).toHaveBeenCalledTimes(1)
		expect(stores.success).not.toHaveBeenCalled()
	})
})
