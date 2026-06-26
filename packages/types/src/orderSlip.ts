export type SlipKind = 'packing' | 'order'

export type OrderSlipAddress = {
  full_name?: string | null
  phone?: string | null
  line1?: string | null
  line2?: string | null
  city?: string | null
  district?: string | null
  state?: string | null
  pincode?: string | null
  email?: string | null
}

export type OrderSlipItem = {
  product_name?: string | null
  variant_label?: string | null
  quantity: number
  unit_price: number
  subtotal?: number | null
  size_label?: string | null
}

export type OrderSlipData = {
  id: string
  order_number: string
  status: string
  created_at: string
  total_amount: number
  subtotal?: number | null
  shipping_amount?: number | null
  discount_amount?: number | null
  payment_mode?: string | null
  payment_status?: string | null
  payment_ref?: string | null
  delivery_method?: string | null
  pickup_date?: string | null
  guest_email?: string | null
  shipping_address?: OrderSlipAddress | null
  awb_code?: string | null
  courier_name?: string | null
  tracking_url?: string | null
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0)
}

function buildAddressBlock(address?: OrderSlipAddress | null): string {
  if (!address) return '<p class="muted">No shipping address available.</p>'

  const lines = [
    address.full_name,
    address.phone,
    address.email,
    [address.line1, address.line2].filter(Boolean).join(', '),
    [address.city, address.district, address.state, address.pincode].filter(Boolean).join(', '),
  ].filter(Boolean)

  return lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')
}

export function buildOrderSlipFilename(orderNumber: string, kind: SlipKind): string {
  const suffix = kind === 'packing' ? 'packing-slip' : 'order-slip'
  return `${suffix}-${orderNumber}.html`
}

