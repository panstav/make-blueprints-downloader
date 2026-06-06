import { jest, describe, test, expect, beforeEach, afterEach } from "@jest/globals";
import { fetchActiveScenarios, fetchScenarioBlueprint, omitMetadataInterface, sanitizeBlueprint } from "./index.js";

export const MOCK_CONFIG = {
	token: "test-token",
	zoneUrl: "https://test.make.com",
	orgId: "12345"
};

export const MOCK_SCENARIOS_PAGE_1 = {
	scenarios: [
		{ id: 101, name: "Scenario 1", isActive: true },
		{ id: 102, name: "Scenario 2", isActive: true }
	]
};

export const MOCK_SCENARIOS_PAGE_2 = {
	scenarios: [
		{ id: 103, name: "Scenario 3", isActive: true }
	]
};

export const MOCK_BLUEPRINT = {
	blueprint: {
		name: "Scenario 1",
		flow: [
			{ id: 1, module: "google-sheets" }
		]
	},
	scheduling: { type: "interval", interval: 60 }
};

export const MOCK_WRAPPED_BLUEPRINT = {
	code: "OK",
	response: {
		blueprint: {
			name: "Scenario 1",
			metadata: {
				instant: true,
				designer: {
					samples: { foo: "bar" },
					orphans: []
				}
			},
			flow: [
				{
					id: 1,
					metadata: {
						designer: { x: 100 },
						interface: [{ name: "output", type: "number" }]
					}
				}
			]
		}
	}
};

export const MOCK_WRAPPED_BLUEPRINT_SANITIZED = {
	code: "OK",
	response: {
		blueprint: {
			name: "Scenario 1",
			metadata: {
				instant: true
			},
			flow: [
				{
					id: 1,
					metadata: {
						designer: { x: 100 }
					}
				}
			]
		}
	}
};

export const ERROR_RESPONSE_TEXT = "Unauthorized access";

describe("fetchActiveScenarios", () => {
	const originalFetch = globalThis.fetch;

	beforeEach(() => {
		globalThis.fetch = jest.fn();
		jest.spyOn(globalThis, "setTimeout").mockImplementation(cb => {
			if (typeof cb === "function") cb();
			return 1;
		});
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		jest.restoreAllMocks();
	});

	test("should fetch scenarios successfully in a single page", async () => {
		globalThis.fetch.mockResolvedValueOnce(
			mockFetchResponse(true, 200, MOCK_SCENARIOS_PAGE_1)
		);

		const result = await fetchActiveScenarios(MOCK_CONFIG);

		expect(result).toEqual(MOCK_SCENARIOS_PAGE_1.scenarios);
		expect(globalThis.fetch).toHaveBeenCalledTimes(1);

		const expectedUrl = new URL("https://test.make.com/api/v2/scenarios");
		expectedUrl.searchParams.set("organizationId", MOCK_CONFIG.orgId);
		expectedUrl.searchParams.set("isActive", "true");
		expectedUrl.searchParams.set("pg[offset]", "0");
		expectedUrl.searchParams.set("pg[limit]", "100");

		expect(globalThis.fetch).toHaveBeenCalledWith(
			expectedUrl.toString(),
			{
				method: "GET",
				headers: {
					"Authorization": `Token ${MOCK_CONFIG.token}`,
					"Content-Type": "application/json"
				}
			}
		);
	});

	test("should paginate when page length equals limit", async () => {
		const page1Scenarios = Array.from({ length: 100 }, (_, i) => ({
			id: i + 1,
			name: `Scenario ${i + 1}`,
			isActive: true
		}));
		const page2Scenarios = [{ id: 101, name: "Scenario 101", isActive: true }];

		globalThis.fetch
			.mockResolvedValueOnce(mockFetchResponse(true, 200, { scenarios: page1Scenarios }))
			.mockResolvedValueOnce(mockFetchResponse(true, 200, { scenarios: page2Scenarios }));

		const result = await fetchActiveScenarios(MOCK_CONFIG);

		expect(result.length).toBe(101);
		expect(globalThis.fetch).toHaveBeenCalledTimes(2);

		const secondCallUrlStr = globalThis.fetch.mock.calls[1][0];
		const secondCallUrl = new URL(secondCallUrlStr);
		expect(secondCallUrl.searchParams.get("pg[offset]")).toBe("100");
	});

	test("should throw an error on API failure response", async () => {
		globalThis.fetch.mockResolvedValueOnce(
			mockFetchResponse(false, 401, null, ERROR_RESPONSE_TEXT)
		);

		await expect(fetchActiveScenarios(MOCK_CONFIG)).rejects.toThrow(
			`Make.com API request failed with status 401: ${ERROR_RESPONSE_TEXT}`
		);
	});
});

