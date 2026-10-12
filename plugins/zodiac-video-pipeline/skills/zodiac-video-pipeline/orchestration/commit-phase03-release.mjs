export * from '../phases/phase03/commit-phase03-release.mjs';
import {forwardCliIfMain} from './forward-cli.mjs';
forwardCliIfMain(import.meta.url,new URL('../phases/phase03/commit-phase03-release.mjs',import.meta.url));
