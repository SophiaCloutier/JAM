<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api } from './api';
import AuthPanel from './AuthPanel.vue';
import Inbox from './Inbox.vue';
const user = ref(''), loading = ref(true), error = ref('');
onMounted(async () => { try { user.value = (await api<{ user: string }>('/auth/current')).user; } catch {} finally { loading.value = false; } });
async function logout() { try { await api('/auth/logout'); user.value = ''; } catch (e) { error.value = (e as Error).message; } }
</script>
<template><div class="app-shell"><a class="skip" href="#main">Skip to content</a><header><a class="wordmark" href="/" aria-label="JAM home">JAM<span>MAKE TIME TO MAKE.</span></a><nav aria-label="Main navigation"><template v-if="user"><span class="user-email">{{ user }}</span><button class="text-button" @click="logout">Sign out</button></template><span v-else class="tag">ALPHA</span></nav></header><main id="main"><p v-if="error" role="alert">{{ error }}</p><p v-if="loading" role="status">Opening JAM…</p><AuthPanel v-else-if="!user" @signed-in="user = $event"/><Inbox v-else/></main><footer><b>JAM</b><span>Creative company. No experience required.</span><span>Alpha · Invitation slice</span></footer></div></template>
