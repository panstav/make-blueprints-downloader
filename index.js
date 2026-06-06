import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LIMIT = 100;

export async function fetchActiveScenarios(config) {
	const { token, zoneUrl, orgId } = config;
	const scenarios = [];
	let offset = 0;
	let hasMore = true;

	while (hasMore) {
		const url = buildRequestUrl(zoneUrl, orgId, offset, LIMIT);
		
		const response = await fetch(url, {
			method: "GET",
			headers: {
				"Authorization": `Token ${token}`,
				"Content-Type": "application/json"
			}
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Make.com API request failed with status ${response.status}: ${errorText}`);
		}

		const data = await response.json();
		const pageScenarios = data.scenarios || [];
		
		scenarios.push(...pageScenarios);
		
		if (pageScenarios.length < LIMIT) {
			hasMore = false;
		} else {
			offset += LIMIT;
			await sleep(1000);
		}
	}

	return scenarios;
}

export async function fetchScenarioBlueprint(config, scenarioId) {
	const { token, zoneUrl } = config;
	const basePath = zoneUrl.includes("/api/v2") ? zoneUrl : `${zoneUrl}/api/v2`;
	const url = `${basePath}/scenarios/${scenarioId}/blueprint`;

	const response = await fetch(url, {
		method: "GET",
		headers: {
			"Authorization": `Token ${token}`,
			"Content-Type": "application/json"
		}
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Failed to fetch blueprint for scenario ${scenarioId} (status ${response.status}): ${errorText}`);
	}

	return response.json();
}

export function omitMetadataInterface(item) {
	if (item && typeof item === "object") {
		const newItem = Array.isArray(item) ? [] : {};
		for (const key in item) {
			if (Object.prototype.hasOwnProperty.call(item, key)) {
				if (key === "metadata" && item[key] && typeof item[key] === "object") {
					newItem[key] = { ...item[key] };
					delete newItem[key]["interface"];
				} else {
					newItem[key] = omitMetadataInterface(item[key]);
				}
			}
		}
		return newItem;
	}
	return item;
}

export function sanitizeBlueprint(blueprintData) {
	if (blueprintData?.blueprint?.metadata?.designer) {
		delete blueprintData.blueprint.metadata.designer;
	}
	if (blueprintData?.response?.blueprint?.metadata?.designer) {
		delete blueprintData.response.blueprint.metadata.designer;
	}
	return omitMetadataInterface(blueprintData);
}

export default async function main() {
	const config = validateConfig(process.env);
	
	console.log(`Fetching active scenarios for organization ${config.orgId}...`);
	const scenarios = await fetchActiveScenarios(config);
	
	console.log(`Successfully fetched ${scenarios.length} active scenario(s).`);
	
	if (scenarios.length === 0) {
		console.log("No active scenarios found.");
		return;
	}

	const outputDir = path.join(__dirname, "downloads");
	await fs.rm(outputDir, { recursive: true, force: true });
	await fs.mkdir(outputDir, { recursive: true });
	console.log(`Saving blueprints to: ${outputDir}\n`);

	await sleep(1000);

	for (const scenario of scenarios) {
		console.log(`Downloading blueprint for [ID: ${scenario.id}] ${scenario.name}...`);
		const blueprintData = await fetchScenarioBlueprint(config, scenario.id);
		const sanitizedData = sanitizeBlueprint(blueprintData);
		const safeName = sanitizeFilename(scenario.name);
		const fileName = `${safeName}-${scenario.id}.json`;
		const outputPath = path.join(outputDir, fileName);
		
		await fs.writeFile(outputPath, JSON.stringify(sanitizedData, null, "\t"), "utf8");
		console.log(`  ✓ Saved as ${fileName}`);
		await sleep(1000);
	}
	
	console.log("\nFinished downloading all blueprints.");
}

function buildRequestUrl(zoneUrl, orgId, offset, limit) {
	const basePath = zoneUrl.includes("/api/v2") ? zoneUrl : `${zoneUrl}/api/v2`;
	const url = new URL(`${basePath}/scenarios`);
	url.searchParams.set("organizationId", orgId);
	url.searchParams.set("isActive", "true");
	url.searchParams.set("pg[offset]", offset.toString());
	url.searchParams.set("pg[limit]", limit.toString());
	return url.toString();
}

function validateConfig(env) {
	const token = env.MAKE_API_TOKEN;
	const zoneUrl = env.MAKE_ZONE_URL;
	const orgId = env.MAKE_ORGANIZATION_ID;

	if (!token) {
		throw new Error("Missing MAKE_API_TOKEN in environment variables.");
	}
	if (!zoneUrl) {
		throw new Error("Missing MAKE_ZONE_URL in environment variables.");
	}
	if (!orgId) {
		throw new Error("Missing MAKE_ORGANIZATION_ID in environment variables.");
	}

	return {
		token,
		zoneUrl: zoneUrl.replace(/\/$/, ""),
		orgId
	};
}

function sanitizeFilename(name) {
	return name
		.replace(/[^a-zא-תA-Z0-9-_]/g, "_")
		.replace(/__+/g, "_")
		.toLowerCase();
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

if (process.argv[1] === __filename) {
	main().catch(error => {
		console.error("Fatal Error:", error.message);
		process.exit(1);
	});
}
