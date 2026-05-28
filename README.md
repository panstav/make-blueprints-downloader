# Make.com Blueprints Downloader

A lightweight, production-ready, dependency-less Node.js utility to fetch, clean, and download JSON blueprints of all **active** scenarios within a specific Make.com organization.

## Features

- **Native Node.js ESM**: Built using pure modern JavaScript, using the native `fetch` API for all requests and `fs/promises` for file management. Zero production dependencies.
- **Environment Aware**: Configured via a `.env` file using Node.js v20+'s native `--env-file` flag (no `dotenv` needed).
- **Blueprint Sanitization**:
  - Automatically removes the root-level `blueprint.metadata.designer` section (which stores layout configurations, canvas samples, and orphans).
  - Recursively strips the `interface` key from any module-level `metadata` blocks.
- **Robust Output Management**: 
  - Automatically cleans and resets the `downloads/` directory before starting.
  - Sanitizes output filenames, supporting English, Hebrew, digits, underscores, and dashes.
- **Rate-Limit Friendly**: Respects the Make.com API by executing requests sequentially with a 1-second delay (`sleep(1000)`) between all consecutive calls.
- **Immediate Failure Propagation**: If any API call fails, the script outputs a descriptive error message and terminates immediately with exit code `1`.
- **Tested**: Includes a comprehensive Jest unit test suite covering pagination, retrieval, and sanitization logic.

## Prerequisites

- **Node.js**: Version 20.6.0+ (required for native `--env-file` support).
- **Make.com API Key**: An active API Token (found in your Make.com Profile > API tab) with `scenarios:read` permissions.
- **Make.com Zone URL**: The URL zone matching your account (e.g. `https://eu1.make.com` or `https://us1.make.com`).
- **Organization ID**: The ID of the organization you wish to target (found in the URL when logged into the organization dashboard).

## Setup

1. Clone or download this project.
2. Initialize environment configuration:
   ```bash
   cp .env.example .env
   ```
3. Edit `.env` and fill in your credentials:
   ```env
   MAKE_API_TOKEN=your_api_token
   MAKE_ZONE_URL=https://eu1.make.com
   MAKE_ORGANIZATION_ID=your_org_id
   ```
4. Install development dependencies (Jest):
   ```bash
   npm install
   ```

## Usage

### Run Downloader

To download the blueprints of all active scenarios:
```bash
npm start
```
Blueprints will be sanitized and saved to the `downloads/` directory using the format:
`downloads/<sanitized-scenario-name>-<id>.json`

### Run Tests

To execute the Jest unit test suite:
```bash
npm test
```

## Code Structure

- `index.js`: The core implementation containing config validation, scenario listing, blueprint fetching, sanitization, and sequential download logic.
- `index.test.js`: Jest unit tests mocking API calls and checking that all logic holds under various conditions.
- `.env.example`: Template for local configuration.
- `.gitignore`: Configures standard Node.js ignores and ignores the downloaded blueprint assets.
- `package.json`: Configures ESM modules, dependencies, and execution scripts.
