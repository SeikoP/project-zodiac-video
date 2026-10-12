export * from '../phases/phase02/finalize-phase02-workspace.mjs';
import {forwardCliIfMain} from './forward-cli.mjs';
forwardCliIfMain(import.meta.url,new URL('../phases/phase02/finalize-phase02-workspace.mjs',import.meta.url));
