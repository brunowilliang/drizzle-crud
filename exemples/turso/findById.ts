import { usersCrud } from './client';

async function testFindById() {
	console.log('🔍 Testing findById...');

	// First create a user to find
	const user = await usersCrud.create({
		name: 'Find Test User',
		email: 'find@test.com',
	});

	console.log('✅ Created user:', user);

	// Find the user by ID - should work with proper typing now
	const foundUser = await usersCrud.findById(user.id);

	console.log('✅ Found user:', foundUser);
	return foundUser;
}

// Run test
testFindById();
