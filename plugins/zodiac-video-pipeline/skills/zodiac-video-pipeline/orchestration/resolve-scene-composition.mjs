export * from '../features/visual-composition/resolve-scene-composition.mjs';
import {forwardCliIfMain} from './forward-cli.mjs';
forwardCliIfMain(import.meta.url,new URL('../features/visual-composition/resolve-scene-composition.mjs',import.meta.url));
