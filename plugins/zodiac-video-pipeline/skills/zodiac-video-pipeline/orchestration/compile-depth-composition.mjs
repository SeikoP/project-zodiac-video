export * from '../features/visual-composition/compile-depth-composition.mjs';
import {forwardCliIfMain} from './forward-cli.mjs';
forwardCliIfMain(import.meta.url,new URL('../features/visual-composition/compile-depth-composition.mjs',import.meta.url));
