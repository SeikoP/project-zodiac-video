export * from '../features/story-object/validate-story-object-composition.mjs';
import {forwardCliIfMain} from './forward-cli.mjs';
forwardCliIfMain(import.meta.url,new URL('../features/story-object/validate-story-object-composition.mjs',import.meta.url));
