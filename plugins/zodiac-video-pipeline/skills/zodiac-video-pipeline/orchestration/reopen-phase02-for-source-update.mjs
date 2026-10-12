export * from '../phases/phase02/reopen-phase02-for-source-update.mjs';
import {forwardCliIfMain} from './forward-cli.mjs';
forwardCliIfMain(import.meta.url,new URL('../phases/phase02/reopen-phase02-for-source-update.mjs',import.meta.url));
