const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { unzip } = require('./zip');
const { isWindowsOS } = require('./utils');
const { exec } = require('./exec');
const { callGeminiAPI } = require('./gemini-api');
const { callOllamaAPI } = require('./ollama-api');
const { generateGeminiExpoDoctorPrompt, generateOllamaExpoDoctorPrompt, generateOllamaExpoDoctorFormat } = require('./prompts');

function validateArgs(args) {
    const errors = [];

    // Validate required arguments
    if (!args.src) {
        errors.push('Source path is required. Please provide the path to your React Native project.');
    }

    if (!args['expo-version']) {
        errors.push('Expo version is required. Please specify the version to upgrade to (e.g., 49.0.0).');
    }

    if (!args['gemini-key'] && !args['ollama-model']) {
        errors.push('Either --gemini-key or --ollama-model must be provided for authentication.');
    }

    // If there are missing required arguments, don't proceed with other validations
    if (errors.length > 0) {
        console.error(chalk.red.bold('❌ Validation Errors:'));
        errors.forEach((error, index) => {
            console.error(chalk.red(`  ${index + 1}. ${error}`));
        });
        console.error(chalk.yellow('\n💡 Usage: wm-reactnative expo-upgrade <src> <expo-version> --gemini-key=<key> OR --ollama-model=<model>'));
        process.exit(1);
    }

    // Validate source path exists
    const sourcePath = path.resolve(args.src);
    if (!fs.existsSync(sourcePath)) {
        errors.push(`Source path does not exist: ${sourcePath}`);
    }

    // Validate expo version format (basic validation)
    const expoVersion = args['expo-version'];
    const versionRegex = /^\d+\.\d+\.\d+$/;
    if (!versionRegex.test(expoVersion)) {
        errors.push(`Invalid expo version format: ${expoVersion}. Expected format: X.Y.Z (e.g., 49.0.0)`);
    }

    // Validate Gemini key or Ollama model format (basic validation)
    const geminiKey = args['gemini-key'];
    const ollamaModel = args['ollama-model'];
    
    if (geminiKey) {
        if (geminiKey.trim().length === 0) {
            errors.push('Gemini key cannot be empty.');
        } else if (geminiKey.length < 10) {
            errors.push('Gemini key appears to be invalid. Please check your API key.');
        }
    }
    
    if (ollamaModel) {
        if (ollamaModel.trim().length === 0) {
            errors.push('Ollama model cannot be empty.');
        }
    }

    // Display all validation errors if any
    if (errors.length > 0) {
        console.error(chalk.red.bold('❌ Validation Errors:'));
        errors.forEach((error, index) => {
            console.error(chalk.red(`  ${index + 1}. ${error}`));
        });
        console.error(chalk.yellow('\n💡 Please fix the above errors and try again.'));
        process.exit(1);
    }

    return {
        sourcePath,
        expoVersion,
        geminiKey,
        ollamaUrl: args['ollama-url'] || 'http://localhost:11434',
        ollamaModel: args['ollama-model']
    };
}

async function extractZip(src)  {
    let folderName = isWindowsOS() ? src.split('\\').pop() : src.split('/').pop();
    const isZipFile = folderName.endsWith('.zip');

    folderName = isZipFile ? folderName.replace('.zip', '') : folderName;

    const tmp = `${require('os').homedir()}/.wm-reactnative-cli/temp/${folderName}/${Date.now()}`;

    if (src.endsWith('.zip')) {
        const zipFile = src;
        src = tmp + '/src';

        if (!fs.existsSync(src)) {
            fs.mkdirsSync(src);
        }
        await unzip(zipFile, src);
    }
    return path.resolve(src) + '/';
}

async function getDefaultDestination(version) {
    const path = `${require('os').homedir()}/.wm-reactnative-cli/upgrade/${version}`;
    fs.mkdirSync(path, {
        recursive: true
    });
    let next = 1;
    if (fs.existsSync(path)) {
        next = fs.readdirSync(path).reduce((a, f) => {
            try {
                const c = parseInt(f);
                if (a <= c) {
                    return c + 1;
                }
            } catch(e) {
                //not a number
            }
            return a;
        }, next);
    }
    const dest = path + '/' + next;
    fs.mkdirSync(dest, {
        recursive: true
    });
    return dest;
}

