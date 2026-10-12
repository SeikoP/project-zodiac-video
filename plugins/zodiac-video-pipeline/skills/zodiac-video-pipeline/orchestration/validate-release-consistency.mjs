export * from '../core/release/validate-release-consistency.mjs';
import {forwardCliIfMain} from './forward-cli.mjs';
forwardCliIfMain(import.meta.url,new URL('../core/release/validate-release-consistency.mjs',import.meta.url));
