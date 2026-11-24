<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, nextTick } from 'vue';
import { api } from './api';
import InvitationCard from './InvitationCard.vue';
import type { Invitation } from '../shared/types';
const invitations = ref<Invitation[]>([]),
  busy = ref(false),
  loading = ref(true),
  error = ref(''),
  notice = ref(''),
  now = ref(Date.now());
const emit = defineEmits<{ count: [active: number] }>();
const pendingAction = ref<{ action: string; invitation: string } | null>(null);
const dialog = ref<HTMLDialogElement | null>(null);
watch(pendingAction, async value => {
  await nextTick();
  if (value) dialog.value?.showModal();
  else dialog.value?.close();
});
const active = computed(() => invitations.value.filter(i => i.active));
const history = computed(() => invitations.value.filter(i => !i.active));
watch(active, value => emit('count', value.length));
async function refresh() {
  try {
    const result = await api<{ inbox: { invitations: string } }>('/invitations/mine');
    invitations.value = JSON.parse(result.inbox.invitations);
    const live = await api<{ calendar: { events: { event: string; details: string }[] } }>('/events/mine');
    for (const invitation of invitations.value) {
      const event = live.calendar.events.find(e => e.event === invitation.event);
      if (event) invitation.details = event.details;
    }
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}
async function respond(action: string, invitation: string) {
  pendingAction.value = { action, invitation };
}
async function confirm() {
  const choice = pendingAction.value;
  if (!choice) return;
  busy.value = true;
  error.value = '';
  notice.value = '';
  try {
    await api(`/invitations/${choice.action}`, { invitation: choice.invitation });
    notice.value =
      choice.action === 'accept'
        ? 'You accepted. Your place is saved.'
        : choice.action === 'decline'
          ? 'Invitation declined. You can request another date.'
          : 'Attendance cancelled. Your place was released.';
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    pendingAction.value = null;
    await refresh();
    busy.value = false;
  }
}
let poll: ReturnType<typeof setInterval>, timer: ReturnType<typeof setInterval>;
onMounted(() => {
  void refresh();
  poll = setInterval(refresh, 15000);
  timer = setInterval(() => {
    now.value = Date.now();
  }, 1000);
});
onUnmounted(() => {
  clearInterval(poll);
  clearInterval(timer);
});
</script>
<template>
  <section class="invitations-view">
    <div class="invitations-heading">
      <div>
        <h1>Your invitations</h1>
        <p>One invitation at a time. Six hours to make it yours.</p>
      </div>
      <button
        class="link-button"
        type="button"
        :disabled="busy"
        @click="
          error = '';
          refresh();
        "
      >
        Refresh inbox
      </button>
    </div>
    <p v-if="error" class="notice error" role="alert">{{ error }}</p>
    <p v-if="notice" class="notice" role="status">{{ notice }}</p>
    <p v-if="loading" class="loading" role="status">Opening your inbox…</p>
    <div v-else-if="!active.length" class="invitation-grid">
      <article class="invitation-tile empty-tile">
        <h2>A little room for possibility.</h2>
        <span>No active invitations right now. Your next match will appear here.</span>
      </article>
    </div>
    <div v-else class="invitation-grid">
      <InvitationCard
        v-for="(invitation, i) in active"
        :key="invitation.invitation"
        :invitation="invitation"
        :now="now"
        :busy="busy"
        :tone="i % 2 ? 'green' : 'burgundy'"
        @respond="respond"
      />
    </div>
    <details v-if="history.length" class="history">
      <summary>Past invitations ({{ history.length }})</summary>
      <div class="invitation-grid">
        <InvitationCard
          v-for="(invitation, i) in history"
          :key="invitation.invitation"
          :invitation="invitation"
          :now="now"
          :busy="busy"
          :tone="i % 2 ? 'green' : 'burgundy'"
          @respond="respond"
        />
      </div>
    </details>
    <dialog ref="dialog" class="confirm" aria-labelledby="confirm-title" @cancel="pendingAction = null">
      <template v-if="pendingAction"
        ><h2 id="confirm-title">
          {{
            pendingAction.action === 'accept'
              ? 'Ready to join?'
              : pendingAction.action === 'decline'
                ? 'Pass on this JAM?'
                : 'Cancel your attendance?'
          }}
        </h2>
        <p>
          {{
            pendingAction.action === 'accept'
              ? 'Your acceptance is final. You can still cancel before the event if plans change.'
              : pendingAction.action === 'decline'
                ? 'This decision is final. You can request another date afterwards.'
                : 'Your place will be released for this event.'
          }}
        </p>
        <div class="tile-actions">
          <button class="solid-button" type="button" autofocus :disabled="busy" @click="confirm">
            {{ busy ? 'Saving…' : 'Confirm' }}</button
          ><button class="outline-button" type="button" :disabled="busy" @click="pendingAction = null">Go back</button>
        </div></template
      >
    </dialog>
  </section>
</template>
