<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { addDays, leadDays, localDay } from '../shared/catalog';

/** A month calendar for choosing one date. Days you can pick are outlined boxes that change color on hover;
 * days before `min` are faded text with no box. Weekends look like every other day.
 * The value is a YYYY-MM-DD string, like an <input type="date">. */
const props = defineProps<{ modelValue: string; min: string; id?: string; labelledby?: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const open = ref(false);
const root = ref<HTMLElement | null>(null);
const grid = ref<HTMLElement | null>(null);
/** The first day of the month on screen, as YYYY-MM-01. */
const month = ref(firstOfMonth(props.modelValue || props.min));
const today = localDay(Date.now());

/** Calendar maths on YYYY-MM-DD strings at noon UTC, so the viewer's timezone never shifts a day. */
function asDate(day: string) {
  return new Date(`${day}T12:00:00Z`);
}
function firstOfMonth(day: string) {
  return `${day.slice(0, 7)}-01`;
}
function shiftMonth(first: string, months: number) {
  const d = asDate(first);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}
function format(day: string, options: Intl.DateTimeFormatOptions) {
  return asDate(day).toLocaleDateString(undefined, { ...options, timeZone: 'UTC' });
}

const monthLabel = computed(() => format(month.value, { month: 'long', year: 'numeric' }));
const canGoBack = computed(() => month.value > firstOfMonth(props.min));
const fieldLabel = computed(() =>
  props.modelValue ? format(props.modelValue, { weekday: 'short', month: 'short', day: 'numeric' }) : 'Choose a date',
);

/** The month's days, padded with blanks so the first day lands under its weekday. */
const cells = computed(() => {
  const first = asDate(month.value);
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const blanks: null[] = Array.from({ length: first.getUTCDay() }, () => null);
  const days = Array.from({ length: lastDay }, (_, i) => {
    const day = addDays(month.value, i);
    return {
      day,
      number: i + 1,
      available: day >= props.min,
      selected: day === props.modelValue,
      today: day === today,
      label: format(day, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
    };
  });
  return [...blanks, ...days];
});

/** The day that takes keyboard focus in the grid: the selected day, else the first one you can pick. */
const focusDay = computed(() => {
  const days = cells.value.filter(c => c !== null);
  return (days.find(c => c.selected && c.available) ?? days.find(c => c.available))?.day ?? '';
});

function choose(day: string) {
  emit('update:modelValue', day);
  open.value = false;
}

async function focus(day: string) {
  await nextTick();
  grid.value?.querySelector<HTMLButtonElement>(`[data-day="${day}"]`)?.focus();
}

async function toggle() {
  open.value = !open.value;
  if (open.value) {
    month.value = firstOfMonth(props.modelValue || props.min);
    await focus(focusDay.value);
  }
}

/** Arrow keys move by a day or a week, changing month when needed; days before `min` are skipped. */
async function onKey(event: KeyboardEvent, day: string) {
  const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
  if (!(event.key in steps)) return;
  event.preventDefault();
  const next = addDays(day, steps[event.key]);
  if (next < props.min) return;
  month.value = firstOfMonth(next);
  await focus(next);
}

function onDocumentClick(event: MouseEvent) {
  if (open.value && root.value && !root.value.contains(event.target as Node)) open.value = false;
}
function onDocumentKey(event: KeyboardEvent) {
  if (open.value && event.key === 'Escape') open.value = false;
}

// If the earliest date moves past the shown month (for example after midnight), follow it.
watch(
  () => props.min,
  min => {
    if (month.value < firstOfMonth(min)) month.value = firstOfMonth(min);
  },
);

onMounted(() => {
  document.addEventListener('click', onDocumentClick);
  document.addEventListener('keydown', onDocumentKey);
});
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick);
  document.removeEventListener('keydown', onDocumentKey);
});
</script>

<template>
  <div ref="root" class="date-picker">
    <button
      :id="id"
      type="button"
      class="date-field-button"
      :class="{ placeholder: !modelValue }"
      :aria-expanded="open"
      :aria-labelledby="labelledby ? `${labelledby} ${id}` : undefined"
      @click="toggle"
    >
      <span>{{ fieldLabel }}</span>
      <span aria-hidden="true">{{ open ? '▴' : '▾' }}</span>
    </button>

    <div v-if="open" class="calendar" role="group" :aria-label="`Choose a date, ${monthLabel}`">
      <div class="calendar-head">
        <button
          type="button"
          class="calendar-nav"
          :disabled="!canGoBack"
          aria-label="Previous month"
          @click="month = shiftMonth(month, -1)"
        >
          ‹
        </button>
        <strong aria-live="polite">{{ monthLabel }}</strong>
        <button type="button" class="calendar-nav" aria-label="Next month" @click="month = shiftMonth(month, 1)">›</button>
      </div>

      <div class="calendar-grid" aria-hidden="true">
        <span v-for="name in WEEKDAYS" :key="name" class="calendar-weekday">{{ name }}</span>
      </div>
      <div ref="grid" class="calendar-grid">
        <template v-for="(cell, i) in cells" :key="cell?.day ?? `blank-${i}`">
          <span v-if="!cell" class="calendar-blank" />
          <button
            v-else
            type="button"
            class="calendar-day"
            :class="{ selected: cell.selected, today: cell.today }"
            :data-day="cell.day"
            :disabled="!cell.available"
            :tabindex="cell.day === focusDay ? 0 : -1"
            :aria-pressed="cell.selected"
            :aria-label="cell.available ? cell.label : `${cell.label}, not available`"
            @click="choose(cell.day)"
            @keydown="onKey($event, cell.day)"
          >
            {{ cell.number }}
          </button>
        </template>
      </div>

      <p class="calendar-hint">Outlined days can be chosen. Requests need {{ leadDays }} days' notice.</p>
    </div>
  </div>
</template>
