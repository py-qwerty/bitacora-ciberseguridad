import { initPomodoro } from './pomodoro.js?v=1';
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPomodoro);
else initPomodoro();
