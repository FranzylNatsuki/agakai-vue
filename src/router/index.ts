import { createRouter, createWebHistory } from '@ionic/vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { authService } from '@/services/authService';

const routes: Array<RouteRecordRaw> = [
  { path: '/', redirect: '/login' },
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
  if (to.name === 'app' && !signedIn) return { name: 'login' };
  if (to.name === 'login' && signedIn) return { name: 'app' };
  return true;
});

export default router;
