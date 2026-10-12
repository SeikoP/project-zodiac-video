export * from '../phases/phase02/activate-phase02.mjs';
import {forwardCliIfMain} from './forward-cli.mjs';
forwardCliIfMain(import.meta.url,new URL('../phases/phase02/activate-phase02.mjs',import.meta.url));
