export * from '../features/episode/validate-episode-scope.mjs';
import {forwardCliIfMain} from './forward-cli.mjs';
forwardCliIfMain(import.meta.url,new URL('../features/episode/validate-episode-scope.mjs',import.meta.url));
