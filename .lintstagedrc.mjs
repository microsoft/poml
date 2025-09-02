import micromatch from 'micromatch';

export default {
  // Rules for typescript, javascript, json, markdown, yaml files
  '*.{ts,tsx,js,mjs,json,md,yml}': ['prettier --write'],
  '*.{ts,tsx,js,mjs}': ['eslint --fix'],

  // Rules for python files, ignoring specific files and directories
  '*.py': (filenames) => {
    const filesToIgnore = ['python/poml/_tags.py', '**/assets/**', '**/*_version.py'];

    // Filter the staged files, keeping only the ones that DO NOT match the ignore patterns
    const filesToProcess = micromatch.not(filenames, filesToIgnore);

    // If no files are left after filtering, return an empty array to skip commands
    if (filesToProcess.length === 0) {
      return [];
    }

    // Return the commands to run on the filtered list of files
    // The file paths are joined by spaces and passed to the commands
    return [`isort ${filesToProcess.join(' ')}`, `black --quiet ${filesToProcess.join(' ')}`];
  },
};
