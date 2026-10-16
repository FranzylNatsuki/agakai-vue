<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { card, mic } from 'ionicons/icons';
import GreetingHeader from '@/components/home/GreetingHeader.vue';
import HomeMenu from '@/components/home/HomeMenu.vue';
import SectionHeader from '@/components/home/SectionHeader.vue';
import BenefitListItem from '@/components/home/BenefitListItem.vue';
import ActionTile from '@/components/home/ActionTile.vue';
import ProfileModal from '@/components/home/ProfileModal.vue';
import LogoutModal from '@/components/home/LogoutModal.vue';
import LoadingSpinner from '@/components/common/LoadingSpinner.vue';
import { useSettings } from '@/composables/useSettings';
import { firstName, type Profile } from '@/models/profile';
import type { Benefit } from '@/models/benefit';
import { profileService } from '@/services/profileService';
import { benefitService } from '@/services/benefitService';
import { authService } from '@/services/authService';

const emit = defineEmits<{
  (e: 'openVoice'): void;
  (e: 'openBenefits'): void;
  (e: 'viewAllBenefits'): void;
  (e: 'openBenefit', benefit: Benefit): void;
}>();

const router = useRouter();
const { t } = useSettings();

const menuOpen = ref(false);
const profileOpen = ref(false);
const logoutOpen = ref(false);

const profile = ref<Profile | null>(null);
const profileLoading = ref(true);
const profileError = ref('');

const benefits = ref<Benefit[]>([]);
const benefitsLoading = ref(true);
const benefitsError = ref('');

onMounted(async () => {
  // TODO(backend): real profile + benefit loading lives in the services.
  try {
    profile.value = await profileService.loadProfile();
  } catch (e) {
    profileError.value = (e as Error).message;
  } finally {
    profileLoading.value = false;
  }

  try {
    benefits.value = await benefitService.loadRelevantBenefits(profile.value?.address);
  } catch (e) {
    benefitsError.value = (e as Error).message;
  } finally {
    benefitsLoading.value = false;
  }
});

function openProfile() {
  profileOpen.value = true;
}

function openLogout() {
  logoutOpen.value = true;
}

async function confirmLogout() {
  logoutOpen.value = false;
  menuOpen.value = false;
  await authService.logout();
  profileService.clear();
  await router.replace('/login');
}
</script>

<template>
  <div class="home">
    <div class="home__top">
      <div class="home__greeting">
        <GreetingHeader
          :greeting-prefix="t('greeting_prefix')"
          :user-name="profile ? firstName(profile) : 'Lola'"
          :subtitle="t('greeting_subtitle')"
          :menu-expanded="menuOpen"
          @menu="menuOpen = !menuOpen"
        />
      </div>
      <HomeMenu :open="menuOpen" @profile="openProfile" @logout="openLogout" />
    </div>

    <div class="home__content fade-up">
      <SectionHeader
        :title="t('available_benefits')"
        :view-all-label="t('view_all')"
        @view-all="emit('viewAllBenefits')"
      />

      <div class="home__benefits">
        <div v-if="benefitsLoading" class="home__center"><LoadingSpinner /></div>
        <p v-else-if="benefitsError" class="home__error">
          {{ t('error_loading_benefits') }}: {{ benefitsError }}
        </p>
        <p v-else-if="benefits.length === 0">{{ t('no_benefits') }}</p>
        <template v-else>
          <BenefitListItem
            v-for="b in benefits.slice(0, 3)"
            :key="b.id"
            :benefit="b"
            @tap="emit('openBenefit', $event)"
          />
        </template>
      </div>

      <div class="home__tiles">
        <ActionTile
          :title="t('voice_assistant')"
          :subtitle="t('voice_assistant_sub')"
          :icon="mic"
          bg-color="#D2ECFF"
          accent-color="#0284C7"
          text-color="#093582"
          @tap="emit('openVoice')"
        />
        <ActionTile
          :title="t('my_benefits')"
          :subtitle="t('my_benefits_sub')"
          :icon="card"
          bg-color="#FFE7D2"
          accent-color="#D35400"
          text-color="#D35400"
          @tap="emit('openBenefits')"
        />
      </div>
    </div>

    <ProfileModal
      :open="profileOpen"
      :profile="profile"
      :loading="profileLoading"
      :error="profileError"
      @close="profileOpen = false"
    />
    <LogoutModal :open="logoutOpen" @cancel="logoutOpen = false" @confirm="confirmLogout" />
  </div>
</template>

<style scoped>
.home {
  height: 100%;
  overflow-y: auto;
  background: var(--c-page-bg);
  padding-top: var(--ion-safe-area-top, 0px);
  box-sizing: border-box;
}
.home__top {
  background: #fff;
  border-bottom: 1px solid var(--c-slate-border);
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.1);
}
.home__greeting {
  padding: 12px 16px;
}
.home__content {
  padding: 16px 24px;
}
.home__benefits {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 14px;
}
.home__center {
  display: flex;
  justify-content: center;
  padding: 20px 0;
}
.home__error {
  margin: 0;
  padding: 12px 0;
  font-size: 0.8125rem;
  color: #f44336;
}
.home__tiles {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-top: 28px;
}
</style>
