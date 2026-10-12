export * from '../core/evidence/phase02-evidence-audit.mjs';
import {forwardCliIfMain} from './forward-cli.mjs';
forwardCliIfMain(import.meta.url,new URL('../core/evidence/phase02-evidence-audit.mjs',import.meta.url));
