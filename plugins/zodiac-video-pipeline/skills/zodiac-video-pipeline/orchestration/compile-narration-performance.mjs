export * from '../features/narration-performance/compile-narration-performance.mjs';
import {forwardCliIfMain} from './forward-cli.mjs';
forwardCliIfMain(import.meta.url,new URL('../features/narration-performance/compile-narration-performance.mjs',import.meta.url));
