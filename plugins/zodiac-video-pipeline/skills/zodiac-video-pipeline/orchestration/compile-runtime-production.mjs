export * from '../compat/production-v1/compile-runtime-production.mjs';
import {forwardCliIfMain} from './forward-cli.mjs';
forwardCliIfMain(import.meta.url,new URL('../compat/production-v1/compile-runtime-production.mjs',import.meta.url));
