export * from '../phases/phase02/phase02-execute.mjs';
import {forwardCliIfMain} from './forward-cli.mjs';
forwardCliIfMain(import.meta.url,new URL('../phases/phase02/phase02-execute.mjs',import.meta.url));
