<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<script setup lang="ts">
import type { Option } from '../../stores/options.types.ts'

import { t } from '@nextcloud/l10n'
import { DateTime } from 'luxon'
import { computed, ref, watch } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import PreviousIcon from 'vue-material-design-icons/ChevronLeft.vue'
import NextIcon from 'vue-material-design-icons/ChevronRight.vue'
import OptionItem from '../Options/OptionItem.vue'
import OptionMenu from '../Options/OptionMenu.vue'
import OptionVoteCounter from '../Options/OptionVoteCounter.vue'
import VoteButton from '../VoteTable/VoteButton.vue'
import VoteItem from '../VoteTable/VoteItem.vue'
import { getDatesFromOption } from '../../composables/optionDateTime.ts'
import {
	groupOptionsByDay,
	initialDay,
	monthDays,
} from '../../helpers/modules/monthCalendar.ts'
import { useOptionsStore } from '../../stores/options.ts'
import { usePollStore } from '../../stores/poll.ts'
import { useSessionStore } from '../../stores/session.ts'
import { useVotesStore } from '../../stores/votes.ts'

const optionsStore = useOptionsStore()
const pollStore = usePollStore()
const sessionStore = useSessionStore()
const votesStore = useVotesStore()

const timezone = computed(() => sessionStore.currentTimezoneName)
const locale = computed(
	() => sessionStore.currentUser.localeCodeIntl || navigator.language,
)
const today = computed(() => DateTime.now().setZone(timezone.value).toISODate()!)
const grouped = computed(() =>
	groupOptionsByDay(optionsStore.options, timezone.value),
)
const dates = computed(() => [...grouped.value.keys()])
const selected = ref('')
const displayedMonth = ref('')
const month = computed(() =>
	DateTime.fromISO(displayedMonth.value || today.value, { zone: timezone.value })
		.setLocale(locale.value)
		.startOf('month'),
)
const weeks = computed(() => {
	const days = monthDays(month.value)
	return Array.from({ length: 6 }, (_, index) =>
		days.slice(index * 7, index * 7 + 7),
	)
})
const selectedOptions = computed(() => grouped.value.get(selected.value) ?? [])
const optionDates = computed(
	() =>
		new Map(
			selectedOptions.value.map((option) => [
				option.id,
				getDatesFromOption(option, timezone.value),
			]),
		),
)
const selectedDate = computed(() =>
	DateTime.fromISO(selected.value || today.value, {
		zone: timezone.value,
	}).setLocale(locale.value),
)
const hasIdentity = computed(() =>
	['user', 'external', 'admin'].includes(sessionStore.currentUser.type),
)
const canGoBack = computed(
	() =>
		dates.value.length > 0
		&& month.value.toFormat('yyyy-MM') > dates.value[0].slice(0, 7),
)
const canGoForward = computed(
	() =>
		dates.value.length > 0
		&& month.value.toFormat('yyyy-MM')
			< dates.value[dates.value.length - 1].slice(0, 7),
)
const answeredByDay = computed(
	() =>
		new Map(
			dates.value.map((day) => [
				day,
				grouped.value.get(day)!.filter((option) => answer(option) !== '')
					.length,
			]),
		),
)
const unplacedCount = computed(
	() =>
		optionsStore.options.filter((option) => !option.deleted).length
		- [...grouped.value.values()].reduce(
			(total, options) => total + options.length,
			0,
		),
)

watch(
	[dates, timezone],
	([, zone], [, previousZone]) => {
		if (previousZone && previousZone !== zone) {
			const anchor = groupOptionsByDay(optionsStore.options, previousZone).get(
				selected.value,
			)?.[0]
			if (anchor) {
				selected.value = anchor.getDateTime().setZone(zone).toISODate()!
				displayedMonth.value = selected.value
				return
			}
		}
		if (!selected.value || !grouped.value.has(selected.value)) {
			selected.value = initialDay(dates.value, today.value) ?? today.value
			displayedMonth.value = selected.value
		}
	},
	{ immediate: true },
)

function answer(option: Option) {
	return votesStore.getVote({ option, user: sessionStore.currentUser }).answer
}

function answerLabel(option: Option) {
	return {
		yes: t('polls', 'Yes'),
		maybe: t('polls', 'Maybe'),
		no: t('polls', 'No'),
		'': t('polls', 'No answer'),
	}[answer(option)]
}

function isVotable(option: Option) {
	return (
		hasIdentity.value
		&& pollStore.permissions.vote
		&& !pollStore.status.isExpired
		&& !option.locked
		&& !option.deleted
	)
}

