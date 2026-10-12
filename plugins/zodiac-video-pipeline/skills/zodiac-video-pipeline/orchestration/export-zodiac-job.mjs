export * from '../compat/production-v1/export-zodiac-job.mjs';
import {forwardCliIfMain} from './forward-cli.mjs';
forwardCliIfMain(import.meta.url,new URL('../compat/production-v1/export-zodiac-job.mjs',import.meta.url));
