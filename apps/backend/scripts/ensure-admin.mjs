import "dotenv/config";
import bcrypt from "bcryptjs";
import pg from "pg";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const email = process.env.ADMIN_EMAIL || "admin@fbr.com";
const password = process.env.ADMIN_PASSWORD || "admin123";
const fullName = process.env.ADMIN_FULL_NAME || "Admin";
const workspaceName = process.env.ADMIN_WORKSPACE_NAME || "Admin Workspace";

const pool = new Pool({ connectionString });
const client = await pool.connect();

try {
  await client.query("begin");

  const passwordHash = await bcrypt.hash(password, 12);
  const userId = "admin-user";

  const userResult = await client.query(
    `
      insert into "User" ("id", "email", "passwordHash", "fullName", "isSuperAdmin", "createdAt", "updatedAt")
      values ($1, $2, $3, $4, true, now(), now())
      on conflict ("email") do update set
        "passwordHash" = excluded."passwordHash",
        "fullName" = excluded."fullName",
        "isSuperAdmin" = true,
        "updatedAt" = now()
      returning "id", "email", "fullName", "isSuperAdmin"
    `,
    [userId, email, passwordHash, fullName],
  );

  const user = userResult.rows[0];

  const membershipResult = await client.query(
    `
      select m."id", m."role", m."isDefault", c."id" as "companyId", c."name" as "companyName"
      from "UserCompanyMembership" m
      join "Company" c on c."id" = m."companyId"
      where m."userId" = $1
      order by m."isDefault" desc, m."id" asc
      limit 1
    `,
    [user.id],
  );

  let membership = membershipResult.rows[0];

  if (!membership) {
    const companyId = "admin-company";
    const membershipId = "admin-membership";

    await client.query(
      `
        insert into "Company" ("id", "name", "kind", "createdAt", "updatedAt")
        values ($1, $2, 'PERSONAL', now(), now())
        on conflict ("id") do update set
          "name" = excluded."name",
          "updatedAt" = now()
      `,
      [companyId, workspaceName],
    );

    const createdMembership = await client.query(
      `
        insert into "UserCompanyMembership" ("id", "userId", "companyId", "role", "isDefault")
        values ($1, $2, $3, 'OWNER', true)
        on conflict ("userId", "companyId") do update set
          "role" = 'OWNER',
          "isDefault" = true
        returning "id", "role", "isDefault", "companyId"
      `,
      [membershipId, user.id, companyId],
    );

    membership = {
      ...createdMembership.rows[0],
      companyName: workspaceName,
    };
  } else if (!membership.isDefault || membership.role !== "OWNER") {
    const updatedMembership = await client.query(
      `
        update "UserCompanyMembership"
        set "role" = 'OWNER', "isDefault" = true
        where "id" = $1
        returning "id", "role", "isDefault", "companyId"
      `,
      [membership.id],
    );

    membership = {
      ...membership,
      ...updatedMembership.rows[0],
    };
  }

  await client.query("commit");

  console.log(JSON.stringify({
    email: user.email,
    userId: user.id,
    company: membership.companyName,
    role: membership.role,
    isDefault: membership.isDefault,
    isSuperAdmin: user.isSuperAdmin,
  }, null, 2));
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}
