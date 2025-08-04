// Mock Data Manager

// Build-time Exclusion
export {
	assertNotProduction,
	conditionalImport,
	createMockWrapper,
	devLog,
	devOnly,
	devWarn,
	excludeFromProduction,
	excludeMockFilesFromBuild,
	getRegisteredMockData,
	loadMockData,
	MockDataWrapper,
	mockDataRegistry,
	mockFileExclusionPattern,
	registerMockData,
	validateMockDataStructure,
} from "./build-exclusion";
export {
	getMockDataManager,
	getMockOrRealData,
	MockDataManager,
	mockAware,
	resetMockDataManager,
	shouldUseMockData,
	validateMockDataUsage,
	withMockSupport,
} from "./manager";
// Mock Data Providers
export {
	getMockData,
	type MockDataType,
	mockApiResponses,
	mockConfig,
	mockDelay,
	mockEnvironments,
	mockErrors,
	mockGenerators,
	mockTasks,
	mockTelemetry,
	mockUsers,
} from "./providers";

import {
	assertNotProduction,
	devOnly,
	excludeFromProduction,
} from "./build-exclusion";
// Re-export commonly used utilities - import the functions first
import {
	getMockOrRealData,
	shouldUseMockData,
	validateMockDataUsage,
	withMockSupport,
} from "./manager";

export const MockUtils = {
	// Environment checks
	shouldUseMock: shouldUseMockData,

	// Data access
	getMockOrReal: getMockOrRealData,

	// Service wrapping
	withMock: withMockSupport,

	// Build-time exclusion
	excludeFromProd: excludeFromProduction,
	devOnly,

	// Validation
	validate: validateMockDataUsage,
	assertNotProd: assertNotProduction,
} as const;
