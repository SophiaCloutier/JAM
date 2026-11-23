<script setup lang="ts">
import { computed } from 'vue';
import type { Invitation, EventDetails } from '../shared/types';
const props = defineProps<{ invitation: Invitation; now: number; busy: boolean }>();
const emit = defineEmits<{ respond: [action: string, invitation: string] }>();
const details = computed<EventDetails>(() => JSON.parse(props.invitation.details));
const remaining = computed(() => Math.max(0, props.invitation.deadline - props.now));
const countdown = computed(() => `${Math.floor(remaining.value / 3600000)}h ${Math.floor(remaining.value / 60000) % 60}m`);
const date = (n: number) => new Date(n).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const status = computed(() => props.invitation.reason === 'EVENT_CANCELLED' ? 'Event cancelled' : props.invitation.status === 'PENDING' && !remaining.value ? 'Expired' : props.invitation.status.toLowerCase());
</script>
<template>
  <article class="panel invitation-card"><div class="card-top"><span class="tag">{{ status }}</span><span v-if="invitation.status === 'PENDING' && remaining" class="hint">{{ countdown }} to respond</span></div><h2>{{ details.title }}</h2><p>{{ details.inviteBlurb }}</p><dl class="event-facts"><div><dt>When</dt><dd>{{ date(invitation.start) }}<br><span class="hint">{{ new Date(invitation.end).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }} finish · {{ Intl.DateTimeFormat().resolvedOptions().timeZone }}</span></dd></div><div><dt>Where</dt><dd>{{ details.venue }}<br><span class="hint">{{ details.area }}</span></dd></div></dl><p>{{ details.description }}</p>
    <template v-if="invitation.status === 'PENDING' && remaining && invitation.active"><p class="hint">Accepting commits you to this plan. If you decline or let this expire, you can request another date.</p><div class="actions"><button class="primary" :disabled="busy" @click="emit('respond', 'accept', invitation.invitation)">Count me in</button><button :disabled="busy" @click="emit('respond', 'decline', invitation.invitation)">Not this time</button></div></template>
    <template v-else-if="invitation.status === 'ACCEPTED' && invitation.active"><div class="notice"><b>You're in.</b> {{ details.status === 'CONFIRMED' ? 'Your JAM is confirmed.' : 'We’ll confirm the plan once at least three people accept.' }}<span v-if="details.accepted !== undefined"> {{ details.accepted }} accepted.</span></div><button v-if="now < invitation.start" class="text-button" :disabled="busy" @click="emit('respond', 'cancel', invitation.invitation)">Cancel my attendance</button></template>
    <p v-else-if="invitation.reason === 'EVENT_CANCELLED'" class="notice">This JAM was cancelled. Choose another date on the Plan page to try again.</p>
    <p v-else-if="invitation.status === 'ACCEPTED' && now >= invitation.end" class="notice">Hope you made something good. If you connected, consider exchanging contact details in person.</p>
  </article>
</template>
