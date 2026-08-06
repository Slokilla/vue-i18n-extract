/// <reference types="dot-object" />
import { SimpleFile, I18NLanguage, I18NItem } from '../types';
export declare function readLanguageFiles(src: string): SimpleFile[];
export declare function extractI18NLanguageFromLanguageFiles(languageFiles: SimpleFile[], dot?: DotObject.Dot): I18NLanguage;
export declare function writeMissingToLanguageFiles(parsedLanguageFiles: SimpleFile[], missingKeys: I18NItem[], dot?: DotObject.Dot, noEmptyTranslation?: string, missingTranslationString?: string, sort?: boolean): void;
export declare function removeUnusedFromLanguageFiles(parsedLanguageFiles: SimpleFile[], unusedKeys: I18NItem[], dot?: DotObject.Dot, sort?: boolean): void;
export declare function sortLanguageFiles(parsedLanguageFiles: SimpleFile[]): void;
export declare function sortObjectKeys<T>(value: T): T;
export declare function parselanguageFiles(languageFiles: string, dot?: DotObject.Dot): I18NLanguage;
