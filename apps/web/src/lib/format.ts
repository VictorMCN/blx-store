const ORDER_STATUS_LABELS: Record<
  string,
  string
> = {
  PENDING_PAYMENT: "Awaiting payment",
  PAID: "Payment confirmed",
  PROCESSING: "Preparing order",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  EXPIRED: "Payment expired",
  CANCELED: "Canceled",
};

export function formatMoney(
  amountInCents: number,
  currency: string,
): string {
  return new Intl.NumberFormat(
    "pt-BR",
    {
      style: "currency",
      currency,
    },
  ).format(amountInCents / 100);
}

export function formatDate(
  value: string | Date,
): string {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(new Date(value));
}

export function formatStatus(
  status: string,
): string {
  const knownLabel =
    ORDER_STATUS_LABELS[status];

  if (knownLabel) {
    return knownLabel;
  }

  return status
    .toLowerCase()
    .split("_")
    .map(
      (part) =>
        part.charAt(0).toUpperCase() +
        part.slice(1),
    )
    .join(" ");
}
