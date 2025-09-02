#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function updateNodeJSVersions(baseVersion, timestamp) {
  const version = timestamp ? `${baseVersion}-nightly.${timestamp}` : baseVersion;

  // Update root package.json
  const rootPackageJsonPath = path.join(__dirname, 'package.json');
  let rootContent = fs.readFileSync(rootPackageJsonPath, 'utf8');
  rootContent = rootContent.replace(/"version": ".*?"/, `"version": "${version}"`);
  fs.writeFileSync(rootPackageJsonPath, rootContent);
  console.log(`Updated package.json version to: ${version}`);

  // Update packages/poml-build/package.json
  const buildPackageJsonPath = path.join(__dirname, 'packages/poml-build/package.json');
  if (fs.existsSync(buildPackageJsonPath)) {
    let buildContent = fs.readFileSync(buildPackageJsonPath, 'utf8');
    buildContent = buildContent.replace(/"version": ".*?"/, `"version": "${version}"`);
    fs.writeFileSync(buildPackageJsonPath, buildContent);
    console.log(`Updated packages/poml-build/package.json version to: ${version}`);
  }

  // Update packages/poml-browser/package.json
  const browserPackageJsonPath = path.join(__dirname, 'packages/poml-browser/package.json');
  if (fs.existsSync(browserPackageJsonPath)) {
    let browserContent = fs.readFileSync(browserPackageJsonPath, 'utf8');
    browserContent = browserContent.replace(/"version": ".*?"/, `"version": "${version}"`);
    fs.writeFileSync(browserPackageJsonPath, browserContent);
    console.log(`Updated packages/poml-browser/package.json version to: ${version}`);
  }

  // Update packages/poml/version.ts
  const versionTsPath = path.join(__dirname, 'packages/poml/version.ts');
  if (fs.existsSync(versionTsPath)) {
    let content = fs.readFileSync(versionTsPath, 'utf8');
    content = content.replace(/export const POML_VERSION = ".*"/, `export const POML_VERSION = "${version}"`);
    fs.writeFileSync(versionTsPath, content);
    console.log(`Updated packages/poml/version.ts to: ${version}`);
  }

  // Update package-lock.json (both root version and packages."" version)
  const packageLockPath = path.join(__dirname, 'package-lock.json');
  if (fs.existsSync(packageLockPath)) {
    let content = fs.readFileSync(packageLockPath, 'utf8');
    // Update root version
    content = content.replace(/^  "version": ".*?",$/m, `  "version": "${version}",`);
    // Update packages."" version
    content = content.replace(/^      "version": ".*?",$/m, `      "version": "${version}",`);
    fs.writeFileSync(packageLockPath, content);
    console.log(`Updated package-lock.json version to: ${version}`);
  }

  // Update packages/poml-browser/package-lock.json (both root version and packages."" version)
  const browserPackageLockPath = path.join(__dirname, 'packages/poml-browser/package-lock.json');
  if (fs.existsSync(browserPackageLockPath)) {
    let browserLockContent = fs.readFileSync(browserPackageLockPath, 'utf8');
    // Update root version
    browserLockContent = browserLockContent.replace(/^  "version": ".*?",$/m, `  "version": "${version}",`);
    // Update packages."" version
    browserLockContent = browserLockContent.replace(/^      "version": ".*?",$/m, `      "version": "${version}",`);
    fs.writeFileSync(browserPackageLockPath, browserLockContent);
    console.log(`Updated packages/poml-browser/package-lock.json version to: ${version}`);
  }
}

function updatePythonVersions(baseVersion, timestamp) {
  const version = timestamp ? `${baseVersion}.dev${timestamp}` : baseVersion;

  // Update pyproject.toml
  const pyprojectPath = path.join(__dirname, 'pyproject.toml');
  if (fs.existsSync(pyprojectPath)) {
    let content = fs.readFileSync(pyprojectPath, 'utf8');
    content = content.replace(/^version = ".*"$/m, `version = "${version}"`);
    fs.writeFileSync(pyprojectPath, content);
    console.log(`Updated pyproject.toml version to: ${version}`);
  }

  // Update python/poml/_version.py
  const versionPath = path.join(__dirname, 'python/poml/_version.py');
  if (fs.existsSync(versionPath)) {
    let content = fs.readFileSync(versionPath, 'utf8');
    content = content.replace(/__version__ = '.*'/, `__version__ = '${version}'`);
    fs.writeFileSync(versionPath, content);
    console.log(`Updated _version.py to: ${version}`);
  }
}

function main() {
  const args = process.argv.slice(2);

  if (args.length < 1 || args.length > 3) {
    console.error('Usage: node bump-version.js <base-version> [timestamp] [--python-only|--nodejs-only]');
    console.error('Examples:');
    console.error('  node bump-version.js 0.1.7                    # Update both sides to 0.1.7');
    console.error('  node bump-version.js 0.1.7 202508120345       # Update both with nightly versions');
    console.error('  node bump-version.js 0.1.7 --python-only      # Update only Python side');
    console.error('  node bump-version.js 0.1.7 202508120345 --nodejs-only  # Update only Node.js nightly');
    process.exit(1);
  }

  const [baseVersion, timestampOrFlag, modeFlag] = args;
  let timestamp = null;
  let mode = 'both'; // 'both', 'python', 'nodejs'

  // Parse arguments
  if (timestampOrFlag) {
    if (timestampOrFlag === '--python-only') {
      mode = 'python';
    } else if (timestampOrFlag === '--nodejs-only') {
      mode = 'nodejs';
    } else if (/^\d{12,14}$/.test(timestampOrFlag)) {
      timestamp = timestampOrFlag;
      if (modeFlag === '--python-only') {
        mode = 'python';
      } else if (modeFlag === '--nodejs-only') {
        mode = 'nodejs';
      }
    } else {
      console.error('Invalid timestamp format. Should be YYYYMMDDHHMM or YYYYMMDDHHMMSS');
      process.exit(1);
    }
  }

  try {
    if (mode === 'both' || mode === 'nodejs') {
      updateNodeJSVersions(baseVersion, timestamp);
    }

    if (mode === 'both' || mode === 'python') {
      updatePythonVersions(baseVersion, timestamp);
    }

    console.log('\nVersion bump completed successfully!');
    if (mode === 'both' || mode === 'nodejs') {
      const jsVersion = timestamp ? `${baseVersion}-nightly.${timestamp}` : baseVersion;
      console.log(`JS version: ${jsVersion}`);
    }
    if (mode === 'both' || mode === 'python') {
      const pythonVersion = timestamp ? `${baseVersion}.dev${timestamp}` : baseVersion;
      console.log(`Python version: ${pythonVersion}`);
    }
  } catch (error) {
    console.error('Error updating versions:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { updateNodeJSVersions, updatePythonVersions };
