import { usersCrud } from './client';

async function testList() {
	console.log('📋 Testing list...');

	// List users with pagination
	const result = await usersCrud.list({
		page: 1,
		limit: 10,
	});

	console.log('✅ List result:', {
		total: result.total,
		page: result.page,
		limit: result.limit,
		resultsCount: result.results.length,
	});

	console.log('✅ First user:', result.results[0]);

	return result;
}

// Run test
testList();
