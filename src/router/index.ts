import { createRouter, createWebHistory } from '@ionic/vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { authService } from '@/services/authService';

const ONBOARDING_DONE_KEY = 'agakai_onboarding_complete_v2';
const routes: Array<RouteRecordRaw> = [
  { path: '/', redirect: '/onboarding' },
  { path: '/onboarding', name: 'onboarding', component: () => import('@/views/OnboardingView.vue') },
  { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue') },
  { path: '/app', name: 'app', component: () => import('@/views/AppShellView.vue') },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

// The session lives in Supabase Auth (or the mock flag), not in a stored row id.
router.beforeEach(async (to) => {
  const signedIn = await authService.hasSession();
  const onboardingDone = typeof localStorage !== 'undefined' &&
    localStorage.getItem(ONBOARDING_DONE_KEY) === '1';
  if (to.name === 'app' && !signedIn) return { name: 'login' };
  if (to.name === 'app' && signedIn && !onboardingDone) return { name: 'onboarding' };
  if (to.name === 'login' && signedIn) {
    return onboardingDone ? { name: 'app' } : { name: 'onboarding' };
  }
  if (to.name === 'login' && !onboardingDone) return { name: 'onboarding' };
  if (to.name === 'onboarding' && onboardingDone) {
    return signedIn ? { name: 'app' } : { name: 'login' };
  }
  return true;
});

export default router;
