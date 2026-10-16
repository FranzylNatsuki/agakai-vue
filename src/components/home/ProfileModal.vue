<script setup lang="ts">
import AppModal from '@/components/common/AppModal.vue';
import LoadingSpinner from '@/components/common/LoadingSpinner.vue';
import ProfileDetailRow from '@/components/home/ProfileDetailRow.vue';
import { useSettings } from '@/composables/useSettings';
import type { Profile } from '@/models/profile';

defineProps<{
  open: boolean;
  profile: Profile | null;
  loading: boolean;
  error: string;
}>();
const emit = defineEmits<{ (e: 'close'): void }>();

const { t } = useSettings();
</script>

<template>
  <AppModal :open="open" :title="t('profile_details')" :confirm-text="t('close')" @cancel="emit('close')" @confirm="emit('close')">
    <div v-if="loading" class="profile-modal__center"><LoadingSpinner /></div>
    <p v-else-if="error" class="profile-modal__error">{{ t('failed_to_load_profile') }}: {{ error }}</p>
    <p v-else-if="!profile" class="profile-modal__plain">{{ t('no_profile_data') }}</p>
    <div v-else>
      <ProfileDetailRow :label="t('name')" :value="profile.name" />
      <ProfileDetailRow :label="t('senior_id')" :value="profile.seniorId" />
      <ProfileDetailRow :label="t('mobile_no')" :value="profile.mobileNo" />
      <ProfileDetailRow :label="t('age')" :value="t('age_years', { age: profile.age })" />
      <ProfileDetailRow label="Gender" :value="profile.gender" />
      <ProfileDetailRow :label="t('birthday')" :value="profile.birthday" />
      <ProfileDetailRow :label="t('address')" :value="profile.address" last />
    </div>
  </AppModal>
</template>

<style scoped>
.profile-modal__center {
  display: flex;
  justify-content: center;
  padding: 20px 0;
}
.profile-modal__error {
  margin: 0;
  font-size: 0.8125rem;
  color: #f44336;
}
.profile-modal__plain {
  margin: 0;
}
</style>