function timeLabel(option: Option) {
	const dates = optionDates.value.get(option.id)!
	return dates.isSameTime
		? dates.optionStart
				.setLocale(locale.value)
				.toLocaleString(DateTime.TIME_SIMPLE)
		: dates.interval.toLocaleString(DateTime.TIME_SIMPLE, {
				locale: locale.value,
			})
}

function changeMonth(step: number) {
	const next = month.value.plus({ months: step })
	displayedMonth.value = next.toISODate()!
	selected.value =
		dates.value.find((day) => day.startsWith(next.toFormat('yyyy-MM')))
		?? next.toISODate()!
}

function dayLabel(day: DateTime) {
	const key = day.toISODate()!
	const count = grouped.value.get(key)?.length ?? 0
	const date = day.toLocaleString(DateTime.DATE_HUGE)
	return hasIdentity.value && count
		? t('polls', '{date}: {answered} of {total} options answered', {
				date,
				answered: answeredByDay.value.get(key) ?? 0,
				total: count,
			})
		: t('polls', '{date}: {total} options', { date, total: count })
}
</script>

<template>
	<div class="vote-calendar">
		<section class="vote-calendar__month" :aria-label="t('polls', 'Month view')">
			<div class="vote-calendar__navigation">
				<NcButton
					:aria-label="t('polls', 'Previous month')"
					:disabled="!canGoBack"
					@click="changeMonth(-1)">
					<template #icon><PreviousIcon :size="20" /></template>
				</NcButton>
				<h2 aria-live="polite">
					{{ month.toLocaleString({ month: 'long', year: 'numeric' }) }}
				</h2>
				<NcButton
					:aria-label="t('polls', 'Next month')"
					:disabled="!canGoForward"
					@click="changeMonth(1)">
					<template #icon><NextIcon :size="20" /></template>
				</NcButton>
			</div>
			<p class="vote-calendar__timezone">
				{{ t('polls', 'Timezone: {timezone}', { timezone }) }}
			</p>
			<table class="vote-calendar__grid">
				<caption class="hidden-visually">
					{{
						t('polls', 'Select a day to see its options')
					}}
				</caption>
				<thead>
					<tr>
						<th
							v-for="day in weeks[0]"
							:key="day.weekday"
							scope="col"
							:abbr="day.weekdayLong!">
							{{ day.weekdayShort }}
						</th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="(week, index) in weeks" :key="index">
						<td v-for="day in week" :key="day.toISODate()!">
							<button
								v-if="day.month === month.month"
								type="button"
								class="vote-calendar__day"
								:class="{
									'has-options': grouped.has(day.toISODate()!),
									selected: selected === day.toISODate(),
								}"
								:aria-label="dayLabel(day)"
								:aria-pressed="selected === day.toISODate()"
								:aria-current="
									day.toISODate() === today ? 'date' : undefined
								"
								@click="selected = day.toISODate()!">
								<span class="vote-calendar__number">{{
									day.day
								}}</span>
								<span
									v-if="grouped.has(day.toISODate()!)"
									class="vote-calendar__count"
									aria-hidden="true">
									<template v-if="hasIdentity"
										>{{
											answeredByDay.get(day.toISODate()!)
										}}/</template
									>{{ grouped.get(day.toISODate()!)!.length }}
								</span>
								<span
									v-if="
										hasIdentity && grouped.has(day.toISODate()!)
									"
									class="vote-calendar__progress"
									aria-hidden="true">
									<span
										:style="{
											width: `${(100 * (answeredByDay.get(day.toISODate()!) ?? 0)) / grouped.get(day.toISODate()!)!.length}%`,
										}" />
								</span>
							</button>
							<span
								v-else
								class="vote-calendar__outside"
								aria-hidden="true"
								>{{ day.day }}</span
							>
						</td>
					</tr>
				</tbody>
			</table>
			<p class="vote-calendar__hint">
				{{
					hasIdentity
						? t('polls', 'Answered options / total options per day')
						: t('polls', 'Select a day to see its options')
				}}
			</p>
			<p v-if="unplacedCount" role="status">
				{{
					t(
						'polls',
						'Some options have no valid date. Use table or list view to see them.',
					)
				}}
			</p>
		</section>
		<section
			class="vote-calendar__details"
			:aria-label="t('polls', 'Day details')">
			<h2 aria-live="polite">
				{{ selectedDate.toLocaleString(DateTime.DATE_HUGE) }}
			</h2>
			<p v-if="hasIdentity" class="vote-calendar__hint">
				{{ t('polls', 'Your answers are saved automatically.') }}
			</p>
			<p v-if="!selectedOptions.length" class="vote-calendar__empty">
				{{ t('polls', 'No options on this day') }}
			</p>
			<ul v-else class="vote-calendar__slots">
				<li
					v-for="option in selectedOptions"
					:key="option.id"
					class="vote-calendar__slot"
					:class="{ confirmed: option.confirmed }">
					<div class="vote-calendar__option">
						<strong
							v-if="
								optionDates.get(option.id)!.isSameDay
								&& !optionDates.get(option.id)!.isFullDays
							"
							class="vote-calendar__time"
							>{{ timeLabel(option) }}</strong
						>
						<OptionItem v-else :option="option" />
						<OptionMenu :option="option" />
					</div>
					<div class="vote-calendar__actions">
						<OptionVoteCounter
							v-if="pollStore.permissions.seeResults"
							:key="String(pollStore.permissions.seeUsernames)"
							:option="option"
							:showMaybe="pollStore.configuration.allowMaybe" />
						<div v-if="hasIdentity" class="vote-calendar__answer">
							<span>{{ answerLabel(option) }}</span>
							<VoteButton
								v-if="isVotable(option)"
								:option="option"
								:user="sessionStore.currentUser"
								immediate />
							<VoteItem
								v-else
								:option="option"
								:user="sessionStore.currentUser"
								currentUser />
						</div>
					</div>
				</li>
			</ul>
		</section>
	</div>
