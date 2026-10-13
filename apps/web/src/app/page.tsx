import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-slate-950">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-8">
          <Link
            href="/"
            className="text-2xl font-semibold tracking-tight"
            aria-label="BLX Store home"
          >
            BLX
            <span className="text-blue-600"> Store</span>
          </Link>

          <nav
            className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex"
            aria-label="Main navigation"
          >
            <a className="transition hover:text-slate-950" href="#products">
              Products
            </a>

            <a className="transition hover:text-slate-950" href="#about">
              About
            </a>

            <a className="transition hover:text-slate-950" href="#support">
              Support
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="hidden rounded-lg px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 sm:inline-flex"
            >
              Sign in
            </button>

            <button
              type="button"
              className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Cart
            </button>
          </div>
        </div>
      </header>

      <section className="border-b border-slate-200">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-24 lg:grid-cols-2 lg:items-center lg:px-8 lg:py-32">
          <div>
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">
              Technology made simple
            </p>

            <h1 className="max-w-2xl text-5xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
              Electronics selected for work, play, and everything in between.
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
              Explore a carefully selected catalog of computers, components,
              peripherals, and accessories through a modern and secure shopping
              experience.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href="#products"
                className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
              >
                Shop products
              </a>

              <a
                href="#about"
                className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
              >
                Learn more
              </a>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 p-8 text-white shadow-xl">
            <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-blue-500/30 blur-3xl" />
            <div className="absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-indigo-500/20 blur-3xl" />

            <div className="relative">
              <p className="text-sm font-medium text-blue-300">BLX Store</p>

              <h2 className="mt-4 text-3xl font-semibold tracking-tight">
                Built around a better shopping experience.
              </h2>

              <div className="mt-10 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <p className="font-semibold">Secure checkout</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    A payment experience designed with security and reliability
                    in mind.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <p className="font-semibold">AI-assisted shopping</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    Product discovery and comparison supported by an intelligent
                    shopping assistant.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="products"
        className="mx-auto max-w-7xl px-6 py-20 lg:px-8"
      >
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">
            Featured categories
          </p>

          <h2 className="mt-3 text-3xl font-semibold tracking-tight">
            Find the right technology for your setup.
          </h2>

          <p className="mt-4 text-slate-600">
            Product data will be connected to the BLX Store catalog as the
            platform evolves.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {[
            {
              title: "Computers",
              description:
                "Laptops and desktops for productivity, development, and gaming.",
            },
            {
              title: "Components",
              description:
                "Hardware selected for upgrades, new builds, and performance.",
            },
            {
              title: "Peripherals",
              description:
                "Keyboards, mice, headsets, and accessories for every workspace.",
            },
          ].map((category) => (
            <article
              key={category.title}
              className="rounded-2xl border border-slate-200 p-6 transition hover:border-slate-300 hover:shadow-sm"
            >
              <h3 className="text-lg font-semibold">{category.title}</h3>

              <p className="mt-3 text-sm leading-6 text-slate-600">
                {category.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <footer
        id="about"
        className="border-t border-slate-200 bg-slate-50"
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-10 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <p>© 2026 BLX Store. Portfolio demonstration project.</p>

          <p id="support">Built for learning, engineering, and portfolio use.</p>
        </div>
      </footer>
    </main>
  );
}
