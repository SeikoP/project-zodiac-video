export * from '../core/audit/audit-creative-reuse.mjs';
import {forwardCliIfMain} from './forward-cli.mjs';
forwardCliIfMain(import.meta.url,new URL('../core/audit/audit-creative-reuse.mjs',import.meta.url));
