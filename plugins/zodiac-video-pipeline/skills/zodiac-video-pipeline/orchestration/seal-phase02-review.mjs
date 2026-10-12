export * from '../phases/phase02/seal-phase02-review.mjs';
import {forwardCliIfMain} from './forward-cli.mjs';
forwardCliIfMain(import.meta.url,new URL('../phases/phase02/seal-phase02-review.mjs',import.meta.url));
