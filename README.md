### Notes
This utility was created to address the problem of getting NPM components deployed
to a repository like Nexus, which itself doesn't have access to npmjs.com.

Examples of this include corporate CI/CD servers which are isolated from the internet
for security reasons.

### Procedures

Requirements: Run on system with access to both the public repository and private repository with yarn/npm configuration established

1. Run `yarn install` to download all dependencies from public repository
2. Run `yarn add request-promise` to install required modules for script
3. Create `tmp` folder in root of your work directory
4. From the work directory run `node publishNpmModules.js`
