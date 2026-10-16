<script setup lang="ts">
import { ref } from 'vue';
import { IonPage, IonToast, IonIcon } from '@ionic/vue';
import { eyeOffOutline, eyeOutline } from 'ionicons/icons';
import { useRouter } from 'vue-router';
import LoginField from '@/components/login/LoginField.vue';
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
    // TODO(backend): authService.login queries the `user` table.
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
    <div class="login">
      <div class="login__scroll fade-in">
        <img class="login__logo" src="/assets/logo.png" alt="AgakAI" />

        <h1 class="headline login__title">Welcome back</h1>
        <p class="login__subtitle">Log in to continue</p>

        <LoginField v-model="seniorId" label="Senior ID" placeholder="Enter your Senior ID" />

        <div class="login__gap" />

        <LoginField
          v-model="password"
          label="Password"
          placeholder="Enter your password"
          autocomplete="current-password"
          :type="obscure ? 'password' : 'text'"
        >
          <template #trailing>
            <button
              class="btn-reset login__eye tappable"
              type="button"
              aria-label="Toggle password visibility"
              @click="obscure = !obscure"
            >
              <IonIcon :icon="obscure ? eyeOffOutline : eyeOutline" />
            </button>
          </template>
        </LoginField>

        <div class="login__forgot">
          <!-- TODO(backend): forgot password flow -->
          <button class="btn-reset tappable" type="button">Forgot Password?</button>
        </div>

        <button class="btn-reset login__submit tappable" :disabled="isLoading" @click="login">
          <LoadingSpinner v-if="isLoading" :size="20" class="login__spinner" />
          <span v-else>Log in</span>
        </button>
      </div>
    </div>

    <IonToast
      :is-open="showError"
      :message="errorMessage"
      :duration="3000"
      color="danger"
      position="bottom"
      @didDismiss="showError = false"
    />
  </IonPage>
</template>

<style scoped>
.login {
  height: 100%;
  overflow-y: auto;
  background: var(--c-page-bg);
  padding-top: var(--ion-safe-area-top, 0px);
}
.login__scroll {
  padding: 56px 32px 24px;
}
.login__logo {
  display: block;
  height: 150px;
  margin: 0 auto;
  object-fit: contain;
}
.login__title {
  margin: 8px 0 0;
  text-align: center;
  font-size: 1.25rem;
}
.login__subtitle {
  margin: 4px 0 32px;
  text-align: center;
  font-size: 0.84375rem;
  color: rgba(0, 0, 0, 0.54);
}
.login__gap {
  height: 16px;
}
.login__eye {
  width: 48px;
  height: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: rgba(0, 0, 0, 0.54);
}
.login__forgot {
  display: flex;
  justify-content: flex-end;
}
.login__forgot button {
  padding: 8px 4px;
  font-size: 0.8125rem;
  color: rgba(0, 0, 0, 0.54);
}
.login__submit {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 46px;
  margin-top: 48px;
  border-radius: 6px;
  background: var(--c-navy);
  color: #fff;
  font-size: 0.875rem;
  font-weight: 700;
}
.login__submit:disabled {
  opacity: 0.6;
}
.login__spinner {
  border-color: rgba(255, 255, 255, 0.35);
  border-top-color: #fff;
}
</style>
