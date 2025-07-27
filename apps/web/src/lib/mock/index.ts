// Mock Data Manager
export {
	MockDataManager,
	getMockDataManager,
	resetMockDataManager,
	shouldUseMockData,
	getMockOrRealData,
	withMockSupport,
	mockAware,
	validateMockDataUsage,
} from "./manager";

// Mock Data Providers
export {
	mockUsers,
	mockTasks,
	mockEnvironments,
	mockApiResponses,
	mockConfig,
	mockTelemetry,
	mockErrors,
	mockDelay,
	mockGenerators,
	getMockData,
	type MockDataType,
} from "./providers";

// Build-time Exclusion
export {
	excludeFromProduction,
	conditionalImport,
	MockDataWrapper,
	createMockWrapper,
	mockFileExclusionPattern,
	excludeMockFilesFromBuild,
	loadMockData,
	devOnly,
	assertNotProduction,
	mockDataRegistry,
	registerMockData,
	getRegisteredMockData,
	devLog,
	devWarn,
	validateMockDataStructure,
} from "./build-exclusion";

// Re-export commonly used utilities
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