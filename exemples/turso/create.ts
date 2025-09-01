import { usersCrud } from './client';

async function testCreate() {
	console.log('👤 Testing create...');

	// Create single user
	const user = await usersCrud.create({
		name: 'Bruno Garcia',
		email: 'bruno@create-test.com',
	});

	console.log('✅ Created user:', user.id);
	return user;
}

// Run test
testCreate();
