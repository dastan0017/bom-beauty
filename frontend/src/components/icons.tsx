import type { ReactNode, SVGProps } from 'react';

// Icons from design/Bom Beauty Prototype.dc.html (24×24 grid). Decorative: always aria-hidden.

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  size?: number;
}

function stroke(children: ReactNode, defaultWidth = 2.2) {
  return function StrokeIcon({ size = 18, strokeWidth = defaultWidth, ...props }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
        {...props}
      >
        {children}
      </svg>
    );
  };
}

function filled(children: ReactNode) {
  return function FilledIcon({ size = 18, ...props }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        focusable="false"
        {...props}
      >
        {children}
      </svg>
    );
  };
}

const SPARKLE = 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z';
const WHATSAPP_RING =
  'M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2z';
const WHATSAPP_HANDSET =
  'm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3.9 2.5 1 2.7.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z';

export const SparkleIcon = filled(<path d={SPARKLE} />);
export const SparkleOutlineIcon = stroke(<path d={SPARKLE} />, 2);
export const WhatsAppIcon = filled(<path d={`${WHATSAPP_RING}${WHATSAPP_HANDSET}`} />);
export const WhatsAppBubbleIcon = filled(<path d={WHATSAPP_RING} />);
export const PlayIcon = filled(
  <path d="M8 5.2v13.6c0 .8.9 1.3 1.5.8l10-6.8c.6-.4.6-1.2 0-1.6l-10-6.8C8.9 3.9 8 4.4 8 5.2z" />,
);
export const PlayTriangleIcon = filled(<path d="M7 4.5v15l13-7.5z" />);

export const CloseIcon = stroke(<path d="M6 6l12 12M18 6L6 18" />);
export const ChevronDownIcon = stroke(<path d="M6 9l6 6 6-6" />, 2.4);
export const ChevronLeftIcon = stroke(<path d="M15 6l-6 6 6 6" />);
export const ChevronRightIcon = stroke(<path d="M9 6l6 6-6 6" />);
export const ArrowRightIcon = stroke(<path d="M5 12h14M13 6l6 6-6 6" />);
export const ArrowLeftIcon = stroke(<path d="M19 12H5M11 6l-6 6 6 6" />);
export const CheckIcon = stroke(<path d="M5 12.5l4.5 4.5L19 7.5" />, 3);
export const DashIcon = stroke(<path d="M6 12h12" />, 3);
export const MinusIcon = stroke(<path d="M5 12h14" />, 2.4);
export const PlusIcon = stroke(<path d="M12 5v14M5 12h14" />, 2.4);
export const SearchIcon = stroke(
  <>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-4.2-4.2" />
  </>,
);
export const DownloadIcon = stroke(<path d="M12 4v12M7 11l5 5 5-5M5 20h14" />);
/** Catalog filters button (ours; the design has no filter sheet). */
export const FiltersIcon = stroke(
  <>
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15" cy="7" r="2" />
    <circle cx="9" cy="17" r="2" />
  </>,
  2,
);
export const WandIcon = stroke(
  <>
    <path d="M4 20l9.5-9.5" />
    <path d="M16 3.5l1.1 3.1 3.1 1.1-3.1 1.1L16 12l-1.1-3.2-3.1-1.1 3.1-1.1z" fill="currentColor" />
    <path d="M6.5 4.5v3M5 6h3" />
  </>,
  2,
);
export const DropIcon = stroke(
  <path d="M12 3.5c3.2 4.1 6 7.3 6 10.6a6 6 0 0 1-12 0c0-3.3 2.8-6.5 6-10.6z" />,
  1.7,
);
export const BagIcon = stroke(
  <>
    <path d="M5.5 8h13l-1 12h-11z" />
    <path d="M9 8V7a3 3 0 0 1 6 0v1" />
  </>,
  1.7,
);
export const BoxIcon = stroke(
  <>
    <path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z" />
    <path d="M3.5 7.5L12 12l8.5-4.5M12 12v9" />
  </>,
  1.7,
);
export const TruckIcon = stroke(
  <>
    <path d="M2.5 5.5h11v10h-11z" />
    <path d="M13.5 9.5h4l3 3.2v2.8h-7" />
    <circle cx="6.5" cy="17.5" r="2" />
    <circle cx="17" cy="17.5" r="2" />
  </>,
  1.8,
);
export const FlaskIcon = stroke(
  <>
    <path d="M9 3h6M10 3v6.2L4.9 18.1A1.9 1.9 0 0 0 6.5 21h11a1.9 1.9 0 0 0 1.6-2.9L14 9.2V3" />
    <path d="M7.4 15h9.2" />
  </>,
  1.9,
);
export const TrashIcon = stroke(<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13" />, 2);
export const ClipboardIcon = stroke(
  <>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <path d="M9 2.5h6V6H9z" />
    <path d="M9 13.5l2 2 4-4" />
  </>,
  1.8,
);
export const TrendIcon = stroke(
  <>
    <path d="M3 17l6-6 4 4 8-8" />
    <path d="M15 7h6v6" />
  </>,
  1.8,
);
export const RepeatIcon = stroke(
  <>
    <path d="M17 2l4 4-4 4" />
    <path d="M3 11V9a3 3 0 0 1 3-3h15" />
    <path d="M7 22l-4-4 4-4" />
    <path d="M21 13v2a3 3 0 0 1-3 3H3" />
  </>,
  1.8,
);
export const ChatIcon = stroke(<path d="M4 5h16v11H8l-4 4z" />, 2);
export const PhoneIcon = stroke(
  <path d="M6.6 3.5h2.6l1.4 4-2 1.3a11 11 0 0 0 6.6 6.6l1.3-2 4 1.4v2.6a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2z" />,
  2,
);
export const InstagramIcon = stroke(
  <>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
  </>,
  1.8,
);
