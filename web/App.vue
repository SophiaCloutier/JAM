<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { api } from './api';
import AuthPanel from './AuthPanel.vue';
import Inbox from './Inbox.vue';
import Planning from './Planning.vue';
type Tab = 'plans' | 'invitations';
const page = ref<Tab>('plans');
const user = ref(''),
  loading = ref(true),
  error = ref(''),
  activeInvitations = ref(0);
/** Count for the Invitations tab badge; the inbox itself also reports it after every refresh. */
async function refreshCount() {
  try {
    const { inbox } = await api<{ inbox: { invitations: string } }>('/invitations/mine');
    activeInvitations.value = (JSON.parse(inbox.invitations) as { active: boolean }[]).filter(i => i.active).length;
  } catch {
    activeInvitations.value = 0;
  }
}
onMounted(async () => {
  try {
    user.value = (await api<{ user: string }>('/auth/current')).user;
  } catch {
  } finally {
    loading.value = false;
  }
});
watch(user, value => {
  if (value) void refreshCount();
});
watch(page, value => {
  if (value === 'plans' && user.value) void refreshCount();
});
async function logout() {
  try {
    await api('/auth/logout');
    user.value = '';
    page.value = 'plans';
  } catch (e) {
    error.value = (e as Error).message;
  }
}
</script>
<template>
  <main id="main" class="dashboard">
    <a class="skip" href="#content">Skip to content</a>
    <header class="topbar">
      <button class="wordmark" type="button" aria-label="JAM home" @click="page = 'plans'"><span>JAM</span></button>
      <div v-if="user" class="account">
        <span>{{ user }}</span
        ><button type="button" @click="logout">Sign out</button>
      </div>
    </header>

    <div id="content">
      <p v-if="error" class="notice error" role="alert">{{ error }}</p>
      <p v-if="loading" class="loading" role="status">Opening JAM…</p>
      <AuthPanel v-else-if="!user" @signed-in="user = $event" />
      <template v-else>
        <nav class="tabs" aria-label="Dashboard">
          <button
            :class="{ active: page === 'plans' }"
            type="button"
            :aria-current="page === 'plans' ? 'page' : undefined"
            @click="page = 'plans'"
          >
            Your plans
          </button>
          <button
            :class="{ active: page === 'invitations' }"
            type="button"
            :aria-current="page === 'invitations' ? 'page' : undefined"
            @click="page = 'invitations'"
          >
            Invitations<span v-if="activeInvitations" class="tab-count" :aria-label="`${activeInvitations} active`">{{
              activeInvitations
            }}</span>
          </button>
        </nav>
        <Planning v-if="page === 'plans'" @open-invitations="page = 'invitations'" />
        <Inbox v-else @count="activeInvitations = $event" />
      </template>
    </div>

    <footer><span>JAM · BOSTON</span><span>BEGINNERS WELCOME</span></footer>
  </main>
</template>
