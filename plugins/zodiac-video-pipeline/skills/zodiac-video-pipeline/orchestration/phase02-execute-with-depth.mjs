export * from '../phases/phase02/phase02-execute-with-depth.mjs';
import {forwardCliIfMain} from './forward-cli.mjs';
forwardCliIfMain(import.meta.url,new URL('../phases/phase02/phase02-execute-with-depth.mjs',import.meta.url));
