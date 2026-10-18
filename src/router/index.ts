import { createRouter, createWebHistory } from '@ionic/vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { profileService } from '@/services/profileService';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: () => (profileService.hasCurrentUser ? '/app' : '/login'),
  },
  { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue') },
  { path: '/app', name: 'app', component: () => import('@/views/AppShellView.vue') },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

router.beforeEach((to) => {
  if (to.name === 'app' && !profileService.hasCurrentUser) {
    return { name: 'login' };
  }
  if (to.name === 'login' && profileService.hasCurrentUser) {
    return { name: 'app' };
  }
  return true;
});

export default router;
