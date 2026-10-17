import { createRouter, createWebHistory } from '@ionic/vue-router';
import type { RouteRecordRaw } from 'vue-router';

const routes: Array<RouteRecordRaw> = [
  { path: '/', redirect: '/app' },
  { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue') },
  { path: '/app', name: 'app', component: () => import('@/views/AppShellView.vue') },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

export default router;
