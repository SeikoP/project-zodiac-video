export * from '../features/scene-set/validate-scene-set-identity.mjs';
import {forwardCliIfMain} from './forward-cli.mjs';
forwardCliIfMain(import.meta.url,new URL('../features/scene-set/validate-scene-set-identity.mjs',import.meta.url));
