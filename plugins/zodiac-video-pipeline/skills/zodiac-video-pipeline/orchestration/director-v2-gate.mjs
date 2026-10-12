export * from '../features/visual-composition/director-v2-gate.mjs';
import {forwardCliIfMain} from './forward-cli.mjs';
forwardCliIfMain(import.meta.url,new URL('../features/visual-composition/director-v2-gate.mjs',import.meta.url));
