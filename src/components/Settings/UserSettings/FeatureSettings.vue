<!--
  - SPDX-FileCopyrightText: 2018 Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<script setup>
import { t } from '@nextcloud/l10n'
import { computed } from 'vue'
import NcCheckboxRadioSwitch from '@nextcloud/vue/components/NcCheckboxRadioSwitch'
import InputDiv from '../../Base/modules/InputDiv.vue'
import RadioGroupDiv from '../../Base/modules/RadioGroupDiv.vue'
import { usePreferencesStore } from '../../../stores/preferences.ts'

const preferencesStore = usePreferencesStore()

const defaultViewTextPoll = computed({
	get() {
		return preferencesStore.user.defaultViewTextPoll === 'list-view'
	},
	set(value) {
		preferencesStore.user.defaultViewTextPoll = value
			? 'list-view'
			: 'table-view'
	},
})

const dateViewOptions = [
	{ value: 'table-view', label: t('polls', 'Table view') },
	{ value: 'list-view', label: t('polls', 'List view') },
	{ value: 'month-view', label: t('polls', 'Month view') },
]
</script>

<template>
	<div>
		<div class="user_settings">
			<NcCheckboxRadioSwitch
				v-model="defaultViewTextPoll"
				type="switch"
				@update:modelValue="preferencesStore.write()">
				{{ t('polls', 'Text polls default to list view') }}
			</NcCheckboxRadioSwitch>
			<div class="settings_details">
				{{
					t(
						'polls',
						'Check this, if you prefer to display text poll in a vertical aligned list rather than in the grid view. The initial default is list view.',
					)
				}}
			</div>
		</div>

		<div class="user_settings">
			<h3>{{ t('polls', 'Default view for date polls') }}</h3>
			<RadioGroupDiv
				v-model="preferencesStore.user.defaultViewDatePoll"
				:options="dateViewOptions"
				@update="preferencesStore.write()" />
		</div>

		<div class="user_settings">
			<NcCheckboxRadioSwitch
				v-model="preferencesStore.user.verbosePollsList"
				type="switch"
				@update:modelValue="preferencesStore.write()">
				{{ t('polls', 'Verbose poll list') }}
			</NcCheckboxRadioSwitch>
			<div class="settings_details">
				{{
					t(
						'polls',
						'Check this for more poll information in the overview.',
					)
				}}
			</div>
		</div>

		<div class="user_settings">
			<InputDiv
				v-model="preferencesStore.user.relevantOffset"
				type="number"
				inputmode="numeric"
				useNumModifiers
				:label="
					t(
						'polls',
						'Enter the amount of days, polls without activity stay in the relevant list:',
					)
				"
				@change="preferencesStore.write()" />
		</div>
	</div>
</template>
