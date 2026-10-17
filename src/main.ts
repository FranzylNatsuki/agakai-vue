import { createApp } from 'vue';
import { IonicVue } from '@ionic/vue';

import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';

import '@ionic/vue/css/core.css';
import '@ionic/vue/css/normalize.css';
import '@ionic/vue/css/structure.css';
import '@ionic/vue/css/typography.css';

import '@/theme/variables.css';
import '@/theme/global.css';

import App from './App.vue';
import router from './router';

const app = createApp(App).use(IonicVue, { mode: 'md', animated: true }).use(router);

router.isReady().then(() => {
  app.mount('#app');
});
