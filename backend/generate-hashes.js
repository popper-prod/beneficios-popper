const bcrypt = require('bcryptjs');

const users = [
  { username: 'admin.popper', password: 'admin123' },
  { username: 'sandra.perez', password: 'super123' }
];

Promise.all(users.map(async (user) => {
  const hash = await bcrypt.hash(user.password, 12);
  console.log(`UPDATE usuarios SET password_hash = '${hash}' WHERE username = '${user.username}';`);
}));
