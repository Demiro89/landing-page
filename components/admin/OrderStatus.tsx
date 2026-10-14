import { orderStatusPresentation } from '@/lib/adminPresentation';

export default function OrderStatus({ status }: { status: string }) {
  const item = orderStatusPresentation(status);
  return <span className={`admin-status admin-status-${item.tone}`}><span aria-hidden="true" />{item.label}</span>;
}
