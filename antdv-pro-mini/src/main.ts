import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import router from '~/router'
import '~/router/router-guard'
import 'ant-design-vue/dist/reset.css'
import '~/assets/styles/reset.css'
import 'uno.css'
import VMdEditor from '@kangc/v-md-editor';
import '@kangc/v-md-editor/lib/style/base-editor.css';
import githubTheme from '@kangc/v-md-editor/lib/theme/github.js';
import '@kangc/v-md-editor/lib/theme/style/github.css';
VMdEditor.use(githubTheme);
const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(VMdEditor);

app.mount('#app')
