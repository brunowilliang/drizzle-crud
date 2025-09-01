import { usersCrud } from './client';

async function testBulkDelete() {
	console.log('🗑️ Testing bulkDelete...');

	// First, get all users to delete
	const allUsers = await usersCrud.list({
		limit: 2000,
	});

	console.log(`📊 Found ${allUsers.total} users to delete`);

	if (allUsers.results.length === 0) {
		console.log('❌ No users found to delete');
		return { success: false, count: 0 };
	}

	// Extract all IDs
	const userIds = allUsers.results.map((user) => user.id);
	console.log(`🎯 Deleting ${userIds.length} users...`);

	// Single bulkDelete call
	const result = await usersCrud.bulkDelete(userIds);

	console.log('✅ BulkDelete result:', result);
	return result;
}

// Run test
testBulkDelete();
