<script setup lang="ts">
import { ref } from 'vue';
import { IonPage, IonIcon } from '@ionic/vue';
import { eyeOffOutline, eyeOutline } from 'ionicons/icons';
import { useRouter } from 'vue-router';
import LoadingSpinner from '@/components/common/LoadingSpinner.vue';
import { authService } from '@/services/authService';
import { profileService } from '@/services/profileService';
import { ttsPlayer } from '@/services/ttsPlayer';

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
  }, 3200);
}

async function login() {
  const id = seniorId.value.trim();
  const pw = password.value.trim();
  if (!id || !pw) {
    fail('Please fill in all fields.');
    return;
  }

  isLoading.value = true;
  void ttsPlayer.stop();
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
</script>

<template>
  <IonPage>
    <div class="agakai-login">
      <section class="login-main fade-in">
        <img class="login-logo" src="/assets/logo.png?v=repair2" alt="AgakAI" />

        <form class="login-card fade-up" @submit.prevent="login">
          <div class="field">
            <label class="field__label" for="senior-id">Senior ID</label>
            <div class="field__box">
              <svg class="i field__icon"><use href="#user" /></svg>
              <input
                id="senior-id"
                v-model="seniorId"
                type="text"
                placeholder="Enter your Senior ID"
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
            <template v-else>Log in</template>
          </button>
        </form>
      </section>

      <div class="toast" :class="{ on: showError }">{{ errorMessage }}</div>
    </div>
  </IonPage>
</template>

<style scoped>
.agakai-login {
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  color: var(--ink);
}

.login-main {
  flex: 1;
  overflow-y: auto;
  padding: 32px 20px calc(28px + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
}

.login-logo {
  display: block;
  width: 240px;
  max-width: 80%;
  height: auto;
  object-fit: contain;
}

.login-card {
  width: 100%;
  background: var(--glass);
  border: 1px solid var(--line);
  border-radius: 28px;
  padding: 18px;
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
  margin-top: 6px;
}

.login-spinner {
  border-color: rgba(255, 255, 255, 0.35);
  border-top-color: #fff;
}

.toast {
  position: absolute;
  left: 50%;
  top: 32px;
  transform: translateX(-50%);
  background: var(--danger);
  color: #fff;
  padding: 12px 20px;
  border-radius: 24px;
  font-weight: 700;
  font-size: 15px;
  opacity: 0;
  transition: opacity 0.2s;
  pointer-events: none;
  z-index: 11;
  max-width: 90%;
  text-align: center;
}

.toast.on {
  opacity: 1;
}
</style>
