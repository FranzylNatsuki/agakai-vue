<script setup lang="ts">
import { ref } from 'vue';
import { IonPage, IonIcon } from '@ionic/vue';
import { eyeOffOutline, eyeOutline } from 'ionicons/icons';
import { useRouter } from 'vue-router';
import LoadingSpinner from '@/components/common/LoadingSpinner.vue';
import { authService } from '@/services/authService';
import { profileService } from '@/services/profileService';

const router = useRouter();

const seniorId = ref('');
const password = ref('');
const obscure = ref(true);
const isLoading = ref(false);
const errorMessage = ref('');
const showError = ref(false);

function fail(message: string) {
  errorMessage.value = message;
  showError.value = true;
  setTimeout(() => {
    showError.value = false;
  }, 2600);
}

async function login() {
  const id = seniorId.value.trim();
  const pw = password.value.trim();
  if (!id || !pw) {
    fail('Please fill in all fields.');
    return;
  }

  isLoading.value = true;
  try {
    const user = await authService.login(id, pw);
    profileService.setCurrentUser(user.id);
    await router.replace('/app');
  } catch (e) {
    fail((e as Error).message.replace('Exception: ', ''));
  } finally {
    isLoading.value = false;
  }
}

async function quickDemoLogin() {
  seniorId.value = 'SC-2024-0001';
  password.value = 'demo';
  await login();
}
</script>

<template>
  <IonPage>
    <div class="tala-login">
      <!-- Top Header matching Tala -->
      <header class="top">
        <div class="logo">
          <span class="mark">
            <svg viewBox="0 0 24 24">
              <path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z" />
            </svg>
          </span>
          Tala
        </div>
        <div class="chip">
          <svg class="i"><use href="#check" /></svg>
          Senior Portal
        </div>
      </header>

      <section class="login-main fade-in">
        <div class="hello">
          <div class="badge"><i />Senior Benefits Agent</div>
          <h1>
            Maayong adlaw,<br />
            <span class="grad">Sign in to Tala.</span>
          </h1>
          <p class="sub">Enter your Senior ID to view your benefits and talk to Tala.</p>
        </div>

        <form class="login-card" @submit.prevent="login">
          <div class="field">
            <label class="field__label" for="senior-id">Senior ID</label>
            <div class="field__box">
              <svg class="i field__icon"><use href="#award" /></svg>
              <input
                id="senior-id"
                v-model="seniorId"
                type="text"
                placeholder="e.g. SC-2024-0001"
                autocomplete="username"
              />
            </div>
          </div>

          <div class="field">
            <label class="field__label" for="senior-pw">Password</label>
            <div class="field__box">
              <input
                id="senior-pw"
                v-model="password"
                :type="obscure ? 'password' : 'text'"
                placeholder="Enter your password"
                autocomplete="current-password"
              />
              <button
                class="eye"
                type="button"
                aria-label="Toggle password visibility"
                @click="obscure = !obscure"
              >
                <IonIcon :icon="obscure ? eyeOffOutline : eyeOutline" />
              </button>
            </div>
          </div>

          <button class="btn pri submit-btn" type="submit" :disabled="isLoading">
            <LoadingSpinner v-if="isLoading" :size="22" class="login-spinner" />
            <template v-else>
              Continue
              <svg class="i"><use href="#go" /></svg>
            </template>
          </button>

          <button class="btn demo-btn" type="button" :disabled="isLoading" @click="quickDemoLogin">
            <svg class="i"><use href="#user" /></svg>
            Quick Demo Sign In
          </button>
        </form>
      </section>

      <div class="toast" :class="{ on: showError }">{{ errorMessage }}</div>
    </div>
  </IonPage>
</template>

<style scoped>
.tala-login {
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  color: var(--ink);
}

.top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px 4px;
  flex-shrink: 0;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 800;
  font-size: 22px;
  letter-spacing: -0.02em;
}

.mark {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: var(--grad);
  display: grid;
  place-items: center;
}

.mark svg {
  width: 22px;
  height: 22px;
  fill: #fff;
}

.chip {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 12px;
  border-radius: 18px;
  background: var(--glass);
  border: 1px solid var(--line);
  font-size: 14px;
  font-weight: 600;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.chip .i {
  width: 16px;
  height: 16px;
  color: #16a34a;
}

.login-main {
  flex: 1;
  overflow-y: auto;
  padding: 20px 16px 24px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 18px;
}

.hello {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.badge {
  align-self: flex-start;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 14px;
  border-radius: 17px;
  background: var(--hi);
  border: 1px solid var(--line);
  font-size: 14px;
  font-weight: 600;
}

.badge i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #22c55e;
  box-shadow: 0 0 10px #22c55e;
}

h1 {
  font-size: calc(var(--fs) * 1.75);
  line-height: 1.08;
  font-weight: 800;
  letter-spacing: -0.035em;
}

.grad {
  background: linear-gradient(110deg, var(--ink) 10%, var(--a2));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.sub {
  color: var(--muted);
  font-size: calc(var(--fs) * 0.82);
  line-height: 1.4;
}

.login-card {
  background: var(--glass);
  border: 1px solid var(--line);
  border-radius: 28px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow: 0 12px 32px rgba(10, 20, 50, 0.08);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field__label {
  font-size: 15px;
  font-weight: 700;
  color: var(--muted);
  padding: 0 4px;
}

.field__box {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 60px;
  padding: 0 16px;
  border-radius: 20px;
  background: var(--solid);
  border: 1px solid var(--line);
  transition: border-color 0.15s ease;
}

.field__box:focus-within {
  border-color: var(--a2);
}

.field__icon {
  width: 22px;
  height: 22px;
  color: var(--a2);
}

.field__box input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: 0;
  background: none;
  font: inherit;
  font-size: var(--fs);
  font-weight: 600;
  color: var(--ink);
  outline: none;
}

.field__box input::placeholder {
  color: var(--muted);
  font-weight: 400;
}

.eye {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 22px;
  color: var(--muted);
}

.btn {
  min-height: 58px;
  border-radius: 20px;
  background: var(--solid);
  font-weight: 700;
  font-size: calc(var(--fs) * 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid var(--line);
  padding: 0 16px;
  transition: transform 0.14s ease;
}

.btn:active {
  transform: scale(0.985);
}

.btn.pri {
  background: var(--grad);
  color: #fff;
  border-color: transparent;
  box-shadow: 0 8px 22px var(--glow);
}

.submit-btn {
  margin-top: 4px;
}

.demo-btn {
  color: var(--a2);
  background: var(--hi);
}

.login-spinner {
  border-color: rgba(255, 255, 255, 0.35);
  border-top-color: #fff;
}

.toast {
  position: absolute;
  left: 50%;
  top: 72px;
  transform: translateX(-50%);
  background: var(--danger);
  color: #fff;
  padding: 12px 20px;
  border-radius: 24px;
  font-weight: 700;
  font-size: 16px;
  opacity: 0;
  transition: opacity 0.2s;
  pointer-events: none;
  z-index: 11;
  white-space: nowrap;
}

.toast.on {
  opacity: 1;
}
</style>
