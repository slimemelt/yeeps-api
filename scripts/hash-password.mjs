// Usage: node scripts/hash-password.mjs "the admin password"
// Prints the value to store with:  npx wrangler secret put ADMIN_PASSWORD_HASH
import { hashPassword } from "../src/auth.js";

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/hash-password.mjs "the admin password"');
  process.exit(1);
}
console.log(await hashPassword(password));
