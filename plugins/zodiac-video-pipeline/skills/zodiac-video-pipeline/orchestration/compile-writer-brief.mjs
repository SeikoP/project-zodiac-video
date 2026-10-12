export * from '../features/episode/compile-writer-brief.mjs';
import {forwardCliIfMain} from './forward-cli.mjs';
forwardCliIfMain(import.meta.url,new URL('../features/episode/compile-writer-brief.mjs',import.meta.url));
