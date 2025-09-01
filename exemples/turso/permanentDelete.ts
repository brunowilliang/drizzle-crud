import { usersCrud } from './client';

async function testPermanentDelete() {
	console.log('💀 Testing permanentDelete...');

	// First create a user to permanently delete
	const user = await usersCrud.create({
		name: 'Permanent Delete User',
		email: 'permanent@test.com',
	});

	console.log('✅ Created user:', user);

	// Permanently delete the user - should work with proper typing now
	const result = await usersCrud.permanentDelete(user.id);

	console.log('✅ PermanentDelete result:', result);

	// Try to find it (should be null)
	const foundUser = await usersCrud.findById(user.id);
	console.log('✅ User after permanent delete:', foundUser);

	return result;
}

// Run test
testPermanentDelete();
