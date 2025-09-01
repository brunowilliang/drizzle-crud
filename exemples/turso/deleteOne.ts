import { usersCrud } from './client';

async function testDeleteOne() {
	console.log('🗑️ Testing deleteOne...');

	// First create a user to delete
	const user = await usersCrud.create({
		name: 'Delete Test User',
		email: 'delete@test.com',
	});

	console.log('✅ Created user:', user);

	// Delete the user - should work with proper typing now
	const result = await usersCrud.deleteOne(user.id);

	console.log('✅ DeleteOne result:', result);
	return result;
}

// Run test
testDeleteOne();
