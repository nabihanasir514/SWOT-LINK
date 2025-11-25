const bcrypt = require('bcryptjs');
const db = require('../config/fileStorage');

async function ensureDefaultUsers() {
  // Check if any users exist
  const existing = await db.findMany('users');
  if (existing.length > 0) {
    console.log(`Seed: Skipped (users.json already has ${existing.length} user(s))`);
    return;
  }

  console.log('Seed: Creating default users');
  const defaults = [
    {
      full_name: 'Alice Startup',
      email: 'alice@startup.test',
      password: 'startup123',
      role: 'Startup'
    },
    {
      full_name: 'Bob Investor',
      email: 'bob@investor.test',
      password: 'investor123',
      role: 'Investor'
    }
  ];

  for (const user of defaults) {
    const password_hash = await bcrypt.hash(user.password, 10);
    const inserted = await db.insert('users', {
      full_name: user.full_name,
      email: user.email,
      password_hash,
      role: user.role,
      is_verified: false,
      is_suspended: false,
      profile_completion: 0,
      last_login: null
    }, 'user_id');

    if (user.role === 'Startup') {
      await db.insert('startupProfiles', { user_id: inserted.insertId }, 'startup_profile_id');
    } else if (user.role === 'Investor') {
      await db.insert('investorProfiles', { user_id: inserted.insertId }, 'investor_profile_id');
    }
  }
  console.log('Seed: Default users created');
}

module.exports = { ensureDefaultUsers };
