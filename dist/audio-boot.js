import { initAudio } from './audio.js?v=2';
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAudio);
else initAudio();
