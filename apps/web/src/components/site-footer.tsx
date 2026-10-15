import Image from "next/image";
import Link from "next/link";

export function SiteFooter() {
  return (
    <footer
      id="about"
      className="border-t border-slate-200 bg-white"
    >
      <div className="mx-auto grid max-w-[1440px] gap-10 px-5 py-12 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <div>
          <Link
            href="/"
            prefetch={false}
            aria-label="BLX Store home"
            className="inline-flex"
          >
            <Image
              src="/blx-logo.png"
              alt="BLX"
              width={135}
              height={45}
              className="h-auto w-[115px]"
            />
          </Link>

          <p className="mt-4 max-w-xs text-xs leading-6 text-slate-500">
            A portfolio e-commerce
            demonstration focused on secure
            payments, reliable engineering
            and modern shopping experiences.
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
            Shop
          </p>

          <div className="mt-4 space-y-3 text-sm">
            <Link
              href="/products"
              prefetch={false}
              className="block text-slate-600 hover:text-blue-600"
            >
              All products
            </Link>

            <Link
              href="/products?inStock=true"
              prefetch={false}
              className="block text-slate-600 hover:text-blue-600"
            >
              Available now
            </Link>

            <Link
              href="/cart"
              prefetch={false}
              className="block text-slate-600 hover:text-blue-600"
            >
              Shopping cart
            </Link>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
            Account
          </p>

          <div className="mt-4 space-y-3 text-sm">
            <Link
              href="/account"
              prefetch={false}
              className="block text-slate-600 hover:text-blue-600"
            >
              My account
            </Link>

            <Link
              href="/account/orders"
              prefetch={false}
              className="block text-slate-600 hover:text-blue-600"
            >
              My orders
            </Link>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
            Project
          </p>

          <p className="mt-4 text-xs leading-6 text-slate-500">
            Educational and portfolio
            demonstration. Product data and
            transactions are synthetic.
          </p>
        </div>
      </div>

      <div className="border-t border-slate-200">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-2 px-5 py-5 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <p>
            © 2026 BLX Store.
          </p>

          <p>
            Engineering portfolio project.
          </p>
        </div>
      </div>
    </footer>
  );
}
