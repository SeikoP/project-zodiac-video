export * from '../features/episode/validate-episode-concept.mjs';
import {forwardCliIfMain} from './forward-cli.mjs';
forwardCliIfMain(import.meta.url,new URL('../features/episode/validate-episode-concept.mjs',import.meta.url));
