export function matchesBookingSearch(
  query: string,
  reference: string,
  customer = "",
  motorcycle = "",
) {
  return `${reference} ${customer} ${motorcycle}`
    .toLowerCase()
    .includes(query.toLowerCase());
}
