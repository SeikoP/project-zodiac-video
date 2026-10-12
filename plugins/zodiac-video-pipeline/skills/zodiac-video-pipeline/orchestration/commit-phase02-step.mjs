export * from '../phases/phase02/commit-phase02-step.mjs';
import {forwardCliIfMain} from './forward-cli.mjs';
forwardCliIfMain(import.meta.url,new URL('../phases/phase02/commit-phase02-step.mjs',import.meta.url));
