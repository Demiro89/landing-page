'use client';

import { FontAwesomeIcon, type FontAwesomeIconProps } from '@fortawesome/react-fontawesome';
import { config, type IconDefinition } from '@fortawesome/fontawesome-svg-core';
import '@fortawesome/fontawesome-svg-core/styles.css';
import type { CSSProperties } from 'react';
import {
  faArrowLeft, faArrowRight, faArrowUpRightFromSquare, faBan, faBell, faBolt,
  faBoxOpen, faBoxesStacked, faCalendar, faCalendarCheck, faCalendarDays,
  faCalendarXmark, faChartBar, faCheck, faChevronRight, faChevronUp, faChevronDown,
  faCircleCheck, faCircleInfo, faCircleQuestion, faCircleXmark, faClock,
  faClockRotateLeft, faCoins, faCopy, faCreditCard, faEnvelope,
  faEnvelopeCircleCheck, faEnvelopeOpenText, faEuroSign, faFolderOpen, faGaugeHigh,
  faHashtag, faHeadset, faHourglassHalf, faInbox, faKey, faLayerGroup, faList,
  faLock, faMagnifyingGlass, faPaperPlane, faPause, faPen, faPlay, faPlayCircle,
  faPlus, faQuoteLeft, faReceipt, faRightFromBracket, faRightToBracket,
  faRotateRight, faServer, faShieldHalved, faSpinner, faStar, faTrash,
  faTriangleExclamation, faUnlock, faUser, faUserCheck, faUserGroup, faUsers,
  faWandMagicSparkles, faXmark,
} from '@fortawesome/free-solid-svg-icons';
import {
  faCopy as farCopy, faClock as farClock, faFolderOpen as farFolderOpen,
  faCalendarCheck as farCalendarCheck,
} from '@fortawesome/free-regular-svg-icons';
import { faGoogle, faPaypal, faTelegram, faYoutube } from '@fortawesome/free-brands-svg-icons';

// La CSS de FA est importée explicitement ci-dessus — pas d'injection auto.
config.autoAddCss = false;

const SOLID: Record<string, IconDefinition> = {
  'arrow-left': faArrowLeft, 'arrow-right': faArrowRight,
  'arrow-up-right-from-square': faArrowUpRightFromSquare, ban: faBan, bell: faBell,
  bolt: faBolt, 'box-open': faBoxOpen, 'boxes-stacked': faBoxesStacked,
  calendar: faCalendar, 'calendar-check': faCalendarCheck, 'calendar-days': faCalendarDays,
  'calendar-xmark': faCalendarXmark, 'chart-bar': faChartBar, check: faCheck,
  'chevron-right': faChevronRight, 'chevron-up': faChevronUp, 'chevron-down': faChevronDown,
  'circle-check': faCircleCheck, 'circle-info': faCircleInfo,
  'circle-question': faCircleQuestion, 'circle-xmark': faCircleXmark, clock: faClock,
  'clock-rotate-left': faClockRotateLeft, coins: faCoins, copy: faCopy,
  'credit-card': faCreditCard, envelope: faEnvelope,
  'envelope-circle-check': faEnvelopeCircleCheck, 'envelope-open-text': faEnvelopeOpenText,
  'euro-sign': faEuroSign, 'folder-open': faFolderOpen, 'gauge-high': faGaugeHigh,
  hashtag: faHashtag, headset: faHeadset, 'hourglass-half': faHourglassHalf,
  inbox: faInbox, key: faKey, 'layer-group': faLayerGroup, list: faList, lock: faLock,
  'magnifying-glass': faMagnifyingGlass, 'paper-plane': faPaperPlane, pause: faPause,
  pen: faPen, play: faPlay, 'play-circle': faPlayCircle, plus: faPlus,
  'quote-left': faQuoteLeft, receipt: faReceipt, 'right-from-bracket': faRightFromBracket,
  'right-to-bracket': faRightToBracket, 'rotate-right': faRotateRight, server: faServer,
  'shield-halved': faShieldHalved, spinner: faSpinner, star: faStar, trash: faTrash,
  'triangle-exclamation': faTriangleExclamation, unlock: faUnlock, user: faUser,
  'user-check': faUserCheck, 'user-group': faUserGroup, users: faUsers,
  'wand-magic-sparkles': faWandMagicSparkles, xmark: faXmark,
};

const REGULAR: Record<string, IconDefinition> = {
  copy: farCopy, clock: farClock, 'folder-open': farFolderOpen,
  'calendar-check': farCalendarCheck,
};

const BRANDS: Record<string, IconDefinition> = {
  google: faGoogle, paypal: faPaypal, telegram: faTelegram, youtube: faYoutube,
};

const MODIFIERS = new Set(['fa-solid', 'fa-brands', 'fa-regular', 'fa-spin']);

/**
 * Remplace les anciennes balises <i className="fa-..."/>.
 * Parse la chaîne className (statique ou dynamique) et rend une icône SVG.
 */
export default function Icon({
  className = '',
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  const parts = className.split(/\s+/).filter(Boolean);
  const spin = parts.includes('fa-spin');
  const variant = parts.includes('fa-brands')
    ? 'brands'
    : parts.includes('fa-regular')
    ? 'regular'
    : 'solid';

  const nameToken = parts.find((p) => p.startsWith('fa-') && !MODIFIERS.has(p));
  const name = nameToken ? nameToken.slice(3) : '';

  const map = variant === 'brands' ? BRANDS : variant === 'regular' ? REGULAR : SOLID;
  const icon = map[name] ?? SOLID[name] ?? BRANDS[name] ?? REGULAR[name];

  if (!icon) return null;

  return (
    <FontAwesomeIcon
      icon={icon}
      spin={spin}
      style={style as FontAwesomeIconProps['style']}
    />
  );
}