</template>

<style lang="scss" scoped>
.vote-calendar {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr));
	gap: 24px;
	align-items: start;
	width: 100%;
	max-width: 1280px;
	margin-inline: auto;
	padding: 16px;
	box-sizing: border-box;

	h2 {
		margin: 0;
		font-size: 1.2em;
		font-weight: 600;
	}
	&__month,
	&__details {
		min-width: 0;
	}
	&__navigation {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	&__timezone,
	&__hint {
		color: var(--color-text-maxcontrast);
		margin-block: 12px;
		overflow-wrap: anywhere;
	}
	&__grid {
		table-layout: fixed;
		width: 100%;
		border-spacing: 4px;
		border-collapse: separate;
	}
	&__grid th {
		padding-block: 8px;
		font-weight: 600;
		text-align: center;
	}
	&__grid td {
		padding: 0;
		height: 76px;
		vertical-align: top;
	}
	&__day {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		position: relative;
		width: 100%;
		height: 100%;
		min-height: 64px;
		margin: 0;
		padding: 4px;
		background: var(--color-main-background);
		border: 1px solid var(--color-border);
		border-radius: var(--border-radius-large);
		color: var(--color-main-text);
		cursor: pointer;
		&.has-options {
			background: var(--color-background-hover);
		}
		&.selected {
			outline: 2px solid var(--color-primary-element);
			outline-offset: -2px;
			background: var(--color-primary-element-light);
		}
		&:focus-visible {
			outline: 3px solid var(--color-main-text);
			outline-offset: 1px;
		}
		&[aria-current='date'] .vote-calendar__number {
			text-decoration: underline;
			text-underline-offset: 3px;
		}
	}
	&__number {
		font-weight: 600;
	}
	&__count {
		font-size: 0.8em;
		color: var(--color-text-maxcontrast);
	}
	&__outside {
		display: block;
		text-align: center;
		padding-block: 12px;
		color: var(--color-text-maxcontrast);
	}
	&__progress {
		position: absolute;
		inset-inline: 8px;
		bottom: 5px;
		height: 3px;
		background: var(--color-border);
		border-radius: 4px;
		overflow: hidden;
	}
	&__progress span {
		display: block;
		height: 100%;
		background: var(--color-primary-element);
	}
	&__slots {
		list-style: none;
		margin: 12px 0 0;
		padding: 0;
	}
	&__slot {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		margin-block-end: 8px;
		border: 1px solid var(--color-border);
		border-radius: var(--border-radius-large);
		background: var(--color-main-background);
	}
	&__option {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	&__time {
		font-size: 1.05em;
		font-weight: 600;
	}
	&__option > .option-item {
		flex: 1;
		min-width: 0;
	}
	&__actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}
	&__answer {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-inline-start: auto;
	}
	&__answer :deep(.vote-button),
	&__answer :deep(.vote-item) {
		width: 44px;
		min-height: 44px;
		flex: 0 0 44px;
	}
	&__empty {
		padding-block: 24px;
		color: var(--color-text-maxcontrast);
	}
}

@media (max-width: 1000px) {
	.vote-calendar {
		grid-template-columns: minmax(0, 1fr);
		max-width: 650px;
		padding: 8px;
		gap: 20px;
	}
}

@media (max-width: 400px) {
	.vote-calendar__grid {
		border-spacing: 2px;
	}
	.vote-calendar__grid td {
		height: 64px;
	}
}
</style>
