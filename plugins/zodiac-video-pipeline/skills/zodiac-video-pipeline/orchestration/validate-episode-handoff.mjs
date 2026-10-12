export * from '../features/episode/validate-episode-handoff.mjs';
import {forwardCliIfMain} from './forward-cli.mjs';
forwardCliIfMain(import.meta.url,new URL('../features/episode/validate-episode-handoff.mjs',import.meta.url));