async function installDependencies(src) {
    try{
        console.log(chalk.yellow('⏳ Installing dependencies...'));
        await exec('npm', ['install'], {
            cwd: src
        }); 
        console.log(chalk.green(`\n🔍 Installed dependencies in: ${src}`));
    }catch(e){
        console.error(chalk.red.bold('❌ Expo upgrade failed:'));
        console.error(chalk.red(e.message));
        process.exit(1);
    }
}


async function resolveExpoDoctor(src, errorLog, geminiKey, ollamaUrl, ollamaModel) {
    console.log(chalk.yellow('⏳ Resolving expo doctor...'));
    const packageJsonPath = path.join(src, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    try {
        let resolution;
        let aiProvider = '';
        
        if (geminiKey) {
            console.log(chalk.blue('🤖 Consulting Gemini AI for resolution...'));
            aiProvider = 'Gemini AI';
            
            const geminiPrompt = generateGeminiExpoDoctorPrompt(errorLog, packageJson);
            resolution = await callGeminiAPI(geminiKey, geminiPrompt);
        } else if (ollamaModel) {
            console.log(chalk.blue('🤖 Consulting Ollama AI for resolution...'));
            aiProvider = 'Ollama AI';
            
            const ollamaPrompt = generateOllamaExpoDoctorPrompt(errorLog, packageJson);
            const ollamaFormat = generateOllamaExpoDoctorFormat();
            resolution = await callOllamaAPI(ollamaUrl, ollamaPrompt, null, ollamaModel, ollamaFormat);
        } else {
            throw new Error('No AI provider configured. Please provide either --gemini-key or --ollama-model');
        }
        
        console.log(chalk.green(`\n🔧 ${aiProvider} Response:`));
        console.log(chalk.cyan('='.repeat(50)));
        console.log(chalk.white(resolution));
        console.log(chalk.cyan('='.repeat(50)));
        
        // Try to parse the response as JSON
        try {
            let data;
            if (geminiKey) {
                // For Gemini, expect the structured format
                data = JSON.parse(resolution);
                if (data.data) {
                    fs.writeFileSync(packageJsonPath, data.data);
                    console.log(chalk.green('✅ Package.json updated successfully'));
                } else {
                    console.error(chalk.red(`❌ Invalid response format from ${aiProvider}`));
                }
            } else {
                // For Ollama, expect structured format with data property
                data = JSON.parse(resolution);
                if (data.data) {
                    fs.writeFileSync(packageJsonPath, JSON.stringify(data.data, null, 2));
                    console.log(chalk.green('✅ Package.json updated successfully'));
                } else {
                    console.error(chalk.red(`❌ Invalid response format from ${aiProvider}`));
                }
            }
            // Return the status if present
            if (data && data.status) {
                return data.status;
            }
        } catch (parseError) {
            console.error(chalk.red(`❌ Failed to parse ${aiProvider} response as JSON:`));
            console.error(chalk.red(parseError.message));
            console.log(chalk.yellow('📝 Raw response was:'));
            console.log(chalk.white(resolution));
        }
    } catch (aiError) {
        console.error(chalk.red('❌ Failed to get AI resolution:'));
        console.error(chalk.red(aiError.message));
    }
    return 'error'; // Default to error if anything fails
}

async function checkExpoDoctor(src, geminiKey, ollamaUrl, ollamaModel) {
    console.log(chalk.yellow('⏳ Checking expo doctor...'));
    
    try {
        const execa = require('execa');
        const result = await execa('npx', ['expo-doctor'], {
            cwd: src,
            reject: false,
            all: true
        });
        
        if (result.exitCode === 0) {
            console.log(chalk.green('✅ Expo doctor check passed successfully'));
            return true; // Success
        } else {
            console.error(chalk.red.bold('❌ Expo doctor check failed:'));
            console.error(chalk.red(`Exit code: ${result.exitCode}`));
            
            // Log the error details
            const errorOutput = result.all || result.stderr || result.stdout || 'No output captured';
            const errorLog = `Expo Doctor Error:\nExit Code: ${result.exitCode}\n\nError Output:\n${errorOutput}\n\nCommand: npx expo-doctor\nWorking Directory: ${src}`;
            console.log(chalk.yellow('\n📋 Error details logged for analysis...'));
            console.log(chalk.red(errorLog));
            
            const status = await resolveExpoDoctor(src, errorLog, geminiKey, ollamaUrl, ollamaModel);
            if (status === 'success') {
                return true;
            }
            return false; // Failed
        }
    } catch (error) {
        console.error(chalk.red.bold('❌ Failed to run expo doctor:'));
        console.error(chalk.red(error.message));
        return false; // Failed
    }
}

async function updatePackageJson(src, expoVersion) {
    const packageJsonPath = path.join(src, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    packageJson.dependencies.expo = expoVersion;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
}

async function expoUpgrade(args) {
    try {
        // Validate all arguments
        const validatedArgs = validateArgs(args);

        // Log the validated arguments
        console.log(chalk.green.bold('✅ Validation passed! Starting Expo upgrade...'));
        console.log(chalk.blue('📋 Parameters:'));
        console.log(chalk.cyan(`  • Source path: ${validatedArgs.sourcePath}`));
        console.log(chalk.cyan(`  • Target Expo version: ${validatedArgs.expoVersion}`));
        if (validatedArgs.geminiKey) {
            console.log(chalk.cyan(`  • Gemini key: ${validatedArgs.geminiKey.substring(0, 8)}...`));
        }
        if (validatedArgs.ollamaModel) {
            console.log(chalk.cyan(`  • Ollama URL: ${validatedArgs.ollamaUrl}`));
            console.log(chalk.cyan(`  • Ollama Model: ${validatedArgs.ollamaModel}`));
        }

        // TODO: Implement actual expo upgrade logic here
        console.log(chalk.green('\n🚀 Expo upgrade validation completed successfully.'));
        console.log(chalk.yellow('⏳ Upgrade process would start here...'));

        let src = await extractZip(validatedArgs.sourcePath);
        console.log(chalk.green(`\n🔍 Extracted source files to: ${src}`));
        
        const dest = await getDefaultDestination(validatedArgs.expoVersion);
        fs.copySync(src, dest);
        fs.rmSync(src, { recursive: true });
        console.log(chalk.green(`\n🔍 Moved source files to: ${dest}`));

        await updatePackageJson(dest, validatedArgs.expoVersion);
        console.log(chalk.green(`\n🔍 Updated package.json to: ${validatedArgs.expoVersion}`));

        src = dest;
        await installDependencies(src);

        // Run expo doctor check and resolution in a loop until it passes
        let maxAttempts = 5;
        let attempt = 1;
        let expoDoctorPassed = false;
        
        while (!expoDoctorPassed && attempt <= maxAttempts) {
            console.log(chalk.blue(`\n🔄 Attempt ${attempt}/${maxAttempts} - Checking expo doctor...`));
            
            expoDoctorPassed = await checkExpoDoctor(src, validatedArgs.geminiKey, validatedArgs.ollamaUrl, validatedArgs.ollamaModel);
            
            if (!expoDoctorPassed && attempt < maxAttempts) {
                console.log(chalk.yellow(`\n🔄 Retrying expo doctor check... (Attempt ${attempt + 1}/${maxAttempts})`));
                // Remove package-lock.json and node_modules
                fs.rmSync(path.join(src, 'package-lock.json'));
                fs.rmSync(path.join(src, 'node_modules'), { recursive: true });
                // Reinstall dependencies after package.json changes and expo doctor check
                await installDependencies(src);
            }
            
            attempt++;
        }
        
        if (!expoDoctorPassed) {
            console.error(chalk.red.bold('\n❌ Expo doctor failed after maximum attempts. Please check the issues manually.'));
        } else {
            console.log(chalk.green.bold('\n✅ Expo doctor check passed successfully after resolution!'));
        }

    } catch (error) {
        console.error(chalk.red.bold('❌ Expo upgrade failed:'));
        console.error(chalk.red(error.message));
        process.exit(1);
    }
}

module.exports = {
    expoUpgrade : expoUpgrade
};
