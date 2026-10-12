export * from '../phases/phase03/compile-job-v5.mjs';
import {forwardCliIfMain} from './forward-cli.mjs';
forwardCliIfMain(import.meta.url,new URL('../phases/phase03/compile-job-v5.mjs',import.meta.url));
