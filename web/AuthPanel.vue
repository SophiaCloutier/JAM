<script setup lang="ts">
import { ref } from 'vue';
import { api } from './api';
const emit = defineEmits<{ signedIn: [user: string] }>();
const mode = ref<'register' | 'login'>('register'), email = ref(''), password = ref(''), error = ref(''), busy = ref(false);
async function submit() {
  busy.value = true; error.value = '';
  try { const result = await api<{ user: string }>(`/auth/${mode.value}`, { email: email.value, password: password.value }); emit('signedIn', result.user); }
  catch (e) { error.value = (e as Error).message; }
  finally { busy.value = false; }
}
</script>
<template>
  <div class="welcome-grid">
    <section class="intro"><p class="eyebrow">A LITTLE TIME. SOMETHING CREATIVE.</p><h1>Make something.<br>Meet someone.</h1><p class="lede">Find your people through a shared creative afternoon. No portfolio, no pressure. Just show up curious.</p><div class="steps"><p><b>Tell us what you like.</b><span>Beginners are always welcome.</span></p><p><b>Find a little free time.</b><span>One slot, one small group.</span></p><p><b>Say yes to a JAM.</b><span>Make something together.</span></p></div></section>
    <section class="panel auth"><p class="eyebrow">WELCOME TO JAM</p><h2>{{ mode === 'register' ? 'A good place to start.' : 'Welcome back.' }}</h2><p>{{ mode === 'register' ? 'Create an account with your college email.' : 'Your next creative plan is waiting.' }}</p>
      <form @submit.prevent="submit"><label>College email<input v-model="email" type="email" autocomplete="email" required maxlength="254" placeholder="you@college.edu"></label><label>Password<input v-model="password" type="password" :autocomplete="mode === 'register' ? 'new-password' : 'current-password'" :minlength="mode === 'register' ? 10 : 1" maxlength="128" required></label><p v-if="mode === 'register'" class="hint">At least 10 characters. Alpha accounts check the .edu suffix; email ownership is not yet verified.</p><p v-if="error" role="alert" class="notice">{{ error }}</p><button class="primary" :disabled="busy">{{ busy ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Sign in' }}</button></form>
      <button class="text-button" :disabled="busy" @click="mode = mode === 'register' ? 'login' : 'register'; error = ''">{{ mode === 'register' ? 'Already joined? Sign in' : 'New here? Create an account' }}</button>
    </section>
  </div>
</template>
