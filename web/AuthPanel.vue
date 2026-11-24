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
  <div class="auth-grid">
    <section class="hero auth-intro">
      <p class="overline">A LITTLE TIME. SOMETHING CREATIVE.</p>
      <h1>Make something. Meet someone.</h1>
      <p class="hero-copy">No portfolio, no pressure. Just show up curious.</p>
      <div class="auth-steps">
        <p>Tell us what you like.</p>
        <p>Pick a day you're free.</p>
        <p>Say yes to a JAM.</p>
      </div>
    </section>
    <section class="panel request-panel auth-panel">
      <div class="panel-heading">
        <span class="panel-number">{{ mode === 'register' ? '01' : '→' }}</span>
        <div><h2>{{ mode === 'register' ? 'A good place to start.' : 'Welcome back.' }}</h2><p>{{ mode === 'register' ? 'Create an account with your college email.' : 'Your next creative plan is waiting.' }}</p></div>
      </div>
      <form @submit.prevent="submit">
        <label><span>College email</span><input id="auth-email" v-model="email" type="email" autocomplete="email" required maxlength="254" placeholder="you@college.edu"></label>
        <label><span>Password</span><input id="auth-password" v-model="password" type="password" :autocomplete="mode === 'register' ? 'new-password' : 'current-password'" :minlength="mode === 'register' ? 10 : 1" maxlength="128" required></label>
        <p v-if="mode === 'register'" class="form-hint">At least 10 characters. Alpha accounts check the .edu suffix; email ownership is not yet verified.</p>
        <p v-if="error" role="alert" class="notice error">{{ error }}</p>
        <button class="request-button" :disabled="busy">{{ busy ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Sign in' }} <span aria-hidden="true">→</span></button>
      </form>
      <button class="text-button" type="button" :disabled="busy" @click="mode = mode === 'register' ? 'login' : 'register'; error = ''">{{ mode === 'register' ? 'Already joined? Sign in' : 'New here? Create an account' }}</button>
    </section>
  </div>
</template>
