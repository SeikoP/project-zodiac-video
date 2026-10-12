export * from '../features/visual-composition/build-native-preview-pairs.mjs';
import {forwardCliIfMain} from './forward-cli.mjs';
forwardCliIfMain(import.meta.url,new URL('../features/visual-composition/build-native-preview-pairs.mjs',import.meta.url));
