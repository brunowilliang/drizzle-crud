import { usersCrud } from './client';

async function testUpdate() {
	console.log('✏️ Testing update...');

	// First create a user to update
	const user = await usersCrud.create({
		name: 'Update Test User',
		email: 'update@test.com',
	});

	console.log('✅ Created user:', user);

	// Update the user - should work with proper typing now
	const updatedUser = await usersCrud.update(user.id, {
		name: 'Updated User Name',
		email: 'updated@test.com',
	});

	console.log('✅ Updated user:', updatedUser);
	return updatedUser;
}

// Run test
testUpdate();
