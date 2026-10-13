/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS disposable-database verification. */
const { Client } = require("pg");
const { randomUUID } = require("node:crypto");
if (
  !process.env.TEST_DATABASE_URL?.includes("uuxjymzrtncrnnkvdpjy") ||
  process.env.TEST_DATABASE_URL.includes("slevojynuumrvgiznmxk")
)
  throw Error("Disposable target required");
const c = new Client({
  connectionString: process.env.TEST_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});
const results = [];
const admin = randomUUID(),
  guest = randomUUID();
const claim = async (id) =>
  c.query("select set_config('request.jwt.claims',$1,true)", [
    JSON.stringify({ sub: id, role: "authenticated", is_anonymous: false }),
  ]);
const ok = (name, condition) => {
  results.push({ name, status: condition ? "PASS" : "FAIL" });
  if (!condition) throw Error(name);
};
async function denied(name, call, pattern) {
  await c.query("savepoint expect_denied");
  let error;
  try {
    await call();
  } catch (e) {
    error = e;
  }
  await c.query("rollback to savepoint expect_denied");
  await c.query("release savepoint expect_denied");
  ok(name, !!error && pattern.test(error.message));
}
(async () => {
  try {
    await c.connect();
    await c.query("begin");
    await c.query("set local statement_timeout='12s'");
    for (const id of [admin, guest])
      await c.query(
        "insert into auth.users(id,email,aud,role,is_anonymous) values($1,$2,'authenticated','authenticated',false)",
        [id, id + "@example.invalid"],
      );
    await c.query(
      "insert into public.admin_users(auth_user_id,role,is_active) values($1,'administrator',true)",
      [admin],
    );
    const customer = (
      await c.query(
        "insert into public.customers(auth_user_id,full_name,email,is_test) values($1,'Synthetic Phase 8 Lifecycle',$2,true) returning id",
        [guest, guest + "@example.invalid"],
      )
    ).rows[0].id;
    const model = (
      await c.query(
        "insert into public.motorcycle_models(slug,brand,model_name,display_name,daily_rate_php,is_published) values($1,'Synthetic','Synthetic','Synthetic Phase 8 Lifecycle',499,false) returning id",
        ["synthetic-phase8-" + randomUUID()],
      )
    ).rows[0].id;
    await claim(admin);
    await c.query("select public.admin_set_motorcycle_quantity($1,1,0)", [
      model,
    ]);
    const unit = (
      await c.query(
        "select id from public.motorcycle_units where motorcycle_model_id=$1",
        [model],
      )
    ).rows[0].id;
    const booking = (
      await c.query(
        "insert into public.bookings(booking_reference,customer_id,motorcycle_model_id,start_at,end_at,status,quoted_total_php,base_total_php,pricing_units,is_test,expires_at) values($1,$2,$3,'2032-06-01T01:00:00Z','2032-06-02T01:00:00Z','pending',499,499,1,true,now()+interval '1 hour') returning id",
        ["SYN-" + randomUUID(), customer, model],
      )
    ).rows[0].id;
    const verification = (
      await c.query(
        "insert into public.customer_verifications(booking_id,customer_id,customer_type,identity_status,license_status,entitlement_status,international_status,overall_status,license_expiration_date) values($1,$2,'philippine_resident','submitted','submitted','under_review','not_applicable','submitted','2035-01-01') returning id",
        [booking, customer],
      )
    ).rows[0].id;
    await c.query("set local role authenticated");
    await claim(admin);
    ok(
      "administrator can read synthetic booking under authenticated RLS",
      (await c.query("select id from public.bookings where id=$1", [booking]))
        .rowCount === 1,
    );
    await denied(
      "unverified request cannot be confirmed",
      () =>
        c.query("select public.admin_confirm_booking($1,$2)", [booking, unit]),
      /verification check must be approved/,
    );
    await c.query(
      "select public.admin_review_verification($1,'identity','approved','Synthetic manual review')",
      [verification],
    );
    ok(
      "single document approval does not auto-approve all checks",
      (
        await c.query(
          "select overall_status from public.customer_verifications where id=$1",
          [verification],
        )
      ).rows[0].overall_status !== "approved",
    );
    for (const type of ["license", "entitlement"])
      await c.query(
        "select public.admin_review_verification($1,$2,'approved','Synthetic manual review')",
        [verification, type],
      );
    await denied(
      "approval still requires uploaded license document",
      () =>
        c.query("select public.admin_confirm_booking($1,$2)", [booking, unit]),
      /document is missing/,
    );
    await c.query("reset role");
    await claim(guest);
    for (const kind of ["drivers_license_front", "government_id"]) {
      const name = `${guest}/${booking}/${randomUUID()}.pdf`;
      await c.query(
        "insert into storage.objects(bucket_id,name,owner_id,metadata) values('identity-verification',$1,$2,$3)",
        [name, guest, { mimetype: "application/pdf", size: 64 }],
      );
      await c.query("set local role authenticated");
      await c.query(
        "insert into public.verification_documents(verification_id,booking_id,owner_user_id,document_kind,storage_path,mime_type,size_bytes) values($1,$2,$3,$4,$5,'application/pdf',64)",
        [verification, booking, guest, kind, name],
      );
      await c.query("reset role");
    }
    await c.query("set local role authenticated");
    await claim(guest);
    await denied(
      "ordinary customer cannot approve verification",
      () =>
        c.query(
          "select public.admin_review_verification($1,'identity','approved',null)",
          [verification],
        ),
      /Administrator access required/,
    );
    await denied(
      "ordinary customer cannot confirm booking",
      () =>
        c.query("select public.admin_confirm_booking($1,$2)", [booking, unit]),
      /Administrator access required/,
    );
    await claim(admin);
    await c.query("select public.admin_confirm_booking($1,$2)", [
      booking,
      unit,
    ]);
    const confirmed = (
      await c.query("select * from public.bookings where id=$1", [booking])
    ).rows[0];
    ok(
      "verified booking confirms and retains assigned physical-unit identity",
      confirmed.status === "confirmed" &&
        confirmed.motorcycle_unit_id === unit &&
        confirmed.approved_by === admin,
    );
    await denied(
      "duplicate confirmation is rejected without duplicate history",
      () =>
        c.query("select public.admin_confirm_booking($1,$2)", [booking, unit]),
      /not active/,
    );
    await c.query(
      "select public.admin_transition_booking_with_reason($1,'active',null)",
      [booking],
    );
    const active = (
      await c.query("select * from public.bookings where id=$1", [booking])
    ).rows[0];
    ok(
      "handover records active status, actor, and timestamp",
      active.status === "active" &&
        active.handover_by === admin &&
        !!active.handover_at,
    );
    await denied(
      "rented quantity cannot be retired",
      () =>
        c.query("select public.admin_set_motorcycle_quantity($1,0,1)", [model]),
      /cannot be reduced/,
    );
    await c.query(
      "select public.admin_transition_booking_with_reason($1,'completed',null)",
      [booking],
    );
    const returned = (
      await c.query("select * from public.bookings where id=$1", [booking])
    ).rows[0];
    ok(
      "return records completion, actor, timestamp, and preserved handover",
      returned.status === "completed" &&
        returned.returned_by === admin &&
        !!returned.returned_at &&
        !!returned.handover_at &&
        returned.motorcycle_unit_id === unit,
    );
    await denied(
      "completed rental cannot be handed over again",
      () =>
        c.query(
          "select public.admin_transition_booking_with_reason($1,'active',null)",
          [booking],
        ),
      /Invalid booking status transition/,
    );
    ok(
      "exactly three status-history records for confirm, handover, and return",
      +(
        await c.query(
          "select count(*) n from public.booking_status_history where booking_id=$1",
          [booking],
        )
      ).rows[0].n === 3,
    );
    ok(
      "manual verification review audit is retained",
      +(
        await c.query(
          "select count(*) n from public.verification_reviews where verification_id=$1",
          [verification],
        )
      ).rows[0].n === 3,
    );
    await c.query("rollback");
    console.log(JSON.stringify(results, null, 2));
  } finally {
    await c.query("rollback").catch(() => {});
    await c.end();
  }
})().catch((e) => {
  console.error(JSON.stringify({ fatal: e.message, results }));
  process.exitCode = 1;
});