export function buildOrderSlipHtml(input: {
  kind: SlipKind
  order: OrderSlipData
  items: OrderSlipItem[]
  shopName?: string
  shopTagline?: string
  storeLabel?: string
}): string {
  const { kind, order, items } = input
  const title = kind === 'packing' ? 'Packing Slip' : 'Order Slip'
  const subtitle =
    kind === 'packing'
      ? 'For warehouse and dispatch use'
      : 'Customer copy with pricing details'

  const rows = items.map((item) => {
    const labelParts = [item.variant_label, item.size_label].filter(Boolean)
    return `
      <tr>
        <td>${escapeHtml(item.product_name ?? 'Item')}</td>
        <td>${escapeHtml(labelParts.join(' · ') || 'Default')}</td>
        <td class="num">${escapeHtml(item.quantity)}</td>
        ${kind === 'order' ? `<td class="num">${escapeHtml(formatMoney(item.unit_price))}</td>` : ''}
        ${kind === 'order' ? `<td class="num">${escapeHtml(formatMoney(item.subtotal ?? item.unit_price * item.quantity))}</td>` : ''}
      </tr>
    `
  }).join('')

  const pricingRows = kind === 'order'
    ? `
      <section class="panel">
        <h3>Summary</h3>
        <div class="summary">
          ${typeof order.subtotal === 'number' ? `<span>Subtotal</span><strong>${escapeHtml(formatMoney(order.subtotal))}</strong>` : ''}
          ${(order.discount_amount ?? 0) > 0 ? `<span>Discount</span><strong>-${escapeHtml(formatMoney(order.discount_amount ?? 0))}</strong>` : ''}
          <span>Shipping</span><strong>${escapeHtml(order.shipping_amount === 0 ? 'FREE' : formatMoney(order.shipping_amount ?? 0))}</strong>
          <span class="grand">Total</span><strong class="grand">${escapeHtml(formatMoney(order.total_amount))}</strong>
        </div>
      </section>
    `
    : ''

  const shippingAddress = buildAddressBlock(order.shipping_address)
  const paymentSection = kind === 'order'
    ? `
      <section class="panel">
        <h3>Payment</h3>
        <p><span class="muted">Mode:</span> ${escapeHtml(order.payment_mode ?? 'online')}</p>
        <p><span class="muted">Status:</span> ${escapeHtml(order.payment_status ?? 'pending')}</p>
        ${order.payment_ref ? `<p><span class="muted">Ref:</span> ${escapeHtml(order.payment_ref)}</p>` : ''}
      </section>
    `
    : ''

  const shipmentSection = order.awb_code
    ? `
      <section class="panel">
        <h3>Shipment</h3>
        <p><span class="muted">AWB:</span> ${escapeHtml(order.awb_code)}</p>
        ${order.courier_name ? `<p><span class="muted">Courier:</span> ${escapeHtml(order.courier_name)}</p>` : ''}
        ${order.tracking_url ? `<p><span class="muted">Tracking:</span> ${escapeHtml(order.tracking_url)}</p>` : ''}
      </section>
    `
    : ''

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)} ${escapeHtml(order.order_number)}</title>
    <style>
      :root {
        --ink: #233238;
        --muted: #69767b;
        --line: #d7ddd8;
        --teal: #2e6672;
        --surface: #faf7f0;
        --bg: #fffdf8;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 32px;
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: var(--ink);
        background: linear-gradient(180deg, #fffdf8 0%, #f7f2e8 100%);
      }
      .sheet {
        max-width: 960px;
        margin: 0 auto;
        background: var(--bg);
        border: 1px solid var(--line);
        border-radius: 20px;
        overflow: hidden;
        box-shadow: 0 14px 40px rgba(35, 50, 56, 0.08);
      }
      .header {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        padding: 24px 28px;
        background: var(--surface);
        border-bottom: 1px solid var(--line);
      }
      .brand {
        margin: 0 0 8px;
        font-size: 13px;
        letter-spacing: .18em;
        text-transform: uppercase;
        color: var(--teal);
        font-weight: 700;
      }
      h1 {
        margin: 0;
        font-size: 30px;
      }
      .sub {
        margin: 6px 0 0;
        color: var(--muted);
      }
      .meta {
        text-align: right;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.7;
      }
      .content {
        padding: 28px;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
        margin-bottom: 18px;
      }
      .panel {
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 16px;
        background: white;
      }
      .panel h3 {
        margin: 0 0 10px;
        font-size: 15px;
      }
      .panel p {
        margin: 4px 0;
        color: var(--ink);
        font-size: 14px;
        line-height: 1.5;
      }
      .muted { color: var(--muted); }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 14px;
      }
      th, td {
        text-align: left;
        padding: 12px 10px;
        border-bottom: 1px solid var(--line);
        vertical-align: top;
      }
      th {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: .12em;
        color: var(--muted);
      }
      .num {
        text-align: right;
        white-space: nowrap;
      }
      .summary {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 8px 16px;
        margin-top: 18px;
        padding-top: 18px;
        border-top: 1px solid var(--line);
      }
      .summary .grand {
        font-size: 18px;
        font-weight: 700;
      }
      .summary strong { justify-self: end; }
      .footer {
        padding: 0 28px 28px;
        color: var(--muted);
        font-size: 12px;
      }
      @media print {
        body { padding: 0; background: white; }
        .sheet { border: 0; border-radius: 0; box-shadow: none; }
      }
    </style>
  </head>
  <body>
    <div class="sheet">
      <div class="header">
        <div>
          <p class="brand">${escapeHtml(input.shopName ?? 'Amiora Diamonds')}</p>
          <h1>${escapeHtml(title)}</h1>
          <p class="sub">${escapeHtml(subtitle)}</p>
        </div>
        <div class="meta">
          <div><strong>${escapeHtml(order.order_number)}</strong></div>
          <div>${escapeHtml(formatDate(order.created_at))}</div>
          <div>${escapeHtml(order.status.replace(/_/g, ' '))}</div>
          ${input.storeLabel ? `<div>${escapeHtml(input.storeLabel)}</div>` : ''}
        </div>
      </div>
      <div class="content">
        <div class="grid">
          <section class="panel">
            <h3>Customer</h3>
            ${order.shipping_address?.full_name ? `<p>${escapeHtml(order.shipping_address.full_name)}</p>` : ''}
            ${order.guest_email ? `<p>${escapeHtml(order.guest_email)}</p>` : ''}
            ${order.shipping_address?.phone ? `<p>${escapeHtml(order.shipping_address.phone)}</p>` : ''}
          </section>
          <section class="panel">
            <h3>${kind === 'packing' ? 'Ship To' : 'Delivery Address'}</h3>
            ${shippingAddress}
          </section>
        </div>
        ${paymentSection}
        <section class="panel">
          <h3>Items</h3>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Variant</th>
                <th class="num">Qty</th>
                ${kind === 'order' ? '<th class="num">Unit</th><th class="num">Line</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </section>
        ${kind === 'order' ? pricingRows : ''}
        ${shipmentSection}
      </div>
      <div class="footer">
        ${kind === 'packing' ? 'Packing slip generated for dispatch.' : 'Order slip generated for customer records.'}
      </div>
    </div>
  </body>
</html>`
}
