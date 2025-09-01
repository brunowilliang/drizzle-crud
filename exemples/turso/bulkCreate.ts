import { usersCrud } from './client';

async function testBulkCreate() {
	console.log('🚀 Testing bulkCreate...');

	// Generate 1000 users
	const usersData = [];
	for (let i = 1; i <= 1000; i++) {
		usersData.push({
			name: `User ${i}`,
			email: `user${i}@test.com`,
		});
	}

	// Single bulkCreate call
	const result = await usersCrud.bulkCreate(usersData);

	console.log('✅ Result:', result);
	return result;
}

// Run test
testBulkCreate();
