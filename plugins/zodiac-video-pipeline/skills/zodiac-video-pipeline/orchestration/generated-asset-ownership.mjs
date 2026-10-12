export * from '../core/ownership/generated-asset-ownership.mjs';
import {forwardCliIfMain} from './forward-cli.mjs';
forwardCliIfMain(import.meta.url,new URL('../core/ownership/generated-asset-ownership.mjs',import.meta.url));
