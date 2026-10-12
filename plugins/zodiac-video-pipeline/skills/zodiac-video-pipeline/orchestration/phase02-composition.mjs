export * from '../features/visual-composition/phase02-composition.mjs';
import {forwardCliIfMain} from './forward-cli.mjs';
forwardCliIfMain(import.meta.url,new URL('../features/visual-composition/phase02-composition.mjs',import.meta.url));
