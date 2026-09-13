import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface Props {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: Props) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="text-text-3 mb-3 flex flex-wrap items-center gap-1 text-[11.5px]"
    >
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={`${item.label}-${i}`} className="flex items-center gap-1">
            {item.href && !isLast ? (
              <Link href={item.href} className="hover:text-text transition-colors">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? 'text-text-2' : ''}>{item.label}</span>
            )}
            {!isLast ? <ChevronRight className="h-3 w-3" /> : null}
          </span>
        );
      })}
    </nav>
  );
}
