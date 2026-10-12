export * from '../core/policy/context-capsule.mjs';
import {forwardCliIfMain} from './forward-cli.mjs';
forwardCliIfMain(import.meta.url,new URL('../core/policy/context-capsule.mjs',import.meta.url));
