import { usersCrud } from './client';

async function testRestore() {
	console.log('♻️ Testing restore...');

	// First create a user
	const user = await usersCrud.create({
		name: 'Restore Test User',
		email: 'restore@test.com',
	});

	console.log('✅ Created user:', user.id);

	// Soft delete the user
	await usersCrud.deleteOne(user.id);
	console.log('✅ User soft deleted');

	// Restore the user
	const result = await usersCrud.restore(user.id);

	console.log('✅ Restore result:', result);

	// Verify user is restored
	const restoredUser = await usersCrud.findById(user.id);
	console.log('✅ User after restore:', restoredUser);

	return result;
}

// Run test
testRestore();
