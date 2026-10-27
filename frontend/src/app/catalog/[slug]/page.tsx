import type { Route } from 'next';
import type { ProductDetail } from '@bom/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { cartProduct } from '@/components/catalog/product-card';
import { ProductBackLink, ProductGallery, ProductOrder } from '@/components/catalog/product-client';
import { ProductRail } from '@/components/catalog/product-rail';
import { Price } from '@/components/currency';
import { ArrowRightIcon, SparkleIcon } from '@/components/icons';
import { JsonLd } from '@/components/json-ld';
import { card } from '@/components/ui';
import { copy } from '@/content/copy';
import { cn } from '@/lib/cn';
import { getProduct, resolveRedirect } from '@/lib/data';
import { BASE_OPEN_GRAPH, breadcrumbsLd, excerpt, imageUrl, productLd } from '@/lib/seo';

type Params = { params: Promise<{ slug: string }> };

async function loadProduct(slug: string): Promise<ProductDetail> {
  const product = await getProduct(slug);
  if (product) return product;
  const target = await resolveRedirect(`/catalog/${slug}`);
  if (target)
    (target.statusCode === 301 || target.statusCode === 308 ? permanentRedirect : redirect)(
      target.toPath as Route,
    );
  notFound();
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const product = await getProduct((await params).slug);
  if (!product) return {};
  return {
    title: product.seo.title ?? `${product.name}, ${product.brand}`,
    description: product.seo.description ?? excerpt(`${product.purpose}. ${product.description}`),
    alternates: { canonical: `/catalog/${product.slug}` },
    openGraph: { ...BASE_OPEN_GRAPH, title: product.seo.title ?? product.name },
  };
}

export default async function ProductPage({ params }: Params) {
  const product = await loadProduct((await params).slug);
  const images = product.images.length ? product.images : product.image ? [product.image] : [];

  return (
    <>
      <JsonLd
        data={[
          breadcrumbsLd([
            { name: copy.common.toHome, path: '/' },
            { name: copy.header.tabs.catalog, path: '/catalog' },
            { name: product.name, path: `/catalog/${product.slug}` },
          ]),
          productLd({
            name: product.name,
            description: excerpt(product.description || product.purpose, 500),
            path: `/catalog/${product.slug}`,
            brand: product.brand,
            priceKgs: product.priceKgs,
            inStock: product.inStock,
            images: images.map((image) => imageUrl(image)),
            sku: product.slug,
          }),
        ]}
      />

      <div className="mx-auto max-w-[1100px] lg:grid lg:grid-cols-[minmax(0,520px)_minmax(0,1fr)] lg:gap-12 lg:px-6 lg:pt-6">
        <section className="flex flex-col px-4 pt-2.5 lg:sticky lg:top-[92px] lg:self-start lg:px-0">
          <ProductBackLink />
          <div className="mt-2">
            <ProductGallery images={images} name={product.name} video={product.video} />
          </div>
        </section>

        <div className="min-w-0">
          <section className="flex flex-col px-5 pt-4 lg:px-0 lg:pt-[60px]">
            {product.badge && (
              <span className="mb-2.5 inline-flex h-[26px] items-center gap-[5px] self-start rounded-full bg-accent-soft px-2.5 text-[13px] font-semibold text-accent-ink">
                <SparkleIcon size={12} />
                {product.badge}
              </span>
            )}
            <span className="text-sm text-muted">
              {product.brand} · {product.volume}
            </span>
            <h1 className="mt-1.5 heading text-[calc(28px*var(--fhk))] leading-[1.15] lg:text-[calc(36px*var(--fhk))]">
              {product.name}
            </h1>
            <p className="mt-2 text-base leading-normal text-muted">{product.purpose}</p>
            <span className="mt-3.5 text-[28px] font-semibold tracking-[-0.03em]">
              <Price kgs={product.priceKgs} />
            </span>
            <span className="mt-2 flex items-center gap-2 text-sm text-muted">
              <span className={cn('size-[7px] rounded-full', product.inStock ? 'bg-stock' : 'bg-preorder')} />
              {product.inStock ? copy.common.inStock : copy.common.preorder}
            </span>
            <ProductOrder product={cartProduct(product)} />
          </section>

          <ProductRail
            className="pt-7 lg:px-0"
            titleClassName="text-[calc(22px*var(--fhk))] leading-[1.2] lg:text-[calc(26px*var(--fhk))]"
            title={copy.product.related}
            products={product.related}
            link={false}
            buttonLabel={copy.cart.addRelated}
          />

          {/* README §6: «Входит в программы» → «Описание» → «Состав» → «Как использовать»; «О бренде» (ours) before «Описание». */}
          <section className="flex flex-col gap-2.5 px-4 pt-[26px] lg:px-0">
            {product.programs.length > 0 && (
              <div className={cn(card, 'flex flex-col gap-3 p-[18px]')}>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[17px] font-semibold">{copy.product.inPrograms}</span>
                  <span className="text-[15px] text-muted">{copy.product.inProgramsLead}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {product.programs.map((program) => (
                    <Link
                      key={program.slug}
                      href={`/programs/${program.slug}`}
                      className="tap inline-flex h-10 items-center gap-1.5 rounded-full bg-accent-soft px-3.5 text-sm font-semibold text-accent-ink"
                    >
                      {program.title}
                      <ArrowRightIcon size={14} strokeWidth={2.4} />
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {product.brandDescription && (
              <TextCard title={copy.product.aboutBrand(product.brand)} text={product.brandDescription} />
            )}
            {product.description && <TextCard title={copy.product.description} text={product.description} />}
            {product.inci && <TextCard title={copy.product.composition} text={product.inci} />}
            {product.howToUse && <TextCard title={copy.product.howToUse} text={product.howToUse} />}
          </section>
        </div>
      </div>
    </>
  );
}

function TextCard({ title, text }: { title: string; text: string }) {
  return (
    <div className={cn(card, 'flex flex-col gap-2 px-[18px] pt-[18px] pb-5')}>
      <h2 className="text-[17px] font-semibold">{title}</h2>
      <p className="text-base leading-[1.55] text-pretty whitespace-pre-line text-muted">{text}</p>
    </div>
  );
}
