import path from 'path';
import fs from 'fs';
import glob from 'glob';
import Dot from 'dot-object';
import yaml from 'js-yaml';
import isValidGlob from 'is-valid-glob';
import { SimpleFile, I18NLanguage, I18NItem } from '../types';

export function readLanguageFiles (src: string): SimpleFile[] {
  // Replace backslash path segments to make the path work with the glob package.
  // https://github.com/Spittal/vue-i18n-extract/issues/159
  const normalizedSrc = src.replace(/\\/g, '/');
  if (!isValidGlob(normalizedSrc)) {
    throw new Error(`languageFiles isn't a valid glob pattern.`);
  }

  const targetFiles = glob.sync(normalizedSrc);

  if (targetFiles.length === 0) {
    throw new Error('languageFiles glob has no files.');
  }

  return targetFiles.map(f => {
    const langPath = path.resolve(process.cwd(), f);

    const extension = langPath.substring(langPath.lastIndexOf('.')).toLowerCase();
    const isJSON = extension === '.json';
    const isYAML = extension === '.yaml' || extension === '.yml';

    let langObj;
    if (isJSON) {
      langObj = JSON.parse(fs.readFileSync(langPath, 'utf8'));
    } else if (isYAML) {
      langObj = yaml.load(fs.readFileSync(langPath, 'utf8'));
    } else {
      langObj = eval(fs.readFileSync(langPath, 'utf8'));
    }

    const fileName = f.replace(process.cwd(), '.');

    return { path: f, fileName, content: JSON.stringify(langObj) };
  });
}

export function extractI18NLanguageFromLanguageFiles (languageFiles: SimpleFile[], dot: DotObject.Dot = Dot): I18NLanguage {
  return languageFiles.reduce((accumulator, file) => {
    const language = file.fileName.substring(file.fileName.lastIndexOf('/') + 1, file.fileName.lastIndexOf('.'));

    if (!accumulator[language]) {
      accumulator[language] = [];
    }

    const flattenedObject = dot.dot(JSON.parse(file.content));
    Object.keys(flattenedObject).forEach((key) => {
      accumulator[language].push({
        path: key,
        file: file.fileName,
      });
    });

    return accumulator;
  }, {});
}

export function writeMissingToLanguageFiles (parsedLanguageFiles: SimpleFile[], missingKeys: I18NItem[], dot: DotObject.Dot = Dot, noEmptyTranslation = '', missingTranslationString = '', sort = false): void {
  parsedLanguageFiles.forEach(languageFile => {
    const languageFileContent = JSON.parse(languageFile.content);

    missingKeys.forEach(item => {
      if (item.language && languageFile.fileName.includes(item.language) || !item.language) {
        const addDefaultTranslation = (noEmptyTranslation) && ((noEmptyTranslation === '*') || (noEmptyTranslation === item.language));
        dot.str(item.path, addDefaultTranslation ? item.path : missingTranslationString === 'null' ? null : missingTranslationString, languageFileContent);
      }
    });

    writeLanguageFile(languageFile, languageFileContent, sort);
  });
}

export function removeUnusedFromLanguageFiles (parsedLanguageFiles: SimpleFile[], unusedKeys: I18NItem[], dot: DotObject.Dot = Dot, sort = false): void {
  parsedLanguageFiles.forEach(languageFile => {
    const languageFileContent = JSON.parse(languageFile.content);

    unusedKeys.forEach(item => {
      if (item.language && languageFile.fileName.includes(item.language)) {
        dot.delete(item.path, languageFileContent);
      }
    });

    writeLanguageFile(languageFile, languageFileContent, sort);
  });
}

export function sortLanguageFiles (parsedLanguageFiles: SimpleFile[]): void {
  parsedLanguageFiles.forEach(languageFile => {
    writeLanguageFile(languageFile, JSON.parse(languageFile.content), true);
  });
}

// Read-only counterpart of sortLanguageFiles: reports the files whose contents differ
// from what a sorted write would produce. Comparing the rendered output rather than the
// key order alone keeps the answer honest — it is exactly `would --sort touch this file`.
export function findUnsortedLanguageFiles (parsedLanguageFiles: SimpleFile[]): string[] {
  return parsedLanguageFiles
    .filter(languageFile => {
      const sorted = renderLanguageFile(languageFile, sortObjectKeys(JSON.parse(languageFile.content)));
      return fs.readFileSync(languageFile.path, 'utf8') !== sorted;
    })
    .map(languageFile => languageFile.fileName);
}

// Recursively sorts the keys of every object alphabetically. Arrays keep their
// order since it is meaningful for vue-i18n (pluralization, lists).
export function sortObjectKeys<T> (value: T): T {
  if (Array.isArray(value)) {
    return value.map(item => sortObjectKeys(item)) as unknown as T;
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  const unsorted = value as Record<string, unknown>;

  return Object.keys(unsorted)
    .sort((a, b) => a.localeCompare(b))
    .reduce((accumulator: Record<string, unknown>, key) => {
      accumulator[key] = sortObjectKeys(unsorted[key]);
      return accumulator;
    }, {}) as unknown as T;
}

function renderLanguageFile (languageFile: SimpleFile, languageFileContent: unknown): string {
  const fileExtension = languageFile.fileName.substring(languageFile.fileName.lastIndexOf('.') + 1);
  const stringifiedContent = JSON.stringify(languageFileContent, null, 2);

  if (fileExtension === 'json') {
    return stringifiedContent;
  } else if (fileExtension === 'js') {
    return `module.exports = ${stringifiedContent}; \n`;
  } else if (fileExtension === 'yaml' || fileExtension === 'yml') {
    // js-yaml folds lines at 80 columns by default, which turns a hand-written
    // one-line-per-key catalog into folded blocks on every write.
    return yaml.dump(languageFileContent, { lineWidth: -1 });
  } else {
    throw new Error(`Language filetype of ${fileExtension} not supported.`)
  }
}

function writeLanguageFile (languageFile: SimpleFile, languageFileContent: unknown, sort = false) {
  const newLanguageFileContent = sort ? sortObjectKeys(languageFileContent) : languageFileContent;
  fs.writeFileSync(languageFile.path, renderLanguageFile(languageFile, newLanguageFileContent));
}

// This is a convenience function for users implementing in their own projects, and isn't used internally
export function parselanguageFiles (languageFiles: string, dot: DotObject.Dot = Dot): I18NLanguage {
  return extractI18NLanguageFromLanguageFiles(readLanguageFiles(languageFiles), dot);
}
