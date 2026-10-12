export * from '../core/evidence/compile-evidence-brief.mjs';
import {forwardCliIfMain} from './forward-cli.mjs';
forwardCliIfMain(import.meta.url,new URL('../core/evidence/compile-evidence-brief.mjs',import.meta.url));
