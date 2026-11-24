<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from './api';
import DatePicker from './DatePicker.vue';
import {
  addDays,
  bostonTime,
  leadDays as LEAD_DAYS,
  localDay,
  locations,
  radii,
  suggestedTags,
  didYouMean,
  normalizeTag,
} from '../shared/catalog';
const emit = defineEmits<{ openInvitations: [] }>();
type RequestView = {
  request: string;
  date: string;
  start: number;
  end: number;
  selected: string;
  location: string;
  radius: number;
  status: string;
  reason: string;
};
// Default event length, for the client-side hint only; the server enforces EVENT_HOURS.
const EVENT_HOURS = 2;
const tags = ref<string[]>([]),
  custom = ref(''),
  requests = ref<RequestView[]>([]);
const date = ref(''),
  from = ref('13:00'),
  until = ref('17:00'),
  choice = ref(''),
  location = ref(locations[0].name),
  radius = ref(3);
const error = ref(''),
  notice = ref(''),
  busy = ref(false),
  admin = ref(false),
  events = ref<Array<{ event: string; title: string; status: string }>>([]);
const earliest = computed(() => addDays(localDay(Date.now()), LEAD_DAYS));
const open = computed(() => requests.value.filter(r => r.status === 'PENDING' || r.status === 'MATCHED'));
const latest = computed(() => requests.value[0]);
const past = computed(() => requests.value.filter(r => !open.value.includes(r)));
/** Client-side check mirrors the server rule so mistakes show before submitting; the server still decides. */
const formProblem = computed(() => {
  if (!tags.value.length) return 'Choose at least one interest first.';
  if (!date.value) return 'Choose a date.';
  if (date.value < earliest.value)
    return `Requests need ${LEAD_DAYS} days' notice. Choose ${pretty(earliest.value)} or later.`;
  if (
    !from.value ||
    !until.value ||
    bostonTime(date.value, until.value) - bostonTime(date.value, from.value) < EVENT_HOURS * 3600000
  )
    return `Give at least ${EVENT_HOURS} hours of free time.`;
  return '';
});
function pretty(day: string) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
function clock(time: number) {
  return new Date(time).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  });
}
function unmatchedMessage(r: RequestView) {
  const when = pretty(r.date);
  return (
    (
      {
        NO_MATCH: `We couldn't find a group for ${when}.`,
        NO_VENUE: `No venue was free for your group on ${when}.`,
        EVENT_CANCELLED: `Your JAM on ${when} was cancelled because not enough people confirmed.`,
        TOO_LATE: `Matching could not run in time for ${when}.`,
      } as Record<string, string>
    )[r.reason] ?? `We couldn't place you on ${when}.`
  );
}
async function refresh() {
  const [profile, pool] = await Promise.all([
    api<{ profile: { interests: string } }>('/profile/mine'),
    api<{ pool: { requests: string } }>('/requests/mine'),
  ]);
  tags.value = JSON.parse(profile.profile.interests);
  requests.value = JSON.parse(pool.pool.requests);
  // After an unmatched request, offer the same interest again; the user can change it.
  if (latest.value?.status === 'UNMATCHED' && !date.value) {
    choice.value = tags.value.includes(latest.value.selected) ? latest.value.selected : '';
    location.value = latest.value.location;
    radius.value = latest.value.radius;
  }
  if (choice.value && !tags.value.includes(choice.value)) choice.value = '';
  try {
    const result = await api<{ admin: { events: string } }>('/admin/events');
    admin.value = true;
    events.value = JSON.parse(result.admin.events);
  } catch {
    admin.value = false;
  }
}
async function act(work: () => Promise<unknown>, message: string) {
  busy.value = true;
  error.value = '';
  notice.value = '';
  try {
    await work();
    await refresh();
    notice.value = message;
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}
const suggestion = computed(() => didYouMean(custom.value));
/** The custom box only ever adds; toggling there would silently remove an interest the user retyped. */
function addCustom(value: string) {
  custom.value = '';
  if (tags.value.includes(normalizeTag(value))) {
    notice.value = `"${normalizeTag(value)}" is already one of your interests.`;
    return;
  }
  return act(() => api('/profile/addInterest', { tag: value }), 'Interests saved.');
}
function tag(value: string) {
  return act(
    () => api(tags.value.includes(value) ? '/profile/removeInterest' : '/profile/addInterest', { tag: value }),
    'Interests saved.',
  );
}
function submit() {
  if (formProblem.value) {
    error.value = formProblem.value;
    return;
  }
  const day = date.value;
  return act(
    async () => {
      await api('/requests/submit', {
        date: day,
        start: bostonTime(day, from.value),
        end: bostonTime(day, until.value),
        selected: choice.value,
        location: location.value,
        radius: radius.value,
      });
      date.value = '';
    },
    `Request saved for ${pretty(day)}. You'll get an invitation if a group forms.`,
  );
}
onMounted(() => act(refresh, ''));
</script>
<template>
  <section class="hero">
    <div>
      <h1>What are you up for?</h1>
      <p class="hero-copy">Choose your interests, then tell us when you’re free.</p>
    </div>
  </section>
  <p v-if="error" role="alert" class="notice error">{{ error }}</p>
  <p v-if="notice" role="status" class="notice">{{ notice }}</p>

  <section class="planner-grid">
    <article class="panel interests-panel">
      <div class="panel-heading">
        <span class="panel-number">01</span>
        <div>
          <h2>Your creative interests</h2>
          <p>No experience needed. Pick up to 12.</p>
        </div>
      </div>
      <div class="interest-list">
        <button
          v-for="item in [...new Set([...suggestedTags, ...tags])]"
          :key="item"
          type="button"
          :class="{ selected: tags.includes(item) }"
          :aria-pressed="tags.includes(item)"
          :disabled="busy"
          @click="tag(item)"
        >
          {{ item }}
        </button>
      </div>
      <form class="add-interest" @submit.prevent="addCustom(custom)">
        <label for="new-interest">Something else?</label>
        <input
          id="new-interest"
          v-model="custom"
          maxlength="40"
          minlength="2"
          required
          placeholder="Your creative interest"
        />
        <button :disabled="busy">Add interest</button>
        <p v-if="suggestion" class="suggestion" role="status">
          Did you mean <b>{{ suggestion }}</b
          >?<button type="button" class="text-button" :disabled="busy" @click="addCustom(suggestion)">
            Use {{ suggestion }}
          </button>
        </p>
      </form>
      <p class="selection-count">{{ tags.length }} of 12 selected</p>
    </article>

    <article class="panel request-panel">
      <div class="panel-heading">
        <span class="panel-number">02</span>
        <div>
          <h2>Request a JAM</h2>
          <p>
            Pick a date at least {{ LEAD_DAYS }} days ahead and at least {{ EVENT_HOURS }} hours of free time. Times are
            Boston time.
          </p>
        </div>
      </div>

      <template v-if="open.length">
        <div v-for="r in open" :key="r.request" class="success-card" role="status">
          <p class="overline">{{ r.status === 'PENDING' ? 'WAITING FOR MATCHING' : 'MATCHED' }}</p>
          <h3>{{ r.status === 'PENDING' ? 'We’re mixing your next JAM.' : 'You have a group.' }}</h3>
          <p>
            {{ pretty(r.date) }}, {{ clock(r.start) }} – {{ clock(r.end) }} · {{ r.selected || 'Surprise me' }} · within
            {{ r.radius }} mi of {{ r.location
            }}<template v-if="r.status === 'MATCHED'"><br />Open Invitations to respond.</template>
          </p>
          <button
            v-if="r.status === 'PENDING'"
            type="button"
            :disabled="busy"
            @click="
              act(
                () => api('/requests/withdraw', { request: r.request }),
                'Request withdrawn. You can choose a new date.',
              )
            "
          >
            Withdraw request
          </button>
          <button v-else type="button" @click="emit('openInvitations')">Go to invitations</button>
        </div>
      </template>
      <form v-else novalidate @submit.prevent="submit">
        <p v-if="latest?.status === 'UNMATCHED'" class="notice" role="status">
          {{ unmatchedMessage(latest) }} Choose another date below. You can keep the same interest or pick a new one.
        </p>
        <div class="date-field">
          <span id="request-date-label">Date</span>
          <DatePicker id="request-date" v-model="date" :min="earliest" labelledby="request-date-label" />
        </div>
        <div class="time-row">
          <label><span>Free from</span><input id="request-from" v-model="from" type="time" required /></label>
          <label><span>Free until</span><input id="request-until" v-model="until" type="time" required /></label>
        </div>
        <label
          ><span>What do you want to do?</span
          ><select id="request-choice" v-model="choice">
            <option value="">Surprise me (any of my interests)</option>
            <option v-for="t in tags" :key="t" :value="t">{{ t }}</option>
          </select></label
        >
        <label
          ><span>Starting from</span
          ><select id="request-location" v-model="location">
            <option v-for="l in locations" :key="l.name" :value="l.name">{{ l.name }}</option>
          </select></label
        >
        <label
          ><span>Willing to travel</span
          ><select id="request-radius" v-model.number="radius">
            <option v-for="r in radii" :key="r" :value="r">up to {{ r }} mi</option>
          </select></label
        >
        <p v-if="formProblem" class="form-hint" role="status">{{ formProblem }}</p>
        <button class="request-button" type="submit" :disabled="busy || !!formProblem">
          Request my JAM <span aria-hidden="true">→</span>
        </button>
      </form>

      <details v-if="past.length" class="past-requests">
        <summary>Previous requests</summary>
        <p v-for="r in past" :key="r.request">
          {{ pretty(r.date) }} · {{ r.selected || 'Surprise me' }} · {{ r.reason.replaceAll('_', ' ').toLowerCase() }}
        </p>
      </details>
    </article>
  </section>

  <section v-if="admin" class="panel admin-panel">
    <div class="panel-heading">
      <span class="panel-number">03</span>
      <div>
        <h2>Matching controls</h2>
        <p>
          Matching runs automatically the day before each date. Run it now to match every waiting date up to
          {{ pretty(earliest) }}.
        </p>
      </div>
    </div>
    <button
      class="solid-button"
      type="button"
      :disabled="busy"
      @click="act(() => api('/admin/run'), 'Matching finished. Unmatched people were asked to choose another date.')"
    >
      Run matching
    </button>
    <div v-for="event in events" :key="event.event" class="admin-event">
      <b>{{ event.title }}</b> · {{ event.status
      }}<button
        v-if="['FORMING', 'CONFIRMED'].includes(event.status)"
        class="outline-button"
        type="button"
        :disabled="busy"
        @click="
          act(
            () => api('/admin/cancel', { event: event.event }),
            'Event cancelled. Its participants were asked to choose another date.',
          )
        "
      >
        Cancel event
      </button>
    </div>
  </section>
</template>
