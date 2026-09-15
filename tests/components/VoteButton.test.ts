/**
 * SPDX-FileCopyrightText: 2026 Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'
import VoteButton from '../../src/components/VoteTable/VoteButton.vue'

const mocks = vi.hoisted(() => ({
	poll: null as any,
	votes: null as any,
	success: vi.fn(),
	error: vi.fn(),
}))
vi.mock('../../src/stores/poll.ts', () => ({ usePollStore: () => mocks.poll }))
vi.mock('../../src/stores/votes.ts', () => ({ useVotesStore: () => mocks.votes }))
vi.mock('@nextcloud/l10n', () => ({ t: (_app: string, text: string) => text }))
vi.mock('@nextcloud/dialogs', () => ({
	showSuccess: mocks.success,
	showError: mocks.error,
}))
vi.mock('../../src/components/VoteTable/VoteIndicator.vue', () => ({
	default: { props: ['answer'], template: '<span>{{ answer }}</span>' },
}))
const props = {
	option: { id: 1, text: '17:00' } as any,
	user: { id: 'martin' } as any,
	immediate: true,
}

beforeEach(() => {
	vi.clearAllMocks()
	mocks.poll = reactive({ configuration: { allowMaybe: true, useNo: true } })
	const vote = reactive({ answer: '' })
	mocks.votes = {
		getVote: () => vote,
		setOptimistic: vi.fn(({ setTo }) => {
			vote.answer = setTo
		}),
		set: vi.fn().mockResolvedValue({}),
	}
})

it('starts saving immediately and finishes after switching days unmounts the button', async () => {
	let finish!: () => void
	mocks.votes.set.mockImplementation(
		() =>
			new Promise<void>((resolve) => {
				finish = resolve
			}),
	)
	const wrapper = mount(VoteButton, { props })
	await wrapper.trigger('click')
	expect(mocks.votes.set).toHaveBeenCalledExactlyOnceWith({
		option: props.option,
		setTo: 'yes',
	})
	expect(wrapper.attributes('disabled')).toBeDefined()
	expect(wrapper.emitted('saving')?.[0][0]).toBeInstanceOf(Promise)
	wrapper.unmount()
	finish()
	await flushPromises()
	expect(mocks.success).toHaveBeenCalled()
	expect(mocks.error).not.toHaveBeenCalled()
})

it('does not save an individual vote while a day batch disables the button', async () => {
	const wrapper = mount(VoteButton, { props: { ...props, disabled: true } })
	await wrapper.trigger('click')
	expect(mocks.votes.setOptimistic).not.toHaveBeenCalled()
	expect(mocks.votes.set).not.toHaveBeenCalled()
	await wrapper.setProps({ disabled: false })
	await wrapper.trigger('click')
	await flushPromises()
	expect(mocks.votes.set).toHaveBeenCalledOnce()
	wrapper.unmount()
})

it('restores the previous answer when the server rejects a vote', async () => {
	mocks.votes.set.mockRejectedValue({ response: { status: 409 } })
	const wrapper = mount(VoteButton, { props })
	await wrapper.trigger('click')
	await flushPromises()
	expect(mocks.votes.getVote().answer).toBe('')
	expect(mocks.error).toHaveBeenCalledWith('Vote already booked out')
	expect(wrapper.attributes('disabled')).toBeUndefined()
	wrapper.unmount()
})

it('uses the existing Yes/Maybe/No cycle and handles disabled Maybe and No', async () => {
	const wrapper = mount(VoteButton, { props })
	for (const answer of ['yes', 'maybe', 'no']) {
		await wrapper.trigger('click')
		await flushPromises()
		expect(mocks.votes.getVote().answer).toBe(answer)
	}
	mocks.poll.configuration.allowMaybe = false
	mocks.poll.configuration.useNo = false
	await wrapper.trigger('click')
	await flushPromises()
	expect(mocks.votes.getVote().answer).toBe('yes')
	await wrapper.trigger('click')
	await flushPromises()
	expect(mocks.votes.getVote().answer).toBe('')
	wrapper.unmount()
})

it('keeps the existing debounce for table and list buttons', async () => {
	vi.useFakeTimers()
	try {
		const wrapper = mount(VoteButton, { props: { ...props, immediate: false } })
		await wrapper.trigger('click')
		expect(mocks.votes.set).not.toHaveBeenCalled()
		await vi.advanceTimersByTimeAsync(300)
		expect(mocks.votes.set).toHaveBeenCalledExactlyOnceWith({
			option: props.option,
			setTo: 'yes',
		})
		wrapper.unmount()
	} finally {
		vi.useRealTimers()
	}
})
