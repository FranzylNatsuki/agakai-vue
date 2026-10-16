import { createApp } from 'vue';
import { IonicVue } from '@ionic/vue';

import '@fontsource/rubik/400.css';
import '@fontsource/rubik/500.css';
import '@fontsource/rubik/600.css';
import '@fontsource/rubik/700.css';
import '@fontsource/rubik/800.css';

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
