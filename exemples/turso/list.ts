import { usersCrud } from './client';

async function testList() {
	console.log('📋 Testing list...');

	// List users with pagination
	const result = await usersCrud.list({});

	console.log('✅ List result:', {
		totalItems: result.totalItems,
		page: result.page,
		perPage: result.perPage,
		totalPages: result.totalPages,
		hasNextPage: result.hasNextPage,
		hasPreviousPage: result.hasPreviousPage,
		resultsCount: result.results.length,
	});

	return result;
}

// Run test
testList();