describe("fetchScenarioBlueprint", () => {
	const originalFetch = globalThis.fetch;

	beforeEach(() => {
		globalThis.fetch = jest.fn();
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	test("should fetch blueprint successfully", async () => {
		globalThis.fetch.mockResolvedValueOnce(
			mockFetchResponse(true, 200, MOCK_BLUEPRINT)
		);

		const result = await fetchScenarioBlueprint(MOCK_CONFIG, 101);

		expect(result).toEqual(MOCK_BLUEPRINT);
		expect(globalThis.fetch).toHaveBeenCalledTimes(1);

		const expectedUrl = "https://test.make.com/api/v2/scenarios/101/blueprint";
		expect(globalThis.fetch).toHaveBeenCalledWith(
			expectedUrl,
			{
				method: "GET",
				headers: {
					"Authorization": `Token ${MOCK_CONFIG.token}`,
					"Content-Type": "application/json"
				}
			}
		);
	});

	test("should throw error when blueprint fetch fails", async () => {
		globalThis.fetch.mockResolvedValueOnce(
			mockFetchResponse(false, 404, null, "Not Found")
		);

		await expect(fetchScenarioBlueprint(MOCK_CONFIG, 999)).rejects.toThrow(
			"Failed to fetch blueprint for scenario 999 (status 404): Not Found"
		);
	});
});

describe("omitMetadataInterface", () => {
	test("should recursively remove interface key from any metadata object", () => {
		const input = {
			name: "Scenario 1",
			metadata: {
				instant: true,
				interface: [{ name: "input", type: "text" }]
			},
			flow: [
				{
					id: 1,
					metadata: {
						designer: { x: 100 },
						interface: [{ name: "output", type: "number" }]
					}
				}
			]
		};

		const expected = {
			name: "Scenario 1",
			metadata: {
				instant: true
			},
			flow: [
				{
					id: 1,
					metadata: {
						designer: { x: 100 }
					}
				}
			]
		};

		const result = omitMetadataInterface(input);
		expect(result).toEqual(expected);
	});

	test("should handle non-object values gracefully", () => {
		expect(omitMetadataInterface(null)).toBeNull();
		expect(omitMetadataInterface("test")).toBe("test");
		expect(omitMetadataInterface(123)).toBe(123);
	});
});

describe("sanitizeBlueprint", () => {
	test("should remove blueprint.metadata.designer and omit interface from metadata recursively", () => {
		const input = {
			blueprint: {
				name: "Scenario 1",
				metadata: {
					instant: true,
					designer: {
						samples: { foo: "bar" },
						orphans: []
					}
				},
				flow: [
					{
						id: 1,
						metadata: {
							designer: { x: 100 },
							interface: [{ name: "output", type: "number" }]
						}
					}
				]
			}
		};

		const expected = {
			blueprint: {
				name: "Scenario 1",
				metadata: {
					instant: true
				},
				flow: [
					{
						id: 1,
						metadata: {
							designer: { x: 100 }
						}
					}
				]
			}
		};

		const result = sanitizeBlueprint(input);
		expect(result).toEqual(expected);
		expect(result.blueprint.metadata.designer).toBeUndefined();
	});

	test("should remove response.blueprint.metadata.designer and omit interface from metadata recursively for wrapped responses", () => {
		const result = sanitizeBlueprint(JSON.parse(JSON.stringify(MOCK_WRAPPED_BLUEPRINT)));
		expect(result).toEqual(MOCK_WRAPPED_BLUEPRINT_SANITIZED);
		expect(result.response.blueprint.metadata.designer).toBeUndefined();
	});
});

function mockFetchResponse(ok, status, jsonPayload, textPayload = "") {
	return {
		ok,
		status,
		json: async () => jsonPayload,
		text: async () => textPayload
	};
}
