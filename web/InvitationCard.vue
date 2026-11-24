<script setup lang="ts">
import { computed } from 'vue';
import type { Invitation, EventDetails } from '../shared/types';
const props = defineProps<{ invitation: Invitation; now: number; busy: boolean; tone?: 'burgundy' | 'green' }>();
const emit = defineEmits<{ respond: [action: string, invitation: string] }>();
const details = computed<EventDetails>(() => JSON.parse(props.invitation.details));
const remaining = computed(() => Math.max(0, props.invitation.deadline - props.now));
const countdown = computed(
  () => `${Math.floor(remaining.value / 3600000)}h ${Math.floor(remaining.value / 60000) % 60}m`,
);
const date = (n: number) =>
  new Date(n).toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
/** Tile overline in the approved style, e.g. "SAT, NOV 28 · 2:00 PM". */
const when = computed(() => {
  const d = new Date(props.invitation.start);
  const day = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`.toUpperCase();
});
const status = computed(() =>
  props.invitation.reason === 'EVENT_CANCELLED'
    ? 'Event cancelled'
    : props.invitation.status === 'PENDING' && !remaining.value
      ? 'Expired'
      : props.invitation.status.toLowerCase(),
);
</script>
<template>
  <article class="invitation-tile" :class="tone === 'green' ? 'green-tile' : 'burgundy-tile'">
    <div class="tile-top">
      <p class="overline">{{ when }}</p>
      <span class="tile-status">{{ status }}</span>
    </div>
    <h2>{{ details.title }}</h2>
    <span class="where">{{ details.venue }} · {{ details.area }}</span>
    <p class="blurb">{{ details.inviteBlurb }}</p>
    <p class="description">{{ details.description }}</p>
    <p class="tile-note">
      Ends {{ new Date(invitation.end).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }} ·
      {{ date(invitation.start) }} · {{ Intl.DateTimeFormat().resolvedOptions().timeZone }}
    </p>
    <template v-if="invitation.status === 'PENDING' && remaining && invitation.active">
      <p class="tile-note">
        <span class="tile-countdown">{{ countdown }} to respond.</span> Accepting commits you to this plan. If you
        decline or let this expire, you can request another date.
      </p>
      <div class="tile-actions">
        <button
          class="solid-button"
          type="button"
          :disabled="busy"
          @click="emit('respond', 'accept', invitation.invitation)"
        >
          Count me in</button
        ><button
          class="outline-button"
          type="button"
          :disabled="busy"
          @click="emit('respond', 'decline', invitation.invitation)"
        >
          Not this time
        </button>
      </div>
    </template>
    <template v-else-if="invitation.status === 'ACCEPTED' && invitation.active">
      <p class="notice">
        <b>You're in.</b>
        {{
          details.status === 'CONFIRMED'
            ? 'Your JAM is confirmed.'
            : 'We’ll confirm the plan once at least three people accept.'
        }}<span v-if="details.accepted !== undefined"> {{ details.accepted }} accepted.</span>
      </p>
      <div v-if="now < invitation.start" class="tile-actions">
        <button
          class="text-button"
          type="button"
          :disabled="busy"
          @click="emit('respond', 'cancel', invitation.invitation)"
        >
          Cancel my attendance
        </button>
      </div>
    </template>
    <p v-else-if="invitation.reason === 'EVENT_CANCELLED'" class="notice">
      This JAM was cancelled. Choose another date on the Plan page to try again.
    </p>
    <p v-else-if="invitation.status === 'ACCEPTED' && now >= invitation.end" class="notice">
      Hope you made something good. If you connected, consider exchanging contact details in person.
    </p>
  </article>
</template>
