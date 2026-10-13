"use server";
import { checkedQuery } from "@/lib/query-results";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";

const schema = z.object({
  id: z.preprocess((v) => v || undefined, z.uuid().optional()),
  name: z.string().trim().min(1).max(100),
  description: z.preprocess(
    (v) => (v === "" ? null : v),
    z.string().trim().max(500).nullable(),
  ),
  pricePhp: z.coerce.number().int().nonnegative(),
  displayOrder: z.coerce.number().int().nonnegative(),
  available: z.string().optional(),
  pricingModel: z.enum(["per_rental", "per_day"]),
  totalQuantity: z.coerce.number().int().nonnegative(),
  maxPerBooking: z.coerce.number().int().positive(),
});

export async function saveExtra(formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    throw new Error("Check the extra name, price, and display order.");
  const { supabase, user } = await requireAdmin();
  const d = parsed.data;
  if (d.maxPerBooking > Math.max(d.totalQuantity, 1))
    throw new Error("Customer limit cannot exceed available quantity.");
  const image = formData.get("image");
  let imagePath: string | undefined;
  if (image instanceof File && image.size) {
    if (
      image.size > 8_388_608 ||
      !["image/avif", "image/webp", "image/jpeg", "image/png"].includes(
        image.type,
      )
    )
      throw new Error(
        "Extra image must be AVIF, WebP, JPEG, or PNG and no larger than 8 MB.",
      );
    const extension =
      image.name
        .split(".")
        .pop()
        ?.replace(/[^a-z0-9]/gi, "") || "bin";
    imagePath = `${d.id ?? crypto.randomUUID()}/${crypto.randomUUID()}.${extension}`;
    const uploaded = await supabase.storage
      .from("booking-extras")
      .upload(imagePath, image, { contentType: image.type })
      .then(checkedQuery);
    if (uploaded.error) throw new Error(uploaded.error.message);
  }
  const values = {
    name: d.name,
    description: d.description,
    price_php: d.pricePhp,
    display_order: d.displayOrder,
    is_available: d.available === "on",
    is_active: d.available === "on",
    pricing_model: d.pricingModel,
    total_quantity: d.totalQuantity,
    max_per_booking: d.maxPerBooking,
    ...(imagePath ? { image_path: imagePath } : {}),
  };
  const result = d.id
    ? await supabase
        .from("booking_extras_catalog")
        .update(values)
        .eq("id", d.id)
    : await supabase
        .from("booking_extras_catalog")
        .insert(values)
        .select("id")
        .single()
        .then(checkedQuery);
  if (result.error) throw new Error(result.error.message);
  const id = d.id ?? result.data?.id;
  if (id)
    await supabase
      .from("audit_logs")
      .insert({
        actor_user_id: user.id,
        action: d.id ? "booking_extra.updated" : "booking_extra.created",
        entity_type: "booking_extra",
        entity_id: id,
        metadata: values,
      })
      .then(checkedQuery);
  revalidatePath("/dashboard/extras");
  revalidatePath("/book", "layout");
  redirect("/dashboard/extras?saved=1");
}
